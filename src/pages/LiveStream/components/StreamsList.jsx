import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Api from '../../../common/SummaryAPI';
import Loading from '../../../components/Loading';

const StreamsList = ({
    title,
    emptyMessage,
    currentPage: externalCurrentPage,
    itemsPerPage: externalItemsPerPage,
    searchTerm,
    statusFilter,
    onPageChange,
    onTotalItemsChange
}) => {
    const navigate = useNavigate();
    const [streams, setStreams] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        itemsPerPage: 10
    });

    // Use external pagination props if provided, otherwise use internal state
    const currentPage = externalCurrentPage || pagination.currentPage;
    const itemsPerPage = externalItemsPerPage || pagination.itemsPerPage;


    // Load all livestreams with pagination
    const loadAllLivestreams = useCallback(async (page = 1, limit = 10, search = '', status = 'all') => {
        try {
            setIsLoading(true);

            // For client-side filtering, we need to load all data first
            // Then apply filters and pagination
            const response = await Api.livestream.getAll({ page: 1, limit: 1000 }); // Load more data for filtering

            if (response.success) {
                // Backend returns: { success: true, data: { livestreams: [...], count: N } }
                let allLivestreams = response.data?.livestreams || [];

                // Apply client-side filtering
                if (status !== 'all') {
                    allLivestreams = allLivestreams.filter(stream => {
                        if (status === 'live') {
                            return stream.status === 'live';
                        } else if (status === 'ended') {
                            return stream.status === 'ended';
                        }
                        return true;
                    });
                }

                // Apply client-side search
                if (search) {
                    allLivestreams = allLivestreams.filter(stream =>
                        stream.title?.toLowerCase().includes(search.toLowerCase()) ||
                        stream.description?.toLowerCase().includes(search.toLowerCase()) ||
                        stream.hostId?.name?.toLowerCase().includes(search.toLowerCase())
                    );
                }

                // Apply pagination to filtered results
                const startIndex = (page - 1) * limit;
                const endIndex = startIndex + limit;
                const paginatedLivestreams = allLivestreams.slice(startIndex, endIndex);

                // Calculate pagination info
                const totalItems = allLivestreams.length;
                const totalPages = Math.ceil(totalItems / limit);

                const paginationData = {
                    currentPage: page,
                    totalPages: totalPages,
                    totalItems: totalItems,
                    itemsPerPage: limit
                };

                setStreams(paginatedLivestreams);
                setPagination(paginationData);

                // Notify parent component of total items change
                if (onTotalItemsChange) {
                    onTotalItemsChange(totalItems);
                }
            } else {
                // console.error('Error loading livestreams:', response.message);
            }
        } catch (error) {
            // console.error('Error loading livestreams:', error);
        } finally {
            setIsLoading(false);
        }
    }, [onTotalItemsChange]);

    // Handle page change for pagination
    const handlePageChange = (newPage) => {
        if (onPageChange) {
            onPageChange(newPage);
        } else {
            loadAllLivestreams(newPage, itemsPerPage, searchTerm, statusFilter);
        }
    };

    // Load data on component mount
    useEffect(() => {
        loadAllLivestreams(currentPage, itemsPerPage, searchTerm, statusFilter);
    }, [loadAllLivestreams, currentPage, itemsPerPage, searchTerm, statusFilter]);

    return (
        <div className="backdrop-blur-xl rounded-xl border overflow-hidden mb-4 lg:mb-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
            {isLoading ? (
                <div className="backdrop-blur-xl rounded-xl border p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }} role="status" aria-live="polite">
                    <Loading
                        type="page"
                        size="medium"
                        message="Loading livestreams..."
                    />
                </div>
            ) : streams.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed min-w-[900px]">
                        {/* ---------- HEADER ---------- */}
                        <thead className="backdrop-blur-sm border-b" style={{ borderColor: '#A86523' }}>
                            <tr>
                                <th className="w-[5%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    #
                                </th>
                                <th className="w-[18%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    Title
                                </th>
                                <th className="w-[20%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    Description
                                </th>
                                <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    Status
                                </th>
                                <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    Host
                                </th>
                                <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    Viewers
                                </th>
                                <th className="w-[11%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    Start Time
                                </th>
                                <th className="w-[11%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    End Time
                                </th>
                                <th className="w-[9%] px-2 lg:px-4 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {streams.map((stream, index) => {
                                const startIndex = ((currentPage || 1) - 1) * (itemsPerPage || 10);
                                const itemNumber = startIndex + index + 1;
                                return (
                                    <tr
                                        key={stream._id || index}
                                        className="hover:bg-gradient-to-r hover:from-yellow-50/50 hover:via-amber-50/50 hover:to-orange-50/50 transition-all duration-300 border-b-2 border-gray-200/40"
                                    >
                                        {/* # */}
                                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                                            {itemNumber}
                                        </td>

                                        {/* Title */}
                                        <td className="px-2 lg:px-4 py-3">
                                            <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                                                {stream.title || 'Untitled Stream'}
                                            </div>
                                        </td>

                                        {/* Description */}
                                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                            <div className="truncate">
                                                {stream.description || 'No description'}
                                            </div>
                                        </td>

                                        {/* Status */}
                                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-semibold ${stream.status === 'live'
                                                ? 'bg-gradient-to-r from-red-400 to-red-600 text-white border border-red-500'
                                                : stream.status === 'ended'
                                                    ? 'bg-gradient-to-r from-gray-400 to-gray-600 text-white border border-gray-500'
                                                    : 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border border-yellow-500'
                                                }`}>
                                                {stream.status || 'unknown'}
                                            </span>
                                        </td>

                                        {/* Host */}
                                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                            {stream.hostId?.name || stream.hostId || 'Unknown'}
                                        </td>

                                        {/* Viewers */}
                                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                            {stream.peakViewers || stream.currentViewers || 0}
                                        </td>

                                        {/* Start Time */}
                                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                            {stream.startTime ? new Date(stream.startTime).toLocaleString() : 'N/A'}
                                        </td>

                                        {/* End Time */}
                                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                            {stream.endTime ? new Date(stream.endTime).toLocaleString() : 'N/A'}
                                        </td>

                                        {/* Actions */}
                                        <td className="px-2 lg:px-4 py-3">
                                            <div className="flex justify-center items-center">
                                                <button
                                                    onClick={() => navigate(`/livestream/details/${stream._id}`)}
                                                    className="p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm"
                                                    aria-label={`View details for livestream ${stream._id}`}
                                                    title="View Details"
                                                >
                                                    <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="p-6 text-center">
                    <div className="flex flex-col items-center space-y-3">
                        <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-medium text-gray-900">No livestreams found</h3>
                            <p className="text-sm text-gray-500 mt-1">{emptyMessage}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StreamsList;
