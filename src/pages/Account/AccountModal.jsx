import React, { useState, useEffect, useContext } from "react";
import { ToastContext } from "../../context/ToastContext";
import SummaryAPI from "../../common/SummaryAPI";

export default function AccountModal({ isOpen, account, onClose, onSuccess }) {
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
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
                <div className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Edit Account</h3>
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
                </div>
            </div>
        </div>
    );
}