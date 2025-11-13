import React from "react";
import { getOrderStatusOptionDisabled } from "../utils/orderUtils";

const UpdateOrderStatusModal = ({
    isOpen,
    onClose,
    order,
    updateFormData,
    onFormChange,
    onUpdate,
    isUpdating,
    error
}) => {
    if (!isOpen) return null;

    // Order status options
    const orderStatusOptions = [
        { value: "pending", label: "Pending" },
        { value: "confirmed", label: "Confirmed" },
        { value: "shipping", label: "Shipping" },
        { value: "delivered", label: "Delivered" },
        { value: "cancelled", label: "Cancelled" },
    ];

    // Order status options for Update Status modal (without cancelled)
    const updateOrderStatusOptions = orderStatusOptions.filter(opt => opt.value !== "cancelled");

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-md flex flex-col transform transition-all duration-300" style={{ borderColor: '#A86523' }}>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0" style={{ borderColor: '#A86523' }}>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900">Update Order Status</h3>
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
                <div className="p-4 sm:p-5">
                    {/* Error Message */}
                    {error && (
                        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="h-4 w-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs sm:text-sm text-red-800">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Order Status
                        </label>
                        <select
                            value={updateFormData.order_status || ""}
                            onChange={(e) => onFormChange("order_status", e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 focus:border-[#A86523] focus:ring-[#A86523]"
                        >
                            {updateOrderStatusOptions.map((opt) => (
                                <option
                                    key={opt.value}
                                    value={opt.value}
                                    disabled={getOrderStatusOptionDisabled(order?.order_status, opt.value)}
                                    className={getOrderStatusOptionDisabled(order?.order_status, opt.value) ? 'text-gray-400' : ''}
                                >
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Workflow: Pending → Confirmed → Shipping → Delivered
                        </p>
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end p-3 sm:p-4 border-t shrink-0" style={{ borderColor: '#A86523' }}>
                    <button
                        onClick={onUpdate}
                        disabled={isUpdating}
                        className="px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-md"
                        style={{ backgroundColor: '#E9A319' }}
                        onMouseEnter={(e) => !isUpdating && (e.currentTarget.style.backgroundColor = '#A86523')}
                        onMouseLeave={(e) => !isUpdating && (e.currentTarget.style.backgroundColor = '#E9A319')}
                    >
                        {isUpdating && (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        )}
                        <span>{isUpdating ? 'Updating...' : 'Update'}</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UpdateOrderStatusModal;

