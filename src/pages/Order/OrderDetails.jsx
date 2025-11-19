import React, { useState, useEffect, useCallback, useContext } from "react";
import Api from "../../common/SummaryAPI";
import ImageModal from "../../components/ImageModal";
import UpdateOrderStatusModal from "../../components/UpdateOrderStatusModal";
import UploadRefundProofModal from "../../components/UploadRefundProofModal";
import Loading from "../../components/Loading";
import { getOrderStatusOptionDisabled } from "../../utils/orderUtils";
import { ToastContext } from "../../context/ToastContext";

// Format price to VND
function formatPrice(price) {
    if (typeof price !== 'number' || isNaN(price)) return 'N/A';
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND',
    }).format(price);
}

// Định dạng ngày dd/MM/yyyy HH:mm
function formatDateTime(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

// Định dạng ngày dd/MM/yyyy
function formatDate(dateStr) {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "N/A";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function formatUpdatedAt(dateStr) {
    if (!dateStr) return "Never updated";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "Invalid date";
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
}

const OrderDetails = ({ order, onClose, isOpen, autoOpenRefundModal = false }) => {
    const { showToast } = useContext(ToastContext);
    const [orderDetails, setOrderDetails] = useState([]);
    const [fullOrderData, setFullOrderData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [imageModal, setImageModal] = useState({ isOpen: false, imageUrl: '', alt: '' });
    const [isUpdating, setIsUpdating] = useState(false);
    const [showUpdateForm, setShowUpdateForm] = useState(false);
    const [updateFormData, setUpdateFormData] = useState({
        order_status: ""
    });
    const [showRefundForm, setShowRefundForm] = useState(false);
    const [uploadingRefundProof, setUploadingRefundProof] = useState(false);

    const fetchOrderDetails = useCallback(async () => {
        if (!order?._id) return;

        setLoading(true);
        setError("");
        try {
            const response = await Api.orders.getDetails(order._id);
            console.log("Order Details Response:", response);

            // Lưu toàn bộ dữ liệu order từ API
            const orderData = response?.data || response;
            setFullOrderData(orderData);

            // API trả về data.orderDetails thay vì data trực tiếp
            const detailsData = orderData?.orderDetails || [];
            setOrderDetails(Array.isArray(detailsData) ? detailsData : []);
        } catch (err) {
            setError(err.message || "Failed to load order details");
            console.error("Fetch Order Details Error:", err);
        } finally {
            setLoading(false);
        }
    }, [order?._id]);

    useEffect(() => {
        if (isOpen && order?._id) {
            fetchOrderDetails();
        }
    }, [isOpen, order?._id, fetchOrderDetails]);

    // Auto-open refund modal if requested and conditions are met
    useEffect(() => {
        if (autoOpenRefundModal && isOpen && !loading && fullOrderData) {
            // Check if refund is allowed
            const currentOrder = fullOrderData || order;
            if (currentOrder?.order_status === 'cancelled' &&
                currentOrder?.payment_method === 'VNPAY' &&
                currentOrder?.pay_status === 'paid' &&
                currentOrder?.refund_status !== 'refunded') {
                // Auto-open refund modal
                setShowRefundForm(true);
            }
        }
    }, [autoOpenRefundModal, isOpen, loading, fullOrderData, order]);

    const displayStatus = (str) => {
        if (!str || typeof str !== "string") return str || "N/A";
        if (str === "not_applicable") return "Not Applicable";
        if (str === "pending_refund") return "Pending Refund";
        if (str === "refunded") return "Refunded";
        return str.charAt(0).toUpperCase() + str.slice(1);
    };

    // Sử dụng dữ liệu từ API nếu có, fallback về props
    const currentOrder = fullOrderData || order;

    // Handle image modal
    const handleImageClick = (imageUrl, alt = 'Image') => {
        setImageModal({ isOpen: true, imageUrl, alt });
    };

    const handleCloseImageModal = () => {
        setImageModal({ isOpen: false, imageUrl: '', alt: '' });
    };

    // Handle update order status
    const handleUpdateOrder = async () => {
        if (!currentOrder?._id) return;

        // Check if order status update is allowed
        if (!isOrderStatusUpdateAllowed()) {
            showToast("Order status cannot be updated for cancelled or delivered orders", "error");
            return;
        }

        // Validate order_status is provided
        if (!updateFormData.order_status || updateFormData.order_status.trim() === "") {
            showToast("Please select an order status", "error");
            setError("Order status is required");
            return;
        }

        // Check if there are any changes
        const currentStatus = currentOrder?.order_status;
        const newStatus = updateFormData.order_status;

        if (currentStatus === newStatus) {
            showToast("No changes detected", "info");
            setShowUpdateForm(false);
            setUpdateFormData({ order_status: "" });
            return;
        }

        // Validate order status transition
        if (getOrderStatusOptionDisabled(currentStatus, newStatus)) {
            showToast(`Invalid status transition: ${currentStatus} → ${newStatus}. Please follow the workflow: Pending → Confirmed → Shipping → Delivered`, "error");
            setError(`Invalid status transition: ${currentStatus} → ${newStatus}`);
            return;
        }

        setIsUpdating(true);
        setError("");
        try {
            // Prepare update data
            const updateData = { order_status: updateFormData.order_status };

            // For VNPAY orders, if not cancelling, ensure pay_status remains paid
            if (currentOrder?.payment_method === "VNPAY" && updateFormData.order_status !== "cancelled") {
                // Keep the current pay_status (should be "paid" for VNPAY)
                if (currentOrder?.pay_status) {
                    updateData.pay_status = currentOrder.pay_status;
                }
            }

            const response = await Api.orders.update(currentOrder._id, updateData);

            // Update local state
            const updatedData = response?.data || response;
            setFullOrderData(prev => ({ ...prev, ...updatedData }));

            // Close update form
            setShowUpdateForm(false);
            setUpdateFormData({ order_status: "" });

            // Show success message
            showToast("Order edited successfully", "success");
        } catch (err) {
            // Extract error message from response
            const errorMessage = err?.response?.data?.message || err?.message || "Failed to update order";
            showToast(errorMessage, "error");
            setError(errorMessage);
            console.error("Update Order Error:", err);
            if (err?.response?.data) {
                console.error("Error details:", err.response.data);
            }
        } finally {
            setIsUpdating(false);
        }
    };

    const handleEditClick = () => {
        setUpdateFormData({
            order_status: currentOrder?.order_status || ""
        });
        setShowUpdateForm(true);
    };

    const handleCancelEdit = () => {
        setShowUpdateForm(false);
        setUpdateFormData({ order_status: "" });
    };

    const handleFormChange = (field, value) => {
        setUpdateFormData(prev => ({ ...prev, [field]: value }));
    };

    // Check if refund management is allowed
    const isRefundManagementAllowed = () => {
        return currentOrder?.order_status === 'cancelled' &&
            currentOrder?.payment_method === 'VNPAY' &&
            currentOrder?.pay_status === 'paid';
    };

    // Check if order status update is allowed
    const isOrderStatusUpdateAllowed = () => {
        const orderStatus = currentOrder?.order_status;
        const paymentMethod = currentOrder?.payment_method;
        const payStatus = currentOrder?.pay_status;

        // VNPAY orders that are unpaid cannot be updated (only cancellation is allowed)
        if (paymentMethod === "VNPAY" && payStatus === "unpaid") {
            return false;
        }

        // Only allow update for pending, confirmed, or shipping orders
        return orderStatus === 'pending' || orderStatus === 'confirmed' || orderStatus === 'shipping';
    };

    // Check if refund status update is allowed (only for cancelled VNPAY paid orders that are not yet refunded)
    const isRefundStatusUpdateAllowed = () => {
        return currentOrder?.order_status === 'cancelled' &&
            currentOrder?.payment_method === 'VNPAY' &&
            currentOrder?.pay_status === 'paid' &&
            currentOrder?.refund_status !== 'refunded';
    };

    // Handle refund proof upload from modal
    const handleRefundProofUpload = async (refundProofUrl) => {
        if (!currentOrder?._id) return;

        // Check if refund status update is allowed (only for VNPAY + paid + cancelled orders)
        if (!isRefundStatusUpdateAllowed()) {
            showToast("Refund can only be updated for cancelled VNPAY paid orders", "error");
            throw new Error("Refund can only be updated for cancelled VNPAY paid orders");
        }

        // Validate refund proof is required
        if (!refundProofUrl) {
            showToast("Refund proof is required", "error");
            throw new Error("Refund proof is required");
        }

        setUploadingRefundProof(true);
        setError("");

        try {
            // Update refund data - only refund_proof
            // Don't send order_status, pay_status, or cancelReason to avoid validation errors
            const updateData = {};

            // Always update proof if we have a URL
            if (refundProofUrl) {
                updateData.refund_proof = refundProofUrl;

                // When proof is uploaded successfully, automatically set refund_status to "refunded"
                // Only if not already refunded and a new proof was uploaded
                if (!isRefunded && refundProofUrl !== currentOrder?.refund_proof) {
                    updateData.refund_status = "refunded";
                }
            }

            const response = await Api.orders.update(currentOrder._id, updateData);
            console.log("Refund Update Response:", response);

            // Update local state
            const updatedData = response?.data || response;
            setFullOrderData(prev => ({ ...prev, ...updatedData }));

            // Close refund form
            setShowRefundForm(false);

            // Show success message
            showToast("Refund proof uploaded successfully", "success");
        } catch (err) {
            // Handle order update errors
            console.error("Refund Update Error:", err);

            let errorMessage = "Failed to update refund status";

            // Extract error message from response
            if (err?.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err?.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err?.message) {
                errorMessage = err.message;
            }

            // Check for network errors
            if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || !err.response) {
                errorMessage = "Failed to upload refund proof. Please try again later.";
            } else if (err?.response?.status === 500) {
                errorMessage = "Failed to upload refund proof. Server error - please try again later";
            }

            setError(errorMessage);
            throw err; // Re-throw to be handled by modal
        } finally {
            setUploadingRefundProof(false);
        }
    };

    const handleRefundEditClick = () => {
        setShowRefundForm(true);
    };

    const handleRefundCancelEdit = () => {
        setShowRefundForm(false);
        setError("");
    };


    const payStatusOptions = [
        { value: "unpaid", label: "Unpaid" },
        { value: "paid", label: "Paid" },
    ];

    const refundStatusOptions = [
        { value: "not_applicable", label: "Not Applicable" },
        { value: "pending_refund", label: "Pending Refund" },
        { value: "refunded", label: "Refunded" },
    ];

    // Refund status options for Process Refund form (only pending and refunded)
    const refundManagementOptions = [
        { value: "pending_refund", label: "Pending Refund" },
        { value: "refunded", label: "Refunded" },
    ];

    // Check if refund status is already refunded
    const isRefunded = currentOrder?.refund_status === 'refunded';


    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-4xl max-h-[90vh] flex flex-col transform transition-all duration-300" style={{ borderColor: '#A86523' }}>
                {/* Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b shrink-0" style={{ borderColor: '#A86523' }}>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">Order Details</h2>
                    <div className="flex items-center gap-2">
                        {!showUpdateForm && !showRefundForm && (
                            <>
                                {isRefundStatusUpdateAllowed() && (
                                    <button
                                        onClick={handleRefundEditClick}
                                        className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 text-white rounded-xl transition-all duration-300 font-medium text-xs sm:text-sm shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                                        title="Process refund status and proof"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                        </svg>
                                        <span className="hidden sm:inline">Process Refund</span>
                                    </button>
                                )}
                                {isOrderStatusUpdateAllowed() && (
                                    <button
                                        onClick={handleEditClick}
                                        className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 text-white rounded-xl transition-all duration-300 font-medium text-xs sm:text-sm shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                                        title="Update order status"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        <span className="hidden sm:inline">Update Status</span>
                                    </button>
                                )}
                            </>
                        )}
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
                </div>

                {/* Content */}
                <style>{`
                    .hide-scrollbar::-webkit-scrollbar {
                        display: none;
                    }
                `}</style>
                <div
                    className="flex-1 overflow-y-auto hide-scrollbar p-4 sm:p-5 lg:p-6"
                    style={{
                        scrollbarWidth: 'none', /* Firefox */
                        msOverflowStyle: 'none', /* IE and Edge */
                    }}
                >
                    <div className="space-y-3 sm:space-y-4">
                        {/* Order Status Overview */}
                        <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 border" style={{ borderColor: '#A86523' }}>
                            <div className="mb-1.5 sm:mb-2">
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 flex items-center">
                                    <svg className="w-5 h-5 mr-2" style={{ color: '#A86523' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Order Status Overview
                                </h3>
                            </div>

                            {!showUpdateForm && (
                                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Order Status</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Payment Method</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Payment Status</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Refund Status</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                <tr>
                                                    <td className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-900">
                                                        {displayStatus(currentOrder?.order_status)}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-900">
                                                        {displayStatus(currentOrder?.payment_method)}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-900">
                                                        {displayStatus(currentOrder?.pay_status)}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs sm:text-sm font-medium text-gray-900">
                                                        {displayStatus(currentOrder?.refund_status)}
                                                    </td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}

                        </div>

                        {/* Refund Proof */}
                        {currentOrder?.refund_proof && (
                            <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 border" style={{ borderColor: '#A86523' }}>
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2 flex items-center">
                                    Refund Proof
                                </h3>
                                <div className="bg-white rounded-lg p-2.5 sm:p-3 shadow-sm">
                                    <div className="flex items-center space-x-2 sm:space-x-3">
                                        <img
                                            src={currentOrder.refund_proof}
                                            alt="Refund proof"
                                            className="h-16 w-16 sm:h-20 sm:w-20 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                            onClick={() => handleImageClick(currentOrder.refund_proof, "Refund proof")}
                                        />
                                        <div className="flex-1">
                                            <p className="text-xs sm:text-sm text-gray-600 mb-1">Click image to view full size</p>
                                            <div className="flex items-center text-xs text-gray-500">
                                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                                Refund documentation provided
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Pricing Information and Customer Information on same row */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                            {/* Pricing Information */}
                            <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 border" style={{ borderColor: '#A86523' }}>
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Pricing Information</h3>
                                <div className="flex flex-col gap-1.5 sm:gap-2">
                                    <div className="flex flex-col">
                                        <p className="text-xs text-gray-500 mb-0.5">Subtotal</p>
                                        <p className="text-sm sm:text-base font-medium text-gray-900">{formatPrice(currentOrder?.totalPrice || 0)}</p>
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-xs text-gray-500 mb-0.5">Discount</p>
                                        <p className="text-sm sm:text-base font-medium text-red-600">-{formatPrice(currentOrder?.discountAmount || 0)}</p>
                                    </div>
                                    <div className="flex flex-col">
                                        <p className="text-xs text-gray-500 mb-0.5">Final Amount</p>
                                        <p className="text-sm sm:text-base font-medium text-green-600">{formatPrice(currentOrder?.finalPrice || currentOrder?.totalPrice || 0)}</p>
                                    </div>
                                </div>
                                {currentOrder?.voucher && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <div className="flex items-center">
                                            <svg className="w-4 h-4 mr-1.5" style={{ color: '#A86523' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                            <span className="text-xs text-gray-600">Voucher: </span>
                                            <span className="ml-1 text-xs font-semibold" style={{ color: '#A86523' }}>
                                                {currentOrder.voucher.code} ({currentOrder.voucher.discountType === 'percentage' ? `${currentOrder.voucher.discountValue}%` : `${formatPrice(currentOrder.voucher.discountValue)}`})
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Customer Information */}
                            <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 border" style={{ borderColor: '#A86523' }}>
                                <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Customer Information</h3>
                                <div className="flex items-start space-x-2 sm:space-x-3">
                                    <div
                                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gray-200 shrink-0 cursor-pointer hover:opacity-80 transition-opacity duration-200"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            const accountId = currentOrder?.customer?._id ||
                                                currentOrder?.customer?.id ||
                                                currentOrder?.customer?.acc_id;
                                            if (accountId) {
                                                const baseUrl = window.location.origin;
                                                const url = `${baseUrl}/accounts?accountId=${accountId}`;
                                                window.open(url, '_blank', 'noopener,noreferrer');
                                            }
                                        }}
                                        title="Click to view account details"
                                        style={{ pointerEvents: 'auto' }}
                                    >
                                        {currentOrder?.customer?.image ? (
                                            <img
                                                src={currentOrder.customer.image}
                                                alt={currentOrder.customer.name}
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
                                        <div className="flex flex-col gap-1.5 sm:gap-2">
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Name</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{currentOrder?.customer?.name || 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-xs text-gray-500 mb-0.5">Username</p>
                                                <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">@{currentOrder?.customer?.username || 'N/A'}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Order Information */}
                        <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 border" style={{ borderColor: '#A86523' }}>
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Order Information</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                                {/* Left Column */}
                                <div className="flex flex-col">
                                    <p className="text-xs text-gray-500 mb-0.5">Recipient Name</p>
                                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                        {currentOrder?.name || currentOrder?.acc_id?.name || currentOrder?.acc_id?.username || "Guest"}
                                    </p>
                                </div>
                                {/* Right Column */}
                                <div className="flex flex-col">
                                    <p className="text-xs text-gray-500 mb-0.5">Delivery Address</p>
                                    <p className="text-xs sm:text-sm font-medium text-gray-900 wrap-break-word">{currentOrder?.addressReceive || "N/A"}</p>
                                </div>
                                {/* Left Column */}
                                <div className="flex flex-col">
                                    <p className="text-xs text-gray-500 mb-0.5">Recipient Phone</p>
                                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">
                                        {currentOrder?.acc_id?.phone || currentOrder?.phone || "N/A"}
                                    </p>
                                </div>
                                {/* Right Column */}
                                <div className="flex flex-col">
                                    <p className="text-xs text-gray-500 mb-0.5">Order Date</p>
                                    <p className="text-xs sm:text-sm font-medium text-gray-900">
                                        {formatDateTime(currentOrder?.orderDate || currentOrder?.createdAt || currentOrder?.created_at) || "N/A"}
                                    </p>
                                </div>
                                {/* Left Column - Completed Date (only if delivered) */}
                                {currentOrder?.order_status === 'delivered' && (
                                    <div className="flex flex-col">
                                        <p className="text-xs text-gray-500 mb-0.5">Completed Date</p>
                                        <p className="text-xs sm:text-sm font-medium text-gray-900">
                                            {formatDateTime(currentOrder?.updatedAt || currentOrder?.updated_at) || "N/A"}
                                        </p>
                                    </div>
                                )}
                                {/* Cancel Reason (only if cancelled) */}
                                {currentOrder?.order_status === 'cancelled' && (
                                    <div className="sm:col-span-2 flex flex-col">
                                        <p className="text-xs text-gray-500 mb-0.5">Cancel Reason</p>
                                        <p className={`text-xs sm:text-sm font-medium ${currentOrder?.cancelReason ? 'text-yellow-600' : 'text-gray-600'}`}>
                                            {displayStatus(currentOrder?.cancelReason || "N/A")}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="bg-gray-50 rounded-lg p-2.5 sm:p-3 border" style={{ borderColor: '#A86523' }}>
                            <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2 flex items-center">
                                Order Items
                                <span className="ml-2 px-2 py-0.5 sm:px-3 sm:py-1 bg-gray-200 text-gray-800 text-xs sm:text-sm font-semibold rounded-full">
                                    {orderDetails.length} item{orderDetails.length !== 1 ? 's' : ''}
                                </span>
                            </h3>

                            {loading ? (
                                <Loading
                                    type="page"
                                    size="medium"
                                    message="Loading order details..."
                                    className="py-10"
                                />
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
                                        onClick={fetchOrderDetails}
                                        className="px-4 py-2 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-sm font-semibold bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                                    >
                                        Retry
                                    </button>
                                </div>
                            ) : orderDetails.length === 0 ? (
                                <div className="text-center py-12">
                                    <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <p className="text-gray-500 text-lg">No order details found</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product</th>
                                                    <th className="px-3 py-2 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Variant</th>
                                                    <th className="px-3 py-2 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Quantity</th>
                                                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Unit Price</th>
                                                    <th className="px-3 py-2 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {orderDetails.map((detail, index) => (
                                                    <tr key={detail._id || index} className="hover:bg-gray-50 transition-colors duration-150">
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center space-x-2 sm:space-x-3">
                                                                {detail.variant?.image ? (
                                                                    <img
                                                                        className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity shrink-0"
                                                                        src={detail.variant.image}
                                                                        alt={detail.variant.product?.name}
                                                                        onClick={() => handleImageClick(detail.variant.image, detail.variant.product?.name)}
                                                                    />
                                                                ) : (
                                                                    <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg bg-gray-200 flex items-center justify-center border border-gray-200 shrink-0">
                                                                        <svg className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                        </svg>
                                                                    </div>
                                                                )}
                                                                <div className="min-w-0">
                                                                    {detail.variant?.product?.name ? (
                                                                        <div
                                                                            className="text-xs sm:text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 hover:underline transition-colors duration-200 truncate"
                                                                            onClick={(e) => {
                                                                                e.preventDefault();
                                                                                e.stopPropagation();
                                                                                const productId = detail.variant?.product?._id ||
                                                                                    detail.variant?.product_id ||
                                                                                    detail.variant?.productId;
                                                                                if (productId) {
                                                                                    const baseUrl = window.location.origin;
                                                                                    const url = `${baseUrl}/products?productId=${productId}`;
                                                                                    window.open(url, '_blank', 'noopener,noreferrer');
                                                                                }
                                                                            }}
                                                                            title="Click to view product details"
                                                                        >
                                                                            {detail.variant.product.name}
                                                                        </div>
                                                                    ) : (
                                                                        <div className="text-xs sm:text-sm font-medium text-gray-900">
                                                                            Unknown Product
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2">
                                                            <div className="text-xs sm:text-sm text-gray-900">
                                                                {detail.variant?.color?.name && detail.variant?.size?.name
                                                                    ? `${detail.variant.color.name} - ${detail.variant.size.name}`
                                                                    : detail.variant?.color?.name || detail.variant?.size?.name || "Standard"
                                                                }
                                                            </div>
                                                        </td>
                                                        <td className="px-3 py-2 text-center text-xs sm:text-sm font-medium text-gray-900">
                                                            {detail.quantity || 0}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs sm:text-sm font-medium text-gray-900">
                                                            {formatPrice(detail.unitPrice || 0)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-xs sm:text-sm font-medium text-gray-900">
                                                            {formatPrice(detail.totalPrice || 0)}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>
                </div>
            </div>

            {/* Update Status Modal */}
            <UpdateOrderStatusModal
                isOpen={showUpdateForm}
                onClose={handleCancelEdit}
                order={currentOrder}
                updateFormData={updateFormData}
                onFormChange={handleFormChange}
                onUpdate={handleUpdateOrder}
                isUpdating={isUpdating}
                error={error}
            />

            {/* Upload Refund Proof Modal */}
            <UploadRefundProofModal
                isOpen={showRefundForm}
                onClose={handleRefundCancelEdit}
                currentProof={currentOrder?.refund_proof}
                onUpload={handleRefundProofUpload}
                isUploading={uploadingRefundProof}
                error={error}
                onImageClick={(imageUrl, alt) => setImageModal({ isOpen: true, imageUrl, alt })}
            />

            {/* Image Modal */}
            <ImageModal
                isOpen={imageModal.isOpen}
                onClose={handleCloseImageModal}
                imageUrl={imageModal.imageUrl}
                alt={imageModal.alt}
            />
        </div>
    );
};

export default OrderDetails;