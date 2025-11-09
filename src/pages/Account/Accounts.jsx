import React, { useEffect, useState, useContext, useCallback } from "react";
import { ToastContext } from "../../context/ToastContext";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate, useLocation } from 'react-router-dom';
import SummaryAPI from "../../common/SummaryAPI";
import AccountModal from "./AccountModal";

export default function Accounts() {
    const { showToast } = useContext(ToastContext);
    const { user, isAuthLoading } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
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
    const [isViewMode, setIsViewMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const accountsPerPage = 20;

    // Fetch accounts
    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        setError('');
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
            setError(errorMessage);
            showToast(errorMessage, "error");
            setAccounts([]);
        } finally {
            setLoading(false);
        }
    }, [showToast, navigate]);

    // Handle accountId from URL query parameter
    useEffect(() => {
        const urlParams = new URLSearchParams(location.search);
        const accountId = urlParams.get('accountId');

        if (accountId && accounts.length > 0) {
            const targetAccount = accounts.find(account =>
                account._id === accountId || account.id === accountId
            );

            if (targetAccount) {
                setEditingAccount(targetAccount);
                setIsViewMode(true);
                setShowModal(true);
                // Clear the URL parameter after opening modal
                navigate('/accounts', { replace: true });
            }
        }
    }, [accounts, location.search, navigate]);

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
    }, [user, isAuthLoading, navigate, fetchAccounts, showToast]);

    // Edit account
    const handleEdit = (account) => {
        if (account.acc_status === 'inactive') return;
        setEditingAccount(account);
        setIsViewMode(false);
        setShowModal(true);
    };

    // Close modal
    const closeModal = () => {
        setShowModal(false);
        setEditingAccount(null);
        setIsViewMode(false);
    };

    // Handle successful operation
    const handleSuccess = (account = null, action = 'refresh') => {
        if (action === 'edit' && account) {
            // Switch to edit mode
            setEditingAccount(account);
            setIsViewMode(false);
            setShowModal(true);
        } else {
            // Refresh accounts list
            fetchAccounts();
        }
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
        const matchesStatus = statusFilter === "all" || a.acc_status === statusFilter || (statusFilter === "inactive" && a.acc_status === 'inactive');
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
    const startIndex = (currentPage - 1) * accountsPerPage;
    const endIndex = startIndex + accountsPerPage;
    const currentAccounts = filteredAccounts.slice(startIndex, endIndex);

    // Handle page change
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };

    // Handle previous page
    const handlePreviousPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };

    // Handle next page
    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
    };

    // Check if any filters are active
    const hasActiveFilters = () => {
        return searchTerm ||
            roleFilter !== 'all' ||
            statusFilter !== 'all';
    };

    // Clear all filters
    const clearFilters = () => {
        setSearchTerm("");
        setRoleFilter("all");
        setStatusFilter("all");
        setSortBy("username");
        setSortOrder("asc");
        setCurrentPage(1);
    };

    // Retry fetching data
    const handleRetry = () => {
        fetchAccounts();
    };

    // Get status badge class
    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'active': return 'bg-green-100 text-green-800';
            case 'suspended': return 'bg-yellow-100 text-yellow-800';
            case 'inactive': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    // Check if account is inactive
    const isAccountInactive = (account) => {
        return account.acc_status === 'inactive';
    };

    if (isAuthLoading) {
        return (
            <div className="products-container">
                <div className="products-loading" role="status" aria-live="polite">
                    <div className="products-progress-bar"></div>
                    <p>Verifying authentication...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">

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
                            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search Accounts</label>
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
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={clearFilters}
                                disabled={!hasActiveFilters()}
                                className="w-full px-3 py-2 lg:px-4 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label="Clear all filters"
                            >
                                Clear Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Unified State: Loading / Empty / Error */}
            {loading || filteredAccounts.length === 0 || error ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6" role="status">
                    <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">

                        {/* ── LOADING ── */}
                        {loading ? (
                            <>
                                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                                <p className="text-gray-600 font-medium">Loading accounts...</p>
                            </>
                        ) : error ? (

                            /* ── NETWORK ERROR ── */
                            <div className="flex flex-col items-center space-y-3">
                                <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                                    <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                        />
                                    </svg>
                                </div>

                                <div className="text-center">
                                    <h3 className="text-base font-medium text-gray-900">Network Error</h3>
                                    <p className="text-sm text-gray-500 mt-1">{error}</p>
                                </div>

                                <button
                                    onClick={handleRetry}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (

                            /* ── NO ACCOUNTS ── */
                            <>
                                <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                                        />
                                    </svg>
                                </div>

                                <div className="text-center">
                                    <h3 className="text-base font-medium text-gray-900">No accounts found</h3>
                                    <p className="text-sm text-gray-500 mt-1">
                                        {accounts.length === 0
                                            ? "Get started by creating your first account"
                                            : "Try adjusting your search or filter criteria"}
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ) : (
                /* Accounts Table - Only when data exists */
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed min-w-[900px]">
                            {/* ---------- HEADER ---------- */}
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="w-[5%]  px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                                        #
                                    </th>
                                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Username</th>
                                    <th className="w-[15%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Email</th>
                                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Phone</th>
                                    <th className="w-[15%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Address</th>
                                    <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Gender</th>
                                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date of Birth</th>
                                    <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Role</th>
                                    <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                                    <th className="w-[13%] px-2 lg:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>

                            <tbody className="bg-white divide-y divide-gray-200">
                                {currentAccounts.map((a, index) => {
                                    const inactive = isAccountInactive(a);
                                    return (
                                        <tr
                                            key={a.id || a._id}
                                            className={`hover:bg-gray-50 transition-colors duration-150 ${
                                                inactive ? 'opacity-60' : ''
                                            }`}
                                        >
                                            {/* # */}
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                                                {startIndex + index + 1}
                                            </td>

                                            {/* Username */}
                                            <td className="px-2 lg:px-4 py-3">
                                                <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                                                    {a.username || 'N/A'}
                                                </div>
                                            </td>

                                            {/* Email */}
                                            <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                                <div className="truncate">
                                                    {a.email || 'N/A'}
                                                </div>
                                            </td>

                                            {/* Name */}
                                            <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                                {a.name || 'N/A'}
                                            </td>

                                            {/* Phone */}
                                            <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                                {a.phone || 'N/A'}
                                            </td>

                                            {/* Address */}
                                            <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                                <div className="truncate">
                                                    {a.address || 'N/A'}
                                                </div>
                                            </td>

                                            {/* Gender */}
                                            <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                                {a.gender || 'N/A'}
                                            </td>

                                            {/* Date of Birth */}
                                            <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                                {a.dob ? new Date(a.dob).toLocaleDateString("vi-VN", {
                                                    day: '2-digit',
                                                    month: '2-digit',
                                                    year: 'numeric'
                                                }) : 'N/A'}
                                            </td>

                                            {/* Role */}
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                                    a.role === 'admin' ? 'bg-blue-100 text-blue-800' :
                                                    a.role === 'manager' ? 'bg-green-100 text-green-800' :
                                                    'bg-gray-100 text-gray-800'
                                                } capitalize`}>
                                                    {a.role || 'user'}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                                                        getStatusBadgeClass(a.acc_status)
                                                    }`}
                                                >
                                                    {a.acc_status || 'active'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-2 lg:px-4 py-3">
                                                <div className="flex justify-center items-center space-x-1">
                                                    {/* View/Edit Button */}
                                                    <button
                                                        onClick={() => handleEdit(a)}
                                                        disabled={inactive}
                                                        className={`p-1.5 rounded-lg transition-all duration-200 border ${
                                                            inactive
                                                                ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                                                : 'text-blue-600 hover:text-blue-800 hover:bg-blue-100 border-blue-200 hover:border-blue-300'
                                                        }`}
                                                        aria-label={`Edit account ${a._id || a.id}`}
                                                        title="Edit Account"
                                                    >
                                                        <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                        </svg>
                                                    </button>

                                                    {/* Delete Button */}
                                                    <button
                                                        onClick={() => handleDeleteClick(a)}
                                                        disabled={inactive}
                                                        className={`p-1.5 rounded-lg transition-all duration-200 border ${
                                                            inactive
                                                                ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                                                : 'text-red-600 hover:text-red-800 hover:bg-red-100 border-red-200 hover:border-red-300'
                                                        }`}
                                                        aria-label={`Deactivate account ${a._id || a.id}`}
                                                        title="Deactivate Account"
                                                    >
                                                        <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {filteredAccounts.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 mt-4 lg:mt-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-700">
                            Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredAccounts.length)}</span> of <span className="font-medium">{filteredAccounts.length}</span> accounts
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                aria-label="Previous page"
                            >
                                Previous
                            </button>

                            <div className="flex items-center space-x-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                                    <button
                                        key={page}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${currentPage === page
                                            ? 'bg-blue-600 text-white border border-blue-600'
                                            : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                                        }`}
                                        onClick={() => handlePageChange(page)}
                                        aria-label={`Page ${page}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>

                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                                aria-label="Next page"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Account Modal */}
            <AccountModal
                isOpen={showModal}
                account={editingAccount}
                onClose={closeModal}
                onSuccess={handleSuccess}
                viewOnly={isViewMode}
            />

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
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Deactivate Account</h3>
                                <p className="text-gray-600 mb-6">
                                    Are you sure you want to deactivate account <span className="font-semibold text-gray-900">{accountToDelete.username}</span>?
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
                                        Deactivate Account
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}