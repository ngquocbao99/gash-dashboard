import React, { useState, useEffect, useContext } from "react";
import { ToastContext } from "../../context/ToastContext";
import SummaryAPI from "../../common/SummaryAPI";
import Loading from "../../components/Loading";

export default function AccountModal({ isOpen, account, onClose, onSuccess, viewOnly = false }) {
    const { showToast } = useContext(ToastContext);
    const [internalViewOnly, setInternalViewOnly] = useState(viewOnly);
    const [currentAccount, setCurrentAccount] = useState(account);
    const [formData, setFormData] = useState({
        role: "",
        acc_status: "",
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderStatistics, setOrderStatistics] = useState({
        totalOrders: 0,
        totalSpent: 0,
        activeOrders: 0
    });
    const [ordersLoading, setOrdersLoading] = useState(false);

    // Format role name for display
    const formatRoleName = (role) => {
        if (role === 'manager') return 'staff';
        return role || 'user';
    };

    // Định dạng ngày dd/MM/yyyy
    const formatDate = (dateStr) => {
        if (!dateStr) return "N/A";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "N/A";
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    // Format price to VND
    const formatPrice = (price) => {
        if (typeof price !== 'number' || isNaN(price)) return '0 ₫';
        return new Intl.NumberFormat('vi-VN', {
            style: 'currency',
            currency: 'VND',
        }).format(price);
    };

    // Update currentAccount when account prop changes (realtime update)
    useEffect(() => {
        if (account) {
            setCurrentAccount(account);
        }
    }, [account]);

    // Initialize form data when currentAccount changes
    useEffect(() => {
        if (currentAccount) {
            setFormData({
                role: currentAccount.role || "user",
                acc_status: currentAccount.is_deleted ? "deleted" : currentAccount.acc_status || "active",
            });
            setErrors({});
        }
    }, [currentAccount]);

    // Sync internal view mode with prop when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setInternalViewOnly(viewOnly);
        }
    }, [isOpen, viewOnly]);

    // Fetch order statistics when modal opens and account is available (skip for admin accounts)
    useEffect(() => {
        const fetchOrderStatistics = async () => {
            if (!isOpen || !currentAccount || !internalViewOnly || currentAccount.role === 'admin') {
                setOrderStatistics({
                    totalOrders: 0,
                    totalSpent: 0,
                    activeOrders: 0
                });
                return;
            }

            const accountId = currentAccount._id || currentAccount.id;
            if (!accountId) return;

            setOrdersLoading(true);
            try {
                const response = await SummaryAPI.accounts.getOrderStatistics(accountId);
                const stats = response?.data || response || {};
                setOrderStatistics({
                    totalOrders: stats.totalOrders || 0,
                    totalSpent: stats.totalSpent || 0,
                    activeOrders: stats.activeOrders || 0
                });
            } catch (err) {
                console.error("Failed to fetch order statistics:", err);
                setOrderStatistics({
                    totalOrders: 0,
                    totalSpent: 0,
                    activeOrders: 0
                });
            } finally {
                setOrdersLoading(false);
            }
        };

        fetchOrderStatistics();
    }, [isOpen, currentAccount, internalViewOnly]);

    // Handle input change
    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        setErrors((prev) => ({ ...prev, [name]: "" }));
    };

    // Validate form
    const validate = () => {
        const newErrors = {};
        if (!formData.role) newErrors.role = "Role is required";
        if (!formData.acc_status) newErrors.acc_status = "Status is required";
        if (formData.acc_status === "deleted") newErrors.acc_status = "Cannot set status to deleted";
        return newErrors;
    };

    // Handle form submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validate();
        if (Object.keys(validationErrors).length > 0) {
            setErrors(validationErrors);
            return;
        }

        setIsSubmitting(true);
        try {
            const accountId = currentAccount?.id || currentAccount?._id;
            if (!accountId) {
                showToast("Account ID not found!", "error");
                return;
            }

            const response = await SummaryAPI.accounts.update(accountId, {
                role: formData.role,
                acc_status: formData.acc_status,
            });

            // Update currentAccount with new data from response (realtime update)
            if (response?.data) {
                setCurrentAccount(prev => ({
                    ...prev,
                    ...response.data,
                    role: formData.role,
                    acc_status: formData.acc_status
                }));
            } else {
                // If response doesn't have data, update from formData
                setCurrentAccount(prev => ({
                    ...prev,
                    role: formData.role,
                    acc_status: formData.acc_status
                }));
            }

            showToast("Account edited successfully", "success");
            // Switch back to view mode after successful update
            setInternalViewOnly(true);
            onSuccess();
        } catch (err) {
            console.error("Update account error:", err);
            let errorMessage = "Failed to update account";
            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.response?.status === 403) {
                errorMessage = "Access denied. Only admin can update accounts";
            } else if (err.response?.status === 404) {
                errorMessage = "Account not found";
            } else if (err.response?.status >= 500) {
                errorMessage = "Server error. Please try again later";
            } else if (err.message) {
                errorMessage = `Failed to update account: ${err.message}`;
            }
            showToast(errorMessage, "error");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !currentAccount) return null;

    return (
        <>
            <style>{`
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
                <div className={`bg-white rounded-2xl shadow-2xl border-2 w-full transform transition-all duration-300 ${internalViewOnly ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] flex flex-col`} style={{ borderColor: '#A86523' }}>
                    {/* Modal Header */}
                    <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b shrink-0" style={{ borderColor: '#A86523' }}>
                        <h3 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                            {internalViewOnly ? 'Account Details' : 'Edit Account'}
                        </h3>
                        <div className="flex items-center gap-2">
                            {internalViewOnly && !currentAccount.is_deleted && currentAccount.acc_status !== 'inactive' && (
                                <button
                                    onClick={() => {
                                        // Switch to edit mode without closing modal
                                        setInternalViewOnly(false);
                                    }}
                                    className="flex items-center space-x-2 px-3 py-1.5 sm:px-4 sm:py-2 text-white rounded-xl transition-all duration-300 font-medium text-xs sm:text-sm shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                                    title="Edit Account"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                    <span className="hidden sm:inline">Edit Account</span>
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={onClose}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                                style={{ '--tw-ring-color': '#A86523' }}
                                aria-label="Close modal"
                                disabled={isSubmitting}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>
                    <div className={`flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 ${internalViewOnly ? 'hide-scrollbar' : ''}`} style={internalViewOnly ? { scrollbarWidth: 'none', msOverflowStyle: 'none' } : {}}>

                        {internalViewOnly ? (
                            // View Mode - Display account details
                            <div className="space-y-4">
                                {/* Account Information */}
                                <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Account Information</h3>
                                    <div className="flex items-start space-x-2 sm:space-x-3">
                                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full overflow-hidden bg-gray-200 shrink-0">
                                            {currentAccount.image ? (
                                                <img
                                                    src={currentAccount.image}
                                                    alt={currentAccount.name}
                                                    className="w-full h-full object-cover"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-400">
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
                                                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{currentAccount.name || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Username</p>
                                                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">@{currentAccount.username || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Email</p>
                                                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{currentAccount.email || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Phone</p>
                                                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{currentAccount.phone || 'N/A'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Role</p>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${currentAccount.role === 'admin' ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white' :
                                                        currentAccount.role === 'manager' ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                                                            'bg-gray-100 text-gray-800'
                                                        } capitalize`}>
                                                        {formatRoleName(currentAccount.role)}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-gray-500 mb-0.5">Status</p>
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${currentAccount.acc_status === 'active' ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                                                        currentAccount.acc_status === 'suspended' ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white' :
                                                            currentAccount.acc_status === 'inactive' ? 'bg-red-600 text-white' :
                                                                'bg-gray-100 text-gray-800'
                                                        } capitalize`}>
                                                        {currentAccount.is_deleted ? 'DELETED' : currentAccount.acc_status || 'active'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Additional Information */}
                                <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Additional Information</h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 sm:gap-2">
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Gender</p>
                                            <p className="text-xs sm:text-sm font-medium text-gray-900">{currentAccount.gender || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Date of Birth</p>
                                            <p className="text-xs sm:text-sm font-medium text-gray-900">
                                                {currentAccount.dob ? new Date(currentAccount.dob).toLocaleDateString("vi-VN", {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                }) : 'N/A'}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Address</p>
                                            <p className="text-xs sm:text-sm font-medium text-gray-900 break-words">{currentAccount.address || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-500 mb-0.5">Created At</p>
                                            <p className="text-xs sm:text-sm font-medium text-gray-900">
                                                {formatDate(currentAccount.createdAt)}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Order Statistics - Only show for non-admin accounts */}
                                {currentAccount.role !== 'admin' && internalViewOnly && (
                                    <div className="bg-gray-50 rounded-lg border p-2.5 sm:p-3" style={{ borderColor: '#A86523' }}>
                                        <h3 className="text-sm sm:text-base font-semibold text-gray-900 mb-1.5 sm:mb-2">Order Statistics</h3>
                                        {ordersLoading ? (
                                            <div className="flex items-center justify-center py-4">
                                                <Loading
                                                    type="inline"
                                                    size="small"
                                                    message="Loading orders..."
                                                />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
                                                <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                                                    <p className="text-xs text-gray-500 mb-1">Total Orders</p>
                                                    <p className="text-lg sm:text-xl font-bold text-gray-900">{orderStatistics.totalOrders}</p>
                                                </div>
                                                <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                                                    <p className="text-xs text-gray-500 mb-1">Total Spent</p>
                                                    <p className="text-lg sm:text-xl font-bold text-green-600">
                                                        {formatPrice(orderStatistics.totalSpent)}
                                                    </p>
                                                </div>
                                                <div className="bg-white rounded-lg p-2 sm:p-3 shadow-sm">
                                                    <p className="text-xs text-gray-500 mb-1">Active Orders</p>
                                                    <p className="text-lg sm:text-xl font-bold text-blue-600">
                                                        {orderStatistics.activeOrders}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        ) : (
                            // Edit Mode - Form
                            <form onSubmit={handleSubmit} className="space-y-5 lg:space-y-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Role</label>
                                    <select
                                        name="role"
                                        value={formData.role}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-2.5 border rounded-lg transition-all duration-200 focus:ring-2 bg-white text-sm lg:text-base ${errors.role
                                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                                            : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                            }`}
                                    >
                                        <option value="admin">Admin</option>
                                        <option value="manager">Staff</option>
                                        <option value="user">User</option>
                                    </select>
                                    {errors.role && (
                                        <p className="mt-1.5 text-sm text-red-600">{errors.role}</p>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                                    <select
                                        name="acc_status"
                                        value={formData.acc_status}
                                        onChange={handleChange}
                                        className={`w-full px-4 py-2.5 border rounded-lg transition-all duration-200 bg-white text-sm lg:text-base ${errors.acc_status
                                            ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                                            : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                            }`}
                                        disabled={currentAccount.is_deleted}
                                    >
                                        <option value="active">Active</option>
                                        <option value="suspended">Suspended</option>
                                    </select>
                                    {errors.acc_status && (
                                        <p className="mt-1.5 text-sm text-red-600">{errors.acc_status}</p>
                                    )}
                                </div>
                            </form>
                        )}
                    </div>

                    {/* Footer - Only show in edit mode */}
                    {!internalViewOnly && (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5 border-t shrink-0" style={{ borderColor: '#A86523' }}>
                            <button
                                type="button"
                                onClick={() => {
                                    // Switch back to view mode instead of closing modal
                                    setInternalViewOnly(true);
                                }}
                                className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 font-medium text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2"
                                style={{ '--tw-ring-color': '#A86523' }}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:hover:shadow-md bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] disabled:hover:from-[#E9A319] disabled:hover:to-[#A86523]"
                                style={{
                                    '--tw-ring-color': '#A86523'
                                }}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <Loading type="inline" size="small" message="" className="mr-1" />
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    'Edit'
                                )}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}