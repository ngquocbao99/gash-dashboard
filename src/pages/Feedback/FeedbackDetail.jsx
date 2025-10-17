import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';

const FeedbackDetail = ({ feedbackId, isOpen, onClose }) => {
    const { user } = React.useContext(AuthContext);
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const fetchFeedbackDetail = useCallback(async () => {
        if (!feedbackId) return;

        setLoading(true);
        setError('');
        try {
            const response = await Api.feedback.getById(feedbackId);
            console.log('Feedback detail response:', response);

            if (response?.success && response?.data) {
                setFeedback(response.data);
            } else {
                setError('Failed to load feedback details');
            }
        } catch (err) {
            console.error('Fetch feedback detail error:', err);
            setError(err.message || 'Failed to load feedback details');
        } finally {
            setLoading(false);
        }
    }, [feedbackId]);

    useEffect(() => {
        if (isOpen && feedbackId) {
            fetchFeedbackDetail();
        }
    }, [isOpen, feedbackId, fetchFeedbackDetail]);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setFeedback(null);
            setError('');
            setLoading(false);
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Feedback Details</h2>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                        aria-label="Close modal"
                    >
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="ml-3 text-gray-600">Loading feedback details...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-12">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error</h3>
                            <p className="text-gray-600 mb-4">{error}</p>
                            <button
                                onClick={fetchFeedbackDetail}
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors duration-200"
                            >
                                Retry
                            </button>
                        </div>
                    ) : feedback ? (
                        <div className="space-y-6">
                            {/* Customer Information */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h3>
                                <div className="flex items-center space-x-4">
                                    <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                                        {feedback.customer?.image ? (
                                            <img
                                                src={feedback.customer.image}
                                                alt={feedback.customer.name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-500">Name</p>
                                                <p className="font-medium text-gray-900">{feedback.customer?.name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Username</p>
                                                <p className="font-medium text-gray-900">@{feedback.customer?.username || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Email</p>
                                                <p className="font-medium text-gray-900">{feedback.customer?.email || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Phone</p>
                                                <p className="font-medium text-gray-900">{feedback.customer?.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feedback Content */}
                            <div className="bg-blue-50 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Feedback</h3>
                                <div className="space-y-4">
                                    {/* Rating */}
                                    {feedback.feedback?.has_rating && (
                                        <div>
                                            <p className="text-sm text-gray-500 mb-2">Rating</p>
                                            <div className="flex items-center space-x-2">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <svg
                                                        key={star}
                                                        className={`w-6 h-6 ${star <= (feedback.feedback.rating || 0)
                                                            ? 'text-yellow-400'
                                                            : 'text-gray-300'
                                                            }`}
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                ))}
                                                <span className="text-lg font-medium text-gray-700 ml-2">
                                                    {feedback.feedback.rating}/5
                                                </span>
                                            </div>
                                        </div>
                                    )}

                                    {/* Content */}
                                    {feedback.feedback?.has_content && feedback.feedback.content ? (
                                        <div>
                                            <p className="text-sm text-gray-500 mb-2">Content</p>
                                            <div className="bg-white border border-blue-200 rounded-lg p-4">
                                                <p className="text-gray-800 leading-relaxed">
                                                    "{feedback.feedback.content}"
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-sm text-gray-500 mb-2">Content</p>
                                            <div className="bg-white border border-gray-200 rounded-lg p-4">
                                                <p className="text-gray-500 italic">No feedback content provided</p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Timestamps */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <p className="text-sm text-gray-500">Created At</p>
                                            <p className="font-medium text-gray-900">
                                                {feedback.feedback?.created_at ? new Date(feedback.feedback.created_at).toLocaleString() : 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-gray-500">Updated At</p>
                                            <p className="font-medium text-gray-900">
                                                {feedback.feedback?.updated_at ? new Date(feedback.feedback.updated_at).toLocaleString() : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Product Information */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Product Information</h3>
                                <div className="flex items-center space-x-4">
                                    <div className="w-20 h-20 rounded-lg overflow-hidden bg-white">
                                        {feedback.variant?.image ? (
                                            <img
                                                src={feedback.variant.image}
                                                alt={feedback.product?.product_name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-gray-500">Product Name</p>
                                                <p className="font-medium text-gray-900">{feedback.product?.product_name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Color</p>
                                                <p className="font-medium text-gray-900">{feedback.variant?.color || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Size</p>
                                                <p className="font-medium text-gray-900">{feedback.variant?.size || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-gray-500">Price</p>
                                                <p className="font-medium text-green-600">{feedback.variant?.price?.toLocaleString('vi-VN')}₫</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Information */}
                            <div className="bg-gray-50 rounded-lg p-4">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">Order Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-gray-500">Order Date</p>
                                        <p className="font-medium text-gray-900">
                                            {feedback.order?.orderDate ? new Date(feedback.order.orderDate).toLocaleDateString() : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-500">Order Status</p>
                                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${feedback.order?.order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                                            feedback.order?.order_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                feedback.order?.order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                            {feedback.order?.order_status || 'Unknown'}
                                        </div>
                                    </div>
                                </div>
                            </div>


                        </div>
                    ) : (
                        <div className="text-center py-12">
                            <p className="text-gray-500">No feedback data available</p>
                        </div>
                    )}
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end p-6 border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default FeedbackDetail;
