import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import { useToast } from '../../hooks/useToast';
import { ArrowBack, LiveTv, Videocam, VideocamOff, VolumeUp, VolumeOff, People, TrendingUp, TrendingDown, Schedule, Flag, Dashboard, Fingerprint, Comment } from '@mui/icons-material';
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
                    minViewers: livestreamData.minViewers || 0,
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
                className: 'bg-red-100 text-red-800 border-red-200',
                icon: <LiveTv className="w-4 h-4" />,
                text: 'Live'
            },
            'ended': {
                className: 'bg-gray-100 text-gray-800 border-gray-200',
                icon: <Flag className="w-4 h-4" />,
                text: 'Ended'
            },
            'scheduled': {
                className: 'bg-blue-100 text-blue-800 border-blue-200',
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
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <ArrowBack className="w-4 h-4" />
                        Back to List
                    </button>
                </div>
            </div>
        );
    }

    const statusBadge = getStatusBadge(livestream.status);

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate('/livestream')}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <ArrowBack className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Livestream Details</h1>
                        <p className="text-gray-600 text-sm">ID: {livestream._id}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {livestream.status === 'live' && (
                        <button
                            onClick={() => navigate(`/manage-livestream/${livestreamId}`)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                            <Dashboard className="w-4 h-4" />
                            Go to Dashboard
                        </button>
                    )}
                    <button
                        onClick={handleRefresh}
                        disabled={isRefreshing}
                        className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                        {isRefreshing ? 'Loading...' : 'Refresh'}
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="space-y-6">
                {/* Basic Information */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <div className="flex items-start justify-between mb-6">
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                                <h2 className="text-xl font-semibold text-gray-900">{livestream.title || 'Untitled Stream'}</h2>
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${statusBadge.className}`}>
                                    {statusBadge.icon}
                                    {statusBadge.text}
                                </span>
                            </div>
                            {livestream.description && (
                                <p className="text-gray-600">{livestream.description}</p>
                            )}
                        </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Fingerprint className="w-5 h-5" />
                                <span className="text-sm font-medium">Stream ID</span>
                            </div>
                            <p className="text-xs font-semibold text-gray-900 break-all">{livestream._id}</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Videocam className="w-5 h-5" />
                                <span className="text-sm font-medium">Room Name</span>
                            </div>
                            <p className="text-xs font-semibold text-gray-900 break-all">{livestream.roomName}</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Flag className="w-5 h-5" />
                                <span className="text-sm font-medium">Status</span>
                            </div>
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${statusBadge.className}`}>
                                {statusBadge.icon}
                                {statusBadge.text}
                            </span>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <People className="w-5 h-5" />
                                <span className="text-sm font-medium">Viewers</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900">{viewerStats.current} viewers</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <TrendingUp className="w-5 h-5" />
                                <span className="text-sm font-medium">Peak Viewers</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900">{viewerStats.peak} viewers</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <TrendingDown className="w-5 h-5" />
                                <span className="text-sm font-medium">Min Viewers</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900">{viewerStats.min} viewers</p>
                        </div>

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Schedule className="w-5 h-5" />
                                <span className="text-sm font-medium">Duration</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900">
                                {calculateDuration(livestream.startTime, livestream.endTime, livestream.duration)}
                            </p>
                        </div>

                        {reactions && reactions.total > 0 && (
                            <div className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-center gap-2 text-gray-600 mb-2">
                                    <LiveTv className="w-5 h-5" />
                                    <span className="text-sm font-medium">Reactions</span>
                                </div>
                                <p className="text-lg font-semibold text-gray-900">
                                    {reactions.total || 0} total
                                </p>
                            </div>
                        )}

                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Comment className="w-5 h-5" />
                                <span className="text-sm font-medium">Comments</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900">
                                {comments?.filter(c => !c.isDeleted).length || 0} total
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reactions Details */}
                {reactions && reactions.total > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Reactions ({reactions.total})
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
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
                                    <div key={type} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                        <div className="flex items-center justify-center mb-3">
                                            <div
                                                className="p-3 rounded-xl flex items-center justify-center shadow-sm"
                                                style={{ backgroundColor: `${color}20` }}
                                            >
                                                <span className="text-3xl leading-none">{emoji}</span>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wider">{label}</p>
                                            <p className="text-2xl font-bold text-gray-900">{count}</p>
                                            {percentage > 0 && (
                                                <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}%</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Timeline */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Timeline</h3>
                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="shrink-0 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <Schedule className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-gray-900">Livestream started</p>
                                <p className="text-sm text-gray-600">{formatDate(livestream.startTime)}</p>
                            </div>
                        </div>

                        {livestream.endTime && (
                            <div className="flex items-start gap-4">
                                <div className="shrink-0 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                    <Flag className="w-6 h-6 text-red-600" />
                                </div>
                                <div className="flex-1">
                                    <p className="text-sm font-medium text-gray-900">Livestream ended</p>
                                    <p className="text-sm text-gray-600">{formatDate(livestream.endTime)}</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Information */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
                    <dl>
                        <div>
                            <dt className="text-sm font-medium text-gray-500 mb-2">Host</dt>
                            <dd className="text-sm text-gray-900 break-all">
                                {typeof livestream.hostId === 'object' ? (
                                    <div className="space-y-1">
                                        <p className="font-semibold">{livestream.hostId?.name || 'Unknown'}</p>
                                        {livestream.hostId?.email && (
                                            <p className="text-xs text-gray-500">{livestream.hostId.email}</p>
                                        )}
                                        {livestream.hostId?.username && (
                                            <p className="text-xs text-gray-500">@{livestream.hostId.username}</p>
                                        )}
                                    </div>
                                ) : (
                                    livestream.hostId
                                )}
                            </dd>
                        </div>
                    </dl>
                </div>

                {/* Live Products */}
                {products && products.length > 0 && (
                    <div className="bg-white rounded-lg shadow-sm border p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Live Products ({products.length})
                        </h3>
                        <div className="space-y-3">
                            {products.map((liveProduct) => {
                                const isActive = liveProduct.isActive && !liveProduct.removedAt;
                                return (
                                    <div key={liveProduct._id} className={`border rounded-lg p-3 hover:shadow-md transition-shadow flex items-center gap-4 ${!isActive ? 'opacity-60 bg-gray-50' : 'bg-white'}`}>
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
                                                {liveProduct.isPinned && (
                                                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 shrink-0">
                                                        📌 Pinned
                                                    </span>
                                                )}
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
                    </div>
                )}

                {/* Live Comments */}
                {(() => {
                    const activeComments = comments.filter(c => !c.isDeleted);
                    return activeComments.length > 0 && (
                        <div className="bg-white rounded-lg shadow-sm border p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">
                                    Comments ({activeComments.length})
                                </h3>
                                {activeComments.length > 20 && (
                                    <button
                                        onClick={() => setShowAllComments(!showAllComments)}
                                        className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
                                    >
                                        {showAllComments ? 'Show Less' : `View All (${activeComments.length})`}
                                    </button>
                                )}
                            </div>
                            <div className={`space-y-3 ${showAllComments ? '' : 'max-h-96'} overflow-y-auto`}>
                                {(showAllComments ? activeComments : activeComments.slice(0, 20)).map((comment) => (
                                    <div key={comment._id} className="border rounded-lg p-3 bg-gray-50 border-gray-200">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {comment.senderId && (
                                                        <span className="font-semibold text-sm text-gray-900">
                                                            {comment.senderId.name || comment.senderId.username || 'Unknown'}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="text-sm text-gray-700">{comment.commentText || comment.content}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between mt-2">
                                            <span className="text-xs text-gray-500">
                                                {formatDate(comment.createdAt)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {!showAllComments && activeComments.length > 20 && (
                                <p className="text-sm text-gray-500 mt-4 text-center">
                                    Showing 20 of {activeComments.length} comments
                                </p>
                            )}
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};

export default LiveStreamDetails;

