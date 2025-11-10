import React, { useEffect, useState, useContext, useCallback } from "react";
import { ToastContext } from "../../context/ToastContext";
import SummaryAPI from "../../common/SummaryAPI";
import BillModal from "./BillModal";

export default function Bills() {
  const { showToast } = useContext(ToastContext);
  const [orders, setOrders] = useState([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentMethodFilter, setPaymentMethodFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [startDateFilter, setStartDateFilter] = useState("");
  const [endDateFilter, setEndDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBillData, setSelectedBillData] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Fetch all paid orders
  const fetchOrders = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const data = await SummaryAPI.orders.getAll(token);
      const paidOrders = data.data.filter(order => order.pay_status?.toLowerCase() === 'paid');
      setOrders(paidOrders);
    } catch (err) {
      let errorMessage = "Failed to fetch orders";

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can view bills";
      } else if (err.response?.status === 401) {
        errorMessage = "You are not authorized to view bills";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (err.message) {
        errorMessage = `Failed to fetch orders: ${err.message}`;
      }

      showToast(errorMessage, "error");
    }
  }, [showToast]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Sort orders by date (newest first) - default sorting
  const sortedOrders = [...orders].sort((a, b) => {
    const aDate = new Date(a.orderDate);
    const bDate = new Date(b.orderDate);
    return bDate - aDate; // Newest first (desc)
  });

  // Filter orders by status, payment method, search term, and date range
  const filteredOrders = sortedOrders.filter((order) => {
    const matchesStatus =
      statusFilter === "all" || order.order_status.toLowerCase() === statusFilter.toLowerCase();
    const matchesPaymentMethod =
      paymentMethodFilter === "all" || order.payment_method.toLowerCase() === paymentMethodFilter.toLowerCase();
    const matchesSearch =
      searchTerm === "" ||
      order._id.includes(searchTerm) ||
      (order.name && order.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (order.email && order.email.toLowerCase().includes(searchTerm.toLowerCase()));

    // Date range filter
    const orderDate = new Date(order.orderDate);
    const matchesStartDate = !startDateFilter || orderDate >= new Date(startDateFilter);
    const matchesEndDate = !endDateFilter || orderDate <= new Date(endDateFilter + 'T23:59:59');

    return matchesStatus && matchesPaymentMethod && matchesSearch && matchesStartDate && matchesEndDate;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrders = filteredOrders.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  // Handle view bill
  const handleViewBill = async (order) => {
    try {
      const token = localStorage.getItem('token');
      const response = await SummaryAPI.bills.export(order._id, token);
      setSelectedBillData(response.data.data);
      setShowModal(true);
    } catch (err) {
      let errorMessage = "Failed to load bill";

      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can view bills";
      } else if (err.response?.status === 404) {
        errorMessage = "Order not found";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (err.message) {
        errorMessage = `Failed to load bill: ${err.message}`;
      }

      showToast(errorMessage, "error");
    }
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedBillData(null);
  };

  // Toggle filters
  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = searchTerm ||
    statusFilter !== 'all' ||
    paymentMethodFilter !== 'all' ||
    startDateFilter !== '' ||
    endDateFilter !== '';

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentMethodFilter('all');
    setStartDateFilter('');
    setEndDateFilter('');
    setCurrentPage(1);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Bill Modal */}
      <BillModal
        isOpen={showModal}
        onClose={closeModal}
        billData={selectedBillData}
      />

      {/* Main Bill Management UI */}
      <>
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523' }}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Bill Management</h1>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg">View bills for paid orders</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
              <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
                <span className="text-xs lg:text-sm font-medium text-gray-700">
                  {filteredOrders.length} bill{filteredOrders.length !== 1 ? 's' : ''}
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
            </div>
          </div>
        </div>

        {/* Filters Section */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523' }}>
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Search & Filter</h2>
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="px-2 py-1.5 lg:px-3 lg:py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-xs lg:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Clear all filters"
              >
                Clear Filters
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search</label>
                <input
                  type="text"
                  placeholder="Search by Order ID or Customer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Order Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                <select
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                >
                  <option value="all">All Methods</option>
                  <option value="cod">Cash on Delivery</option>
                  <option value="vnpay">VNPay</option>
                </select>
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Start Date</label>
                <input
                  type="date"
                  value={startDateFilter}
                  onChange={(e) => {
                    setStartDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">End Date</label>
                <input
                  type="date"
                  value={endDateFilter}
                  onChange={(e) => {
                    setEndDateFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Orders Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden" style={{ borderColor: '#A86523' }}>
          {filteredOrders.length === 0 ? (
            <div className="p-6" role="status">
              <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
                {/* ── NO BILLS ── */}
                <>
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-medium text-gray-900">No bills found</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {searchTerm || statusFilter !== "all" || paymentMethodFilter !== "all" || startDateFilter || endDateFilter
                        ? "Try adjusting your search or filter criteria"
                        : "No paid orders available"}
                    </p>
                  </div>
                </>
              </div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed min-w-[1000px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-[4%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                        #
                      </th>
                      <th className="w-[13%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Order ID</th>
                      <th className="w-[11%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Date</th>
                      <th className="w-[18%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Customer</th>
                      <th className="w-[12%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Total</th>
                      <th className="w-[12%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Payment Method</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Paid Status</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {paginatedOrders.map((order, index) => (
                      <tr key={order._id} className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm font-medium text-gray-900">#{order._id.slice(-6).toUpperCase()}</td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                          {new Date(order.orderDate).toLocaleDateString("vi-VN", {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          })}
                        </td>
                        <td className="px-2 lg:px-4 py-3">
                          <div className="text-xs lg:text-sm text-gray-900" style={{ wordBreak: 'break-word', whiteSpace: 'normal' }} title={order.name || 'N/A'}>
                            {order.name || 'N/A'}
                          </div>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">{order.finalPrice ? `${order.finalPrice.toLocaleString('vi-VN')}đ` : 'N/A'}</td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900 capitalize">{order.payment_method || 'N/A'}</td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${order.order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                            order.order_status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                              order.order_status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                                order.order_status === 'pending' ? 'bg-gray-100 text-gray-800' :
                                  'bg-red-100 text-red-800'
                            }`}>
                            {order.order_status ? order.order_status.charAt(0).toUpperCase() + order.order_status.slice(1) : 'N/A'}
                          </span>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${order.pay_status?.toLowerCase() === 'paid' ? 'bg-green-100 text-green-800' :
                            order.pay_status?.toLowerCase() === 'unpaid' ? 'bg-yellow-100 text-yellow-800' :
                              order.pay_status?.toLowerCase() === 'refunded' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                            }`}>
                            {order.pay_status ? order.pay_status.charAt(0).toUpperCase() + order.pay_status.slice(1) : 'N/A'}
                          </span>
                        </td>
                        <td className="px-2 lg:px-4 py-3">
                          <div className="flex justify-center items-center space-x-1">
                            <button
                              onClick={() => handleViewBill(order)}
                              className="p-1.5 rounded-lg transition-all duration-200 border border-[#A86523]"
                              style={{
                                color: '#A86523',
                                backgroundColor: 'transparent'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FCEFCB'}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                              aria-label={`View bill for order ${order._id}`}
                              title="View Bill"
                            >
                              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {filteredOrders.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border p-4 lg:p-6 mt-4 lg:mt-6" style={{ borderColor: '#A86523' }}>
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="text-sm text-gray-700">
                Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredOrders.length)}</span> of <span className="font-medium">{filteredOrders.length}</span> bills
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
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
                  onClick={() => handlePageChange(currentPage + 1)}
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
      </>
    </div>
  );
}