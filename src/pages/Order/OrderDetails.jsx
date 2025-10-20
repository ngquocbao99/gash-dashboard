import React, { useState, useEffect, useCallback, useContext } from "react";
import Api from "../../common/SummaryAPI";
import ImageModal from "../../components/ImageModal";
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

const OrderDetails = ({ order, onClose, isOpen }) => {
    const { showToast } = useContext(ToastContext);
    const [orderDetails, setOrderDetails] = useState([]);
    const [fullOrderData, setFullOrderData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [imageModal, setImageModal] = useState({ isOpen: false, imageUrl: '', alt: '' });
    const [isUpdating, setIsUpdating] = useState(false);
    const [showUpdateForm, setShowUpdateForm] = useState(false);
    const [updateFormData, setUpdateFormData] = useState({
        order_status: "",
        pay_status: ""
    });
    const [showRefundForm, setShowRefundForm] = useState(false);
    const [refundFormData, setRefundFormData] = useState({
        refund_status: "",
        refund_proof: null
    });
    const [refundProofPreview, setRefundProofPreview] = useState(null);
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

        // Validate order status transition
        const currentStatus = currentOrder?.order_status;
        const newStatus = updateFormData.order_status;

        if (newStatus && getOrderStatusOptionDisabled(currentStatus, newStatus)) {
            showToast(`Invalid status transition: ${currentStatus} → ${newStatus}. Please follow the workflow: Pending → Confirmed → Shipping → Delivered/Cancelled`, "error");
            return;
        }

        setIsUpdating(true);
        setError("");
        try {
            const response = await Api.orders.update(currentOrder._id, updateFormData);
            console.log("Update Order Response:", response);

            // Update local state
            const updatedData = response?.data || response;
            setFullOrderData(prev => ({ ...prev, ...updatedData }));

            // Close update form
            setShowUpdateForm(false);
            setUpdateFormData({ order_status: "", pay_status: "" });

            // Show success message
            showToast("Order updated successfully!", "success");
        } catch (err) {
            showToast(err.message || "Failed to update order", "error");
            console.error("Update Order Error:", err);
        } finally {
            setIsUpdating(false);
        }
    };

    const handleEditClick = () => {
        setUpdateFormData({
            order_status: currentOrder?.order_status || "",
            pay_status: currentOrder?.pay_status || ""
        });
        setShowUpdateForm(true);
    };

    const handleCancelEdit = () => {
        setShowUpdateForm(false);
        setUpdateFormData({ order_status: "", pay_status: "" });
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
        return orderStatus === 'pending' || orderStatus === 'confirmed' || orderStatus === 'shipping';
    };

    // Check if refund status update is allowed (only for cancelled VNPAY paid orders)
    const isRefundStatusUpdateAllowed = () => {
        return currentOrder?.order_status === 'cancelled' &&
            currentOrder?.payment_method === 'VNPAY' &&
            currentOrder?.pay_status === 'paid';
    };

    // Handle refund proof upload
    const handleRefundProofChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setRefundFormData(prev => ({ ...prev, refund_proof: file }));

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setRefundProofPreview(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle refund status update
    const handleRefundUpdate = async () => {
        if (!currentOrder?._id) return;

        // Check if refund status update is allowed
        if (!isRefundStatusUpdateAllowed()) {
            showToast("Refund status can only be updated for cancelled VNPAY paid orders", "error");
            return;
        }

        // Validate refund proof is required for cancelled VNPAY paid orders
        if (!refundFormData.refund_proof && !currentOrder?.refund_proof) {
            showToast("Refund proof is required for cancelled VNPAY paid orders", "error");
            return;
        }

        setUploadingRefundProof(true);
        setError("");

        try {
            let refundProofUrl = currentOrder?.refund_proof;

            // Upload refund proof if provided
            if (refundFormData.refund_proof) {
                const uploadResponse = await Api.upload.image(refundFormData.refund_proof);
                refundProofUrl = uploadResponse?.data?.url || uploadResponse?.url;
            }

            // Update refund data
            const updateData = {};

            // Only update status if not already refunded
            if (!isRefunded) {
                updateData.refund_status = refundFormData.refund_status;
            }

            // Always allow updating proof
            if (refundProofUrl) {
                updateData.refund_proof = refundProofUrl;
            }

            const response = await Api.orders.update(currentOrder._id, updateData);
            console.log("Refund Update Response:", response);

            // Update local state
            const updatedData = response?.data || response;
            setFullOrderData(prev => ({ ...prev, ...updatedData }));

            // Close refund form
            setShowRefundForm(false);
            setRefundFormData({ refund_status: "", refund_proof: null });
            setRefundProofPreview(null);

            // Show success message
            showToast("Refund status updated successfully!", "success");
        } catch (err) {
            showToast(err.message || "Failed to update refund status", "error");
            console.error("Refund Update Error:", err);
        } finally {
            setUploadingRefundProof(false);
        }
    };

    const handleRefundEditClick = () => {
        // Set default to pending_refund if current status is not_applicable
        const defaultStatus = currentOrder?.refund_status === "not_applicable"
            ? "pending_refund"
            : currentOrder?.refund_status || "pending_refund";

        setRefundFormData({
            refund_status: defaultStatus,
            refund_proof: null
        });
        setRefundProofPreview(null);
        setShowRefundForm(true);
    };

    const handleRefundCancelEdit = () => {
        setShowRefundForm(false);
        setRefundFormData({ refund_status: "", refund_proof: null });
        setRefundProofPreview(null);
    };

    const handleRefundFormChange = (field, value) => {
        setRefundFormData(prev => ({ ...prev, [field]: value }));
    };

    // Order status options
    const orderStatusOptions = [
        { value: "pending", label: "Pending" },
        { value: "confirmed", label: "Confirmed" },
        { value: "shipping", label: "Shipping" },
        { value: "delivered", label: "Delivered" },
        { value: "cancelled", label: "Cancelled" },
    ];

    const payStatusOptions = [
        { value: "unpaid", label: "Unpaid" },
        { value: "paid", label: "Paid" },
    ];

    const refundStatusOptions = [
        { value: "not_applicable", label: "Not Applicable" },
        { value: "pending_refund", label: "Pending Refund" },
        { value: "refunded", label: "Refunded" },
    ];

    // Refund status options for Manage Refund form (only pending and refunded)
    const refundManagementOptions = [
        { value: "pending_refund", label: "Pending Refund" },
        { value: "refunded", label: "Refunded" },
    ];

    // Check if refund status is already refunded
    const isRefunded = currentOrder?.refund_status === 'refunded';

    // Order status transition validation
    const getOrderStatusOptionDisabled = (currentStatus, optionValue) => {
        // Define allowed transitions based on workflow
        const allowedTransitions = {
            pending: ["confirmed", "cancelled"],
            confirmed: ["shipping", "cancelled"],
            shipping: ["delivered", "cancelled"],
            delivered: [], // No transitions from delivered
            cancelled: [], // No transitions from cancelled
        };

        // Handle undefined or null currentStatus
        if (!currentStatus || typeof currentStatus !== 'string') {
            return true; // Disable all options if status is invalid
        }

        // If current status is delivered or cancelled, disable all options
        if (currentStatus === "delivered" || currentStatus === "cancelled") {
            return true;
        }

        // If option value is the same as current status, don't disable
        if (optionValue === currentStatus) {
            return false;
        }

        // Check if the transition is allowed
        const allowedOptions = allowedTransitions[currentStatus];
        if (!allowedOptions || !Array.isArray(allowedOptions)) {
            return true; // Disable if no valid transitions found
        }

        return !allowedOptions.includes(optionValue);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-6 py-5 border-b border-gray-200">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Details</h2>
                            <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                    </svg>
                                    <span className="font-medium">Order ID:</span>
                                    <span className="ml-1 font-mono text-blue-600">{currentOrder?._id}</span>
                                </div>
                                <div className="flex items-center">
                                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span className="font-medium">Date:</span>
                                    <span className="ml-1">{formatDateTime(currentOrder?.orderDate)}</span>
                                </div>
                                <div className="flex items-center">
                                    <span className="font-medium">Total:</span>
                                    <span className="ml-1 font-bold text-green-600">{formatPrice(currentOrder?.finalPrice || currentOrder?.totalPrice)}</span>
                                </div>
                                {currentOrder?.summary && (
                                    <div className="flex items-center">
                                        <span className="font-medium">Items:</span>
                                        <span className="ml-1">{currentOrder.summary.totalItems} products ({currentOrder.summary.totalQuantity} qty)</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2 hover:bg-white rounded-lg"
                            aria-label="Close order details"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="overflow-y-auto max-h-[calc(95vh-140px)]">
                    <div className="p-6 space-y-6">
                        {/* Order Status Overview */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-200">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-900 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Order Status Overview
                                </h3>
                                {!showUpdateForm && !showRefundForm && (
                                    <div className="flex gap-2">
                                        {isRefundStatusUpdateAllowed() && (
                                            <button
                                                onClick={handleRefundEditClick}
                                                className="flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all duration-200 font-medium text-sm"
                                                title="Manage refund status and proof"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                                </svg>
                                                <span>Manage Refund</span>
                                            </button>
                                        )}
                                        {isOrderStatusUpdateAllowed() && (
                                            <button
                                                onClick={handleEditClick}
                                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-medium text-sm"
                                                title="Update order status"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                                <span>Update Status</span>
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>

                            {showUpdateForm ? (
                                <div className="bg-white rounded-lg p-6 shadow-sm">
                                    {/* Error Message */}
                                    {error && (
                                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="flex items-center">
                                                <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p className="text-sm text-red-800">{error}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Order Status
                                            </label>
                                            <select
                                                value={updateFormData.order_status}
                                                onChange={(e) => handleFormChange("order_status", e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                            >
                                                {orderStatusOptions.map((opt) => (
                                                    <option
                                                        key={opt.value}
                                                        value={opt.value}
                                                        disabled={getOrderStatusOptionDisabled(currentOrder?.order_status, opt.value)}
                                                        className={getOrderStatusOptionDisabled(currentOrder?.order_status, opt.value) ? 'text-gray-400' : ''}
                                                    >
                                                        {opt.label}
                                                        {getOrderStatusOptionDisabled(currentOrder?.order_status, opt.value) ? ' (Not Allowed)' : ''}
                                                    </option>
                                                ))}
                                            </select>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Workflow: Pending → Confirmed → Shipping → Delivered/Cancelled
                                            </p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Payment Status
                                                <span className="text-xs text-gray-500 ml-2">
                                                    (Current: {displayStatus(currentOrder?.pay_status)})
                                                </span>
                                            </label>
                                            <select
                                                value={updateFormData.pay_status}
                                                onChange={(e) => handleFormChange("pay_status", e.target.value)}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                                            >
                                                {payStatusOptions.map((opt) => (
                                                    <option key={opt.value} value={opt.value}>
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end space-x-3">
                                        <button
                                            onClick={handleCancelEdit}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleUpdateOrder}
                                            disabled={isUpdating}
                                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                        >
                                            {isUpdating && (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            )}
                                            <span>{isUpdating ? 'Updating...' : 'Update Order'}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="bg-white rounded-lg p-6 shadow-sm">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                        <div className="text-center">
                                            <div className="flex items-center justify-center mb-2">
                                                <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p className="text-sm font-medium text-gray-600">Order Status</p>
                                            </div>
                                            <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${currentOrder?.order_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                                currentOrder?.order_status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                                    currentOrder?.order_status === 'shipping' ? 'bg-purple-100 text-purple-800' :
                                                        currentOrder?.order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                                                            currentOrder?.order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                                                'bg-gray-100 text-gray-800'
                                                }`}>
                                                {displayStatus(currentOrder?.order_status)}
                                            </span>
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center mb-2">
                                                <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                                                </svg>
                                                <p className="text-sm font-medium text-gray-600">Payment Method</p>
                                            </div>
                                            <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${currentOrder?.payment_method === 'COD' ? 'bg-orange-100 text-orange-800' :
                                                currentOrder?.payment_method === 'VNPAY' ? 'bg-blue-100 text-blue-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                {displayStatus(currentOrder?.payment_method)}
                                            </span>
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center mb-2">
                                                <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                                </svg>
                                                <p className="text-sm font-medium text-gray-600">Payment Status</p>
                                            </div>
                                            <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${currentOrder?.pay_status === 'paid' ? 'bg-green-100 text-green-800' :
                                                currentOrder?.pay_status === 'unpaid' ? 'bg-red-100 text-red-800' :
                                                    'bg-gray-100 text-gray-800'
                                                }`}>
                                                {displayStatus(currentOrder?.pay_status)}
                                            </span>
                                        </div>
                                        <div className="text-center">
                                            <div className="flex items-center justify-center mb-2">
                                                <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                                <p className="text-sm font-medium text-gray-600">Refund Status</p>
                                            </div>
                                            <span className={`inline-flex px-4 py-2 text-sm font-semibold rounded-full ${currentOrder?.refund_status === 'not_applicable' ? 'bg-gray-100 text-gray-800' :
                                                currentOrder?.refund_status === 'pending_refund' ? 'bg-yellow-100 text-yellow-800' :
                                                    currentOrder?.refund_status === 'refunded' ? 'bg-green-100 text-green-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {displayStatus(currentOrder?.refund_status)}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Refund Management Form */}
                            {showRefundForm && (
                                <div className="bg-white rounded-lg p-6 shadow-sm mt-4">
                                    <div className="flex items-center justify-between mb-4">
                                        <h4 className="text-lg font-semibold text-gray-900 flex items-center">
                                            <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                            </svg>
                                            {isRefunded ? 'Update Refund Proof' : 'Manage Refund'}
                                        </h4>
                                    </div>

                                    {/* Error Message */}
                                    {error && (
                                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                                            <div className="flex items-center">
                                                <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <p className="text-sm text-red-800">{error}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Refund Status
                                            </label>
                                            <select
                                                value={refundFormData.refund_status}
                                                onChange={(e) => handleRefundFormChange("refund_status", e.target.value)}
                                                disabled={isRefunded}
                                                className={`w-full px-3 py-2 border rounded-lg transition-all duration-200 ${isRefunded
                                                    ? 'border-gray-200 bg-gray-100 text-gray-500 cursor-not-allowed'
                                                    : 'border-gray-300 focus:ring-2 focus:ring-orange-500 focus:border-orange-500'
                                                    }`}
                                            >
                                                {refundManagementOptions.map((opt) => (
                                                    <option
                                                        key={opt.value}
                                                        value={opt.value}
                                                        disabled={isRefunded && opt.value === 'pending_refund'}
                                                        className={isRefunded && opt.value === 'pending_refund' ? 'text-gray-400' : ''}
                                                    >
                                                        {opt.label}
                                                    </option>
                                                ))}
                                            </select>
                                            {isRefunded && (
                                                <p className="text-xs text-gray-500 mt-1">
                                                    Status cannot be changed from "Refunded". You can only update the refund proof.
                                                </p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Refund Proof
                                                {currentOrder?.refund_proof && (
                                                    <span className="text-xs text-green-600 ml-2">
                                                        (Current proof available)
                                                    </span>
                                                )}
                                            </label>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleRefundProofChange}
                                                required
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-all duration-200"
                                            />
                                            {refundProofPreview && (
                                                <div className="mt-2">
                                                    <p className="text-sm text-gray-600 mb-2">Preview:</p>
                                                    <img
                                                        src={refundProofPreview}
                                                        alt="Refund proof preview"
                                                        className="w-32 h-32 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => setImageModal({ isOpen: true, imageUrl: refundProofPreview, alt: 'Refund proof preview' })}
                                                    />
                                                </div>
                                            )}
                                            {currentOrder?.refund_proof && !refundProofPreview && (
                                                <div className="mt-2">
                                                    <p className="text-sm text-gray-600 mb-2">Current proof:</p>
                                                    <img
                                                        src={currentOrder.refund_proof}
                                                        alt="Current refund proof"
                                                        className="w-32 h-32 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                                        onClick={() => setImageModal({ isOpen: true, imageUrl: currentOrder.refund_proof, alt: 'Current refund proof' })}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end space-x-3 mt-6">
                                        <button
                                            onClick={handleRefundCancelEdit}
                                            className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleRefundUpdate}
                                            disabled={uploadingRefundProof}
                                            className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                                        >
                                            {uploadingRefundProof && (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                            )}
                                            <span>
                                                {uploadingRefundProof
                                                    ? 'Updating...'
                                                    : isRefunded
                                                        ? 'Update Proof'
                                                        : 'Update Refund'
                                                }
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>



                        {/* Refund Proof */}
                        {currentOrder?.refund_proof && (
                            <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-6 border border-red-200">
                                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                    <svg className="w-5 h-5 mr-2 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    Refund Proof
                                </h3>
                                <div className="bg-white rounded-lg p-6 shadow-sm">
                                    <div className="flex items-center space-x-6">
                                        <img
                                            src={currentOrder.refund_proof}
                                            alt="Refund proof"
                                            className="h-32 w-32 object-cover rounded-lg border-2 border-gray-300 cursor-pointer hover:opacity-80 transition-opacity shadow-md"
                                            onClick={() => handleImageClick(currentOrder.refund_proof, "Refund proof")}
                                        />
                                        <div className="flex-1">
                                            <p className="text-base text-gray-600 mb-2">Click image to view full size</p>
                                            <div className="flex items-center text-sm text-gray-500">
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

                        {/* Customer Information - Simplified */}
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-6 border border-green-200">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                                Customer Information
                            </h3>
                            <div className="bg-white rounded-lg p-6 shadow-sm">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="flex-shrink-0">
                                            {currentOrder?.customer?.image ? (
                                                <img
                                                    className="h-16 w-16 rounded-full object-cover border-2 border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                    src={currentOrder.customer.image}
                                                    alt={currentOrder.customer.name}
                                                    onClick={() => handleImageClick(currentOrder.customer.image, currentOrder.customer.name)}
                                                />
                                            ) : (
                                                <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                                                    <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-gray-900">
                                                {currentOrder?.customer?.name || "Guest"}
                                            </h4>
                                            <p className="text-sm text-gray-500">
                                                @{currentOrder?.customer?.username || "guest"}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            const accountId = currentOrder?.customer?._id;
                                            if (accountId) {
                                                window.open(`/accounts?accountId=${accountId}`, '_blank');
                                            } else {
                                                window.open('/accounts', '_blank');
                                            }
                                        }}
                                        className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all duration-200 font-medium text-sm"
                                        title="View account details"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                        <span>View Account</span>
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Order Information */}
                        <div className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-xl p-6 border border-amber-200">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                Order Information
                            </h3>
                            <div className="bg-white rounded-lg p-6 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                            <div>
                                                <p className="text-sm text-gray-600">Recipient Name</p>
                                                <p className="text-base font-semibold text-gray-900">
                                                    {currentOrder?.name || currentOrder?.acc_id?.name || currentOrder?.acc_id?.username || "Guest"}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center">
                                            <svg className="w-5 h-5 text-gray-400 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                            </svg>
                                            <div>
                                                <p className="text-sm text-gray-600">Phone Number</p>
                                                <p className="text-base font-semibold text-gray-900">
                                                    {currentOrder?.acc_id?.phone || currentOrder?.phone || "N/A"}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex items-start">
                                            <svg className="w-5 h-5 text-gray-400 mr-3 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                            </svg>
                                            <div className="flex-1">
                                                <p className="text-sm text-gray-600">Delivery Address</p>
                                                <p className="text-base font-semibold text-gray-900 break-words">{currentOrder?.addressReceive || "N/A"}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>


                        {/* Pricing Information */}
                        <div className="bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl p-6 border border-emerald-200">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                </svg>
                                Pricing Information
                            </h3>
                            <div className="bg-white rounded-lg p-6 shadow-sm">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="text-center">
                                        <div className="flex items-center justify-center mb-2">
                                            <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-sm font-medium text-gray-600">Subtotal</p>
                                        </div>
                                        <p className="text-xl font-bold text-gray-900">{formatPrice(currentOrder?.totalPrice || 0)}</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center mb-2">
                                            <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                            <p className="text-sm font-medium text-gray-600">Discount</p>
                                        </div>
                                        <p className="text-xl font-bold text-red-600">-{formatPrice(currentOrder?.discountAmount || 0)}</p>
                                    </div>
                                    <div className="text-center">
                                        <div className="flex items-center justify-center mb-2">
                                            <svg className="w-6 h-6 text-gray-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                                            </svg>
                                            <p className="text-sm font-medium text-gray-600">Final Amount</p>
                                        </div>
                                        <p className="text-2xl font-bold text-green-600">{formatPrice(currentOrder?.finalPrice || currentOrder?.totalPrice || 0)}</p>
                                    </div>
                                </div>
                                {currentOrder?.voucher && (
                                    <div className="mt-4 pt-4 border-t border-gray-200">
                                        <div className="flex items-center justify-center">
                                            <svg className="w-5 h-5 text-blue-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                            </svg>
                                            <span className="text-sm text-gray-600">Voucher Applied: </span>
                                            <span className="ml-2 text-sm font-semibold text-blue-600">
                                                {currentOrder.voucher.code} ({currentOrder.voucher.discountType === 'percentage' ? `${currentOrder.voucher.discountValue}%` : `${formatPrice(currentOrder.voucher.discountValue)}`})
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Order Items */}
                        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6 border border-purple-200">
                            <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                Order Items
                                <span className="ml-2 px-3 py-1 bg-purple-100 text-purple-800 text-sm font-semibold rounded-full">
                                    {orderDetails.length} item{orderDetails.length !== 1 ? 's' : ''}
                                </span>
                            </h3>

                            {loading ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600"></div>
                                    <span className="ml-3 text-gray-600 font-medium">Loading order details...</span>
                                </div>
                            ) : error ? (
                                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                                    <div className="flex items-center">
                                        <svg className="h-6 w-6 text-red-400 mr-3" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                        </svg>
                                        <p className="text-red-800 font-medium">{error}</p>
                                    </div>
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
                                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Product</th>
                                                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider">Variant</th>
                                                    <th className="px-6 py-4 text-center text-sm font-semibold text-gray-700 uppercase tracking-wider">Quantity</th>
                                                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Unit Price</th>
                                                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {orderDetails.map((detail, index) => (
                                                    <tr key={detail._id || index} className="hover:bg-gray-50 transition-colors duration-150">
                                                        <td className="px-6 py-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center">
                                                                    {detail.variant?.image ? (
                                                                        <img
                                                                            className="h-16 w-16 rounded-lg object-cover mr-4 border border-gray-200 cursor-pointer hover:opacity-80 transition-opacity"
                                                                            src={detail.variant.image}
                                                                            alt={detail.variant.product?.name}
                                                                            onClick={() => handleImageClick(detail.variant.image, detail.variant.product?.name)}
                                                                        />
                                                                    ) : (
                                                                        <div className="h-16 w-16 rounded-lg bg-gray-200 flex items-center justify-center mr-4">
                                                                            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                            </svg>
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <div className="text-base font-semibold text-gray-900">
                                                                            {detail.variant?.product?.name || "Unknown Product"}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    onClick={() => {
                                                                        const productId = detail.variant?.product?._id;
                                                                        if (productId) {
                                                                            window.open(`/products?productId=${productId}`, '_blank');
                                                                        } else {
                                                                            window.open('/products', '_blank');
                                                                        }
                                                                    }}
                                                                    className="flex items-center space-x-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-medium text-sm"
                                                                    title="View product details"
                                                                >
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                                    </svg>
                                                                    <span>View Product</span>
                                                                </button>
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <div className="text-sm text-gray-900">
                                                                {detail.variant?.color?.name && detail.variant?.size?.name
                                                                    ? `${detail.variant.color.name} - ${detail.variant.size.name}`
                                                                    : detail.variant?.color?.name || detail.variant?.size?.name || "Standard"
                                                                }
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-center">
                                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                                                                {detail.quantity || 0}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                                                            {formatPrice(detail.unitPrice || 0)}
                                                        </td>
                                                        <td className="px-6 py-4 text-right text-base font-bold text-gray-900">
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

                {/* Footer */}
                <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-6 py-4 border-t border-gray-200">
                    <div className="flex justify-between items-center">
                        <div className="text-sm text-gray-500">
                            Order created on {formatDate(currentOrder?.orderDate)}
                        </div>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors duration-200 font-medium flex items-center"
                        >
                            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Close
                        </button>
                    </div>
                </div>
            </div>

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