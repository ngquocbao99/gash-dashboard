import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import { useToast } from '../../hooks/useToast';
import { ArrowBack, LiveTv, Videocam, VideocamOff, VolumeUp, VolumeOff, People, TrendingUp, Schedule, Flag, Dashboard } from '@mui/icons-material';
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
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [viewerStats, setViewerStats] = useState({
        peak: 0,
        min: 0,
        current: 0
    });

    // Load livestream details
    const loadLivestreamDetails = async () => {
        try {
            setIsLoading(true);
            console.log('📋 Loading livestream details for ID:', livestreamId);

            const response = await Api.livestream.getById(livestreamId);
            console.log('📋 API Response:', response);

            if (response.success) {
                // Backend returns: { success: true, message: "...", data: { livestream: {...} } }
                const data = response.data?.livestream || response.data;
                console.log('📋 Livestream data:', data);

                // Handle the livestream data
                const livestreamData = {
                    _id: data._id,
                    hostId: data.hostId,
                    title: data.title,
                    description: data.description,
                    image: data.image,
                    roomName: data.roomName,
                    status: data.status,
                    startTime: data.startTime,
                    endTime: data.endTime,
                    peakViewers: data.peakViewers,
                    minViewers: data.minViewers,
                    currentViewers: data.currentViewers,
                    liveProducts: data.liveProducts || [],
                    liveComments: data.liveComments || []
                };

                setLivestream(livestreamData);
                setViewerStats({
                    peak: data.peakViewers || 0,
                    min: data.minViewers || 0,
                    current: data.currentViewers || 0
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
    const calculateDuration = (startTime, endTime) => {
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="border border-gray-200 rounded-lg p-4">
                            <div className="flex items-center gap-2 text-gray-600 mb-2">
                                <Videocam className="w-5 h-5" />
                                <span className="text-sm font-medium">Room Name</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900 break-all">{livestream.roomName}</p>
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
                                <Schedule className="w-5 h-5" />
                                <span className="text-sm font-medium">Duration</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900">{calculateDuration(livestream.startTime, livestream.endTime)}</p>
                        </div>
                    </div>
                </div>

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

                {/* Statistics */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-blue-600 font-medium">Peak Viewers</p>
                                    <p className="text-2xl font-bold text-blue-900">{viewerStats.peak}</p>
                                </div>
                                <TrendingUp className="w-8 h-8 text-blue-600" />
                            </div>
                        </div>

                        <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-green-600 font-medium">Min Viewers</p>
                                    <p className="text-2xl font-bold text-green-900">{viewerStats.min}</p>
                                </div>
                                <People className="w-8 h-8 text-green-600" />
                            </div>
                        </div>

                        <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-purple-600 font-medium">Current Viewers</p>
                                    <p className="text-2xl font-bold text-purple-900">{viewerStats.current}</p>
                                </div>
                                <LiveTv className="w-8 h-8 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Information */}
                <div className="bg-white rounded-lg shadow-sm border p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Information</h3>
                    <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Host</dt>
                            <dd className="mt-1 text-sm text-gray-900 break-all">
                                {typeof livestream.hostId === 'object' ? (
                                    <div className="space-y-1">
                                        <p className="font-semibold">{livestream.hostId?.name || 'Unknown'}</p>
                                        <p className="text-xs text-gray-500">{livestream.hostId?.email || ''}</p>
                                    </div>
                                ) : (
                                    livestream.hostId
                                )}
                            </dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Stream ID</dt>
                            <dd className="mt-1 text-sm text-gray-900 break-all">{livestream._id}</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Min Viewers</dt>
                            <dd className="mt-1 text-sm text-gray-900">{viewerStats.min} viewers</dd>
                        </div>
                        <div>
                            <dt className="text-sm font-medium text-gray-500">Status</dt>
                            <dd className="mt-1">
                                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium ${statusBadge.className}`}>
                                    {statusBadge.icon}
                                    {statusBadge.text}
                                </span>
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
};

export default LiveStreamDetails;

