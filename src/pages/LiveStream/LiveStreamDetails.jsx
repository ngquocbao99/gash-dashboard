import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import { useToast } from '../../hooks/useToast';
import { LiveTv, Videocam, VideocamOff, VolumeUp, VolumeOff, People, TrendingUp, TrendingDown, Schedule, Flag, Dashboard, Fingerprint, Comment, Inventory2 } from '@mui/icons-material';
import Loading from '../../components/Loading';
import { format } from 'date-fns';

const LiveStreamDetails = () => {
    const { user } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { livestreamId } = useParams();

    // State
    const [isLoading, setIsLoading] = useState(false);
    const [livestream, setLivestream] = useState(null);
    const [products, setProducts] = useState([]);
    const [comments, setComments] = useState([]);
    const [reactions, setReactions] = useState(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [viewerStats, setViewerStats] = useState({
        peak: 0,
        min: 0,
        current: 0
    });
    const [showAllComments, setShowAllComments] = useState(false);
    const [showAllProducts, setShowAllProducts] = useState(false);

    // Load livestream details
    const loadLivestreamDetails = async () => {
        try {
            setIsLoading(true);

            const response = await Api.livestream.getById(livestreamId);


            if (response.success) {
                // Backend returns: { success: true, message: "...", data: { livestream: {...}, products: [...], comments: [...], reactions: {...} } }
                const { livestream: livestreamData, products: productsData, comments: commentsData, reactions: reactionsData } = response.data || {};

                if (!livestreamData) {
                    showToast('Livestream data not found in response', 'error');
                    navigate('/livestream');
                    return;
                }

                // Set livestream data (backend includes currentViewers, duration)
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
                    peakViewers: livestreamData.peakViewers || 0,
                    peakViewersAt: livestreamData.peakViewersAt || null,
                    minViewers: livestreamData.minViewers || 0,
                    minViewersAt: livestreamData.minViewersAt || null,
                    currentViewers: livestreamData.currentViewers || 0,
                    duration: livestreamData.duration // Duration in milliseconds (null if still live)
                });

                // Set products, comments, reactions separately
                setProducts(productsData || []);
                setComments(commentsData || []);
                setReactions(reactionsData || null);

                // Set viewer stats
                setViewerStats({
                    peak: livestreamData.peakViewers || 0,
                    min: livestreamData.minViewers || 0,
                    current: livestreamData.currentViewers || 0
                });
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

    // Auto-refresh every 5 seconds if stream is live
    useEffect(() => {
        loadLivestreamDetails();

        if (livestream?.status === 'live') {
            const interval = setInterval(() => {
                loadLivestreamDetails();
            }, 5000); // Refresh every 5 seconds

            return () => clearInterval(interval);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [livestreamId, livestream?.status]);

    // Format date
    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return format(new Date(dateString), 'dd/MM/yyyy HH:mm:ss');
        } catch (error) {
            return dateString;
        }
    };

    // Calculate duration
    const calculateDuration = (startTime, endTime, durationMs = null) => {
        // If backend provides duration (for ended streams), use it
        if (durationMs !== null && durationMs > 0) {
            const diff = Math.floor(durationMs / 1000); // Convert ms to seconds
            const hours = Math.floor(diff / 3600);
            const minutes = Math.floor((diff % 3600) / 60);
            const seconds = diff % 60;

            if (hours > 0) {
                return `${hours}h ${minutes}m ${seconds}s`;
            } else if (minutes > 0) {
                return `${minutes}m ${seconds}s`;
            } else {
                return `${seconds}s`;
            }
        }

        // Fallback: calculate from startTime and endTime
        if (!startTime) return 'N/A';

        const start = new Date(startTime);
        const end = endTime ? new Date(endTime) : new Date();
        const diff = Math.floor((end - start) / 1000); // in seconds

        const hours = Math.floor(diff / 3600);
        const minutes = Math.floor((diff % 3600) / 60);
        const seconds = diff % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m ${seconds}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds}s`;
        } else {
            return `${seconds}s`;
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
                message="Loading livestream details..."
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

    return (
        <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
                <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">Livestream Details</h1>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
                    {livestream.status === 'live' && (
                        <button
                            onClick={() => navigate(`/manage-livestream/${livestreamId}`)}
                            className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 transform hover:scale-105"
                        >
                            <Dashboard className="w-3 h-3 lg:w-4 lg:h-4" />
                            <span className="font-medium">Go to Dashboard</span>
                        </button>
                    )}
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
                                <span className="font-medium">Refresh</span>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-4 lg:space-y-6">
                {/* Basic Information */}
                <div className="backdrop-blur-xl rounded-xl border overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                    <div className="p-3 sm:p-4 lg:p-6">
                        <div className="flex items-start justify-between mb-3 lg:mb-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 sm:gap-3 mb-2 sm:mb-3 flex-wrap">
                                    <h2 className="text-base sm:text-lg lg:text-xl font-semibold text-gray-900">{livestream.title || 'Untitled Stream'}</h2>
                                    <span className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium border ${statusBadge.className}`}>
                                        {statusBadge.icon}
                                        {statusBadge.text}
                                    </span>
                                </div>
                                {livestream.description && (
                                    <p className="text-xs sm:text-sm lg:text-base text-gray-600">{livestream.description}</p>
                                )}
                            </div>
                        </div>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                            {/* <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                    <Fingerprint className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="text-xs font-medium">Stream ID</span>
                                </div>
                                <p className="text-xs sm:text-sm font-semibold text-gray-900 break-all">{livestream._id}</p>
                            </div> */}

                            <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                    <Videocam className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="text-xs font-medium">Room Name</span>
                                </div>
                                <p className="text-xs sm:text-sm font-semibold text-gray-900 break-all">{livestream.roomName}</p>
                            </div>

                            <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                    <Flag className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="text-xs font-medium">Status</span>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge.className}`}>
                                    {statusBadge.icon}
                                    {statusBadge.text}
                                </span>
                            </div>

                            <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="text-xs font-medium">Peak Viewers</span>
                                </div>
                                <p className="text-sm sm:text-base font-semibold text-gray-900">{viewerStats.peak} viewers</p>
                            </div>

                            {livestream.peakViewersAt && (
                                <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                    <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                        <Schedule className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="text-xs font-medium">Peak At</span>
                                    </div>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-900">{formatDate(livestream.peakViewersAt)}</p>
                                </div>
                            )}

                            <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                    <TrendingDown className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="text-xs font-medium">Min Viewers</span>
                                </div>
                                <p className="text-sm sm:text-base font-semibold text-gray-900">{viewerStats.min} viewers</p>
                            </div>

                            {livestream.minViewersAt && (
                                <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                    <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                        <Schedule className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="text-xs font-medium">Min At</span>
                                    </div>
                                    <p className="text-xs sm:text-sm font-semibold text-gray-900">{formatDate(livestream.minViewersAt)}</p>
                                </div>
                            )}

                            <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                    <Schedule className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="text-xs font-medium">Duration</span>
                                </div>
                                <p className="text-sm sm:text-base font-semibold text-gray-900">
                                    {calculateDuration(livestream.startTime, livestream.endTime, livestream.duration)}
                                </p>
                            </div>

                            {reactions && reactions.total > 0 && (
                                <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                    <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                        <LiveTv className="w-3 h-3 sm:w-4 sm:h-4" />
                                        <span className="text-xs font-medium">Reactions</span>
                                    </div>
                                    <p className="text-sm sm:text-base font-semibold text-gray-900">
                                        {reactions.total || 0} total
                                    </p>
                                </div>
                            )}

                            <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                    <Inventory2 className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="text-xs font-medium">Products</span>
                                </div>
                                <p className="text-sm sm:text-base font-semibold text-gray-900">
                                    {products?.length || 0} total
                                </p>
                            </div>

                            <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                <div className="flex items-center gap-2 text-gray-600 mb-1.5 sm:mb-2">
                                    <Comment className="w-3 h-3 sm:w-4 sm:h-4" />
                                    <span className="text-xs font-medium">Comments</span>
                                </div>
                                <p className="text-sm sm:text-base font-semibold text-gray-900">
                                    {comments?.length || 0} total
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Reactions Details */}
                {reactions && reactions.total > 0 && (
                    <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">
                            Reactions ({reactions.total})
                        </h3>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                                { type: 'like', emoji: '👍', label: 'Like', color: '#3B82F6' },
                                { type: 'love', emoji: '❤️', label: 'Love', color: '#EF4444' },
                                { type: 'haha', emoji: '😂', label: 'Haha', color: '#F59E0B' },
                                { type: 'wow', emoji: '😮', label: 'Wow', color: '#8B5CF6' },
                                { type: 'sad', emoji: '😢', label: 'Sad', color: '#6B7280' },
                                { type: 'angry', emoji: '😡', label: 'Angry', color: '#DC2626' },
                            ].map(({ type, emoji, label, color }) => {
                                const count = reactions[type] || 0;
                                const percentage = reactions.total > 0 ? (count / reactions.total) * 100 : 0;

                                return (
                                    <div key={type} className="border border-gray-200 rounded-lg p-2 hover:shadow-md transition-shadow">
                                        <div className="flex flex-col items-center">
                                            <div
                                                className="p-1.5 rounded-lg flex items-center justify-center shadow-sm mb-1.5"
                                                style={{ backgroundColor: `${color}20` }}
                                            >
                                                <span className="text-lg leading-none">{emoji}</span>
                                            </div>
                                            <p className="text-[9px] font-semibold text-gray-600 mb-0.5 uppercase tracking-wider text-center">{label}</p>
                                            <p className="text-sm font-bold text-gray-900 mb-0.5">{count}</p>
                                            {percentage > 0 && (
                                                <p className="text-[8px] text-gray-500">{percentage.toFixed(1)}%</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Timeline and Additional Information */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {/* Timeline */}
                    <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">Timeline</h3>
                        <div className="space-y-3">
                            <div className="flex items-start gap-3">
                                <div className="shrink-0 w-10 h-10 bg-gradient-to-br from-green-100 to-emerald-100 rounded-full flex items-center justify-center shadow-sm">
                                    <Schedule className="w-5 h-5 text-green-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-xs font-medium text-gray-900">Livestream started</p>
                                    <p className="text-xs text-gray-600 mt-0.5">{formatDate(livestream.startTime)}</p>
                                </div>
                            </div>

                            {livestream.endTime && (
                                <div className="flex items-start gap-3">
                                    <div className="shrink-0 w-10 h-10 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center shadow-sm">
                                        <Flag className="w-5 h-5 text-red-600" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-medium text-gray-900">Livestream ended</p>
                                        <p className="text-xs text-gray-600 mt-0.5">{formatDate(livestream.endTime)}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Additional Information */}
                    <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-2 sm:mb-3">Additional Information</h3>
                        <dl>
                            <div>
                                <dt className="text-sm font-medium text-gray-500 mb-2">Host</dt>
                                <dd className="text-sm text-gray-900 break-all">
                                    {typeof livestream.hostId === 'object' ? (
                                        <div className="flex items-start gap-3">
                                            {/* Avatar */}
                                            <div className="flex-shrink-0">
                                                {livestream.hostId?.avatar || livestream.hostId?.avatarUrl || livestream.hostId?.image || livestream.hostId?.profileImage ? (
                                                    <img
                                                        src={livestream.hostId?.avatar || livestream.hostId?.avatarUrl || livestream.hostId?.image || livestream.hostId?.profileImage}
                                                        alt={livestream.hostId?.name || livestream.hostId?.username || 'Host'}
                                                        className="w-12 h-12 rounded-full object-cover border border-gray-200"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                <div className={`w-12 h-12 rounded-full bg-gray-200 border border-gray-200 items-center justify-center ${livestream.hostId?.avatar || livestream.hostId?.avatarUrl || livestream.hostId?.image || livestream.hostId?.profileImage ? 'hidden' : 'flex'}`}>
                                                    <span className="text-lg font-semibold text-gray-600">
                                                        {(livestream.hostId?.name || livestream.hostId?.username || 'U').charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Info */}
                                            <div className="flex-1 space-y-1">
                                                <p className="font-semibold">{livestream.hostId?.name || 'Unknown'}</p>
                                                {livestream.hostId?.email && (
                                                    <p className="text-xs text-gray-500">{livestream.hostId.email}</p>
                                                )}
                                                {livestream.hostId?.username && (
                                                    <p className="text-xs text-gray-500">@{livestream.hostId.username}</p>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        livestream.hostId
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </div>
                </div>

                {/* Live Products */}
                {products && products.length > 0 && (
                    <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                                Live Products ({products.length})
                            </h3>
                            {products.length > 20 && (
                                <button
                                    onClick={() => setShowAllProducts(!showAllProducts)}
                                    className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 px-2 py-1 rounded-md transition-all duration-200"
                                >
                                    {showAllProducts ? 'Show Less' : `View All (${products.length})`}
                                </button>
                            )}
                        </div>
                        <div className={`space-y-3 ${showAllProducts ? '' : 'max-h-96'} overflow-y-auto pr-1`}>
                            {(showAllProducts ? products : products.slice(0, 20)).map((liveProduct) => {
                                const isActive = liveProduct.isActive && !liveProduct.removedAt;
                                return (
                                    <div key={liveProduct._id} className={`bg-gray-50 rounded-lg border p-2.5 sm:p-3 hover:shadow-md transition-shadow flex items-center gap-3 sm:gap-4 ${!isActive ? 'opacity-60' : ''}`} style={{ borderColor: '#A86523' }}>
                                        {/* Product Image */}
                                        {liveProduct.productId?.productImageIds && liveProduct.productId.productImageIds.length > 0 ? (
                                            <div className="flex-shrink-0">
                                                <img
                                                    src={liveProduct.productId.productImageIds[0]?.imageUrl || ''}
                                                    alt={liveProduct.productId.productName}
                                                    className="w-20 h-20 object-cover rounded-lg"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex-shrink-0 w-20 h-20 bg-gray-200 rounded-lg flex items-center justify-center">
                                                <svg className="w-10 h-10 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}

                                        {/* Product Info */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="font-semibold text-gray-900 truncate">
                                                    {liveProduct.productId?.productName || 'Unknown Product'}
                                                </h4>
                                                {isActive ? (
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-800 shrink-0">
                                                        Active
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-100 text-red-800 shrink-0">
                                                        Removed
                                                    </span>
                                                )}
                                            </div>
                                            {liveProduct.productId?.categoryId && (
                                                <p className="text-xs text-gray-500 mb-1">
                                                    {liveProduct.productId.categoryId.cat_name}
                                                </p>
                                            )}
                                            <div className="flex items-center gap-4 text-xs text-gray-500">
                                                <span>Added: {formatDate(liveProduct.addedAt)}</span>
                                                {(liveProduct.addedBy || liveProduct.addBy) && (
                                                    <span>
                                                        By: {typeof (liveProduct.addedBy || liveProduct.addBy) === 'object'
                                                            ? ((liveProduct.addedBy || liveProduct.addBy)?.name || (liveProduct.addedBy || liveProduct.addBy)?.username || 'Unknown')
                                                            : 'Unknown'}
                                                    </span>
                                                )}
                                            </div>
                                            {liveProduct.removedAt && (
                                                <div className="flex items-center gap-4 text-xs text-red-600 mt-1">
                                                    <span>Removed: {formatDate(liveProduct.removedAt)}</span>
                                                    {(liveProduct.removedBy || liveProduct.removeBy) && (
                                                        <span>
                                                            By: {typeof (liveProduct.removedBy || liveProduct.removeBy) === 'object'
                                                                ? ((liveProduct.removedBy || liveProduct.removeBy)?.name || (liveProduct.removedBy || liveProduct.removeBy)?.username || 'Unknown')
                                                                : 'Unknown'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {!showAllProducts && products.length > 20 && (
                            <p className="text-sm text-gray-500 mt-4 text-center">
                                Showing 20 of {products.length} products
                            </p>
                        )}
                    </div>
                )}

                {/* Live Comments */}
                {comments && comments.length > 0 && (
                    <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                        <div className="flex items-center justify-between mb-2 sm:mb-3">
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900">
                                Comments ({comments.length})
                            </h3>
                            {comments.length > 20 && (
                                <button
                                    onClick={() => setShowAllComments(!showAllComments)}
                                    className="text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    {showAllComments ? 'Show Less' : `View All (${comments.length})`}
                                </button>
                            )}
                        </div>
                        <div className={`space-y-3 ${showAllComments ? '' : 'max-h-96'} overflow-y-auto pr-1`}>
                            {(showAllComments ? comments : comments.slice(0, 20)).map((comment) => {
                                const isDeleted = comment.isDeleted === true;
                                return (
                                    <div key={comment._id} className={`bg-gray-50 rounded-lg border p-2.5 sm:p-3 ${isDeleted ? 'opacity-60' : ''}`} style={{ borderColor: '#A86523' }}>
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1 flex-wrap">
                                                    {comment.senderId && (
                                                        <span className={`font-semibold text-sm ${isDeleted ? 'text-gray-500' : 'text-gray-900'}`}>
                                                            {comment.senderId.name || comment.senderId.username || 'Unknown'}
                                                        </span>
                                                    )}
                                                    {isDeleted && (
                                                        <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded">
                                                            Deleted
                                                        </span>
                                                    )}
                                                </div>
                                                <p className={`text-sm ${isDeleted ? 'text-gray-500' : 'text-gray-700'}`}>
                                                    {comment.commentText || comment.content}
                                                </p>
                                                {isDeleted && comment.deletedBy && (
                                                    <p className="text-xs text-gray-400 mt-1">
                                                        Deleted by: {typeof comment.deletedBy === 'object'
                                                            ? (comment.deletedBy.name || comment.deletedBy.username || 'Unknown')
                                                            : 'Unknown'}
                                                        {typeof comment.deletedBy === 'object' && comment.deletedBy.role && (
                                                            <span className="ml-1 text-gray-500">({comment.deletedBy.role})</span>
                                                        )}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs text-gray-500">
                                                    {formatDate(comment.createdAt)}
                                                </span>
                                                {isDeleted && comment.deletedAt && (
                                                    <>
                                                        <span className="text-xs text-gray-400">•</span>
                                                        <span className="text-xs text-gray-400">
                                                            Deleted: {formatDate(comment.deletedAt)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {!showAllComments && comments.length > 20 && (
                            <p className="text-sm text-gray-500 mt-4 text-center">
                                Showing 20 of {comments.length} comments
                            </p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default LiveStreamDetails;

