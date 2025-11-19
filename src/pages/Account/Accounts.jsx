import React, { useEffect, useState, useContext, useCallback } from "react";
import { ToastContext } from "../../context/ToastContext";
import { AuthContext } from "../../context/AuthContext";
import { useNavigate, useLocation } from 'react-router-dom';
import SummaryAPI from "../../common/SummaryAPI";
import AccountModal from "./AccountModal";
import Loading from "../../components/Loading";

export default function Accounts() {
    const { showToast } = useContext(ToastContext);
    const { user, isAuthLoading } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();
    const [accounts, setAccounts] = useState([]);
    const [statusFilter, setStatusFilter] = useState("all");
    const [roleFilter, setRoleFilter] = useState("all");
    const [searchTerm, setSearchTerm] = useState("");
    const [sortBy, setSortBy] = useState("acc_status");
    const [sortOrder, setSortOrder] = useState("asc");
    const [showFilters, setShowFilters] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [accountToDelete, setAccountToDelete] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isViewMode, setIsViewMode] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const accountsPerPage = 10;

    // Fetch accounts
    const fetchAccounts = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await SummaryAPI.accounts.getAll();
            const accountData = Array.isArray(response) ? response : Array.isArray(response.data) ? response.data : [];
            setAccounts(accountData);
        } catch (err) {
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

    // View account details
    const handleView = (account) => {
        setEditingAccount(account);
        setIsViewMode(true);
        setShowModal(true);
    };

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
        setIsDeleting(true);
        try {
            const accountId = accountToDelete.id || accountToDelete._id;
            if (!accountId) {
                showToast("Account ID not found!", "error");
                return;
            }
            await SummaryAPI.accounts.disable(accountId);
            showToast("Account disabled successfully!", "success");
            fetchAccounts();
            setShowDeleteConfirm(false);
            setAccountToDelete(null);
        } catch (err) {
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
            setIsDeleting(false);
        }
    };

    // Cancel delete
    const handleCancelDelete = () => {
        setShowDeleteConfirm(false);
        setAccountToDelete(null);
    };

    // Sort accounts - Priority: status, then username, then role
    const sortedAccounts = [...(accounts || [])].sort((a, b) => {
        // First sort by status
        const aStatus = a.acc_status || '';
        const bStatus = b.acc_status || '';
        const statusComparison = aStatus.localeCompare(bStatus);

        // If statuses are different, return the status comparison
        if (statusComparison !== 0) {
            return sortOrder === 'asc' ? statusComparison : -statusComparison;
        }

        // If statuses are the same, sort by username
        const aUsername = (a.username || '').toLowerCase();
        const bUsername = (b.username || '').toLowerCase();
        const usernameComparison = aUsername.localeCompare(bUsername);

        // If usernames are different, return the username comparison
        if (usernameComparison !== 0) {
            return sortOrder === 'asc' ? usernameComparison : -usernameComparison;
        }

        // If usernames are the same, sort by role
        const aRole = a.role || '';
        const bRole = b.role || '';
        const roleComparison = aRole.localeCompare(bRole);

        return sortOrder === 'asc' ? roleComparison : -roleComparison;
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

    // Calculate which pages to show (max 5 pages)
    const getVisiblePages = () => {
        const maxVisible = 5;
        if (totalPages <= maxVisible) {
            return Array.from({ length: totalPages }, (_, i) => i + 1);
        }

        let start = Math.max(1, currentPage - 2);
        let end = Math.min(totalPages, start + maxVisible - 1);

        if (end - start < maxVisible - 1) {
            start = Math.max(1, end - maxVisible + 1);
        }

        return Array.from({ length: end - start + 1 }, (_, i) => start + i);
    };

    const visiblePages = getVisiblePages();

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

    // Handle first/last page
    const handleFirstPage = () => {
        handlePageChange(1);
    };

    const handleLastPage = () => {
        handlePageChange(totalPages);
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
        setSortBy("acc_status");
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

    // Format role name for display
    const formatRoleName = (role) => {
        if (role === 'manager') return 'staff';
        return role || 'user';
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
        <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6">

            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">Account Management</h1>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
                    <div className="bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 backdrop-blur-md px-2 lg:px-4 py-1 lg:py-2 rounded-xl border-2 border-yellow-400/50 shadow-md">
                        <span className="text-xs lg:text-sm font-semibold text-gray-700">
                            {filteredAccounts.length} account{filteredAccounts.length !== 1 ? 's' : ''}
                        </span>
                    </div>
                    <button
                        className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 transform hover:scale-105"
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

            {/* Filter Section */}
            {showFilters && (
                <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                    <div className="flex items-center justify-between mb-3 lg:mb-4">
                        <h2 className="text-base lg:text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Search & Filter</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearFilters}
                                disabled={!hasActiveFilters()}
                                className="px-2 py-1.5 lg:px-3 lg:py-2 text-gray-600 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:via-pink-500 hover:to-rose-500 rounded-xl transition-all duration-300 border-2 border-gray-300/60 hover:border-transparent font-medium text-xs lg:text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 shadow-md hover:shadow-lg"
                                aria-label="Clear all filters"
                            >
                                Clear
                            </button>
                        </div>
                    </div>
                    <div className="mb-3 lg:mb-4">
                        <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search Accounts</label>
                        <input
                            type="text"
                            placeholder="Search by username, email, name..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                        />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 lg:gap-4">
                        <div>
                            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Role</label>
                            <select
                                value={roleFilter}
                                onChange={(e) => setRoleFilter(e.target.value)}
                                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                            >
                                <option value="all">All Roles</option>
                                <option value="user">User</option>
                                <option value="manager">Staff</option>
                                <option value="admin">Admin</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                            >
                                <option value="all">All Statuses</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="inactive">Inactive</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {/* Unified State: Loading / Empty / Error */}
            {loading || filteredAccounts.length === 0 || error ? (
                <div className="backdrop-blur-xl rounded-xl border p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }} role="status">
                    <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">

                        {/* ── LOADING ── */}
                        {loading ? (
                            <Loading
                                type="page"
                                size="medium"
                                message="Loading accounts..."
                            />
                        ) : error ? (

                            /* ── NETWORK ERROR ── */
                            <div className="flex flex-col items-center space-y-3">
                                <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center shadow-lg">
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
                                    <h3 className="text-base font-semibold text-gray-900">Network Error</h3>
                                    <p className="text-sm text-gray-500 mt-1">{error}</p>
                                </div>

                                <button
                                    onClick={handleRetry}
                                    className="px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                                >
                                    Retry
                                </button>
                            </div>
                        ) : (

                            /* ── NO ACCOUNTS ── */
                            <>
                                <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
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
                <div className="backdrop-blur-xl rounded-xl border overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                    <div className="overflow-x-auto">
                        <table className="w-full table-fixed min-w-[700px]">
                            {/* ---------- HEADER ---------- */}
                            <thead className="backdrop-blur-sm border-b" style={{ borderColor: '#A86523' }}>
                                <tr>
                                    <th className="w-[5%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                                        #
                                    </th>
                                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Username</th>
                                    <th className="w-[15%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Email</th>
                                    <th className="w-[15%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Name</th>
                                    <th className="w-[12%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Phone</th>
                                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Role</th>
                                    <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Status</th>
                                    <th className="w-[15%] px-2 lg:px-4 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>

                            <tbody>
                                {currentAccounts.map((a, index) => {
                                    const inactive = isAccountInactive(a);
                                    return (
                                        <tr
                                            key={a.id || a._id}
                                            className={`hover:bg-gradient-to-r hover:from-yellow-50/50 hover:via-amber-50/50 hover:to-orange-50/50 transition-all duration-300 border-b-2 border-gray-200/40 ${inactive ? 'opacity-60' : ''
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

                                            {/* Role */}
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm ${a.role === 'admin'
                                                    ? 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white' :
                                                    a.role === 'manager'
                                                        ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white' :
                                                        'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {formatRoleName(a.role)}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm ${a.acc_status === 'active'
                                                        ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white'
                                                        : a.acc_status === 'suspended'
                                                            ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                                                            : a.acc_status === 'inactive'
                                                                ? 'bg-red-600 text-white'
                                                                : 'bg-gray-100 text-gray-800'
                                                        }`}
                                                >
                                                    {a.acc_status || 'active'}
                                                </span>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-2 lg:px-4 py-3">
                                                <div className="flex justify-center items-center space-x-1">
                                                    {/* View Details Button */}
                                                    <button
                                                        onClick={() => handleView(a)}
                                                        className="p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm"
                                                        aria-label={`View account details ${a._id || a.id}`}
                                                        title="View Details"
                                                    >
                                                        <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                        </svg>
                                                    </button>

                                                    {/* Edit Button */}
                                                    <button
                                                        onClick={() => handleEdit(a)}
                                                        disabled={inactive}
                                                        className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${inactive
                                                            ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                                            : 'border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm'
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
                                                        className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${inactive
                                                            ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                                            : 'text-white bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700'
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
                <div className="backdrop-blur-xl rounded-xl border p-4 lg:p-6 mt-4 lg:mt-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-sm text-gray-700">
                            Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                            <span className="font-medium">
                                {Math.min(endIndex, filteredAccounts.length)}
                            </span>{" "}
                            of <span className="font-medium">{filteredAccounts.length}</span>{" "}
                            accounts
                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={handleFirstPage}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200"
                                aria-label="First page"
                                title="First page"
                            >
                                First
                            </button>
                            <button
                                onClick={handlePreviousPage}
                                disabled={currentPage === 1}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200"
                                aria-label="Previous page"
                            >
                                Previous
                            </button>

                            <div className="flex items-center space-x-1">
                                {totalPages > 5 && visiblePages[0] > 1 && (
                                    <>
                                        <button
                                            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 transition-all duration-200"
                                            onClick={() => handlePageChange(1)}
                                            aria-label="Page 1"
                                        >
                                            1
                                        </button>
                                        {visiblePages[0] > 2 && (
                                            <span className="px-2 text-gray-500">...</span>
                                        )}
                                    </>
                                )}
                                {visiblePages.map(page => (
                                    <button
                                        key={page}
                                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${currentPage === page
                                            ? 'text-white border-transparent bg-gradient-to-r from-[#E9A319] via-[#A86523] to-[#8B4E1A] hover:from-[#A86523] hover:via-[#8B4E1A] hover:to-[#6B3D14]'
                                            : 'text-gray-600 bg-white border border-gray-300 hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300'
                                            }`}
                                        onClick={() => handlePageChange(page)}
                                        aria-label={`Page ${page}`}
                                    >
                                        {page}
                                    </button>
                                ))}
                                {totalPages > 5 && visiblePages[visiblePages.length - 1] < totalPages && (
                                    <>
                                        {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                                            <span className="px-2 text-gray-500">...</span>
                                        )}
                                        <button
                                            className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 transition-all duration-200"
                                            onClick={() => handlePageChange(totalPages)}
                                            aria-label={`Page ${totalPages}`}
                                        >
                                            {totalPages}
                                        </button>
                                    </>
                                )}
                            </div>

                            <button
                                onClick={handleNextPage}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200"
                                aria-label="Next page"
                            >
                                Next
                            </button>
                            <button
                                onClick={handleLastPage}
                                disabled={currentPage === totalPages}
                                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200"
                                aria-label="Last page"
                                title="Last page"
                            >
                                Last
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
                <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
                        <div className="p-6">
                            <div className="flex items-center mb-4">
                                <div className="shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                    </svg>
                                </div>
                            </div>
                            <div className="text-center">
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">Deactivate Account</h3>
                                <div className="text-gray-600 mb-6">
                                    <p>
                                        Are you sure you want to deactivate account <span className="font-semibold text-gray-900">{accountToDelete.username}</span>?
                                        <br />
                                        <span className="text-sm text-gray-500">This action cannot be undone.</span>
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                                    <button
                                        onClick={handleCancelDelete}
                                        disabled={isDeleting}
                                        className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleDelete}
                                        disabled={isDeleting}
                                        className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        {isDeleting ? (
                                            <div className="flex items-center justify-center space-x-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                <span>Processing...</span>
                                            </div>
                                        ) : (
                                            'Deactivate Account'
                                        )}
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