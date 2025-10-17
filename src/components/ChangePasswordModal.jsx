import React, { useState, useContext } from "react";
import { motion } from "framer-motion";
import Api from "../common/SummaryAPI";
import { useToast } from "../hooks/useToast";
import { AuthContext } from "../context/AuthContext";
import { Eye, EyeOff } from "lucide-react";

const ChangePasswordModal = ({ handleCancel }) => {
    const [form, setForm] = useState({
        oldPassword: "",
        newPassword: "",
        repeatPassword: "",
    });
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState({
        oldPassword: false,
        newPassword: false,
        repeatPassword: false,
    });

    const { user } = useContext(AuthContext);
    const { showToast } = useToast();

    const togglePasswordVisibility = (field) => {
        setShowPassword((prev) => ({
            ...prev,
            [field]: !prev[field],
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!form.oldPassword || !form.newPassword || !form.repeatPassword) {
            showToast("All fields are required", "error", 3000);
            return;
        }
        if (form.newPassword.length < 8) {
            showToast("New password must be at least 8 characters", "error", 3000);
            return;
        }
        // Password validation: at least 3 of 4 character types
        const hasUpperCase = /[A-Z]/.test(form.newPassword);
        const hasLowerCase = /[a-z]/.test(form.newPassword);
        const hasNumber = /\d/.test(form.newPassword);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.newPassword);
        const characterTypesMet = [hasUpperCase, hasLowerCase, hasNumber, hasSpecial].filter(Boolean).length;
        
        if (characterTypesMet < 3) {
            showToast(
                "Password must include at least three of: uppercase letter, lowercase letter, number, special character",
                "error",
                3000
            );
            return;
        }
        if (form.newPassword !== form.repeatPassword) {
            showToast("Passwords do not match", "error", 3000);
            return;
        }

        setLoading(true);
        try {
            await Api.accounts.changePassword(user._id, {
                oldPassword: form.oldPassword,
                newPassword: form.newPassword,
            });
            showToast("Password changed successfully!", "success", 2000);
            handleCancel();
        } catch (err) {
            console.error("Change password error:", err.response || err.message);
            const errorMessage =
                err.response?.data?.message || "Failed to change password";
            showToast(errorMessage, "error", 4000);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 flex items-center justify-center z-50">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                onClick={handleCancel}
            ></div>

            {/* Modal */}
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.25 }}
                className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-100"
            >
                <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
                    Change Password
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {[
                        { label: "Old Password", key: "oldPassword" },
                        { label: "New Password", key: "newPassword" },
                        { label: "Repeat Password", key: "repeatPassword" },
                    ].map((field) => (
                        <div key={field.key} className="relative">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                {field.label}
                            </label>
                            <input
                                type={showPassword[field.key] ? "text" : "password"}
                                value={form[field.key]}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                                }
                                className="w-full border border-gray-300 rounded-xl p-2.5 text-sm 
                           focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition pr-10"
                                placeholder={`Enter ${field.label.toLowerCase()}`}
                            />
                            <button
                                type="button"
                                onClick={() => togglePasswordVisibility(field.key)}
                                className="absolute right-3 top-9 text-gray-500 hover:text-gray-700"
                            >
                                {showPassword[field.key] ? (
                                    <EyeOff className="w-5 h-5" />
                                ) : (
                                    <Eye className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    ))}

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={handleCancel}
                            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 hover:opacity-90 text-white font-semibold text-sm shadow"
                        >
                            {loading ? "Saving..." : "Save"}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
};

export default ChangePasswordModal;