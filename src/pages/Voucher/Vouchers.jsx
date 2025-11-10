import React, { useEffect, useState, useContext, useCallback } from "react";
import { ToastContext } from "../../context/ToastContext";
import SummaryAPI from "../../common/SummaryAPI";
import VoucherModal from "./VoucherModal";
import DeleteConfirmModal from "../../components/DeleteConfirmModal";
import Loading from "../../components/Loading";

export default function Vouchers() {
  const { showToast } = useContext(ToastContext);
  const [vouchers, setVouchers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("code"); // 'startDate', 'endDate', 'code', 'discountValue', 'usageLimit'
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc' or 'desc'
  const [showFilters, setShowFilters] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  // Helper function to extract error message
  const getErrorMessage = (err, defaultMessage) => {
    if (err.response?.data?.message) {
      return err.response.data.message;
    } else if (err.response?.status === 403) {
      return "Access denied. Only admin and manager can perform this action";
    } else if (err.response?.status === 401) {
      return "You are not authorized to perform this action";
    } else if (err.response?.status === 404) {
      return "Resource not found";
    } else if (err.response?.status >= 500) {
      return "Server error. Please try again later";
    } else if (err.message) {
      return err.message;
    }
    return defaultMessage;
  };

  // Fetch vouchers
  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await SummaryAPI.vouchers.getAll();
      setVouchers(data.data);
    } catch (err) {
      console.error(err);
      const errorMessage = getErrorMessage(err, "Failed to fetch vouchers");
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // Calculate voucher status
  const getVoucherStatus = (voucher) => {
    if (voucher.isDeleted) return "DISABLED";

    const now = new Date();
    const start = new Date(voucher.startDate);
    const end = new Date(voucher.endDate);

    if (now < start) return "UPCOMING";
    if (now > end) return "EXPIRED";
    if (voucher.usedCount >= voucher.usageLimit) return "USED UP";

    return "ACTIVE";
  };

  // Format status for display
  const formatStatus = (status) => {
    return status.split(' ')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Edit voucher
  const handleEdit = (voucher) => {
    if (voucher.isDeleted) return;
    setEditingVoucher(voucher);
    setModalMode("edit");
    setShowModal(true);
  };

  // Create voucher
  const handleCreate = () => {
    setEditingVoucher(null);
    setModalMode("create");
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingVoucher(null);
  };

  // Handle successful operation
  const handleSuccess = () => {
    fetchVouchers();
  };

  // Toggle filters
  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  // Show delete confirmation
  const handleDeleteClick = (voucher) => {
    setVoucherToDelete(voucher);
    setShowDeleteConfirm(true);
  };

  // Delete / Disable voucher
  const handleDelete = async () => {
    if (!voucherToDelete) return;

    const voucherId = voucherToDelete.id || voucherToDelete._id;
    if (!voucherId) {
      showToast("Voucher ID not found!", "error");
      return;
    }

    setLoading(true);
    setError('');

    try {
      await SummaryAPI.vouchers.disable(voucherId);
      showToast("Voucher disabled successfully", "success");
      setShowDeleteConfirm(false);
      setVoucherToDelete(null);
      fetchVouchers();
    } catch (err) {
      console.error(err);
      const errorMessage = getErrorMessage(err, "Failed to disable voucher");
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setVoucherToDelete(null);
  };

  // Get status priority for sorting (lower number = higher priority)
  // Priority: ACTIVE > UPCOMING > USED UP > EXPIRED > DISABLED
  // USED UP before EXPIRED because used-up vouchers indicate successful usage and may be more important for analysis
  const getStatusPriority = (status) => {
    const priorityMap = {
      'ACTIVE': 1,
      'UPCOMING': 2,
      'USED UP': 3,      // Used up (usage-based) - indicates successful voucher usage
      'EXPIRED': 4,      // Expired (time-based) - just ran out of time
      'DISABLED': 5
    };
    return priorityMap[status] || 99;
  };

  // Sort vouchers based on sortBy and sortOrder
  // Always sort by status first (ACTIVE > others > DISABLED), then by selected field
  const sortedVouchers = [...vouchers].sort((a, b) => {
    // First, sort by status (ACTIVE first, DISABLED last)
    const aStatus = getVoucherStatus(a);
    const bStatus = getVoucherStatus(b);
    const aStatusPriority = getStatusPriority(aStatus);
    const bStatusPriority = getStatusPriority(bStatus);

    // If statuses are different, sort by status priority
    if (aStatusPriority !== bStatusPriority) {
      return aStatusPriority - bStatusPriority;
    }

    // If statuses are the same, sort by the selected field
    let aValue, bValue;

    switch (sortBy) {
      case 'startDate':
        aValue = new Date(a.startDate);
        bValue = new Date(b.startDate);
        break;
      case 'endDate':
        aValue = new Date(a.endDate);
        bValue = new Date(b.endDate);
        break;
      case 'discountValue':
        aValue = a.discountValue;
        bValue = b.discountValue;
        break;
      case 'usageLimit':
        aValue = a.usageLimit;
        bValue = b.usageLimit;
        break;
      case 'code':
      default:
        // Default: sort by code
        aValue = a.code.toLowerCase();
        bValue = b.code.toLowerCase();
        break;
    }

    // Sort by selected field
    if (sortBy === 'code') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  // Filter vouchers by status, type and search term
  const filteredVouchers = sortedVouchers.filter((v) => {
    const matchesStatus =
      statusFilter === "all" || getVoucherStatus(v) === statusFilter;
    const matchesType =
      typeFilter === "all" || v.discountType === typeFilter;
    const matchesSearch =
      searchTerm === "" || v.code.includes(searchTerm);

    return matchesStatus && matchesType && matchesSearch;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredVouchers.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentVouchers = filteredVouchers.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = useCallback((page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

  // Handle previous/next page
  const handlePreviousPage = useCallback(() => {
    handlePageChange(currentPage - 1);
  }, [currentPage, handlePageChange]);

  const handleNextPage = useCallback(() => {
    handlePageChange(currentPage + 1);
  }, [currentPage, handlePageChange]);

  // Check if any filters are active
  const hasActiveFilters = searchTerm ||
    typeFilter !== 'all' ||
    statusFilter !== 'all' ||
    sortBy !== 'code' ||
    sortOrder !== 'asc';

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setTypeFilter('all');
    setStatusFilter('all');
    setSortBy('code');
    setSortOrder('asc');
    setCurrentPage(1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Unified Voucher Modal */}
      <VoucherModal
        isOpen={showModal}
        mode={modalMode}
        voucher={editingVoucher}
        onClose={closeModal}
        onSuccess={handleSuccess}
      />

      {/* Main Voucher Management UI */}
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523' }}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Voucher Management</h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage discount vouchers</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
            <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
              <span className="text-xs lg:text-sm font-medium text-gray-700">
                {filteredVouchers.length} voucher{filteredVouchers.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
              style={{ backgroundColor: '#E9A319' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
              onClick={toggleFilters}
              aria-label="Toggle filters"
            >
              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
              </svg>
              <span className="font-medium hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
              <span className="font-medium sm:hidden">Filters</span>
            </button>
            <button
              className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
              style={{ backgroundColor: '#E9A319' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
              onClick={handleCreate}
            >
              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">Add Voucher</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523' }}>
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900">Search & Filter</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="px-2 py-1.5 lg:px-3 lg:py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-xs lg:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Clear all filters"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search by Code</label>
              <input
                type="text"
                placeholder="Enter voucher code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
              />
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Discount Type</label>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
              >
                <option value="all">All Types</option>
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
              >
                <option value="all">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="UPCOMING">Upcoming</option>
                <option value="USED UP">Used Up</option>
                <option value="EXPIRED">Expired</option>
                <option value="DISABLED">Disabled</option>
              </select>
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
              >
                <option value="code">Voucher Code</option>
                <option value="startDate">Start Date</option>
                <option value="endDate">End Date</option>
                <option value="discountValue">Discount Value</option>
                <option value="usageLimit">Usage Limit</option>
              </select>
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Order</label>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Vouchers Table */}
      <div className="bg-white rounded-xl shadow-xl border overflow-hidden" style={{ borderColor: '#A86523' }}>
        {loading || filteredVouchers.length === 0 || error ? (
          <div className="p-6" role="status">
            <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
              {/* ── LOADING ── */}
              {loading ? (
                <Loading
                  type="inline"
                  size="medium"
                  message="Loading vouchers..."
                  className="min-h-[180px]"
                />
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
                    onClick={fetchVouchers}
                    className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                    style={{ backgroundColor: '#E9A319' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
                  >
                    Retry
                  </button>
                </div>
              ) : (
                /* ── NO VOUCHERS ── */
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
                    <h3 className="text-base font-medium text-gray-900">No vouchers found</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {vouchers.length === 0
                        ? "Get started by creating your first voucher"
                        : "Try adjusting your search or filter criteria"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-[4%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">
                    #
                  </th>
                  <th className="w-[13%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Code</th>
                  <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Type</th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Discount</th>
                  <th className="w-[8%] pl-2 lg:pl-4 pr-3 lg:pr-5 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Min Order</th>
                  <th className="w-[8%] pl-3 lg:pl-5 pr-5 lg:pr-7 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Max Discount</th>
                  <th className="w-[10%] pl-5 lg:pl-7 pr-2 lg:pr-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Start Date</th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">End Date</th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Usage</th>
                  <th className="w-[9%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {currentVouchers.map((v, index) => {
                  const status = getVoucherStatus(v);
                  const formattedStatus = formatStatus(status);
                  return (
                    <tr key={v.id || v._id} className={`hover:bg-gray-50 transition-colors duration-150 ${v.isDeleted ? 'opacity-60' : ''}`}>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-2 lg:px-4 py-3">
                        <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                          {v.code}
                        </div>
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                        {v.discountType === "percentage" ? "Percentage" : "Fixed"}
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-right">
                        <div className="text-xs lg:text-sm font-semibold text-gray-900">
                          {v.discountType === "percentage"
                            ? `${v.discountValue}%`
                            : `${v.discountValue.toLocaleString("vi-VN")}₫`}
                        </div>
                      </td>
                      <td className="pl-2 lg:pl-4 pr-3 lg:pr-5 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900 text-right">
                        {v.minOrderValue.toLocaleString("vi-VN")}₫
                      </td>
                      <td className="pl-3 lg:pl-5 pr-5 lg:pr-7 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900 text-right">
                        {v.discountType === "percentage"
                          ? v.maxDiscount
                            ? `${v.maxDiscount.toLocaleString("vi-VN")}₫`
                            : "-"
                          : "-"}
                      </td>
                      <td className="pl-5 lg:pl-7 pr-2 lg:pr-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                        {new Date(v.startDate).toLocaleDateString("vi-VN", {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                        {new Date(v.endDate).toLocaleDateString("vi-VN", {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric'
                        })}
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        <div className="text-xs lg:text-sm text-gray-900">
                          <span className="font-medium">{v.usedCount}</span>
                          <span className="text-gray-500">/{v.usageLimit}</span>
                        </div>
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${status === 'ACTIVE'
                          ? 'bg-green-100 text-green-800'
                          : status === 'UPCOMING'
                            ? 'bg-blue-100 text-blue-800'
                            : status === 'EXPIRED'
                              ? 'bg-red-100 text-red-800'
                              : status === 'USED UP'
                                ? 'bg-orange-300 text-orange-800'
                                : 'bg-gray-100 text-gray-800'
                          }`}>
                          {formattedStatus}
                        </span>
                      </td>
                      <td className="px-2 lg:px-4 py-3">
                        <div className="flex justify-center items-center space-x-1">
                          <button
                            className={`p-1.5 rounded-lg transition-all duration-200 border ${v.isDeleted
                              ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                              : 'border-[#A86523]'
                              }`}
                            style={!v.isDeleted ? {
                              color: '#A86523',
                              backgroundColor: 'transparent'
                            } : {}}
                            onMouseEnter={(e) => !v.isDeleted && (e.currentTarget.style.backgroundColor = '#FCEFCB')}
                            onMouseLeave={(e) => !v.isDeleted && (e.currentTarget.style.backgroundColor = 'transparent')}
                            onClick={() => handleEdit(v)}
                            disabled={v.isDeleted}
                            aria-label={`Edit voucher ${v.code}`}
                            title="Edit Voucher"
                          >
                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            className={`p-1.5 rounded-lg transition-all duration-200 border ${v.isDeleted
                              ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                              : 'text-red-600 hover:text-red-800 hover:bg-red-100 border-red-200 hover:border-red-300'
                              }`}
                            onClick={() => handleDeleteClick(v)}
                            disabled={v.isDeleted}
                            aria-label={`Disable voucher ${v.code}`}
                            title="Disable Voucher"
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
        )}
      </div>

      {/* Pagination */}
      {filteredVouchers.length > 0 && (
        <div className="bg-white rounded-xl shadow-xl border p-4 lg:p-6 mt-4 lg:mt-6" style={{ borderColor: '#A86523' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredVouchers.length)}</span> of <span className="font-medium">{filteredVouchers.length}</span> vouchers
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
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${currentPage === page
                      ? 'text-white border-[#A86523]'
                      : 'text-gray-500 bg-white border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                      }`}
                    style={currentPage === page ? { backgroundColor: '#E9A319' } : {}}
                    onMouseEnter={(e) => currentPage === page && (e.currentTarget.style.backgroundColor = '#A86523')}
                    onMouseLeave={(e) => currentPage === page && (e.currentTarget.style.backgroundColor = '#E9A319')}
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

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm && voucherToDelete !== null}
        title="Disable Voucher"
        itemName={voucherToDelete?.code}
        message={
          voucherToDelete ? (
            <>
              Are you sure you want to disable voucher <span className="font-semibold text-gray-900">{voucherToDelete.code}</span>?
              <br />
              <span className="text-sm text-gray-500">This action cannot be undone.</span>
            </>
          ) : null
        }
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={handleCancelDelete}
        isLoading={loading}
      />
    </div>
  );
}