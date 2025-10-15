import React, { useState, useEffect, useContext } from 'react';
import { ToastContext } from '../../context/ToastContext';
import SummaryAPI from '../../common/SummaryAPI';

const VoucherModal = ({
    isOpen,
    mode, // 'create' or 'edit'
    voucher, // only needed for edit mode
    onClose,
    onSuccess
}) => {
    const { showToast } = useContext(ToastContext);
    const [formData, setFormData] = useState({
        code: "",
        discountType: "percentage",
        discountValue: "",
        minOrderValue: 0,
        maxDiscount: "",
        startDate: "",
        endDate: "",
        usageLimit: 1,
    });
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    // Initialize form data when voucher changes (for edit mode)
    useEffect(() => {
        if (mode === 'edit' && voucher && isOpen) {
            setFormData({
                code: voucher.code,
                discountType: voucher.discountType,
                discountValue: voucher.discountValue,
                minOrderValue: voucher.minOrderValue,
                maxDiscount: voucher.maxDiscount || "",
                startDate: convertFromISODate(voucher.startDate),
                endDate: convertFromISODate(voucher.endDate),
                usageLimit: voucher.usageLimit,
                isDeleted: voucher.isDeleted,
            });
            setFieldErrors({}); // Clear field errors
        } else if (mode === 'create' && isOpen) {
            // Reset form for create mode
            setFormData({
                code: "",
                discountType: "percentage",
                discountValue: "",
                minOrderValue: 0,
                maxDiscount: "",
                startDate: "",
                endDate: "",
                usageLimit: 1,
            });
            setFieldErrors({}); // Clear field errors
        }
    }, [mode, voucher, isOpen]);

    // Handle field changes
    const handleChange = (e) => {
        const { name, value } = e.target;

        let newValue = value;
        if (name === "code") {
            newValue = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 30);
        }

        setFormData((prev) => ({ ...prev, [name]: newValue }));

        // Validate field in real-time
        const error = validateField(name, newValue, mode);
        setFieldErrors(prev => ({ ...prev, [name]: error }));
    };

    // Convert yyyy-mm-dd to ISO date for API (HTML5 date input already uses yyyy-mm-dd format)
    const convertToISODate = (dateString) => {
        if (!dateString) return '';
        return dateString; // HTML5 date input already returns yyyy-mm-dd format
    };

    // Convert ISO date to yyyy-mm-dd for display (HTML5 date input format)
    const convertFromISODate = (isoDate) => {
        if (!isoDate) return '';
        const date = new Date(isoDate);
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Validate individual field
    const validateField = (name, value, currentMode = mode) => {
        switch (name) {
            case 'code':
                if (!value.trim()) return 'Voucher code is required';
                if (value.length < 3) return 'Voucher code must be at least 3 characters';
                return null;
            case 'discountValue':
                if (!value || value <= 0) return 'Discount value must be greater than 0';
                if (formData.discountType === 'percentage' && value > 100) {
                    return 'Percentage must be less than or equal to 100';
                }
                if (formData.discountType === 'fixed' && value < 1000) {
                    return 'Fixed amount must be at least 1,000₫';
                }
                return null;
            case 'minOrderValue':
                if (value < 0) return 'Minimum order value cannot be negative';
                return null;
            case 'maxDiscount':
                if (formData.discountType === 'percentage' && value && value <= 0) {
                    return 'Maximum discount must be greater than 0';
                }
                return null;
            case 'startDate':
                if (!value) return 'Start date is required';
                if (value.length !== 10) return 'Please select a valid date';

                // Validate date format (yyyy-mm-dd)
                const startDate = new Date(value);
                if (isNaN(startDate.getTime())) return 'Invalid date format';

                // Only validate past date for create mode, not for edit mode
                if (currentMode === 'create') {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (startDate < today) {
                        return 'Start date cannot be in the past';
                    }
                }
                return null;
            case 'endDate':
                if (!value) return 'End date is required';
                if (value.length !== 10) return 'Please select a valid date';

                // Validate date format (yyyy-mm-dd)
                const endDate = new Date(value);
                if (isNaN(endDate.getTime())) return 'Invalid date format';

                if (formData.startDate) {
                    const startDate = new Date(formData.startDate);
                    if (endDate <= startDate) {
                        return 'End date must be after start date';
                    }
                }
                return null;
            case 'usageLimit':
                if (!value || value <= 0) return 'Usage limit must be greater than 0';
                return null;
            default:
                return null;
        }
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setFieldErrors({}); // Clear previous field errors

        try {
            // Validate all fields
            const errors = {};
            let hasErrors = false;

            // Validate each field
            Object.keys(formData).forEach(key => {
                if (key === 'isDeleted') return; // Skip isDeleted field
                const error = validateField(key, formData[key], mode);
                if (error) {
                    errors[key] = error;
                    hasErrors = true;
                }
            });

            // If there are field validation errors, show them and stop
            if (hasErrors) {
                setFieldErrors(errors);
                setLoading(false);
                return;
            }

            const payload = {
                discountType: formData.discountType,
                discountValue: Number(formData.discountValue),
                minOrderValue: Number(formData.minOrderValue),
                usageLimit: Number(formData.usageLimit),
                startDate: new Date(formData.startDate),
                endDate: new Date(formData.endDate),
            };

            if (formData.discountType === "percentage" && formData.maxDiscount !== "") {
                payload.maxDiscount = Number(formData.maxDiscount);
            }

            if (mode === 'create') {
                payload.code = formData.code;
                await SummaryAPI.vouchers.create(payload);
                showToast("Voucher created successfully!", "success");
            } else {
                if (!voucher?.id && !voucher?._id) {
                    showToast("Invalid voucher data", "error");
                    return;
                }
                await SummaryAPI.vouchers.update(voucher.id || voucher._id, payload);
                showToast("Voucher updated successfully!", "success");
            }

            // Call success callback after a short delay
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);

        } catch (err) {
            console.error("Voucher operation error:", err);

            let errorMessage = "An unexpected error occurred";

            // Handle API response errors with specific messages
            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.message) {
                errorMessage = err.message;
            }

            // Handle specific HTTP status codes with backend-specific messages
            if (err.response?.status === 400) {
                // Backend validation errors - use the specific message from backend
                if (err.response?.data?.message) {
                    errorMessage = err.response.data.message;
                } else {
                    errorMessage = "Invalid voucher data. Please check your input.";
                }
            } else if (err.response?.status === 401) {
                errorMessage = "You are not authorized to perform this action";
            } else if (err.response?.status === 403) {
                errorMessage = "Access denied. Only admin and manager can perform this action";
            } else if (err.response?.status === 404) {
                if (mode === 'edit') {
                    errorMessage = "Voucher not found";
                } else {
                    errorMessage = "Service not available";
                }
            } else if (err.response?.status === 409) {
                errorMessage = "Voucher code already exists";
            } else if (err.response?.status >= 500) {
                errorMessage = "Server error. Please try again later.";
            } else if (mode === 'create') {
                errorMessage = "Failed to create voucher";
            } else {
                errorMessage = "Failed to update voucher";
            }

            showToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    };

    // Handle modal close
    const handleClose = () => {
        setFieldErrors({}); // Clear field errors when closing
        onClose();
    };

    // Helper function to render field with error
    const renderFieldWithError = (name, label, children) => (
        <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
                {label}
            </label>
            {children}
            {fieldErrors[name] && (
                <div className="mt-1 flex items-center text-sm text-red-600">
                    <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    {fieldErrors[name]}
                </div>
            )}
        </div>
    );

    if (!isOpen) return null;

    const isEditMode = mode === 'edit';
    const isDisabled = isEditMode && formData.isDeleted;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-4xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
                <div className="p-3 sm:p-4 lg:p-6">
                    <div className="flex items-center justify-between mb-4 lg:mb-6">
                        <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                            {isEditMode ? `Edit Voucher` : "Create New Voucher"}
                        </h2>
                        <button
                            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 hover:shadow-sm"
                            onClick={handleClose}
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>Close</span>
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4 lg:space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Voucher Code
                                </label>
                                <input
                                    name="code"
                                    value={formData.code}
                                    onChange={handleChange}
                                    disabled={isEditMode} // Code should not be editable in edit mode
                                    className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm lg:text-base ${fieldErrors.code
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-gray-300'
                                        } ${isEditMode ? 'bg-gray-50' : 'bg-white'}`}
                                    placeholder="Enter voucher code"
                                />
                                {fieldErrors.code && (
                                    <div className="mt-1 flex items-center text-sm text-red-600">
                                        <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        {fieldErrors.code}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Discount Type
                                </label>
                                <select
                                    name="discountType"
                                    value={formData.discountType}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                                >
                                    <option value="percentage">Percentage (%)</option>
                                    <option value="fixed">Fixed Amount (₫)</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    {formData.discountType === "percentage" ? "Discount (%)" : "Discount Amount (₫)"}
                                </label>
                                <input
                                    type="number"
                                    name="discountValue"
                                    value={formData.discountValue}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base ${fieldErrors.discountValue
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-gray-300'
                                        }`}
                                    placeholder={formData.discountType === "percentage" ? "Enter percentage" : "Enter amount"}
                                />
                                {fieldErrors.discountValue && (
                                    <div className="mt-1 flex items-center text-sm text-red-600">
                                        <svg className="w-4 h-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        {fieldErrors.discountValue}
                                    </div>
                                )}
                            </div>

                            {renderFieldWithError('minOrderValue', 'Minimum Order Value (₫)',
                                <input
                                    type="number"
                                    name="minOrderValue"
                                    value={formData.minOrderValue}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base ${fieldErrors.minOrderValue
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-gray-300'
                                        }`}
                                    placeholder="Enter minimum order value"
                                />
                            )}

                            {formData.discountType === "percentage" &&
                                renderFieldWithError('maxDiscount', 'Maximum Discount (₫)',
                                    <input
                                        type="number"
                                        name="maxDiscount"
                                        value={formData.maxDiscount}
                                        onChange={handleChange}
                                        disabled={isDisabled}
                                        className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base ${fieldErrors.maxDiscount
                                            ? 'border-red-300 bg-red-50'
                                            : 'border-gray-300'
                                            }`}
                                        placeholder="Enter maximum discount"
                                    />
                                )
                            }

                            {renderFieldWithError('startDate', 'Start Date',
                                <input
                                    type="date"
                                    name="startDate"
                                    value={formData.startDate}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    min={mode === 'create' ? new Date().toISOString().split('T')[0] : undefined}
                                    max={formData.endDate ? new Date(new Date(formData.endDate).getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined}
                                    className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base ${isDisabled ? 'cursor-not-allowed bg-gray-50' : ''} ${fieldErrors.startDate
                                        ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300'
                                        }`}
                                />
                            )}

                            {renderFieldWithError('endDate', 'End Date',
                                <input
                                    type="date"
                                    name="endDate"
                                    value={formData.endDate}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    min={formData.startDate ? new Date(new Date(formData.startDate).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0] : undefined}
                                    className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base ${isDisabled ? 'cursor-not-allowed bg-gray-50' : ''} ${fieldErrors.endDate
                                        ? 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300'
                                        }`}
                                />
                            )}

                            {renderFieldWithError('usageLimit', 'Usage Limit',
                                <input
                                    type="number"
                                    name="usageLimit"
                                    value={formData.usageLimit}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base ${fieldErrors.usageLimit
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-gray-300'
                                        }`}
                                    placeholder="Enter usage limit"
                                />
                            )}
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 pt-4 lg:pt-6 border-t border-gray-200">
                            <button
                                type="button"
                                onClick={handleClose}
                                className="px-4 py-2 lg:px-6 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 hover:shadow-sm font-medium text-sm lg:text-base"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading || isDisabled}
                                className="px-4 py-2 lg:px-6 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base transform hover:scale-105 disabled:hover:scale-100"
                            >
                                {loading ? (
                                    <div className="flex items-center space-x-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    isEditMode ? "Update Voucher" : "Create Voucher"
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default VoucherModal;
