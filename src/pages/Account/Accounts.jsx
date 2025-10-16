import React, { useEffect, useState, useContext, useCallback } from "react";
import { ToastContext } from "../../context/ToastContext";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate } from 'react-router-dom';
import SummaryAPI from "../../common/SummaryAPI";
import AccountModal from "./AccountModal";

export default function Accounts() {
    const { showToast } = useContext(ToastContext);
    const { user, isAuthLoading } = useContext(AuthContext);
    const navigate = useNavigate();
    const [accounts, setAccounts] = useState([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [roleFilter, setRoleFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("username");
    const [sortOrder, setSortOrder] = useState("asc");
    const [showFilters, setShowFilters] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const accountsPerPage = 20;

    // Fetch accounts
    const fetchAccounts = useCallback(async () => {
        try {
            const response = await SummaryAPI.accounts.getAll();
            const accountData = Array.isArray(response) ? response : Array.isArray(response.data) ? response.data : [];
            console.log("Fetched accounts:", accountData);
            setAccounts(accountData);
        } catch (err) {
            console.error("Fetch accounts error:", err);
            let errorMessage = "Failed to fetch accounts";
            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.response?.status === 403) {
                errorMessage = "Access denied. Only admin can view accounts";
            } else if (err.response?.status === 401) {
                errorMessage = "You are not authorized to view accounts";
                navigate('/login', { replace: true });
            } else if (err.response?.status >= 500) {
                errorMessage = "Server error. Please try again later";
            } else if (err.message) {
                errorMessage = `Failed to fetch accounts: ${err.message}`;
            }
            showToast(errorMessage, "error");
            setAccounts([]);
        }
    }, [showToast, navigate]);

    useEffect(() => {
        if (isAuthLoading) return;
        if (!user && !localStorage.getItem('token')) {
            navigate('/login', { replace: true });
        } else if (user && user.role === 'admin') {
            fetchAccounts();
        } else {
            showToast("Access denied. Only admin can view accounts", "error");
            navigate('/dashboard', { replace: true });
        }
    }, [user, isAuthLoading, navigate, fetchAccounts]);

    // Edit account
    const handleEdit = (account) => {
        if (account.is_deleted) return;
        setEditingAccount(account);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setEditingAccount(null);
    };

    // Handle successful operation
    const handleSuccess = () => {
        fetchAccounts();
    };

    // Toggle filters
    const toggleFilters = () => {
        setShowFilters(!showFilters);
    };

    // Show delete confirmation
    const handleDeleteClick = (account) => {
        setAccountToDelete(account);
        setShowDeleteConfirm(true);
    };

    // Delete / Disable account
    const handleDelete = async () => {
        if (!accountToDelete) return;
        try {
            const accountId = accountToDelete.id || accountToDelete._id;
            if (!accountId) {
                showToast("Account ID not found!", "error");
                return;
            }
            await SummaryAPI.accounts.disable(accountId);
            showToast("Account disabled successfully!", "success");
            fetchAccounts();
        } catch (err) {
            console.error("Disable account error:", err);
            let errorMessage = "Failed to disable account";
            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.response?.status === 403) {
                errorMessage = "Access denied. Only admin can disable accounts";
            } else if (err.response?.status === 404) {
                errorMessage = "Account not found";
            } else if (err.response?.status >= 500) {
                errorMessage = "Server error. Please try again later";
            } else if (err.message) {
                errorMessage = `Failed to disable account: ${err.message}`;
            }
            showToast(errorMessage, "error");
        } finally {
            setShowDeleteConfirm(false);
            setAccountToDelete(null);
        }
    };

    // Cancel delete
    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setAccountToDelete(null);
    };

    // Sort accounts
    const sortedAccounts = [...(accounts || [])].sort((a, b) => {
        let aValue, bValue;
        switch (sortBy) {
            case 'username':
                aValue = a.username?.toLowerCase() || '';
                bValue = b.username?.toLowerCase() || '';
                break;
            case 'email':
                aValue = a.email?.toLowerCase() || '';
                bValue = b.email?.toLowerCase() || '';
                break;
            case 'name':
                aValue = a.name ? a.name.toLowerCase() : '';
                bValue = b.name ? b.name.toLowerCase() : '';
                break;
            case 'role':
                aValue = a.role || '';
                bValue = b.role || '';
                break;
            case 'acc_status':
                aValue = a.acc_status || '';
                bValue = b.acc_status || '';
                break;
            default:
                aValue = a.username?.toLowerCase() || '';
                bValue = b.username?.toLowerCase() || '';
        }
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    });

    // Filter accounts
    const filteredAccounts = sortedAccounts.filter((a) => {
        const matchesStatus = statusFilter === "all" || a.acc_status === statusFilter || (statusFilter === "deleted" && a.is_deleted);
        const matchesRole = roleFilter === "all" || a.role === roleFilter;
        const matchesSearch = searchTerm === "" ||
            a.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (a.name && a.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (a.phone && a.phone.includes(searchTerm));
        return matchesStatus && matchesRole && matchesSearch;
    });

    // Pagination logic
    const totalPages = Math.ceil(filteredAccounts.length / accountsPerPage);
    const paginatedAccounts = filteredAccounts.slice(
        (currentPage - 1) * accountsPerPage,
        currentPage * accountsPerPage
    );

    // Handle page change
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 flex items-center justify-center">
                <div className="flex items-center space-x-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                    <span>Verifying authentication...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
            {/* Account Modal (Edit only) */}
            <AccountModal
                isOpen={showModal}
                account={editingAccount}
                onClose={closeModal}
                onSuccess={handleSuccess}
            />

            {/* Main Account Management UI */}
            <>
                {/* Header Section */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Account Management</h1>
                            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage user accounts and permissions</p>
                        </div>
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
                            <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
                                <span className="text-xs lg:text-sm font-medium text-gray-700">
                                    {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}
                                </span>
                            </div>
                            <button
                                className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
                                onClick={toggleFilters}
                                aria-label="Toggle filters"
                            >
                                <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                                </svg>
                                <span className="font-medium hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                                <span className="font-medium sm:hidden">Filters</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Filter Section */}
                {showFilters && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
                        <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Search & Filter</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                            <div>
                                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search</label>
                                <input
                                    type="text"
                                    placeholder="Search by username, email, name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                                />
                            </div>
                            <div>
                                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Role</label>
                                <select
                                    value={roleFilter}
                                    onChange={(e) => setRoleFilter(e.target.value)}
                                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                                >
                                    <option value="all">All Roles</option>
                                    <option value="user">User</option>
                                    <option value="manager">Manager</option>
                                    <option value="admin">Admin</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                                >
                                    <option value="all">All Statuses</option>
                                    <option value="active">Active</option>
                                    <option value="suspended">Suspended</option>
                                    <option value="deleted">Deleted</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Sort By</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                                >
                                    <option value="username">Username</option>
                                    <option value="email">Email</option>
                                    <option value="name">Name</option>
                                    <option value="role">Role</option>
                                    <option value="acc_status">Status</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Order</label>
                                <select
                                    value={sortOrder}
                                    onChange={(e) => setSortOrder(e.target.value)}
                                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                                >
                                    <option value="asc">Ascending</option>
                                    <option value="desc">Descending</option>
                                </select>
                            </div>
                            <div className="flex items-end">
                                <button
                                    onClick={() => {
                                        setSearchTerm("");
                                        setRoleFilter("all");
                                        setStatusFilter("all");
                                        setSortBy("username");
                                        setSortOrder("asc");
                                        setCurrentPage(1);
                                    }}
                                    className="w-full px-3 py-2 lg:px-4 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base"
                                >
                                    Clear Filters
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Accounts Table */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[800px]">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Username</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Phone</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Address</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Gender</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date of Birth</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {paginatedAccounts.length > 0 ? (
                                    paginatedAccounts.map((a) => (
                                        <tr key={a.id || a._id} className="hover:bg-gray-50 transition-colors duration-150">
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                                <div className="text-xs lg:text-sm font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded-lg inline-block">
                                                    {a.username || '-'}
                                                </div>
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                                                {a.email || '-'}
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                                                {a.name || '-'}
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                                                {a.phone || '-'}
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                                                {a.address || '-'}
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                                                {a.gender || '-'}
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                                                {a.dob ? new Date(a.dob).toLocaleDateString("vi-VN", {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                }) : '-'}
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.role === 'admin' ? 'bg-blue-100 text-blue-800' : a.role === 'manager' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {a.role || 'user'}
                                                </span>
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${a.acc_status === 'active' ? 'bg-green-100 text-green-800' : a.acc_status === 'suspended' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
                                                    {a.is_deleted ? 'DELETED' : a.acc_status || 'active'}
                                                </span>
                                            </td>
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm font-medium">
                                                <div className="flex items-center space-x-1">
                                                    <button
                                                        className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                                                        onClick={() => handleEdit(a)}
                                                        disabled={a.is_deleted}
                                                        title="Edit account"
                                                    >
                                                        <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>
                                                    <button
                                                        className={`p-1.5 rounded-lg transition-all duration-200 border ${a.is_deleted ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200 border-red-200 hover:border-red-300'}`}
                                                        onClick={() => handleDeleteClick(a)}
                                                        disabled={a.is_deleted}
                                                        title={a.is_deleted ? "Already deleted" : "Delete account"}
                                                    >
                                                        {a.is_deleted ? (
                                                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728L5.636 5.636m12.728 12.728L18.364 5.636M5.636 18.364l12.728-12.728" />
                                                            </svg>
                                                        ) : (
                                                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="10" className="px-2 lg:px-4 py-8 text-center">
                                            <div className="flex flex-col items-center justify-center space-y-3">
                                                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-6 h-6 lg:w-8 lg:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </div>
                                                <div>
                                                    <h3 className="text-base lg:text-lg font-medium text-gray-900 mb-1 lg:mb-2">No accounts found</h3>
                                                    <p className="text-gray-500 text-xs lg:text-sm">
                                                        {searchTerm || statusFilter !== "all" || roleFilter !== "all"
                                                            ? "Try adjusting your search or filter criteria"
                                                            : "No accounts available"}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-between items-center mt-4">
                        <div className="text-sm text-gray-600">
                            Showing {(currentPage - 1) * accountsPerPage + 1} to{" "}
                            {Math.min(currentPage * accountsPerPage, filteredAccounts.length)} of {filteredAccounts.length} accounts
                        </div>
                        <div className="flex space-x-2">
                            <button
                                onClick={() => handlePageChange(currentPage - 1)}
                                disabled={currentPage === 1}
                                className={`px-3 py-2 rounded-lg border ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                            >
                                Previous
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <button
                                    key={page}
                                    onClick={() => handlePageChange(page)}
                                    className={`px-3 py-2 rounded-lg border ${currentPage === page ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 hover:bg-blue-100'}`}
                                >
                                    {page}
                                </button>
                            ))}
                            <button
                                onClick={() => handlePageChange(currentPage + 1)}
                                disabled={currentPage === totalPages}
                                className={`px-3 py-2 rounded-lg border ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'}`}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && accountToDelete && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
                            <div className="p-6">
                                <div className="flex items-center mb-4">
                                    <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                                        <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                        </svg>
                                    </div>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Account</h3>
                                    <p className="text-gray-600 mb-6">
                                        Are you sure you want to delete account <span className="font-semibold text-gray-900">{accountToDelete.username}</span>?
                                        <br />
                                        <span className="text-sm text-gray-500">This action cannot be undone.</span>
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                        <button
                                            onClick={handleCancelDelete}
                                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium hover:shadow-sm"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleDelete}
                                            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium hover:shadow-lg transform hover:scale-105"
                                        >
                                            Delete Account
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </>
        </div>
    );
}