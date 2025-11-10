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
        minOrderValue: "",
        maxDiscount: "",
        startDate: "",
        endDate: "",
        usageLimit: "",
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
                minOrderValue: "",
                maxDiscount: "",
                startDate: "",
                endDate: "",
                usageLimit: "",
            });
            setFieldErrors({}); // Clear field errors
        }
    }, [mode, voucher, isOpen]);

    // Handle field changes - with real-time validation
    const handleChange = (e) => {
        const { name, value } = e.target;

        // Update form data
        setFormData((prev) => {
            const updated = { ...prev, [name]: value };

            // Validate the current field with updated formData
            const error = validateField(name, value, mode, updated);

            // Update errors
            setFieldErrors(prevErrors => {
                const newErrors = { ...prevErrors };
                if (error) {
                    newErrors[name] = error;
                } else {
                    delete newErrors[name];
                }
                return newErrors;
            });

            // If discountType changes, re-validate dependent fields
            if (name === "discountType") {
                if (value === "percentage") {
                    // Validate maxDiscount if it exists
                    if (updated.maxDiscount) {
                        const maxDiscountError = validateField("maxDiscount", updated.maxDiscount, mode, updated);
                        setFieldErrors(prevErrors => {
                            const newErrors = { ...prevErrors };
                            if (maxDiscountError) {
                                newErrors.maxDiscount = maxDiscountError;
                            } else {
                                delete newErrors.maxDiscount;
                            }
                            return newErrors;
                        });
                    }
                } else {
                    // Clear maxDiscount error when switching to fixed
                    setFieldErrors(prevErrors => {
                        const newErrors = { ...prevErrors };
                        delete newErrors.maxDiscount;
                        return newErrors;
                    });
                }

                // Re-validate discountValue when switching discount type
                if (updated.discountValue) {
                    const discountError = validateField("discountValue", updated.discountValue, mode, updated);
                    setFieldErrors(prevErrors => {
                        const newErrors = { ...prevErrors };
                        if (discountError) {
                            newErrors.discountValue = discountError;
                        } else {
                            delete newErrors.discountValue;
                        }
                        return newErrors;
                    });
                }
            }

            // If minOrderValue or discountValue changes, validate business logic for fixed discount
            if (name === "minOrderValue" || name === "discountValue") {
                if (updated.discountType === "fixed" && updated.minOrderValue && updated.discountValue) {
                    const minOrderNum = Number(updated.minOrderValue);
                    const discountNum = Number(updated.discountValue);
                    if (!isNaN(minOrderNum) && !isNaN(discountNum) && minOrderNum > 0 && discountNum > minOrderNum) {
                        setFieldErrors(prevErrors => ({
                            ...prevErrors,
                            discountValue: 'For fixed discount, the discount value cannot exceed the minimum order value'
                        }));
                    } else {
                        // Clear error if validation passes
                        setFieldErrors(prevErrors => {
                            const newErrors = { ...prevErrors };
                            if (newErrors.discountValue === 'For fixed discount, the discount value cannot exceed the minimum order value') {
                                delete newErrors.discountValue;
                            }
                            return newErrors;
                        });
                    }
                }
            }

            return updated;
        });
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
    const validateField = (name, value, currentMode = mode, currentFormData = formData) => {
        switch (name) {
            case 'code':
                if (!value || !value.trim()) return 'Please fill in all required fields';
                // Combined validation: check length and format together
                if (value.length < 3 || value.length > 30 || !/^[A-Z0-9]+$/.test(value)) {
                    return 'Voucher code must contain only uppercase letters and numbers, 3 to 30 characters long.';
                }
                return null;
            case 'discountValue':
                if (!value || value === '' || value === null) return 'Please fill in all required fields';
                const discountNum = Number(value);
                if (isNaN(discountNum) || discountNum <= 0) return 'Discount value must be greater than 0';
                if (currentFormData.discountType === 'percentage') {
                    if (discountNum > 100) {
                        return 'Percentage must be less than or equal to 100';
                    }
                }
                // For fixed discount, backend only checks > 0, no minimum amount requirement
                // But check business logic: if minOrderValue > 0, discountValue cannot exceed minOrderValue
                if (currentFormData.discountType === 'fixed' && currentFormData.minOrderValue) {
                    const minOrderNum = Number(currentFormData.minOrderValue);
                    if (!isNaN(minOrderNum) && minOrderNum > 0 && discountNum > minOrderNum) {
                        return 'For fixed discount, the discount value cannot exceed the minimum order value';
                    }
                }
                return null;
            case 'minOrderValue':
                // minOrderValue is required, must be filled and valid
                // Check if value is blank/empty (but allow 0)
                if (value === '' || value === null || value === undefined) {
                    return 'Please fill in all required fields';
                }
                // Validate it's a valid number
                const minOrderNum = Number(value);
                if (isNaN(minOrderNum)) {
                    return 'Please fill in all required fields';
                }
                // Must be >= 0 (0 is allowed)
                if (minOrderNum < 0) {
                    return 'Minimum order value cannot be negative';
                }
                return null;
            case 'maxDiscount':
                // For percentage discount, maxDiscount is required
                if (currentFormData.discountType === 'percentage') {
                    if (!value || value === '' || value === null) {
                        return 'Please fill in all required fields';
                    }
                    const maxDiscountNum = Number(value);
                    if (isNaN(maxDiscountNum) || maxDiscountNum <= 0) {
                        return 'Maximum discount must be greater than 0';
                    }
                }
                return null;
            case 'startDate':
                if (!value || value === '') return 'Please fill in all required fields';
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
                if (!value || value === '') return 'Please fill in all required fields';
                if (value.length !== 10) return 'Please select a valid date';

                // Validate date format (yyyy-mm-dd)
                const endDate = new Date(value);
                if (isNaN(endDate.getTime())) return 'Invalid date format';

                if (currentFormData.startDate) {
                    const startDate = new Date(currentFormData.startDate);
                    if (endDate <= startDate) {
                        return 'End date must be after start date';
                    }
                }
                return null;
            case 'usageLimit':
                if (!value || value === '' || value === null) return 'Please fill in all required fields';
                const usageLimitNum = Number(value);
                if (isNaN(usageLimitNum) || usageLimitNum < 1) return 'Usage limit must be at least 1';
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

            // Special validation: maxDiscount is required for percentage discount
            if (formData.discountType === 'percentage') {
                if (!formData.maxDiscount || formData.maxDiscount === '' || formData.maxDiscount === null) {
                    errors.maxDiscount = 'Please fill in all required fields';
                    hasErrors = true;
                }
            }

            // Special validation: Business logic for fixed discount
            // If minOrderValue > 0, discountValue cannot exceed minOrderValue
            if (formData.discountType === 'fixed' && formData.minOrderValue && formData.discountValue) {
                const minOrderNum = Number(formData.minOrderValue);
                const discountNum = Number(formData.discountValue);
                if (!isNaN(minOrderNum) && !isNaN(discountNum) && minOrderNum > 0 && discountNum > minOrderNum) {
                    errors.discountValue = 'For fixed discount, the discount value cannot exceed the minimum order value';
                    hasErrors = true;
                }
            }

            // If there are field validation errors, show them and stop
            if (hasErrors) {
                setFieldErrors(errors);
                // Show generic message since error messages are already displayed under each field
                showToast("Please check the input fields again", "error");
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

            if (formData.discountType === "percentage" && formData.maxDiscount !== "" && formData.maxDiscount !== null && formData.maxDiscount !== undefined) {
                payload.maxDiscount = Number(formData.maxDiscount);
            }

            if (mode === 'create') {
                payload.code = formData.code;
                await SummaryAPI.vouchers.create(payload);
                showToast("Voucher added successfully!", "success");
            } else {
                if (!voucher?.id && !voucher?._id) {
                    showToast("Invalid voucher data", "error");
                    return;
                }
                await SummaryAPI.vouchers.update(voucher.id || voucher._id, payload);
                showToast("Voucher edited successfully", "success");
            }

            // Call success callback after a short delay
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);

        } catch (err) {
            console.error("Voucher operation error:", err);

            let errorMessage = "An unexpected error occurred";
            const blankFields = {};
            let hasFieldErrors = false;

            // Handle API response errors - prioritize backend message
            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;

                // If error is "Please fill in all required fields", highlight blank fields
                if (errorMessage === "Please fill in all required fields" ||
                    errorMessage.toLowerCase().includes("fill in all required")) {
                    // Check which fields are blank based on what was sent to backend
                    // Required fields for create
                    if (mode === 'create') {
                        if (!formData.code || !formData.code.trim()) {
                            blankFields.code = "Please fill in all required fields";
                            hasFieldErrors = true;
                        }
                    }

                    // Required fields for both create and update
                    if (!formData.discountType || !formData.discountType.trim()) {
                        blankFields.discountType = "Please fill in all required fields";
                        hasFieldErrors = true;
                    }
                    if (!formData.discountValue || formData.discountValue === '' || formData.discountValue === null) {
                        blankFields.discountValue = "Please fill in all required fields";
                        hasFieldErrors = true;
                    }
                    // Check for blank, but allow 0
                    if (formData.minOrderValue === '' || formData.minOrderValue === null || formData.minOrderValue === undefined) {
                        blankFields.minOrderValue = "Please fill in all required fields";
                        hasFieldErrors = true;
                    }
                    if (!formData.startDate || formData.startDate === '') {
                        blankFields.startDate = "Please fill in all required fields";
                        hasFieldErrors = true;
                    }
                    if (!formData.endDate || formData.endDate === '') {
                        blankFields.endDate = "Please fill in all required fields";
                        hasFieldErrors = true;
                    }
                    if (!formData.usageLimit || formData.usageLimit === '' || formData.usageLimit === null) {
                        blankFields.usageLimit = "Please fill in all required fields";
                        hasFieldErrors = true;
                    }

                    // For percentage discount, maxDiscount is required
                    if (formData.discountType === "percentage") {
                        if (!formData.maxDiscount || formData.maxDiscount === '' || formData.maxDiscount === null) {
                            blankFields.maxDiscount = "Please fill in all required fields";
                            hasFieldErrors = true;
                        }
                    }

                    // Set field errors to highlight blank fields with red border
                    if (Object.keys(blankFields).length > 0) {
                        setFieldErrors(prev => ({ ...prev, ...blankFields }));
                    }
                }
            } else if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.response?.data?.message) {
                // If we already processed the message above, don't override
                // But if it's a different error message, use it
                if (!errorMessage || errorMessage === "An unexpected error occurred") {
                    errorMessage = err.response.data.message;
                }
            } else if (err.message) {
                errorMessage = err.message;
            }

            // Handle specific error messages from backend - set field errors
            if (err.response?.data?.message) {
                const backendMessage = err.response.data.message;
                // Handle specific backend validation errors
                if (backendMessage.includes('discount value cannot exceed the minimum order value')) {
                    setFieldErrors(prev => ({
                        ...prev,
                        discountValue: backendMessage
                    }));
                    hasFieldErrors = true;
                } else if (backendMessage.includes('Usage limit cannot be less than used count')) {
                    setFieldErrors(prev => ({
                        ...prev,
                        usageLimit: backendMessage
                    }));
                    hasFieldErrors = true;
                } else if (backendMessage.includes('Voucher code must contain only uppercase')) {
                    setFieldErrors(prev => ({
                        ...prev,
                        code: backendMessage
                    }));
                    hasFieldErrors = true;
                }
            }

            // Handle specific HTTP status codes
            if (err.response?.status === 401) {
                errorMessage = "You are not authorized to perform this action";
            } else if (err.response?.status === 403) {
                errorMessage = "Access denied. Only admin and manager can perform this action";
            } else if (err.response?.status === 404) {
                if (mode === 'edit') {
                    errorMessage = "Voucher not found";
                } else {
                    errorMessage = "Service not available";
                }
            } else if (err.response?.status >= 500) {
                errorMessage = "Server error. Please try again later.";
            }

            // Show toast: if field errors are displayed, show generic message; otherwise show specific error
            if (hasFieldErrors || Object.keys(blankFields).length > 0) {
                showToast("Please check the input fields again", "error");
            } else {
                showToast(errorMessage, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    // Handle modal close
    const handleClose = () => {
        setFieldErrors({}); // Clear field errors when closing
        onClose();
    };

    // Helper function to render field with error (red border and error message)
    const renderFieldWithError = (name, label, children) => (
        <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
                {label} <span className="text-red-500">*</span>
            </label>
            {children}
            {fieldErrors[name] && (
                <p className="mt-1.5 text-sm text-red-600">{fieldErrors[name]}</p>
            )}
        </div>
    );

    if (!isOpen) return null;

    const isEditMode = mode === 'edit';
    const isDisabled = isEditMode && formData.isDeleted;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-4xl max-h-[90vh] flex flex-col transform transition-all duration-300" style={{ borderColor: '#A86523' }}>
                {/* Fixed Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b shrink-0" style={{ borderColor: '#A86523' }}>
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                        {isEditMode ? `Edit Voucher` : "Add New Voucher"}
                    </h2>
                    <button
                        type="button"
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': '#A86523' }}
                        onClick={handleClose}
                        aria-label="Close"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    <form id="voucher-form" onSubmit={handleSubmit} className="space-y-5 lg:space-y-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 lg:gap-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Voucher Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    name="code"
                                    value={formData.code}
                                    onChange={handleChange}
                                    disabled={isEditMode}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 text-sm lg:text-base disabled:bg-gray-50 disabled:cursor-not-allowed ${fieldErrors.code
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 bg-white hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                        }`}
                                    placeholder="Enter voucher code"
                                />
                                {fieldErrors.code && (
                                    <p className="mt-1.5 text-sm text-red-600">{fieldErrors.code}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    Discount Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    name="discountType"
                                    value={formData.discountType}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base disabled:bg-gray-50 disabled:cursor-not-allowed ${fieldErrors.discountType
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                        }`}
                                >
                                    <option value="percentage">Percentage (%)</option>
                                    <option value="fixed">Fixed Amount (₫)</option>
                                </select>
                                {fieldErrors.discountType && (
                                    <p className="mt-1.5 text-sm text-red-600">{fieldErrors.discountType}</p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">
                                    {formData.discountType === "percentage" ? "Discount (%)" : "Discount Amount (₫)"} <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    name="discountValue"
                                    value={formData.discountValue}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base disabled:bg-gray-50 disabled:cursor-not-allowed ${fieldErrors.discountValue
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                        }`}
                                    placeholder={formData.discountType === "percentage" ? "Enter percentage" : "Enter amount"}
                                />
                                {fieldErrors.discountValue && (
                                    <p className="mt-1.5 text-sm text-red-600">{fieldErrors.discountValue}</p>
                                )}
                            </div>

                            {renderFieldWithError('minOrderValue', 'Minimum Order Value (₫)',
                                <input
                                    type="number"
                                    name="minOrderValue"
                                    value={formData.minOrderValue}
                                    onChange={handleChange}
                                    disabled={isDisabled}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base disabled:bg-gray-50 disabled:cursor-not-allowed ${fieldErrors.minOrderValue
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
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
                                        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base disabled:bg-gray-50 disabled:cursor-not-allowed ${fieldErrors.maxDiscount
                                            ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                            : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
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
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base disabled:bg-gray-50 disabled:cursor-not-allowed ${fieldErrors.startDate
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
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
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base disabled:bg-gray-50 disabled:cursor-not-allowed ${fieldErrors.endDate
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
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
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base disabled:bg-gray-50 disabled:cursor-not-allowed ${fieldErrors.usageLimit
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                        }`}
                                    placeholder="Enter usage limit"
                                />
                            )}
                        </div>
                    </form>
                </div>

                {/* Fixed Footer */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5 border-t shrink-0" style={{ borderColor: '#A86523' }}>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': '#A86523' }}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        form="voucher-form"
                        disabled={loading || isDisabled}
                        className="px-6 py-2.5 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:hover:shadow-md"
                        style={{
                            backgroundColor: '#E9A319',
                            '--tw-ring-color': '#A86523'
                        }}
                        onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#A86523')}
                        onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E9A319')}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Processing...</span>
                            </div>
                        ) : (
                            isEditMode ? "Edit" : "Add"
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VoucherModal;
