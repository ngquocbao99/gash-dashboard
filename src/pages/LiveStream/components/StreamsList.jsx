import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Api from '../../../common/SummaryAPI';
import { Visibility } from '@mui/icons-material';

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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4 lg:mb-6">
            <div className="border-b border-gray-200 p-3 sm:p-4 lg:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <h2 className="text-base lg:text-lg font-semibold text-gray-900">{title}</h2>
                    <div className="text-xs lg:text-sm text-gray-500">
                        Total: {pagination?.totalItems || 0} streams
                        {searchTerm && <span className="ml-2 text-blue-600">(filtered by "{searchTerm}")</span>}
                        {statusFilter !== 'all' && <span className="ml-2 text-blue-600">(status: {statusFilter === 'live' ? 'Live' : 'Ended'})</span>}
                    </div>
                </div>
            </div>

            {isLoading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-4 lg:mb-6" role="status" aria-live="polite">
                    <div className="flex flex-col items-center justify-center space-y-4">
                        <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                        <p className="text-gray-600 font-medium">Loading livestreams...</p>
                    </div>
                </div>
            ) : (
                <>
                    <div className="divide-y divide-gray-200">
                        {streams.length > 0 ? (
                            streams.map((stream, index) => (
                                <div key={stream._id || index} className="p-3 sm:p-4 hover:bg-gray-50 transition-colors duration-150">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h3 className="text-xs lg:text-sm font-medium text-gray-900 mb-1">{stream.title || 'Untitled Stream'}</h3>
                                            <p className="text-xs lg:text-sm text-gray-600 mb-2">{stream.description || 'No description'}</p>
                                            <div className="flex items-center gap-3 lg:gap-4 flex-wrap text-xs text-gray-500">
                                                <span className={`px-2 py-1 rounded-full text-xs ${stream.status === 'live' ? 'bg-red-100 text-red-800' :
                                                    stream.status === 'ended' ? 'bg-gray-100 text-gray-800' :
                                                        'bg-yellow-100 text-yellow-800'
                                                    }`}>
                                                    {stream.status || 'unknown'}
                                                </span>
                                                {/* {stream.roomName && <span>Room: {stream.roomName}</span>} */}
                                                {stream.hostId && (
                                                    <span>Host: {stream.hostId?.name || stream.hostId || 'Unknown'}</span>
                                                )}
                                                <span>Viewers: {stream.currentViewers || 0}</span>
                                                {stream.peakViewers > 0 && <span>Peak: {stream.peakViewers}</span>}
                                            </div>
                                        </div>
                                        <div className="flex flex-col items-end gap-2">
                                            <div className="text-sm text-gray-500 text-right">
                                                <div>Started: {stream.startTime ? new Date(stream.startTime).toLocaleString() : 'N/A'}</div>
                                                {stream.endTime && (
                                                    <div>Ended: {new Date(stream.endTime).toLocaleString()}</div>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => navigate(`/livestream/details/${stream._id}`)}
                                                className="flex items-center gap-1 px-3 py-1 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                            >
                                                <Visibility className="w-3 h-3" />
                                                View Details
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="p-4 text-center text-gray-500">
                                {emptyMessage}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {pagination?.totalPages > 1 && (
                        <div className="px-6 py-4 border-t bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-700">
                                    Showing {((currentPage || 1) - 1) * (itemsPerPage || 10) + 1} to {Math.min((currentPage || 1) * (itemsPerPage || 10), pagination?.totalItems || 0)} of {pagination?.totalItems || 0} results
                                </div>
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={() => handlePageChange((currentPage || 1) - 1)}
                                        disabled={(currentPage || 1) <= 1}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>

                                    <div className="flex items-center space-x-1">
                                        {Array.from({ length: Math.min(5, pagination?.totalPages || 1) }, (_, i) => {
                                            const pageNum = Math.max(1, Math.min((pagination?.totalPages || 1) - 4, (currentPage || 1) - 2)) + i;
                                            return (
                                                <button
                                                    key={pageNum}
                                                    onClick={() => handlePageChange(pageNum)}
                                                    className={`px-3 py-1 text-sm border rounded-md ${pageNum === (currentPage || 1)
                                                        ? 'bg-blue-600 text-white border-blue-600'
                                                        : 'border-gray-300 hover:bg-gray-50'
                                                        }`}
                                                >
                                                    {pageNum}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <button
                                        onClick={() => handlePageChange((currentPage || 1) + 1)}
                                        disabled={(currentPage || 1) >= (pagination?.totalPages || 1)}
                                        className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default StreamsList;
