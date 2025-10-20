import React, { useState, useEffect, useContext } from "react";
import { ToastContext } from "../../context/ToastContext";
import SummaryAPI from "../../common/SummaryAPI";

export default function AccountModal({ isOpen, account, onClose, onSuccess, viewOnly = false }) {
    const { showToast } = useContext(ToastContext);
    const [formData, setFormData] = useState({
        role: "",
        acc_status: "",
    });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Initialize form data when account changes
    useEffect(() => {
        if (account) {
            setFormData({
                role: account.role || "user",
                acc_status: account.is_deleted ? "deleted" : account.acc_status || "active",
            });
            setErrors({});
        }
    }, [account]);

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
            const accountId = account?.id || account?._id;
            if (!accountId) {
                showToast("Account ID not found!", "error");
                return;
            }

            await SummaryAPI.accounts.update(accountId, {
                role: formData.role,
                acc_status: formData.acc_status,
            });
            showToast("Account updated successfully!", "success");
            onSuccess();
            onClose();
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

    if (!isOpen || !account) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className={`bg-white rounded-xl shadow-2xl border border-gray-200 w-full transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95 ${viewOnly ? 'max-w-2xl' : 'max-w-md'}`}>
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                        {viewOnly ? 'Account Details' : 'Edit Account'}
                    </h3>

                    {viewOnly ? (
                        // View Mode - Display account details
                        <div className="space-y-6">
                            {/* Account Header */}
                            <div className="flex items-center space-x-4 pb-4 border-b border-gray-200">
                                <div className="flex-shrink-0">
                                    {account.image ? (
                                        <img
                                            className="h-16 w-16 rounded-full object-cover border-2 border-gray-200"
                                            src={account.image}
                                            alt={account.name}
                                        />
                                    ) : (
                                        <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center border-2 border-gray-200">
                                            <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                            </svg>
                                        </div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xl font-bold text-gray-900">{account.name || 'N/A'}</h4>
                                    <p className="text-sm text-gray-500">@{account.username || 'N/A'}</p>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${account.role === 'admin' ? 'bg-blue-100 text-blue-800' : account.role === 'manager' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {account.role || 'user'}
                                        </span>
                                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${account.acc_status === 'active' ? 'bg-green-100 text-green-800' : account.acc_status === 'suspended' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                            {account.is_deleted ? 'DELETED' : account.acc_status || 'active'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Account Information Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{account.email || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{account.phone || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">{account.gender || 'N/A'}</p>
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg">
                                            {account.dob ? new Date(account.dob).toLocaleDateString("vi-VN", {
                                                day: '2-digit',
                                                month: '2-digit',
                                                year: 'numeric'
                                            }) : 'N/A'}
                                        </p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                                        <p className="text-sm text-gray-900 bg-gray-50 px-3 py-2 rounded-lg break-words">{account.address || 'N/A'}</p>
                                    </div>
                                </div>
                            </div>

                            {/* Account ID */}
                            <div className="pt-4 border-t border-gray-200">
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account ID</label>
                                <p className="text-xs text-gray-500 font-mono bg-gray-50 px-3 py-2 rounded-lg">{account._id || account.id || 'N/A'}</p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4">
                                <button
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium hover:shadow-sm"
                                >
                                    Close
                                </button>
                                {!account.is_deleted && (
                                    <button
                                        onClick={() => {
                                            onClose();
                                            // Switch to edit mode by calling the edit function from parent
                                            if (onSuccess) {
                                                onSuccess(account, 'edit');
                                            }
                                        }}
                                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 font-medium hover:shadow-lg transform hover:scale-105"
                                    >
                                        Edit Account
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        // Edit Mode - Original form
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm"
                                >
                                    <option value="user">User</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                                {errors.role && (
                                    <p className="text-red-600 text-xs mt-1">{errors.role}</p>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                <select
                                    name="acc_status"
                                    value={formData.acc_status}
                                    onChange={handleChange}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm"
                                    disabled={account.is_deleted}
                                >
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                </select>
                                {errors.acc_status && (
                                    <p className="text-red-600 text-xs mt-1">{errors.acc_status}</p>
                                )}
                            </div>
                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium hover:shadow-sm"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className={`flex-1 px-4 py-2 rounded-lg transition-all duration-200 font-medium hover:shadow-lg transform hover:scale-105 ${isSubmitting ? 'bg-blue-400 text-white cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
                                >
                                    {isSubmitting ? "Updating..." : "Update Account"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}