import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ToastContext } from "../../context/ToastContext";
import Api from "../../common/SummaryAPI";
import FeedbackDetail from "./FeedbackDetail";
import Loading from "../../components/Loading";

const Feedbacks = () => {
  const { user, isAuthLoading } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const navigate = useNavigate();
  const [feedbacks, setFeedbacks] = useState([]);
  const [filteredFeedbacks, setFilteredFeedbacks] = useState([]);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(null);
  const [uniqueProductNames, setUniqueProductNames] = useState([]);

  // Filter states
  const [filters, setFilters] = useState({
    startDate: "",
    endDate: "",
    productName: "",
    ratingFilter: "",
    statusFilter: "",
  });
  const [showFilters, setShowFilters] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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

  // Fetch feedbacks without parameters
  const fetchFeedbacks = useCallback(async () => {
    if (!user?._id) {
      setError("User not authenticated");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const response = await Api.feedback.getAll();

      let feedbacksData = [];
      if (Array.isArray(response)) {
        feedbacksData = response;
      } else if (response?.data?.feedbacks) {
        feedbacksData = response.data.feedbacks;
      } else {
        throw new Error("Unexpected response format");
      }

      // Filter out invalid feedback entries and feedbacks with no rating and no content
      feedbacksData = feedbacksData.filter(
        (feedback) =>
          feedback.order?._id &&
          feedback.variant?.variant_id &&
          feedback.customer?._id &&
          feedback.feedback?.rating != null &&
          feedback.feedback.rating >= 1 &&
          feedback.feedback.rating <= 5
      );

      const sortedFeedbacks = feedbacksData.sort((a, b) => {
        const dateA = a.feedback?.created_at
          ? new Date(a.feedback.created_at)
          : new Date(0);
        const dateB = b.feedback?.created_at
          ? new Date(b.feedback.created_at)
          : new Date(0);
        return dateB - dateA;
      });

      setFeedbacks(sortedFeedbacks);
      setFilteredFeedbacks(sortedFeedbacks);

      if (sortedFeedbacks.length === 0) {
        showToast("No feedback found for the given criteria", "info");
      }
    } catch (err) {
      console.error("Fetch feedbacks error:", err);
      const errorMessage = getErrorMessage(err, "Failed to fetch feedbacks");
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }, [user, showToast]);

  // Fetch data
  const fetchData = useCallback(async () => {
    await fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Handle authentication state and fetch data
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!user && !localStorage.getItem("token")) {
      navigate("/login", { replace: true });
    } else if (user) {
      fetchData();
    }
  }, [user, isAuthLoading, navigate, fetchData]);

  useEffect(() => {
    // Only show products that have feedback (all products in feedbacks list have feedback)
    const productMap = new Map();

    feedbacks.forEach((fb) => {
      const productName = fb.product?.product_name || fb.product?.productName;

      if (productName) {
        // All products in feedbacks list have feedback, so include them all
        if (!productMap.has(productName)) {
          productMap.set(productName, productName);
        }
      }
    });

    const names = Array.from(productMap.values()).sort();

    setUniqueProductNames(names);
  }, [feedbacks]);

  // Apply filters to feedbacks
  const applyFilters = useCallback((feedbacksList, filterSettings) => {
    return feedbacksList.filter((feedback) => {
      // Product name filter (string match)
      if (filterSettings.productName) {
        const feedbackName = (
          feedback.product?.product_name ||
          feedback.product?.productName ||
          ""
        ).toLowerCase();
        if (!feedbackName.includes(filterSettings.productName.toLowerCase())) {
          return false;
        }
      }

      // Rating filter
      if (
        filterSettings.ratingFilter &&
        feedback.feedback?.rating !== parseInt(filterSettings.ratingFilter)
      ) {
        return false;
      }

      // Status filter
      if (filterSettings.statusFilter) {
        const isDeleted = feedback.feedback?.is_deleted || false;
        if (
          (filterSettings.statusFilter === "active" && isDeleted) ||
          (filterSettings.statusFilter === "deleted" && !isDeleted)
        ) {
          return false;
        }
      }

      // Date filters
      const feedbackDate = feedback.feedback?.created_at
        ? new Date(feedback.feedback.created_at)
        : null;
      if (feedbackDate) {
        if (
          filterSettings.startDate &&
          feedbackDate < new Date(filterSettings.startDate)
        )
          return false;
        if (
          filterSettings.endDate &&
          feedbackDate > new Date(filterSettings.endDate)
        )
          return false;
      } else if (filterSettings.startDate || filterSettings.endDate) {
        return false;
      }

      return true;
    });
  }, []);

  // Update filtered feedbacks when feedbacks or filters change
  useEffect(() => {
    setFilteredFeedbacks(applyFilters(feedbacks, filters));
    setCurrentPage(1);
  }, [feedbacks, filters, applyFilters]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredFeedbacks.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;

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
  const currentFeedbacks = filteredFeedbacks.slice(startIndex, endIndex);

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

  // Handle first/last page
  const handleFirstPage = useCallback(() => {
    handlePageChange(1);
  }, [handlePageChange]);

  const handleLastPage = useCallback(() => {
    handlePageChange(totalPages);
  }, [totalPages, handlePageChange]);

  // Handle filter changes
  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      startDate: "",
      endDate: "",
      productName: "",
      ratingFilter: "",
      statusFilter: "",
    });
  }, []);

  // Toggle filter visibility
  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  // Toggle delete feedback — OPTIMIZED (no full reload)
  const toggleDeleteFeedback = async (feedbackId, currentDeletedState) => {
    const newDeletedState = !currentDeletedState;

    // Optimistically update UI
    setFilteredFeedbacks((prev) =>
      prev.map((fb) =>
        fb._id === feedbackId
          ? {
            ...fb,
            feedback: {
              ...fb.feedback,
              is_deleted: newDeletedState,
            },
          }
          : fb
      )
    );

    setFeedbacks((prev) =>
      prev.map((fb) =>
        fb._id === feedbackId
          ? {
            ...fb,
            feedback: {
              ...fb.feedback,
              is_deleted: newDeletedState,
            },
          }
          : fb
      )
    );

    try {
      if (newDeletedState) {
        await Api.feedback.delete(feedbackId);
        showToast("Feedback deleted successfully", "success");
      } else {
        await Api.feedback.restore(feedbackId);
        showToast("Feedback restored successfully", "success");
      }
    } catch (err) {
      // Revert on error
      setFilteredFeedbacks((prev) =>
        prev.map((fb) =>
          fb._id === feedbackId
            ? {
              ...fb,
              feedback: {
                ...fb.feedback,
                is_deleted: currentDeletedState,
              },
            }
            : fb
        )
      );

      setFeedbacks((prev) =>
        prev.map((fb) =>
          fb._id === feedbackId
            ? {
              ...fb,
              feedback: {
                ...fb.feedback,
                is_deleted: currentDeletedState,
              },
            }
            : fb
        )
      );

      const defaultMessage = newDeletedState
        ? "Failed to delete feedback"
        : "Failed to restore feedback";
      const errorMessage = getErrorMessage(err, defaultMessage);
      showToast(errorMessage, "error");
    }
  };

  // Retry fetching data
  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Show feedback details in popup
  const handleShowDetails = useCallback((feedback) => {
    setSelectedFeedbackId(feedback._id);
    setShowDetailsModal(true);
  }, []);

  // Close details modal
  const handleCloseDetailsModal = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedFeedbackId(null);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return (
      filters.startDate ||
      filters.endDate ||
      filters.productName ||
      filters.ratingFilter ||
      filters.statusFilter
    );
  }, [filters]);

  // Check if feedback is deleted
  const isFeedbackDeleted = useCallback((feedback) => {
    return feedback.feedback?.is_deleted || false;
  }, []);

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">
            Feedback Management
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
          <div className="bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 backdrop-blur-md px-2 lg:px-4 py-1 lg:py-2 rounded-xl border-2 border-yellow-400/50 shadow-md">
            <span className="text-xs lg:text-sm font-semibold text-gray-700">
              {filteredFeedbacks.length} feedback
              {filteredFeedbacks.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 transform hover:scale-105"
            onClick={toggleFilters}
            aria-label="Toggle filters"
          >
            <svg
              className="w-3 h-3 lg:w-4 lg:h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z"
              />
            </svg>
            <span className="font-medium hidden sm:inline">
              {showFilters ? "Hide Filters" : "Show Filters"}
            </span>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) =>
                  handleFilterChange("startDate", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              />
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange("endDate", e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              />
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Product Name
              </label>
              <select
                value={filters.productName}
                onChange={(e) =>
                  handleFilterChange("productName", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              >
                <option value="">
                  All Products ({uniqueProductNames.length})
                </option>
                {uniqueProductNames.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Rating
              </label>
              <select
                value={filters.ratingFilter}
                onChange={(e) =>
                  handleFilterChange("ratingFilter", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              >
                <option value="">All Ratings</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
              </select>
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={filters.statusFilter}
                onChange={(e) =>
                  handleFilterChange("statusFilter", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>
        </div>
      )
      }

      {/* Unified State: Loading / Empty / Error */}
      {
        isAuthLoading || loading || filteredFeedbacks.length === 0 || error ? (
          <div
            className="backdrop-blur-xl rounded-xl border p-6"
            style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}
            role="status"
          >
            <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
              {/* ── LOADING ── */}
              {isAuthLoading || loading ? (
                <Loading
                  type="page"
                  size="medium"
                  message="Loading feedbacks..."
                />
              ) : error ? (
                /* ── NETWORK ERROR ── */
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-red-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-medium text-gray-900">
                      Network Error
                    </h3>
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
                /* ── NO FEEDBACKS ── */
                <>
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg
                      className="w-7 h-7 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-medium text-gray-900">No feedbacks available</h3>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Feedbacks Table - Only when data exists */
          <div className="backdrop-blur-xl rounded-xl border overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[1200px]">
                {/* ---------- HEADER ---------- */}
                <thead className="backdrop-blur-sm border-b" style={{ borderColor: '#A86523' }}>
                  <tr>
                    <th className="w-[5%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      #
                    </th>
                    <th className="w-[15%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Customer
                    </th>
                    <th className="w-[20%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Product Name
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Feedback Date
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Rating
                    </th>
                    <th className="w-[20%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Content
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentFeedbacks.map((feedback, index) => {
                    const deleted = isFeedbackDeleted(feedback);
                    return (
                      <tr
                        key={feedback._id}
                        className={`hover:bg-gradient-to-r hover:from-yellow-50/50 hover:via-amber-50/50 hover:to-orange-50/50 transition-all duration-300 border-b-2 border-gray-200/40`}
                      >
                        {/* # */}
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                          {startIndex + index + 1}
                        </td>

                        {/* Customer */}
                        <td className="px-2 lg:px-4 py-3">
                          <div className="flex items-center space-x-2">
                            <img
                              src={feedback.customer?.image || ""}
                              alt={feedback.customer?.name || "Customer"}
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <div>
                              <div className="text-xs lg:text-sm font-medium text-gray-900">
                                {feedback.customer?.name || "N/A"}
                              </div>
                              <div className="text-xs text-gray-500">
                                @{feedback.customer?.username || "N/A"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Product Name */}
                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 truncate">
                          {feedback.product?.product_name || "N/A"}
                        </td>

                        {/* Feedback Date */}
                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 whitespace-nowrap">
                          {feedback.feedback?.created_at
                            ? new Date(feedback.feedback.created_at).toLocaleDateString()
                            : "N/A"}
                        </td>

                        {/* Rating */}
                        <td className="px-2 lg:px-4 py-3">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <svg
                                key={star}
                                className={`w-4 h-4 ${star <= (feedback.feedback?.rating || 0)
                                  ? "text-yellow-400"
                                  : "text-gray-300"
                                  }`}
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            ))}
                          </div>
                        </td>

                        {/* Content */}
                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                          <div className="truncate">
                            {feedback.feedback?.content
                              ? `${feedback.feedback.content.substring(0, 80)}${feedback.feedback.content.length > 80
                                ? "..."
                                : ""
                              }`
                              : "N/A"}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm ${deleted
                              ? "bg-red-600 text-white"
                              : "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                              }`}
                          >
                            {deleted ? "deleted" : "active"}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-2 lg:px-4 py-3">
                          <div className="flex justify-center items-center space-x-1">
                            {/* View Button */}
                            <button
                              onClick={() => handleShowDetails(feedback)}
                              className="p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm"
                              aria-label={`View details for feedback ${feedback._id}`}
                              title="View Details"
                            >
                              <svg
                                className="w-3 h-3 lg:w-4 lg:h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                />
                              </svg>
                            </button>

                            {/* Delete/Restore Button */}
                            <button
                              onClick={() =>
                                toggleDeleteFeedback(feedback._id, deleted)
                              }
                              className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${deleted
                                ? "text-white bg-green-600 hover:bg-green-700 border-green-600 hover:border-green-700"
                                : "text-white bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
                                }`}
                              aria-label={`${deleted ? "Restore" : "Delete"
                                } feedback ${feedback._id}`}
                              title={`${deleted ? "Restore" : "Delete"} Feedback`}
                            >
                              <svg
                                className="w-3 h-3 lg:w-4 lg:h-4"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                {deleted ? (
                                  // Restore icon
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                  />
                                ) : (
                                  // Delete icon
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                )}
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
        )
      }

      {/* Pagination */}
      {
        filteredFeedbacks.length > 0 && (
          <div className="backdrop-blur-xl rounded-xl border p-4 lg:p-6 mt-4 lg:mt-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                <span className="font-medium">
                  {Math.min(endIndex, filteredFeedbacks.length)}
                </span>{" "}
                of <span className="font-medium">{filteredFeedbacks.length}</span>{" "}
                feedbacks
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
        )
      }

      {/* Feedback Details Modal */}
      <FeedbackDetail
        feedbackId={selectedFeedbackId}
        isOpen={showDetailsModal}
        onClose={handleCloseDetailsModal}
      />
    </div >
  );
};

export default Feedbacks;
