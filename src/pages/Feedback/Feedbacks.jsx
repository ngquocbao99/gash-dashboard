import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import FeedbackDetail from './FeedbackDetail';

const Feedbacks = () => {
  const { user, isAuthLoading } = useContext(AuthContext);
  const [feedbacks, setFeedbacks] = useState([]);
  const [editingFeedbackId, setEditingFeedbackId] = useState(null);
  const [editFormData, setEditFormData] = useState({ feedback_details: '' });
  const [newFeedbackForm, setNewFeedbackForm] = useState({ order_id: '', variant_id: '', feedback_details: '', UnitPrice: '', Quantity: '' });
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchParams, setSearchParams] = useState({
    startDate: '',
    endDate: '',
    productId: '',
    username: ''
  });
  const [showFilters, setShowFilters] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [orders, setOrders] = useState([]);
  const [variants, setVariants] = useState([]);
  const [products, setProducts] = useState([]);
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const navigate = useNavigate();

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  // Fetch feedbacks with search parameters
const fetchFeedbacks = useCallback(async () => {
  if (!user?._id) {
    setError('User not authenticated');
    return;
  }
  setLoading(true);
  setError('');

  try {
    const { startDate, endDate, productId, username } = searchParams;
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    if (productId) params.productId = productId;
    if (username) params.username = username;

    const response = await Api.feedback.getAll(params);
    console.log('Full API response:', response);

    let feedbacksData = [];
    if (Array.isArray(response)) {
      feedbacksData = response;
    } else if (response?.data?.feedbacks) {
      feedbacksData = response.data.feedbacks;
    } else {
      throw new Error('Unexpected response format');
    }

    console.log('Extracted feedbacksData:', feedbacksData);

    // Filter out invalid feedback entries
    feedbacksData = feedbacksData.filter(feedback => 
      feedback.order?._id && feedback.variant?.variant_id && feedback.customer?._id
    );

    const sortedFeedbacks = feedbacksData.sort((a, b) => {
      const dateA = a.order?.orderDate ? new Date(a.order.orderDate) : new Date(0);
      const dateB = b.order?.orderDate ? new Date(b.order.orderDate) : new Date(0);
      return dateB - dateA;
    });

    setFeedbacks(sortedFeedbacks);
    console.log('Final sorted feedbacks:', sortedFeedbacks);

    if (response?.data?.statistics) {
      setStatistics(response.data.statistics);
    }

    if (sortedFeedbacks.length === 0) {
      setToast({ type: 'info', message: 'No feedback found for the given criteria' });
    }
  } catch (err) {
    const errorMessage = err.response?.data?.message || err.message || 'Failed to load feedbacks. Please try again later.';
    setError(errorMessage);
    setToast({ type: 'error', message: errorMessage });
    console.error('Fetch feedbacks error:', err);
  } finally {
    setLoading(false);
  }
}, [user, searchParams]);

  // Fetch orders, variants, products, and users for dropdowns
  const fetchOrders = useCallback(async () => {
    try {
      const response = await Api.orders.getAll();
      setOrders(response || []);
    } catch (err) {
      console.error('Fetch orders error:', err);
      setOrders([]);
    }
  }, []);

  const fetchVariants = useCallback(async () => {
    try {
      const response = await Api.newVariants.getAll();
      setVariants(response || []);
    } catch (err) {
      console.error('Fetch variants error:', err);
      setVariants([]);
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      const response = await Api.newProducts.getAll();
      setProducts(response || []);
    } catch (err) {
      console.error('Fetch products error:', err);
      setProducts([]);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await Api.accounts.getAll();
      setUsers(response || []);
    } catch (err) {
      console.error('Fetch users error:', err);
      setUsers([]);
    }
  }, []);

  // Load data on component mount
  useEffect(() => {
    if (user?._id) {
      fetchFeedbacks();
      fetchOrders();
      fetchVariants();
      fetchProducts();
      fetchUsers();
    }
  }, [user, fetchFeedbacks, fetchOrders, fetchVariants, fetchProducts, fetchUsers]);

  // Handle field changes
  const handleFieldChange = (e, formType, fieldName) => {
    const value = e.target.value;
    if (formType === 'search') {
      setSearchParams(prev => ({ ...prev, [fieldName]: value }));
    } else if (formType === 'edit') {
      setEditFormData(prev => ({ ...prev, [fieldName]: value }));
    } else if (formType === 'new') {
      setNewFeedbackForm(prev => ({ ...prev, [fieldName]: value }));
    }
  };

  // Create new feedback
  const createFeedback = async (e) => {
    e.preventDefault();
    try {
      await Api.orderDetails.create(newFeedbackForm);
      setToast({ type: 'success', message: 'Feedback created successfully!' });
      setNewFeedbackForm({ order_id: '', variant_id: '', feedback_details: '', UnitPrice: '', Quantity: '' });
      setShowAddForm(false);
      fetchFeedbacks();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to create feedback' });
    }
  };

  // Update feedback
  const updateFeedback = async (e) => {
    e.preventDefault();
    try {
      await Api.orderDetails.update(editingFeedbackId, editFormData);
      setToast({ type: 'success', message: 'Feedback updated successfully!' });
      setEditingFeedbackId(null);
      setEditFormData({ feedback_details: '' });
      fetchFeedbacks();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to update feedback' });
    }
  };

  // Toggle delete feedback
  const toggleDeleteFeedback = async (feedback, isDeleted) => {
    try {
      if (isDeleted) {
        await Api.feedback.delete(feedback._id);
        setToast({ type: 'success', message: 'Feedback deleted successfully!' });
      } else {
        await Api.feedback.restore(feedback._id);
        setToast({ type: 'success', message: 'Feedback restored successfully!' });
      }
      fetchFeedbacks();
    } catch (err) {
      setToast({ type: 'error', message: err.message || 'Failed to update feedback' });
    }
  };

  // Toggle filters
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Clear search
  const clearSearch = useCallback(() => {
    setSearchParams({ startDate: '', endDate: '', productId: '', username: '' });
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Retry fetching data
  const handleRetry = useCallback(() => {
    fetchFeedbacks();
  }, [fetchFeedbacks]);

  // Handle view detail
  const handleViewDetail = (feedback) => {
    setSelectedFeedbackId(feedback._id);
    setShowDetailModal(true);
  };

  // Close modal
  const closeDetailModal = () => {
    setShowDetailModal(false);
    setSelectedFeedbackId(null);
  };

  // Pagination calculations
  const totalPages = Math.ceil(feedbacks.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentFeedbacks = feedbacks.slice(startIndex, endIndex);

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // Check if there are active filters
  const hasActiveFilters = () => {
    return searchParams.startDate || searchParams.endDate || searchParams.productId || searchParams.username;
  };

  // Show loading spinner while checking authentication
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect if not authenticated or not admin/manager
  if (!user || !['admin', 'manager'].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-4 lg:p-6 xl:p-8">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
            toast.type === 'info' ? 'bg-blue-500 text-white' :
              'bg-gray-500 text-white'
          }`}>
          {toast.message}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 xl:p-8 mb-4 sm:mb-6 lg:mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 truncate">Feedback Management</h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage and review customer feedbacks</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
            <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
              <span className="text-xs lg:text-sm font-medium text-gray-700">
                {feedbacks.length} feedback{feedbacks.length !== 1 ? 's' : ''}
              </span>
            </div>
            <button
              className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-6 py-1.5 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-base"
              onClick={toggleFilters}
              aria-label="Toggle filters"
            >
              <svg className="w-3 h-3 lg:w-5 lg:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
              </svg>
              <span className="font-medium hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
              <span className="font-medium sm:hidden">Filters</span>
            </button>
          </div>
        </div>
      </div>

      {/* Statistics Section */}
      {statistics && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 lg:p-8 mb-6 lg:mb-8">
          <h2 className="text-lg lg:text-xl font-semibold text-gray-900 mb-4 lg:mb-6">Feedback Statistics</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
            {/* Total Feedbacks */}
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 lg:p-6 border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-blue-700 mb-1">Total Feedbacks</p>
                  <p className="text-2xl lg:text-3xl font-bold text-blue-900">{statistics.total_feedbacks}</p>
                </div>
                <div className="p-2 lg:p-3 bg-blue-200 rounded-xl flex-shrink-0">
                  <svg className="w-5 h-5 lg:w-7 lg:h-7 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Average Rating */}
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-xl p-4 lg:p-6 border border-yellow-200">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-xs lg:text-sm font-medium text-yellow-700 mb-1">Average Rating</p>
                  <p className="text-2xl lg:text-3xl font-bold text-yellow-900">{statistics.average_rating?.toFixed(1)}/5</p>
                </div>
                <div className="p-2 lg:p-3 bg-yellow-200 rounded-xl flex-shrink-0">
                  <svg className="w-5 h-5 lg:w-7 lg:h-7 text-yellow-700" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6" role="alert" aria-live="assertive">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <p className="text-sm text-red-800">{error}</p>
            </div>
            <div className="ml-3">
              <button
                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200"
                onClick={handleRetry}
                aria-label="Retry loading feedbacks"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-6" role="status" aria-live="polite">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="ml-3 text-gray-600">Loading feedbacks...</p>
          </div>
        </div>
      )}

      {/* Feedbacks List */}
      {!loading && feedbacks.length === 0 && !error ? (
        <div className="flex flex-col items-center justify-center py-16 px-4" role="status">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
            <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">No feedbacks found</h3>
          <p className="text-gray-500 text-center mb-6">There are no feedbacks matching your current filters.</p>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg transition-colors duration-200"
            onClick={() => navigate('/')}
            aria-label="Continue shopping"
          >
            Continue Shopping
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Table Header */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 px-2 sm:px-4 lg:px-6 xl:px-8 py-3 lg:py-4 xl:py-6 border-b border-gray-200">
            <div className="grid grid-cols-12 gap-2 lg:gap-4 xl:gap-6 text-xs lg:text-sm font-semibold text-gray-800">
              <div className="col-span-1">#</div>
              <div className="col-span-3 lg:col-span-2">Customer</div>
              <div className="col-span-2">Rating</div>
              <div className="col-span-4 lg:col-span-5">Content</div>
              <div className="col-span-2">Actions</div>
            </div>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-gray-200">
            {currentFeedbacks.map((feedback, index) => (
              <div key={feedback._id} className="px-2 sm:px-4 lg:px-6 xl:px-8 py-3 lg:py-4 xl:py-6 hover:bg-gray-50 transition-all duration-200">
                <div className="grid grid-cols-12 gap-2 lg:gap-4 xl:gap-6 items-center">
                  {/* Index */}
                  <div className="col-span-1">
                    <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-gray-600">
                        {startIndex + index + 1}
                      </span>
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="col-span-3 lg:col-span-2">
                    <div className="flex items-center space-x-1 lg:space-x-2 xl:space-x-4">
                      <div className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 xl:w-12 xl:h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0">
                        {feedback.customer?.image ? (
                          <img
                            src={feedback.customer.image}
                            alt={feedback.customer.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 xl:w-6 xl:h-6" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs lg:text-sm font-semibold text-gray-900 truncate">
                          {feedback.customer?.name || 'Unknown User'}
                        </div>
                        <div className="text-xs text-gray-500 font-medium truncate">
                          @{feedback.customer?.username || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Rating */}
                  <div className="col-span-2">
                    {feedback.feedback?.has_rating ? (
                      <div className="flex flex-col lg:flex-row lg:items-center space-y-1 lg:space-y-0 lg:space-x-2">
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <svg
                              key={star}
                              className={`w-3 h-3 lg:w-4 lg:h-4 ${star <= (feedback.feedback.rating || 0)
                                ? 'text-yellow-400'
                                : 'text-gray-300'
                                }`}
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                          ))}
                        </div>
                        <span className="text-xs lg:text-sm font-medium text-gray-700 bg-gray-100 px-2 py-1 rounded-full">
                          {feedback.feedback.rating}/5
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs lg:text-sm text-gray-400 bg-gray-50 px-2 lg:px-3 py-1 rounded-full">No rating</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="col-span-4 lg:col-span-5">
                    {feedback.feedback?.has_content && feedback.feedback.content ? (
                      <div className="bg-gradient-to-r from-blue-50 to-blue-100 border border-blue-200 rounded-lg lg:rounded-xl p-2 lg:p-3 xl:p-4">
                        <p className="text-gray-800 text-xs lg:text-sm leading-relaxed font-medium line-clamp-2">
                          "{feedback.feedback.content}"
                        </p>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-200 rounded-lg lg:rounded-xl p-2 lg:p-3 xl:p-4">
                        <p className="text-gray-500 text-xs lg:text-sm italic">No feedback content provided</p>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2">
                    <div className="flex flex-col sm:flex-row items-center justify-center space-y-1 sm:space-y-0 sm:space-x-2">
                      {/* View Detail Button */}
                      <button
                        onClick={() => handleViewDetail(feedback)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300 flex-shrink-0"
                        aria-label="View feedback details"
                        title="View Details"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>

                      {/* Delete/Restore Button */}
                      {(user?.role === 'admin' || user?.role === 'manager' || feedback.customer?._id === user?._id) && (
                        <button
                          onClick={() => toggleDeleteFeedback(feedback, !feedback.feedback?.is_deleted)}
                          className={`p-2 rounded-lg transition-all duration-200 border flex-shrink-0 ${feedback.feedback?.is_deleted
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 border-green-200 hover:border-green-300'
                            : 'bg-red-100 text-red-700 hover:bg-red-200 border-red-200 hover:border-red-300'
                            }`}
                          aria-label={`${feedback.feedback?.is_deleted ? 'Restore' : 'Delete'} feedback`}
                          title={`${feedback.feedback?.is_deleted ? 'Restore' : 'Delete'} feedback`}
                        >
                          {feedback.feedback?.is_deleted ? (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {feedbacks.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mt-3 sm:mt-4 lg:mt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 lg:gap-4">
            <div className="text-xs lg:text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, feedbacks.length)}</span> of <span className="font-medium">{feedbacks.length}</span> feedbacks
            </div>
            <div className="flex items-center space-x-1 lg:space-x-2">
              <button
                className="px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                aria-label="Previous page"
              >
                <span className="hidden sm:inline">Previous</span>
                <span className="sm:hidden">Prev</span>
              </button>
              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm font-medium rounded-lg transition-colors duration-200 ${currentPage === page
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50'
                      }`}
                    onClick={() => handlePageChange(page)}
                    aria-label={`Page ${page}`}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button
                className="px-2 lg:px-3 py-1.5 lg:py-2 text-xs lg:text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <span className="sm:hidden">Next</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Detail Modal */}
      <FeedbackDetail
        feedbackId={selectedFeedbackId}
        isOpen={showDetailModal}
        onClose={closeDetailModal}
      />
    </div>
  );
};

export default Feedbacks;