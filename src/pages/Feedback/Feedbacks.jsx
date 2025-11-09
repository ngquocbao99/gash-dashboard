import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ToastContext } from "../../context/ToastContext";
import Api from "../../common/SummaryAPI";
import FeedbackDetail from "./FeedbackDetail";

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
  const [showFilters, setShowFilters] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);

  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [statistics, setStatistics] = useState(null);

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

      // Filter out invalid feedback entries
      feedbacksData = feedbacksData.filter(
        (feedback) =>
          feedback.order?._id &&
          feedback.variant?.variant_id &&
          feedback.customer?._id
      );

      const sortedFeedbacks = feedbacksData.sort((a, b) => {
        const dateA = a.order?.orderDate
          ? new Date(a.order.orderDate)
          : new Date(0);
        const dateB = b.order?.orderDate
          ? new Date(b.order.orderDate)
          : new Date(0);
        return dateB - dateA;
      });

      setFeedbacks(sortedFeedbacks);
      setFilteredFeedbacks(sortedFeedbacks);

      if (response?.data?.statistics) {
        setStatistics(response.data.statistics);
      }

      if (sortedFeedbacks.length === 0) {
        showToast("No feedback found for the given criteria", "info");
      }
    } catch (err) {
      const errorMessage =
        err.response?.data?.message ||
        err.message ||
        "Failed to load feedbacks. Please try again later.";
      setError(errorMessage);
      showToast(errorMessage, "error");
      console.error("Fetch feedbacks error:", err);
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
    const names = [
      ...new Set(
        feedbacks
          .map(
            (fb) =>
              fb.product?.product_name || fb.product?.productName || "Unknown"
          )
          .filter(Boolean)
      ),
    ].sort();

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
      const orderDate = feedback.order?.orderDate
        ? new Date(feedback.order.orderDate)
        : null;
      if (orderDate) {
        if (
          filterSettings.startDate &&
          orderDate < new Date(filterSettings.startDate)
        )
          return false;
        if (
          filterSettings.endDate &&
          orderDate > new Date(filterSettings.endDate)
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
  const currentFeedbacks = filteredFeedbacks.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Handle previous page
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  // Handle next page
  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

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
        showToast("Feedback deleted successfully!", "success");
      } else {
        await Api.feedback.restore(feedbackId);
        showToast("Feedback restored successfully!", "success");
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

      showToast(
        err.response?.data?.message || "Failed to update feedback",
        "error"
      );
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
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">
              Feedback Management
            </h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
              Manage and review customer feedbacks
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
            <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
              <span className="text-xs lg:text-sm font-medium text-gray-700">
                {filteredFeedbacks.length} feedback
                {filteredFeedbacks.length !== 1 ? "s" : ""}
              </span>
            </div>
            <button
              className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
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
      </div>

      {/* Filter Section */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">
            Search & Filter
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 lg:gap-4">
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
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
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
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
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
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
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
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
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
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
            <div>
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

      {/* Statistics Section
      {statistics && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-4 lg:mb-6">
            Feedback Statistics
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 lg:p-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-blue-700 mb-1">
                    Total Feedbacks
                  </p>
                  <p className="text-2xl lg:text-3xl font-bold text-blue-900">
                    {statistics.total_feedbacks}
                  </p>
                </div>
                <div className="p-2 lg:p-3 bg-blue-200 rounded-xl flex-shrink-0">
                  <svg
                    className="w-5 h-5 lg:w-7 lg:h-7 text-blue-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 lg:p-6 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-yellow-700 mb-1">
                    Average Rating
                  </p>
                  <p className="text-2xl lg:text-3xl font-bold text-yellow-900">
                    {statistics.average_rating?.toFixed(1)}/5
                  </p>
                </div>
                <div className="p-2 lg:p-3 bg-yellow-200 rounded-xl flex-shrink-0">
                  <svg
                    className="w-5 h-5 lg:w-7 lg:h-7 text-yellow-700"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      )} */}

      {/* Unified State: Loading / Empty / Error */}
      {isAuthLoading || loading || filteredFeedbacks.length === 0 || error ? (
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          role="status"
        >
          <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
            {/* ── LOADING ── */}
            {isAuthLoading || loading ? (
              <>
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-600 font-medium">
                  Loading feedbacks...
                </p>
              </>
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
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow"
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
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>

                <div className="text-center">
                  <h3 className="text-base font-medium text-gray-900">
                    No feedbacks found
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    Try adjusting your search or filter criteria
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Feedbacks Table - Only when data exists */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[1200px]">
              {/* ---------- HEADER ---------- */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-[5%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    #
                  </th>
                  <th className="w-[15%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="w-[20%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Product Name
                  </th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Order Date
                  </th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Rating
                  </th>
                  <th className="w-[20%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Content
                  </th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {currentFeedbacks.map((feedback, index) => {
                  const deleted = isFeedbackDeleted(feedback);
                  return (
                    <tr
                      key={feedback._id}
                      className={`hover:bg-gray-50 transition-colors duration-150`}
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

                      {/* Order Date */}
                      <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 whitespace-nowrap">
                        {feedback.order?.orderDate
                          ? new Date(
                              feedback.order.orderDate
                            ).toLocaleDateString()
                          : "N/A"}
                      </td>

                      {/* Rating */}
                      <td className="px-2 lg:px-4 py-3">
                        <div className="flex items-center">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`w-4 h-4 ${
                                star <= (feedback.feedback?.rating || 0)
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
                            ? `${feedback.feedback.content.substring(0, 80)}${
                                feedback.feedback.content.length > 80
                                  ? "..."
                                  : ""
                              }`
                            : "N/A"}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${
                            deleted
                              ? "bg-red-100 text-red-800"
                              : "bg-green-100 text-green-800"
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
                            className="p-1.5 rounded-lg transition-all duration-200 border text-blue-600 hover:text-blue-800 hover:bg-blue-100 border-blue-200 hover:border-blue-300"
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
                            className={`p-1.5 rounded-lg transition-all duration-200 border ${
                              deleted
                                ? "text-green-600 hover:text-green-800 hover:bg-green-100 border-green-200 hover:border-green-300"
                                : "text-red-600 hover:text-red-800 hover:bg-red-100 border-red-200 hover:border-red-300"
                            }`}
                            aria-label={`${
                              deleted ? "Restore" : "Delete"
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
      )}

      {/* Pagination */}
      {filteredFeedbacks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 mt-4 lg:mt-6">
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
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Previous page"
              >
                Previous
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                  (page) => (
                    <button
                      key={page}
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                        currentPage === page
                          ? "bg-blue-600 text-white border border-blue-600"
                          : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700"
                      }`}
                      onClick={() => handlePageChange(page)}
                      aria-label={`Page ${page}`}
                    >
                      {page}
                    </button>
                  )
                )}
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

      {/* Feedback Details Modal */}
      <FeedbackDetail
        feedbackId={selectedFeedbackId}
        isOpen={showDetailsModal}
        onClose={handleCloseDetailsModal}
      />
    </div>
  );
};

export default Feedbacks;
