// DebugOrderModal.jsx - Generate Random Orders for Testing
import React, { useState, useCallback, useContext } from 'react';
import { ToastContext } from '../context/ToastContext';
import Api from '../common/SummaryAPI';

const DebugOrderModal = ({
    isOpen,
    onClose,
    onOrdersGenerated,
}) => {
    const { showToast } = useContext(ToastContext);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [orderCount, setOrderCount] = useState(10);
    const [validationError, setValidationError] = useState('');

    // Reset form when modal opens/closes
    React.useEffect(() => {
        if (isOpen) {
            setOrderCount(10);
            setError('');
            setValidationError('');
        }
    }, [isOpen]);

    // Validate form
    const validateForm = useCallback(() => {
        const errors = '';

        if (!orderCount || orderCount < 1 || orderCount > 1000) {
            setValidationError('Order count must be between 1 and 1000');
            return false;
        }

        if (isNaN(orderCount)) {
            setValidationError('Order count must be a valid number');
            return false;
        }

        setValidationError('');
        return true;
    }, [orderCount]);

    // Handle submit (generate orders)
    const handleSubmit = useCallback(async () => {
        setLoading(true);
        setError('');
        setValidationError('');

        // Validate form
        if (!validateForm()) {
            setLoading(false);
            return;
        }

        try {
            const count = parseInt(orderCount, 10);
            
            if (isNaN(count) || count < 1 || count > 1000) {
                showToast('Order count must be between 1 and 1000', 'error');
                setLoading(false);
                return;
            }

            showToast(`Generating ${count} random order(s)...`, 'info');

            const response = await Api.orders.generateDebugOrders(count);

            const message = response.message || response.data?.message || `${count} order(s) generated successfully`;
            showToast(message, "success");

            // Reset form
            setOrderCount(10);
            setError('');
            setValidationError('');

            // Notify parent
            if (onOrdersGenerated) {
                onOrdersGenerated();
            }

            // Close modal after a short delay
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            console.error('Generate debug orders error:', err);
            console.error("Error response:", err.response);
            console.error("Error response data:", err.response?.data);

            let errorMessage = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Failed to generate debug orders';

            // Handle specific error cases
            if (errorMessage.includes('ENABLE_DEBUG_ORDERS')) {
                errorMessage = 'Debug order generation is disabled. This feature is only available when ENABLE_DEBUG_ORDERS=true in the backend environment.';
            } else if (errorMessage.includes('Access denied')) {
                errorMessage = 'Access denied. Only administrators and managers can generate debug orders.';
            }

            setError(errorMessage);
            showToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    }, [orderCount, validateForm, showToast, onOrdersGenerated, onClose]);

    // Reset form
    const resetForm = useCallback(() => {
        setOrderCount(10);
        setError('');
        setValidationError('');
    }, []);

    // Handle close modal
    const handleClose = useCallback(() => {
        resetForm();
        onClose();
    }, [resetForm, onClose]);

    // Handle input change
    const handleCountChange = useCallback((e) => {
        const value = e.target.value;
        setOrderCount(value);
        
        // Clear validation error when user types
        if (validationError) {
            setValidationError('');
        }
    }, [validationError]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-lg max-h-[90vh] flex flex-col transform transition-all duration-300"
                style={{ borderColor: '#A86523' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b shrink-0"
                    style={{ borderColor: '#A86523' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                            </svg>
                        </div>
                        <div>
                            <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                                Generate Debug Orders
                            </h2>
                            <p className="text-xs text-gray-500 mt-1">
                                Testing/Development Only
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': '#A86523' }}
                        aria-label="Close"
                        disabled={loading}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {/* Warning Banner */}
                    <div className="mb-5 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                        <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <div className="flex-1">
                                <h3 className="text-sm font-semibold text-yellow-800 mb-1">
                                    Debug/Testing Feature
                                </h3>
                                <p className="text-xs text-yellow-700">
                                    This feature generates random orders based on existing products, variants, and user accounts. 
                                    Only available when <code className="bg-yellow-100 px-1 py-0.5 rounded">ENABLE_DEBUG_ORDERS=true</code> is set in the backend environment.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Info Banner */}
                    <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h3 className="text-sm font-semibold text-blue-800 mb-2">
                            What will be generated:
                        </h3>
                        <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                            <li>Random orders with realistic data (names, addresses, phone numbers)</li>
                            <li>Order details with random product variants and quantities</li>
                            <li>Random order statuses (pending, confirmed, shipping, delivered, cancelled)</li>
                            <li>Random payment statuses (paid/unpaid) and payment methods (COD/VNPAY)</li>
                            <li>Random vouchers applied (30% chance)</li>
                            <li>Orders dated within the last 30 days</li>
                        </ul>
                    </div>

                    {/* Form */}
                    <div className="space-y-5">
                        <div>
                            <label htmlFor="orderCount" className="block text-sm font-semibold text-gray-700 mb-2">
                                Number of Orders to Generate <span className="text-red-500">*</span>
                            </label>
                            <input
                                id="orderCount"
                                type="number"
                                min="1"
                                max="1000"
                                value={orderCount}
                                onChange={handleCountChange}
                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base ${
                                    validationError
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 bg-white hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                }`}
                                placeholder="Enter number of orders (1-1000)"
                                required
                                disabled={loading}
                            />
                            {validationError && (
                                <p className="mt-1.5 text-sm text-red-600">{validationError}</p>
                            )}
                            <p className="mt-1.5 text-xs text-gray-500">
                                Enter a number between 1 and 1000. Each order will contain 1-5 random items.
                            </p>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div
                    className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5 border-t shrink-0"
                    style={{ borderColor: '#A86523' }}
                >
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 font-medium text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': '#A86523' }}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || !orderCount || orderCount < 1 || orderCount > 1000}
                        className="px-6 py-2.5 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:hover:shadow-md bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 disabled:hover:from-orange-600 disabled:hover:to-red-600"
                        style={{
                            '--tw-ring-color': '#A86523'
                        }}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Generating {orderCount} order(s)...</span>
                            </div>
                        ) : (
                            `Generate ${orderCount || 0} Order(s)`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DebugOrderModal;

