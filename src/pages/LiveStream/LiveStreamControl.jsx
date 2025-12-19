import React, { useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import { useToast } from '../../hooks/useToast';
import { LiveTv, Comment, Inventory2, ThumbUp, Refresh, Schedule, Flag, PushPin, MoreVert } from '@mui/icons-material';
import Loading from '../../components/Loading';
import LiveStreamProducts from './components/LiveStreamProducts';
import { format } from 'date-fns';
import io from 'socket.io-client';

// Normalize socket URL
const getSocketURL = () => {
    const url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return url.replace(/\/$/, '');
};
const SOCKET_URL = getSocketURL();

const LiveStreamControl = () => {
    const { user } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { livestreamId } = useParams();

    // State
    const [isLoading, setIsLoading] = useState(false);
    const [livestream, setLivestream] = useState(null);
    const [reactions, setReactions] = useState(null);
    const [comments, setComments] = useState([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [currentDuration, setCurrentDuration] = useState('00:00:00');
    const socketRef = useRef(null);

    // Track ongoing API calls to prevent duplicate requests
    const ongoingCallsRef = useRef({
        updateViewerCount: false,
    });

    // Format date helper function
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
        } catch (error) {
            return dateString;
        }
    };

    // Load livestream details
    const loadLivestreamDetails = async () => {
        try {
            setIsLoading(true);

            const response = await Api.livestream.getById(livestreamId);

            if (response.success) {
                const { livestream: livestreamData, products: productsData, comments: commentsData, reactions: reactionsData } = response.data || {};

                if (!livestreamData) {
                    showToast('Livestream data not found in response', 'error');
                    navigate('/livestream');
                    return;
                }

                setLivestream({
                    _id: livestreamData._id,
                    hostId: livestreamData.hostId,
                    title: livestreamData.title,
                    description: livestreamData.description,
                    image: livestreamData.image,
                    roomName: livestreamData.roomName,
                    status: livestreamData.status,
                    startTime: livestreamData.startTime,
                    endTime: livestreamData.endTime,
                    createdAt: livestreamData.createdAt,
                    updatedAt: livestreamData.updatedAt,
                    peakViewers: livestreamData.peakViewers ?? 0,
                    peakViewersAt: livestreamData.peakViewersAt || null,
                    minViewers: livestreamData.minViewers ?? 0,
                    minViewersAt: livestreamData.minViewersAt || null,
                    // For live streams, use currentViewers; for ended streams, use totalViewers or 0
                    currentViewers: livestreamData.status === 'live'
                        ? (livestreamData.currentViewers ?? 0)
                        : (livestreamData.totalViewers ?? 0),
                    totalViewers: livestreamData.totalViewers ?? 0,
                    duration: livestreamData.duration
                });

                // Sort comments: pinned first, then by createdAt (oldest first)
                const sortedComments = Array.isArray(commentsData)
                    ? commentsData.sort((a, b) => {
                        const aIsPinned = a.isPinned === true;
                        const bIsPinned = b.isPinned === true;

                        if (aIsPinned && !bIsPinned) return -1;
                        if (!aIsPinned && bIsPinned) return 1;

                        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return dateA - dateB;
                    })
                    : [];
                setComments(sortedComments);
                setReactions(reactionsData || null);
            } else {
                showToast(response.message || 'Unable to load livestream information', 'error');
                navigate('/livestream');
            }
        } catch (error) {
            console.error('Error loading livestream details:', error);
            showToast('Error loading livestream information', 'error');
            navigate('/livestream');
        } finally {
            setIsLoading(false);
        }
    };

    // Refresh data
    const handleRefresh = async () => {
        setIsRefreshing(true);
        await loadLivestreamDetails();
        setTimeout(() => setIsRefreshing(false), 500);
    };

    // Handle viewer count update from socket (real-time) - only update currentViewers
    // Peak and min are calculated by backend and synced via periodic API calls
    const handleViewerCountUpdate = useCallback((count) => {
        setLivestream(prev => {
            if (!prev) {
                return prev;
            }

            // Only update currentViewers from socket
            // Peak and min come from backend via periodic sync
            const currentCount = typeof count === 'number' ? count : 0;

            if (prev.currentViewers === currentCount) {
                return prev;
            }

            return {
                ...prev,
                currentViewers: currentCount
            };
        });
    }, []);

    // Setup Socket.IO for realtime updates
    useEffect(() => {
        if (!livestreamId || !livestream || livestream.status !== 'live') {
            return;
        }

        // Create socket with proper configuration
        const socket = io(SOCKET_URL, {
            transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: false,
            autoConnect: true,
            // Additional options for better compatibility
            upgrade: true,
            rememberUpgrade: true,
        });

        socketRef.current = socket;

        let isConnected = false;
        let joinRoomAttempted = false;

        const joinRoom = () => {
            if (socket.connected && !joinRoomAttempted && livestreamId) {
                joinRoomAttempted = true;
                socket.emit('joinLivestreamRoom', livestreamId);
            }
        };

        socket.on('connect', () => {
            isConnected = true;
            joinRoomAttempted = false;
            // Join livestream room to receive viewer count updates
            joinRoom();
        });

        socket.on('disconnect', (reason) => {
            isConnected = false;
            joinRoomAttempted = false;
            // Allow automatic reconnection
        });

        socket.on('connect_error', (error) => {
            // Socket.IO will automatically retry
            // Only log after multiple failures
            if (socket.io.reconnecting) {
                // Reconnecting, don't log
            }
        });

        socket.on('reconnect', (attemptNumber) => {
            isConnected = true;
            // Re-join room after reconnection
            joinRoom();
        });

        // Listen for comment events
        socket.on('comment:added', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        socket.on('comment:deleted', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        socket.on('comment:pinned', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        socket.on('comment:unpinned', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        // Listen for product events
        socket.on('product:added', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        socket.on('product:removed', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        socket.on('product:pinned', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        socket.on('product:unpinned', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        // Listen for reaction events
        socket.on('reaction:added', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        socket.on('reaction:updated', (data) => {
            if (data?.liveId === livestreamId) {
                loadLivestreamDetails();
            }
        });

        // Listen for viewer count updates from backend
        socket.on('viewer:count', (data) => {
            try {
                if (data?.liveId === livestreamId && typeof data?.count === 'number') {
                    handleViewerCountUpdate(data.count);
                }
            } catch (e) {
                console.error('Error handling viewer count update:', e);
            }
        });

        // Cleanup
        return () => {
            // Cleanup function
            try {
                // Remove all listeners first
                socket.off('connect');
                socket.off('disconnect');
                socket.off('comment:added');
                socket.off('comment:deleted');
                socket.off('comment:pinned');
                socket.off('comment:unpinned');
                socket.off('product:added');
                socket.off('product:removed');
                socket.off('product:pinned');
                socket.off('product:unpinned');
                socket.off('reaction:added');
                socket.off('reaction:updated');
                socket.off('viewer:count');
                socket.off('connect_error');
                socket.off('reconnect');

                // Leave room before disconnecting (only if connected)
                if (socket.connected && joinRoomAttempted) {
                    socket.emit('leaveLivestreamRoom', livestreamId);
                    // Wait a bit for the emit to complete
                    setTimeout(() => {
                        socket.disconnect();
                    }, 100);
                } else {
                    socket.disconnect();
                }
            } catch (error) {
                // Force disconnect if cleanup fails
                try {
                    socket.disconnect();
                } catch (e) {
                    // Ignore
                }
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [livestreamId, livestream?._id, livestream?.status, handleViewerCountUpdate]);

    // Periodic sync for viewer count (fallback and peak/min tracking) - more frequent for faster updates
    useEffect(() => {
        if (!livestream || livestream.status !== 'live') return;

        // Copy ref to variable for cleanup
        const ongoingCalls = ongoingCallsRef.current;

        const syncViewerCount = async () => {
            try {
                // Prevent duplicate calls
                if (ongoingCalls.updateViewerCount) {
                    return;
                }
                ongoingCalls.updateViewerCount = true;

                try {
                    const response = await Api.livestream.getById(livestreamId);
                    if (response.success) {
                        // Backend returns: { success: true, data: { livestream: {...} } }
                        const currentStream = response.data?.livestream;

                        if (currentStream) {
                            const newViewers = currentStream.currentViewers ?? 0;
                            const backendPeak = currentStream.peakViewers ?? 0;
                            const backendMin = currentStream.minViewers ?? 0;

                            // Get peak/min from backend (backend calculates real-time)
                            setLivestream(prev => {
                                if (!prev) return prev;

                                // Check if any value changed
                                const hasChanges =
                                    prev.currentViewers !== newViewers ||
                                    prev.peakViewers !== backendPeak ||
                                    prev.minViewers !== backendMin;

                                if (!hasChanges) {
                                    return prev;
                                }

                                return {
                                    ...prev,
                                    currentViewers: newViewers,
                                    peakViewers: backendPeak,
                                    minViewers: backendMin
                                };
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error syncing viewer count:', error);
                } finally {
                    ongoingCalls.updateViewerCount = false;
                }
            } catch (error) {
                console.error('Error in syncViewerCount:', error);
            }
        };

        // Initial sync
        syncViewerCount();

        // Sync every 5 seconds for faster updates (was 10 seconds)
        const interval = setInterval(syncViewerCount, 5000);

        return () => {
            clearInterval(interval);
            // Reset flag on unmount
            ongoingCalls.updateViewerCount = false;
        };
    }, [livestream, livestreamId, livestream?.status]);

    // Initial load
    useEffect(() => {
        loadLivestreamDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [livestreamId]);

    // Update duration in real-time when livestream is live
    useEffect(() => {
        if (!livestream || livestream.status !== 'live' || !livestream.startTime) {
            setCurrentDuration('00:00:00');
            return;
        }

        const startTime = livestream.startTime;
        const updateDuration = () => {
            const start = new Date(startTime);
            const now = new Date();
            const diff = Math.floor((now - start) / 1000);
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;
            setCurrentDuration(`${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
        };

        // Update immediately
        updateDuration();

        // Update every second
        const interval = setInterval(updateDuration, 1000);

        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [livestream?.status, livestream?.startTime]);

    // Handle pin comment
    const handlePinComment = async (commentId) => {
        if (!user || !livestreamId) return;

        const isAdmin = user?.role === 'admin' || user?.role === 'manager';
        if (!isAdmin) {
            showToast('Only admins and managers can pin comments', 'error');
            return;
        }

        try {
            const response = await Api.livestream.pinComment(commentId, livestreamId);

            if (response?.success || response?.data?.success) {
                showToast('Comment pinned successfully', 'success');
                await loadLivestreamDetails();
            } else {
                const errorMsg = response?.message || response?.data?.message || 'Unable to pin comment';
                showToast(errorMsg, 'error');
            }
        } catch (error) {
            const errorMsg = error?.response?.data?.message || error?.message || 'Error pinning comment';
            showToast(errorMsg, 'error');
        }
    };

    // Handle unpin comment
    const handleUnpinComment = async (commentId) => {
        if (!user || !livestreamId) return;

        const isAdmin = user?.role === 'admin' || user?.role === 'manager';
        if (!isAdmin) {
            showToast('Only admins and managers can unpin comments', 'error');
            return;
        }

        try {
            const response = await Api.livestream.unpinComment(commentId, livestreamId);

            if (response?.success || response?.data?.success) {
                showToast('Comment unpinned successfully', 'success');
                await loadLivestreamDetails();
            } else {
                const errorMsg = response?.message || response?.data?.message || 'Unable to unpin comment';
                showToast(errorMsg, 'error');
            }
        } catch (error) {
            const errorMsg = error?.response?.data?.message || error?.message || 'Error unpinning comment';
            showToast(errorMsg, 'error');
        }
    };

    // Handle hide/delete comment
    const handleHideComment = async (commentId) => {
        if (!user || !livestreamId) return;

        try {
            const response = await Api.livestream.hideComment(commentId);

            if (response?.success) {
                showToast('Comment deleted successfully', 'success');
                await loadLivestreamDetails();
            } else {
                const errorMsg = response?.message || 'Unable to delete comment';
                showToast(errorMsg, 'error');
            }
        } catch (error) {
            const errorMsg = error?.response?.data?.message || error?.message || 'Error deleting comment';
            showToast(errorMsg, 'error');
        }
    };

    // Handle submit comment
    const handleSubmitComment = async (commentText) => {
        if (!user || !livestreamId) return;

        if (!commentText || !commentText.trim()) {
            showToast('Please enter a comment', 'error');
            return;
        }

        try {
            const response = await Api.livestream.addComment({
                liveId: livestreamId,
                commentText: commentText.trim()
            });

            if (response?.success || response?.data?.success) {
                showToast('Comment added successfully', 'success');
                await loadLivestreamDetails();
            } else {
                const errorMsg = response?.message || response?.data?.message || 'Unable to add comment';
                showToast(errorMsg, 'error');
            }
        } catch (error) {
            const errorMsg = error?.response?.data?.message || error?.message || 'Error adding comment';
            showToast(errorMsg, 'error');
        }
    };

    // Get status badge
    const getStatusBadge = (status) => {
        const badges = {
            'live': {
                className: 'bg-gradient-to-r from-red-400 to-red-600 text-white border border-red-500',
                icon: <LiveTv className="w-4 h-4" />,
                text: 'Live'
            },
            'ended': {
                className: 'bg-gradient-to-r from-gray-400 to-gray-600 text-white border border-gray-500',
                icon: <Flag className="w-4 h-4" />,
                text: 'Ended'
            },
            'scheduled': {
                className: 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white border border-blue-500',
                icon: <Schedule className="w-4 h-4" />,
                text: 'Scheduled'
            }
        };

        return badges[status] || badges['ended'];
    };

    if (isLoading && !livestream) {
        return (
            <Loading
                type="page"
                size="large"
                message="Loading livestream management..."
                subMessage="Please wait a moment"
                fullScreen={true}
            />
        );
    }

    if (!livestream) {
        return (
            <div className="p-6">
                <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                    <h3 className="text-xl font-semibold text-gray-900 mb-4">Livestream not found</h3>
                    <p className="text-gray-600 mb-6">This livestream does not exist or has been deleted.</p>
                    <button
                        onClick={() => navigate('/livestream')}
                        className="inline-flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Back to List
                    </button>
                </div>
            </div>
        );
    }

    const statusBadge = getStatusBadge(livestream.status);

    // Calculate duration
    const calculateDuration = (startTime, endTime, durationMs = null) => {
        if (durationMs !== null && durationMs > 0) {
            const diff = Math.floor(durationMs / 1000);
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;
            return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        }
        if (!startTime) return '00:00:00';
        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
        const diff = Math.floor((end - start) / 1000);
        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6 overflow-x-hidden flex flex-col">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">Livestream Management</h1>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-600">{livestream.title || 'Untitled Stream'}</span>
                            <span className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${statusBadge.className}`}>
                                {statusBadge.icon}
                                {statusBadge.text}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
                    {livestream.status !== 'ended' && (
                        <button
                            onClick={handleRefresh}
                            disabled={isRefreshing}
                            className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                        >
                            {isRefreshing ? (
                                <>
                                    <div className="animate-spin rounded-full h-3 w-3 lg:h-4 lg:w-4 border-2 border-white border-t-transparent"></div>
                                    <span className="font-medium">Loading...</span>
                                </>
                            ) : (
                                <>
                                    <Refresh className="w-3 h-3 lg:w-4 lg:h-4" />
                                    <span className="font-medium">Refresh</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content - Left: Stream Info/Stats/Reactions, Right: Products/Comments */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 mb-4 lg:mb-6 flex-1 min-h-0">
                {/* Left Side: Stream Info, View Stats, and Reactions */}
                <div className="lg:col-span-3 backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-5 min-w-0 overflow-hidden flex flex-col" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                    <div className="space-y-3 lg:space-y-4 flex-1 overflow-y-auto min-h-0">
                        {/* Livestream Info Card */}
                        <div className="bg-white rounded-lg border border-gray-200 p-3 lg:p-4 shrink-0">
                            <div className="flex items-center gap-2 mb-3">
                                <LiveTv className="w-4 h-4 text-blue-600 shrink-0" />
                                <h2 className="text-sm font-bold text-gray-900 truncate">LIVESTREAM INFO</h2>
                            </div>
                            <div className="space-y-2.5">
                                {/* Duration */}
                                <div className="flex items-center justify-between pb-2 border-b border-gray-200 gap-2">
                                    <span className="text-xs font-medium text-gray-600 shrink-0">Duration</span>
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="text-base font-bold text-green-600 truncate">
                                            {livestream.status === 'live' ? currentDuration : calculateDuration(livestream.startTime, livestream.endTime, livestream.duration)}
                                        </span>
                                        {livestream.status === 'live' && (
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                                                <span className="text-[10px] font-bold text-red-600">LIVE</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Started */}
                                <div className="flex items-center justify-between pb-2 border-b border-gray-200 gap-2">
                                    <span className="text-xs font-medium text-gray-600 shrink-0">Started</span>
                                    <span className="text-xs text-gray-700 truncate text-right">
                                        {formatDate(livestream.startTime)}
                                    </span>
                                </div>

                                {/* Host */}
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-medium text-gray-600 shrink-0">Host</span>
                                    <span className="text-xs text-gray-700 truncate text-right">
                                        {typeof livestream.hostId === 'object' && livestream.hostId
                                            ? (livestream.hostId.name || livestream.hostId.username || 'Unknown')
                                            : 'Unknown'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Viewer Stats Card */}
                        <div className="bg-white rounded-lg border border-gray-200 p-3 lg:p-4 shrink-0">
                            <div className="flex items-center gap-3">
                                {/* Min Viewers */}
                                <div className="text-center min-w-0">
                                    <div className="text-xs text-gray-500 font-medium">Min</div>
                                    <div className="text-base font-bold text-gray-900">{livestream.minViewers || 0}</div>
                                </div>
                                <div className="h-6 w-px bg-gray-300"></div>
                                {/* Peak Viewers */}
                                <div className="text-center min-w-0">
                                    <div className="text-xs text-gray-500 font-medium">Peak</div>
                                    <div className="text-base font-bold text-green-600">{livestream.peakViewers || 0}</div>
                                </div>
                                <div className="h-6 w-px bg-gray-300"></div>
                                {/* Current/Total Viewers */}
                                <div className="text-center min-w-0">
                                    <div className="text-xs text-gray-500 font-medium">Views</div>
                                    <div className="text-base font-bold text-purple-600">
                                        {livestream.status === 'live'
                                            ? (livestream.currentViewers ?? 0)
                                            : (livestream.totalViewers ?? livestream.currentViewers ?? 0)
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Reactions Section */}
                        <div className="bg-white rounded-lg border border-gray-200 p-3 lg:p-4 shrink-0">
                            <div className="flex items-center gap-2 mb-3">
                                <ThumbUp className="w-4 h-4 text-[#A86523] shrink-0" />
                                <h2 className="text-sm font-semibold text-gray-900 truncate">Reactions</h2>
                                {reactions && reactions.total > 0 && (
                                    <span className="px-1.5 py-0.5 bg-green-100 text-green-800 rounded-full text-[10px] font-bold shrink-0">
                                        {reactions.total}
                                    </span>
                                )}
                            </div>
                            <div className="min-w-0 overflow-hidden">
                                <ReactionsTab reactions={reactions} compact={true} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Side: Comments and Products */}
                <div className="lg:col-span-9 backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6 min-w-0 overflow-hidden flex flex-col" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 flex-1 min-h-0" style={{ alignItems: 'stretch' }}>
                        {/* Comments Section */}
                        <div className="min-w-0 overflow-hidden flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-4 shrink-0">
                                <Comment className="w-5 h-5 text-[#A86523] shrink-0" />
                                <h2 className="text-base lg:text-lg font-semibold text-gray-900 truncate">Comments Management</h2>
                            </div>
                            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                                <CommentsTab
                                    comments={comments}
                                    livestreamId={livestreamId}
                                    user={user}
                                    onPinComment={handlePinComment}
                                    onUnpinComment={handleUnpinComment}
                                    onHideComment={handleHideComment}
                                    onSubmitComment={handleSubmitComment}
                                    formatDate={formatDate}
                                    livestreamStatus={livestream?.status}
                                />
                            </div>
                        </div>

                        {/* Products Section */}
                        <div className="min-w-0 overflow-hidden flex flex-col h-full">
                            <div className="flex items-center gap-2 mb-4 shrink-0">
                                <Inventory2 className="w-5 h-5 text-[#A86523] shrink-0" />
                                <h2 className="text-base lg:text-lg font-semibold text-gray-900 truncate">Products Management</h2>
                            </div>
                            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                                <LiveStreamProducts liveId={livestreamId} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Comments Tab Component
const CommentsTab = ({ comments, livestreamId, user, onPinComment, onUnpinComment, onHideComment, onSubmitComment, formatDate, livestreamStatus }) => {
    const [showAllComments, setShowAllComments] = useState(false);
    const [showMenu, setShowMenu] = useState({});
    const [newComment, setNewComment] = useState('');
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);

    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

    const toggleMenu = (commentId) => {
        setShowMenu(prev => ({
            ...prev,
            [commentId]: !prev[commentId]
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newComment.trim() || isSubmittingComment) return;

        setIsSubmittingComment(true);
        try {
            await onSubmitComment(newComment);
            setNewComment('');
        } finally {
            setIsSubmittingComment(false);
        }
    };

    return (
        <div className="h-full flex flex-col">
            {/* Pinned Comments Section - Fixed, no scroll */}
            {comments && comments.some(c => c.isPinned === true) && (
                <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                        <PushPin className="w-4 h-4 text-yellow-600" />
                        <span className="text-yellow-700 text-xs font-bold uppercase tracking-wide">
                            Pinned Messages
                        </span>
                    </div>
                    <div className="space-y-2">
                        {comments
                            .filter(c => c.isPinned === true)
                            .map((comment) => (
                                <CommentItem
                                    key={comment._id}
                                    comment={comment}
                                    user={user}
                                    isAdmin={isAdmin}
                                    onPinComment={onPinComment}
                                    onUnpinComment={onUnpinComment}
                                    onHideComment={onHideComment}
                                    formatDate={formatDate}
                                    showMenu={showMenu[comment._id]}
                                    onToggleMenu={() => toggleMenu(comment._id)}
                                />
                            ))}
                    </div>
                </div>
            )}

            {/* Regular Comments List - With Scroll */}
            {comments && comments.length > 0 ? (
                <div className="overflow-y-auto pr-1" style={{ maxHeight: 'calc(5 * 100px)' }}>
                    <div className="space-y-3">
                        {(showAllComments ? comments : comments.slice(0, 20))
                            .filter(c => !c.isPinned)
                            .map((comment) => (
                                <CommentItem
                                    key={comment._id}
                                    comment={comment}
                                    user={user}
                                    isAdmin={isAdmin}
                                    onPinComment={onPinComment}
                                    onUnpinComment={onUnpinComment}
                                    onHideComment={onHideComment}
                                    formatDate={formatDate}
                                    showMenu={showMenu[comment._id]}
                                    onToggleMenu={() => toggleMenu(comment._id)}
                                />
                            ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center">
                    <Comment className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No comments yet</p>
                </div>
            )}

            {/* Comment Input Form - Only show when livestream is live - Moved to bottom */}
            {livestreamStatus === 'live' && onSubmitComment && (
                <form onSubmit={handleSubmit} className="mt-4 shrink-0">
                    <div className="flex gap-2">
                        <textarea
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            onKeyDown={(e) => {
                                // Allow Enter to submit, but Shift+Enter for new line
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    if (newComment.trim() && !isSubmittingComment) {
                                        handleSubmit(e);
                                    }
                                }
                            }}
                            placeholder="Write a comment..."
                            rows={2}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#A86523] focus:border-transparent resize-none text-sm"
                            disabled={isSubmittingComment}
                        />
                        <button
                            type="submit"
                            disabled={!newComment.trim() || isSubmittingComment}
                            className="w-10 h-10 bg-gradient-to-r from-[#E9A319] to-[#A86523] text-white rounded-lg hover:from-[#A86523] hover:to-[#8B4E1A] disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none flex items-center justify-center"
                        >
                            {isSubmittingComment ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                            ) : (
                                <svg className="w-5 h-5 transform rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                                </svg>
                            )}
                        </button>
                    </div>
                </form>
            )}
        </div>
    );
};

// CommentItem Component for Control Page
const CommentItem = ({ comment, user, isAdmin, onPinComment, onUnpinComment, onHideComment, formatDate, showMenu, onToggleMenu }) => {
    const [showDeleteModal, setShowDeleteModal] = useState(false);

    const isDeleted = comment.isDeleted === true;
    const isPinned = comment.isPinned === true;
    const canPin = isAdmin && !isPinned && !isDeleted;
    const canUnpin = isAdmin && isPinned && !isDeleted;
    const canDelete = isAdmin && !isDeleted;

    return (
        <>
            <div className={`group relative rounded-lg border p-2 transition-all min-h-[80px] ${isPinned
                ? 'bg-yellow-50 border-yellow-300'
                : isDeleted
                    ? 'bg-gray-100 border-gray-300 opacity-60'
                    : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                }`} style={!isPinned && !isDeleted ? { borderColor: '#A86523' } : {}}>
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        {/* Author and badges */}
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                            {comment.senderId && (
                                <span className={`font-semibold text-sm truncate ${isDeleted ? 'text-gray-500' : 'text-gray-900'}`}>
                                    {comment.senderId.name || comment.senderId.username || 'Unknown'}
                                </span>
                            )}
                            {isPinned && (
                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-200 text-yellow-800 border border-yellow-400 shrink-0">
                                    <PushPin className="w-2.5 h-2.5" />
                                    PINNED
                                </span>
                            )}
                            {isDeleted && (
                                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded shrink-0">
                                    Deleted
                                </span>
                            )}
                        </div>

                        {/* Comment text */}
                        <p className={`text-sm break-words mb-1.5 ${isDeleted ? 'text-gray-500' : 'text-gray-700'}`}>
                            {comment.commentText || comment.content}
                        </p>

                        {/* Pin/Unpin/Delete info */}
                        {isPinned && comment.pinBy && (
                            <p className="text-xs text-yellow-600 mb-1">
                                Pinned by: {typeof comment.pinBy === 'object'
                                    ? (comment.pinBy.name || comment.pinBy.username || 'Unknown')
                                    : 'Unknown'}
                                {typeof comment.pinBy === 'object' && comment.pinBy.role && (
                                    <span className="ml-1 text-yellow-500">({comment.pinBy.role})</span>
                                )}
                            </p>
                        )}
                        {!isPinned && comment.unpinBy && (
                            <p className="text-xs text-gray-500 mb-1">
                                Unpinned by: {typeof comment.unpinBy === 'object'
                                    ? (comment.unpinBy.name || comment.unpinBy.username || 'Unknown')
                                    : 'Unknown'}
                                {typeof comment.unpinBy === 'object' && comment.unpinBy.role && (
                                    <span className="ml-1 text-gray-400">({comment.unpinBy.role})</span>
                                )}
                            </p>
                        )}
                        {isDeleted && comment.deletedBy && (
                            <p className="text-xs text-gray-400 mb-1">
                                Deleted by: {typeof comment.deletedBy === 'object'
                                    ? (comment.deletedBy.name || comment.deletedBy.username || 'Unknown')
                                    : 'Unknown'}
                                {typeof comment.deletedBy === 'object' && comment.deletedBy.role && (
                                    <span className="ml-1 text-gray-500">({comment.deletedBy.role})</span>
                                )}
                            </p>
                        )}

                        {/* Timestamp */}
                        <div className="flex items-center gap-2 flex-wrap mt-1.5 pt-1.5 border-t border-gray-200">
                            <span className="text-xs text-gray-500">
                                {formatDate(comment.createdAt)}
                            </span>
                            {isPinned && comment.pinnedAt && (
                                <>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className="text-xs text-yellow-600">
                                        Pinned: {formatDate(comment.pinnedAt)}
                                    </span>
                                </>
                            )}
                            {!isPinned && comment.unpinnedAt && (
                                <>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className="text-xs text-gray-500">
                                        Unpinned: {formatDate(comment.unpinnedAt)}
                                    </span>
                                </>
                            )}
                            {isDeleted && comment.deletedAt && (
                                <>
                                    <span className="text-xs text-gray-400">•</span>
                                    <span className="text-xs text-gray-500">
                                        Deleted: {formatDate(comment.deletedAt)}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Menu button */}
                    {(canPin || canUnpin || canDelete) && !isDeleted && (
                        <div className="relative flex-shrink-0">
                            <button
                                onClick={onToggleMenu}
                                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1 rounded transition-opacity"
                                title="More options"
                            >
                                <MoreVert className="w-4 h-4" />
                            </button>
                            {showMenu && (
                                <>
                                    <div className="fixed inset-0 z-10" onClick={onToggleMenu} />
                                    <div className="absolute right-0 top-6 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[110px]">
                                        {canPin && (
                                            <button
                                                onClick={() => {
                                                    onPinComment(comment._id);
                                                    onToggleMenu();
                                                }}
                                                className="w-full px-3 py-1.5 text-left text-xs text-yellow-600 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-amber-50 flex items-center gap-1.5 transition-all duration-200"
                                            >
                                                <PushPin className="w-3.5 h-3.5" />
                                                Pin
                                            </button>
                                        )}
                                        {canUnpin && (
                                            <button
                                                onClick={() => {
                                                    onUnpinComment(comment._id);
                                                    onToggleMenu();
                                                }}
                                                className="w-full px-3 py-1.5 text-left text-xs text-yellow-600 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-amber-50 flex items-center gap-1.5 transition-all duration-200"
                                            >
                                                <PushPin className="w-3.5 h-3.5" />
                                                Unpin
                                            </button>
                                        )}
                                        {canDelete && (
                                            <button
                                                onClick={() => {
                                                    setShowDeleteModal(true);
                                                    onToggleMenu();
                                                }}
                                                className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 flex items-center gap-1.5 transition-all duration-200"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                Delete
                                            </button>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {showDeleteModal && (
                <div className="fixed inset-0 flex items-center justify-center z-[9999]">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)}></div>
                    <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-100">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                </div>
                                <h2 className="text-xl font-bold text-gray-800">Delete Comment</h2>
                            </div>
                            <p className="text-gray-600 mb-2">Are you sure you want to delete this comment?</p>
                            {comment.commentText && (
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4">
                                    <p className="text-sm text-gray-700 line-clamp-3">
                                        "{comment.commentText || comment.content}"
                                    </p>
                                </div>
                            )}
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setShowDeleteModal(false)}
                                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => {
                                        onHideComment(comment._id);
                                        setShowDeleteModal(false);
                                    }}
                                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

// Reactions Tab Component
const ReactionsTab = ({ reactions, compact = false }) => {
    const reactionTypes = [
        { type: 'like', emoji: '👍', label: 'Like', color: '#3B82F6' },
        { type: 'love', emoji: '❤️', label: 'Love', color: '#EF4444' },
        { type: 'haha', emoji: '😂', label: 'Haha', color: '#F59E0B' },
        { type: 'wow', emoji: '😮', label: 'Wow', color: '#8B5CF6' },
        { type: 'sad', emoji: '😢', label: 'Sad', color: '#6B7280' },
        { type: 'angry', emoji: '😡', label: 'Angry', color: '#DC2626' },
    ];

    // Always show all reaction types, even if no reactions
    const total = reactions?.total || 0;

    if (compact) {
        return (
            <div>
                <div className="grid grid-cols-2 gap-2">
                    {reactionTypes.map(({ type, emoji, label, color }) => {
                        const count = reactions?.[type] || 0;
                        const percentage = total > 0 ? (count / total) * 100 : 0;

                        return (
                            <div key={type} className="border border-gray-200 rounded-lg p-2 hover:shadow-sm transition-shadow bg-white">
                                <div className="flex flex-col items-center">
                                    <div
                                        className="p-1 rounded-lg flex items-center justify-center mb-1"
                                        style={{ backgroundColor: `${color}20` }}
                                    >
                                        <span className="text-base leading-none">{emoji}</span>
                                    </div>
                                    <p className="text-[9px] font-semibold text-gray-600 mb-0.5 uppercase tracking-wider text-center truncate w-full">{label}</p>
                                    <p className="text-xs font-bold text-gray-900 mb-0.5">{count}</p>
                                    {percentage > 0 && (
                                        <p className="text-[8px] text-gray-500">{percentage.toFixed(0)}%</p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="mb-4">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Reactions Overview
                </h3>
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
                    <div className="flex items-center gap-2">
                        <ThumbUp className="w-5 h-5 text-blue-600" />
                        <span className="text-2xl font-bold text-gray-900">{total}</span>
                        <span className="text-gray-600">total reactions</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {reactionTypes.map(({ type, emoji, label, color }) => {
                    const count = reactions?.[type] || 0;
                    const percentage = total > 0 ? (count / total) * 100 : 0;

                    return (
                        <div key={type} className="border border-gray-200 rounded-lg p-3 hover:shadow-md transition-shadow bg-white">
                            <div className="flex flex-col items-center">
                                <div
                                    className="p-2 rounded-lg flex items-center justify-center shadow-sm mb-2"
                                    style={{ backgroundColor: `${color}20` }}
                                >
                                    <span className="text-2xl leading-none">{emoji}</span>
                                </div>
                                <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider text-center">{label}</p>
                                <p className="text-lg font-bold text-gray-900 mb-1">{count}</p>
                                {percentage > 0 && (
                                    <p className="text-xs text-gray-500">{percentage.toFixed(1)}%</p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LiveStreamControl;

