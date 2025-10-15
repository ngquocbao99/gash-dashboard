import React, { useEffect, useState, useContext, useCallback } from "react";
import { ToastContext } from "../../context/ToastContext";
import SummaryAPI from "../../common/SummaryAPI";
import VoucherModal from "./VoucherModal";

export default function Vouchers() {
  const { showToast } = useContext(ToastContext);
  const [vouchers, setVouchers] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("code"); // 'startDate', 'endDate', 'code', 'discountValue', 'usageLimit'
  const [sortOrder, setSortOrder] = useState("asc"); // 'asc' or 'desc'
  const [showFilters, setShowFilters] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState("create"); // 'create' or 'edit'
  const [editingVoucher, setEditingVoucher] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [voucherToDelete, setVoucherToDelete] = useState(null);

  // Fetch vouchers
  const fetchVouchers = useCallback(async () => {
    try {
      const data = await SummaryAPI.vouchers.getAll();
      setVouchers(data.data);
    } catch (err) {
      console.error(err);

      let errorMessage = "Failed to fetch vouchers";

      // Handle specific API error messages
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can view vouchers";
      } else if (err.response?.status === 401) {
        errorMessage = "You are not authorized to view vouchers";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (err.message) {
        errorMessage = `Failed to fetch vouchers: ${err.message}`;
      }

      showToast(errorMessage, "error");
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
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Show delete confirmation
  const handleDeleteClick = (voucher) => {
    setVoucherToDelete(voucher);
    setShowDeleteConfirm(true);
  };

  // Delete / Disable voucher
  const handleDelete = async () => {
    if (!voucherToDelete) return;

    try {
      const voucherId = voucherToDelete.id || voucherToDelete._id;
      if (!voucherId) {
        showToast("Voucher ID not found!", "error");
        return;
      }
      await SummaryAPI.vouchers.disable(voucherId);
      showToast("Voucher disabled successfully!", "success");
      fetchVouchers();
    } catch (err) {
      console.error(err);

      let errorMessage = "Failed to disable voucher";

      // Handle specific API error messages
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can disable vouchers";
      } else if (err.response?.status === 404) {
        errorMessage = "Voucher not found";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (err.message) {
        errorMessage = `Failed to disable voucher: ${err.message}`;
      }

      showToast(errorMessage, "error");
    } finally {
      setShowDeleteConfirm(false);
      setVoucherToDelete(null);
    }
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setVoucherToDelete(null);
  };

  // Sort vouchers based on sortBy and sortOrder
  const sortedVouchers = [...vouchers].sort((a, b) => {
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
      case 'code':
        aValue = a.code.toLowerCase();
        bValue = b.code.toLowerCase();
        break;
      case 'discountValue':
        aValue = a.discountValue;
        bValue = b.discountValue;
        break;
      case 'usageLimit':
        aValue = a.usageLimit;
        bValue = b.usageLimit;
        break;
      default:
        aValue = new Date(a.startDate);
        bValue = new Date(b.startDate);
    }

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
      <>
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Voucher Management</h1>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Create and manage discount vouchers</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
              <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
                <span className="text-xs lg:text-sm font-medium text-gray-700">
                  {filteredVouchers.length} voucher{filteredVouchers.length !== 1 ? 's' : ''}
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
              <button
                className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
                onClick={handleCreate}
              >
                <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                <span className="font-medium">Create Voucher</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Search & Filter</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search by Code</label>
                <input
                  type="text"
                  placeholder="Enter voucher code..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Discount Type</label>
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
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
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                >
                  <option value="all">All Status</option>
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
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
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
                    setTypeFilter("all");
                    setStatusFilter("all");
                    setSortBy("code");
                    setSortOrder("asc");
                  }}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vouchers Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Code</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Type</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Discount</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Min Order</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Max Discount</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Start Date</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">End Date</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Usage</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredVouchers.length > 0 ? (
                  filteredVouchers.map((v) => {
                    const status = getVoucherStatus(v);
                    return (
                      <tr key={v.id || v._id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <div className="text-xs lg:text-sm font-medium text-gray-900 bg-gray-100 px-2 py-1 rounded-lg inline-block">
                            {v.code}
                          </div>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${v.discountType === 'percentage'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-green-100 text-green-800'
                            }`}>
                            {v.discountType === "percentage" ? "Percentage" : "Fixed"}
                          </span>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <div className="text-xs lg:text-sm font-semibold text-gray-900">
                            {v.discountType === "percentage"
                              ? `${v.discountValue}%`
                              : `₫${v.discountValue.toLocaleString("vi-VN")}`}
                          </div>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                          ₫{v.minOrderValue.toLocaleString("vi-VN")}
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                          {v.discountType === "percentage"
                            ? v.maxDiscount
                              ? `₫${v.maxDiscount.toLocaleString("vi-VN")}`
                              : "-"
                            : "-"}
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
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
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status === 'ACTIVE'
                            ? 'bg-green-100 text-green-800'
                            : status === 'UPCOMING'
                              ? 'bg-blue-100 text-blue-800'
                              : status === 'EXPIRED'
                                ? 'bg-gray-100 text-gray-800'
                                : status === 'USED UP'
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-red-100 text-red-800'
                            }`}>
                            {status}
                          </span>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm font-medium">
                          <div className="flex items-center space-x-1">
                            <button
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                              onClick={() => handleEdit(v)}
                              disabled={v.isDeleted}
                              title="Edit voucher"
                            >
                              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              className={`p-1.5 rounded-lg transition-all duration-200 border ${v.isDeleted
                                ? 'bg-gray-100 text-gray-500 border-gray-200 cursor-not-allowed'
                                : 'bg-red-100 text-red-600 hover:bg-red-200 border-red-200 hover:border-red-300'
                                }`}
                              onClick={() => handleDeleteClick(v)}
                              disabled={v.isDeleted}
                              title={v.isDeleted ? "Already disabled" : "Disable voucher"}
                            >
                              {v.isDeleted ? (
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
                    );
                  })
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
                          <h3 className="text-base lg:text-lg font-medium text-gray-900 mb-1 lg:mb-2">No vouchers found</h3>
                          <p className="text-gray-500 text-xs lg:text-sm">
                            {searchTerm || statusFilter !== "all" || typeFilter !== "all"
                              ? "Try adjusting your search or filter criteria"
                              : "Get started by creating your first voucher"}
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
      </>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && voucherToDelete && (
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
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Disable Voucher</h3>
                <p className="text-gray-600 mb-6">
                  Are you sure you want to disable voucher <span className="font-semibold text-gray-900">{voucherToDelete.code}</span>?
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
                    Disable Voucher
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