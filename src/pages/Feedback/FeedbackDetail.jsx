import React, { useState, useEffect, useCallback } from 'react';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import ImageModal from '../../components/ImageModal';

const FeedbackDetail = ({ feedbackId, isOpen, onClose }) => {
    const { user } = React.useContext(AuthContext);
    const [feedback, setFeedback] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');

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
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-4xl max-h-[90vh] flex flex-col transform transition-all duration-300"
                style={{ borderColor: '#A86523' }}
            >
                {/* Modal Header */}
                <div
                    className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b shrink-0"
                    style={{ borderColor: '#A86523' }}
                >
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Feedback Details</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': '#A86523' }}
                        aria-label="Close modal"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-5 lg:p-6">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: '#FCEFCB', borderBottomColor: '#E9A319' }}></div>
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
                                className="px-4 py-2 text-white rounded-lg transition-colors duration-200"
                                style={{ backgroundColor: '#E9A319' }}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
                            >
                                Retry
                            </button>
                        </div>
                    ) : feedback ? (
                        <div className="space-y-4">
                            {/* Customer Information */}
                            <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3">
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Customer Information</h3>
                                <div className="flex items-start space-x-2 sm:space-x-3">
                                    <div
                                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gray-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity duration-200"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const accountId = feedback.customer?._id ||
                                                feedback.customer?.id ||
                                                feedback.customer?.acc_id;
                                            if (accountId) {
                                                const baseUrl = window.location.origin;
                                                const url = `${baseUrl}/accounts?accountId=${accountId}`;
                                                window.open(url, '_blank', 'noopener,noreferrer');
                                            }
                                        }}
                                        title="Click to view account details"
                                        style={{ pointerEvents: 'auto' }}
                                    >
                                        {feedback.customer?.image ? (
                                            <img
                                                src={feedback.customer.image}
                                                alt={feedback.customer.name}
                                                className="w-full h-full object-cover pointer-events-none"
                                                draggable="false"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 pointer-events-none">
                                                <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 20 20">
                                                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Name</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{feedback.customer?.name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Username</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">@{feedback.customer?.username || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Email</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{feedback.customer?.email || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{feedback.customer?.phone || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Feedback Content */}
                            <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3">
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Feedback</h3>
                                <div className="space-y-2">
                                    {/* Rating and Timestamps Row */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                                    {/* Rating */}
                                    {feedback.feedback?.has_rating && (
                                        <div>
                                                <p className="text-xs text-gray-500 mb-1">Rating</p>
                                                <div className="flex items-center space-x-1">
                                                {[1, 2, 3, 4, 5].map((star) => (
                                                    <svg
                                                        key={star}
                                                            className={`w-4 h-4 sm:w-5 sm:h-5 ${star <= (feedback.feedback.rating || 0)
                                                            ? 'text-yellow-400'
                                                            : 'text-gray-300'
                                                            }`}
                                                        fill="currentColor"
                                                        viewBox="0 0 20 20"
                                                    >
                                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                    </svg>
                                                ))}
                                                    <span className="text-sm sm:text-base font-medium text-gray-700 ml-1.5">
                                                    {feedback.feedback.rating}/5
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                        {/* Timestamps */}
                                        <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Created</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900">
                                                    {feedback.feedback?.created_at ? new Date(feedback.feedback.created_at).toLocaleString('vi-VN', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    }) : 'N/A'}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Updated</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900">
                                                    {feedback.feedback?.updated_at ? new Date(feedback.feedback.updated_at).toLocaleString('vi-VN', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric',
                                                        hour: '2-digit',
                                                        minute: '2-digit'
                                                    }) : 'N/A'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Content */}
                                    {feedback.feedback?.has_content && feedback.feedback.content ? (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Content</p>
                                            <div className="bg-white border rounded-lg p-2 sm:p-3" style={{ borderColor: '#A86523' }}>
                                                <p className="text-xs sm:text-sm text-gray-800 leading-relaxed">
                                                    "{feedback.feedback.content}"
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <p className="text-xs text-gray-500 mb-1">Content</p>
                                            <div className="bg-white border border-gray-200 rounded-lg p-2 sm:p-3">
                                                <p className="text-xs sm:text-sm text-gray-500 italic">No feedback content provided</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Product Information */}
                            <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3">
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Product Information</h3>
                                <div className="flex items-start space-x-2 sm:space-x-3">
                                    <div
                                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden bg-white cursor-pointer hover:opacity-80 transition-opacity duration-200 relative shrink-0"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (feedback.variant?.image) {
                                                setSelectedImage(feedback.variant.image);
                                                setShowImageModal(true);
                                            }
                                        }}
                                        title="Click to view image"
                                        style={{ pointerEvents: 'auto' }}
                                    >
                                        {feedback.variant?.image ? (
                                            <img
                                                src={feedback.variant.image}
                                                alt={feedback.product?.product_name}
                                                className="w-full h-full object-cover pointer-events-none"
                                                draggable="false"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-gray-400 pointer-events-none">
                                                <svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Product Name</p>
                                                {feedback.product?.product_name ? (
                                                    <p
                                                        className="text-xs sm:text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline transition-colors duration-200 truncate"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const productId = feedback.product?.product_id ||
                                                                feedback.product?._id ||
                                                                feedback.product?.id ||
                                                                feedback.variant?.product_id ||
                                                                feedback.variant?.productId;
                                                            if (productId) {
                                                                const baseUrl = window.location.origin;
                                                                const url = `${baseUrl}/products?productId=${productId}`;
                                                                window.open(url, '_blank', 'noopener,noreferrer');
                                                            }
                                                        }}
                                                        title="Click to view product details"
                                                    >
                                                        {feedback.product.product_name}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs sm:text-sm font-medium text-gray-900">N/A</p>
                                                )}
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Color</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900">{feedback.variant?.color || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Size</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900">{feedback.variant?.size || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Price</p>
                                                <p className="text-xs sm:text-sm font-medium text-green-600">{feedback.variant?.price?.toLocaleString('vi-VN')}₫</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Order Information */}
                            <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3">
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Order Information</h3>
                                <div className="flex items-start space-x-2 sm:space-x-3">
                                    <div className="w-12 h-12 sm:w-16 sm:h-16 shrink-0"></div>
                                    <div className="flex-1 min-w-0">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Order ID</p>
                                                {feedback.order?._id ? (
                                                    <p
                                                        className="text-xs font-medium text-gray-900 font-mono cursor-pointer hover:text-blue-600 hover:underline transition-colors duration-200 break-all"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            const baseUrl = window.location.origin;
                                                            const orderId = feedback.order._id;
                                                            const url = `${baseUrl}/orders?orderId=${orderId}`;
                                                            window.open(url, '_blank', 'noopener,noreferrer');
                                                        }}
                                                        title="Click to view order details"
                                                    >
                                                        {feedback.order._id}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs font-medium text-gray-900 font-mono">N/A</p>
                                                )}
                                            </div>
                                    <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Order Date</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900">
                                                    {feedback.order?.orderDate ? new Date(feedback.order.orderDate).toLocaleDateString('vi-VN', {
                                                        day: '2-digit',
                                                        month: '2-digit',
                                                        year: 'numeric'
                                                    }) : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Order Status</p>
                                                <div className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${feedback.order?.order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                                            feedback.order?.order_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                feedback.order?.order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                            feedback.order?.order_status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                                                feedback.order?.order_status === 'shipping' ? 'bg-purple-100 text-purple-800' :
                                                    'bg-gray-100 text-gray-800'
                                            }`}>
                                                    {feedback.order?.order_status ? feedback.order.order_status.charAt(0).toUpperCase() + feedback.order.order_status.slice(1) : 'Unknown'}
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Final Price</p>
                                                <p className="text-xs sm:text-sm font-medium text-green-600">
                                                    {feedback.order?.finalPrice ? `${feedback.order.finalPrice.toLocaleString('vi-VN')}₫` : 'N/A'}
                                                </p>
                                            </div>
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
                <div
                    className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5 border-t shrink-0"
                    style={{ borderColor: '#A86523' }}
                >
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-6 py-2.5 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:hover:shadow-md"
                        style={{ backgroundColor: '#E9A319', '--tw-ring-color': '#A86523' }}
                        onMouseEnter={(e) => {
                            if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#A86523';
                        }}
                        onMouseLeave={(e) => {
                            if (!e.currentTarget.disabled) e.currentTarget.style.backgroundColor = '#E9A319';
                        }}
                        disabled={loading}
                    >
                        Close
                    </button>
                </div>
            </div>

            {/* Image Modal */}
            <ImageModal
                isOpen={showImageModal}
                onClose={() => {
                    setShowImageModal(false);
                    setSelectedImage('');
                }}
                imageUrl={selectedImage}
                alt={feedback?.product?.product_name || 'Product image'}
            />
        </div>
    );
};

export default FeedbackDetail;
