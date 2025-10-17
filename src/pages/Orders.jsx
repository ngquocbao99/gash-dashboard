import RefundProofModal from "./RefundProofModal";
import React, { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import "../styles/Orders.css";
import { io } from "socket.io-client";
import Api from "../common/SummaryAPI";

// Định dạng ngày dd/MM/yyyy
function formatDateVN(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "N/A";
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format price to VND
function formatPrice(price) {
  if (typeof price !== 'number' || isNaN(price)) return 'N/A';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
  }).format(price);
}

// Helper to determine which order status options should be enabled for update
const getOrderStatusOptionDisabled = (currentStatus, optionValue) => {
  // Define allowed transitions based on backend logic
  const allowedTransitions = {
    pending: ["confirmed", "shipping", "delivered", "cancelled"],
    confirmed: ["shipping", "delivered"],
    shipping: ["delivered"],
    delivered: [],
    cancelled: [],
  };

  // If current status is delivered or cancelled, disable all options
  if (currentStatus === "delivered" || currentStatus === "cancelled") {
    return true;
  }

  // If option value is the same as current status, don't disable
  if (optionValue === currentStatus) {
    return false;
  }

  // Check if the transition is allowed
  return !allowedTransitions[currentStatus].includes(optionValue);
};


const Orders = () => {
  const [showRefundProofModal, setShowRefundProofModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");
  const [refundProofFile, setRefundProofFile] = useState(null);
  const [refundProofPreview, setRefundProofPreview] = useState("");
  const [uploadingRefundProof, setUploadingRefundProof] = useState(false);

  const handleRefundProofChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setRefundProofFile(file);
    setRefundProofPreview(URL.createObjectURL(file));
  };

  const { user, isAuthLoading } = useContext(AuthContext);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    order_status: "",
    pay_status: "",
    refund_status: "",
    refund_proof: "",
  });

  const isOrderDataChanged = (order) => {
    // Admin API chỉ hỗ trợ các trường cơ bản, không bao gồm feedback_order
    const fields = ["order_status", "pay_status", "refund_status", "refund_proof"];
    for (let key of fields) {
      const oldVal = order[key] ?? "";
      const newVal = editFormData[key] ?? "";
      if (key === "refund_proof" && refundProofFile) return true;
      if (oldVal !== newVal) return true;
    }
    return false;
  };

  const [filters, setFilters] = useState({
    orderStatus: "",
    payStatus: "",
  });
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const navigate = useNavigate();
  const socketRef = useRef(null);

  const orderStatusOptions = [
    { value: "pending", label: "Pending" },
    { value: "confirmed", label: "Confirmed" },
    { value: "shipping", label: "Shipping" },
    { value: "delivered", label: "Delivered" },
    { value: "cancelled", label: "Cancelled" },
  ];

  const payStatusOptions = [
    { value: "unpaid", label: "Unpaid" },
    { value: "paid", label: "Paid" },
  ];

  const refundStatusOptions = [
    { value: "not_applicable", label: "Not Applicable" },
    { value: "pending_refund", label: "Pending Refund" },
    { value: "refunded", label: "Refunded" },
  ];

  const displayStatus = (str) => {
    if (!str || typeof str !== "string") return str || "N/A";
    if (str === "not_applicable") return "Not Applicable";
    if (str === "pending_refund") return "Pending Refund";
    if (str === "refunded") return "Refunded";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  const shouldDisableUpdate = (method, status, pay, refund) => {
    // Check if order is finalized (cannot be updated)
    return (
      (method === "COD" &&
        status === "delivered" &&
        pay === "paid") ||
      (method === "COD" &&
        status === "cancelled" &&
        pay === "unpaid") ||
      (method === "VNPAY" &&
        status === "delivered" &&
        pay === "paid") ||
      (method === "VNPAY" &&
        status === "cancelled" &&
        refund === "refunded")
    );
  };

  const hasActiveFilters = useCallback(() => {
    return (
      filters.orderStatus ||
      filters.payStatus ||
      searchText
    );
  }, [filters, searchText]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchOrders = useCallback(async () => {
    if (!user?._id) {
      setError("User not authenticated");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await Api.orders.getAll();
      console.log("Orders Response:", response);

      // Extract data from response structure
      const ordersData = response?.data || response || [];

      setOrders(
        Array.isArray(ordersData)
          ? ordersData.sort(
            (a, b) => new Date(b.orderDate) - new Date(a.orderDate)
          )
          : []
      );
    } catch (err) {
      setError(err.message || "Failed to load orders");
      console.error("Fetch Orders Error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let filtered = orders;

    // Filter by order status
    if (filters.orderStatus) {
      filtered = filtered.filter(order => order.order_status === filters.orderStatus);
    }

    // Filter by payment status
    if (filters.payStatus) {
      filtered = filtered.filter(order => order.pay_status === filters.payStatus);
    }

    // Filter by search text
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(order =>
        order._id.toLowerCase().includes(searchLower) ||
        (order.acc_id?.name && order.acc_id.name.toLowerCase().includes(searchLower)) ||
        (order.acc_id?.username && order.acc_id.username.toLowerCase().includes(searchLower)) ||
        (order.acc_id?.email && order.acc_id.email.toLowerCase().includes(searchLower)) ||
        (order.acc_id?.phone && order.acc_id.phone.toLowerCase().includes(searchLower)) ||
        (order.phone && order.phone.toLowerCase().includes(searchLower)) ||
        (order.addressReceive && order.addressReceive.toLowerCase().includes(searchLower))
      );
    }

    setFilteredOrders(filtered);
  }, [orders, filters, searchText]);





  const updateOrder = useCallback(
    async (orderId, updatedData) => {
      setLoading(true);
      setError("");
      setToast(null);
      try {
        const originalOrder = orders.find((o) => o._id === orderId);
        if (!originalOrder) {
          setToast({
            type: "error",
            message: "Order not found in current list. Please refresh the page.",
          });
          fetchOrders();
          return;
        }

        const changedFields = {};
        // Admin API chỉ hỗ trợ các trường cơ bản, không bao gồm feedback_order
        ["order_status", "pay_status", "refund_status"].forEach((key) => {
          const oldVal = originalOrder[key] ?? "";
          const newVal = updatedData[key] ?? "";
          if (oldVal !== newVal) changedFields[key] = newVal;
        });

        if (refundProofFile) {
          setUploadingRefundProof(true);
          const uploadResult = await Api.upload.image(refundProofFile);
          setUploadingRefundProof(false);
          // Try different possible response structures
          const imageUrl = uploadResult.data?.url ||
            uploadResult.data?.data?.url ||
            uploadResult.data?.imageUrl ||
            uploadResult.data?.data?.imageUrl ||
            uploadResult.data;

          if (imageUrl) {
            changedFields.refund_proof = imageUrl;
          } else {
            throw new Error("Failed to upload refund proof");
          }
        }

        if (Object.keys(changedFields).length === 0) {
          setToast({ type: "info", message: "No changes detected" });
          setEditingOrderId(null);
          setEditFormData({
            order_status: "",
            pay_status: "",
            refund_status: "",
            refund_proof: "",
          });
          return;
        }

        // Validate order status transitions
        const allowedTransitions = {
          pending: ["confirmed", "shipping", "delivered", "cancelled"],
          confirmed: ["shipping", "delivered"],
          shipping: ["delivered"],
          delivered: [],
          cancelled: [],
        };

        const currentStatus = originalOrder.order_status;
        const newStatus = changedFields.order_status;

        if (newStatus && !allowedTransitions[currentStatus].includes(newStatus)) {
          setToast({
            type: "error",
            message: `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowedTransitions[currentStatus].join(", ") || "none"}`,
          });
          return;
        }

        // Check if order is finalized (cannot be updated)
        const isFinalized =
          (originalOrder.payment_method === "COD" &&
            originalOrder.order_status === "delivered" &&
            originalOrder.pay_status === "paid") ||
          (originalOrder.payment_method === "COD" &&
            originalOrder.order_status === "cancelled" &&
            originalOrder.pay_status === "unpaid") ||
          (originalOrder.payment_method === "VNPAY" &&
            originalOrder.order_status === "delivered" &&
            originalOrder.pay_status === "paid") ||
          (originalOrder.payment_method === "VNPAY" &&
            originalOrder.order_status === "cancelled" &&
            originalOrder.refund_status === "refunded");

        if (isFinalized) {
          setToast({
            type: "error",
            message: "This order is finalized and cannot be updated",
          });
          return;
        }

        // Business rules validation
        const newPayStatus = changedFields.pay_status || originalOrder.pay_status;
        const newRefundStatus = changedFields.refund_status || originalOrder.refund_status;

        // COD rules
        if (originalOrder.payment_method === "COD") {
          if (
            ["pending", "confirmed", "shipping"].includes(newStatus || currentStatus) &&
            newPayStatus === "paid"
          ) {
            setToast({
              type: "error",
              message: "COD orders cannot be paid before delivery",
            });
            return;
          }
        }

        // VNPAY rules
        if (originalOrder.payment_method === "VNPAY") {
          if ((newStatus || currentStatus) !== "cancelled" && newPayStatus !== "paid") {
            setToast({
              type: "error",
              message: "VNPAY orders must remain paid unless cancelled",
            });
            return;
          }

          if ((newStatus || currentStatus) === "cancelled" && newPayStatus === "paid") {
            if (!["pending_refund", "refunded"].includes(newRefundStatus)) {
              setToast({
                type: "error",
                message: "Cancelled paid VNPAY orders must have refund_status = pending_refund or refunded",
              });
              return;
            }
          }

          // Check if in pending_refund state - only allow refund_status and refund_proof updates
          if (originalOrder.refund_status === "pending_refund") {
            const allowedKeys = ["refund_status", "refund_proof"];
            const hasInvalidUpdate = Object.keys(changedFields).some(
              (key) => !allowedKeys.includes(key)
            );
            if (hasInvalidUpdate) {
              setToast({
                type: "error",
                message: "When order is cancelled+paid (pending_refund), only refund_status/proof can be updated",
              });
              return;
            }
          }
        }

        console.log("Updating order:", orderId, "with data:", changedFields);
        console.log("Order ID type:", typeof orderId, "Length:", orderId?.length);
        console.log("Full order object:", originalOrder);
        console.log("API endpoint will be:", `/orders/admin/update/${orderId}`);

        let response;
        try {
          response = await Api.orders.update(orderId, changedFields);
          console.log("Update Order Response:", response);
        } catch (error) {
          console.error("Update Order Error:", error);
          console.error("Error details:", error.response?.data);
          console.error("Request URL:", error.config?.url);
          console.error("Request method:", error.config?.method);

          // Handle specific error cases
          if (error.response?.data?.message === "Order not found" ||
            error.response?.status === 404) {
            setToast({
              type: "error",
              message: "Order not found. This might be a backend issue. Please refresh the page and try again.",
            });
            // Refresh orders list
            fetchOrders();
            return;
          }

          throw error;
        }

        // Extract updated data from response structure
        const responseData = response?.data || response;

        setOrders((prev) =>
          prev.map((order) =>
            order._id === orderId ? { ...order, ...responseData } : order
          )
        );
        setEditingOrderId(null);
        setEditFormData({
          order_status: "",
          pay_status: "",
          refund_status: "",
          refund_proof: "",
        });
        setRefundProofFile(null);
        setRefundProofPreview("");
        setToast({ type: "success", message: "Order updated successfully!" });
      } catch (err) {
        setToast({ type: "error", message: err.message || "Failed to update order" });
      } finally {
        setLoading(false);
        setUploadingRefundProof(false);
      }
    },
    [orders, refundProofFile, fetchOrders]
  );

  const cancelOrder = useCallback(
    async (orderId) => {
      setLoading(true);
      setError("");
      setToast(null);
      try {
        await Api.orders.cancel(orderId);
        setToast({ type: "success", message: "Order cancelled successfully" });
        fetchOrders();
      } catch (err) {
        setToast({
          type: "error",
          message: err.message || "Failed to cancel order",
        });
      } finally {
        setLoading(false);
      }
    },
    [fetchOrders]
  );

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      orderStatus: "",
      payStatus: "",
    });
    setSearchText("");
    setCurrentPage(1);
  }, []);

  const toggleFilters = useCallback(() => {
    setShowFilters((prev) => !prev);
  }, []);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!user && !localStorage.getItem("token")) {
      navigate("/login", { replace: true });
    } else if (user) {
      fetchOrders();
    }
  }, [user, isAuthLoading, navigate, fetchOrders]);

  useEffect(() => {
    if (!user?._id) return;
    if (!socketRef.current) {
      socketRef.current = io(
        import.meta.env.VITE_API_URL || "http://localhost:5000",
        {
          transports: ["websocket"],
          withCredentials: true,
        }
      );
    }
    const socket = socketRef.current;
    socket.on("orderUpdated", () => fetchOrders());
    return () => {
      socket.off("orderUpdated");
    };
  }, [user, fetchOrders]);

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  const handleEditChange = useCallback((field, value) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  }, []);


  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Toast Notifications */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg transition-all duration-300 ${toast.type === 'success' ? 'bg-green-500 text-white' :
          toast.type === 'error' ? 'bg-red-500 text-white' :
            toast.type === 'info' ? 'bg-blue-500 text-white' :
              'bg-gray-500 text-white'
          }`}>
          {toast.message}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 lg:mb-6">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800">{error}</p>
            </div>
            <button
              onClick={fetchOrders}
              className="flex-shrink-0 bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-lg text-sm font-medium transition-colors duration-200"
              disabled={loading}
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Loading orders...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredOrders.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="flex flex-col items-center justify-center text-center">
            <svg className="h-12 w-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No orders found</h3>
            <p className="text-gray-500 mb-4">There are no orders matching your current filters.</p>
            <button
              onClick={() => navigate("/")}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors duration-200"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      {!loading && filteredOrders.length > 0 && (
        <>
          {/* Header Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Order Management</h1>
                <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage and track customer orders</p>
              </div>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
                <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
                  <span className="text-xs lg:text-sm font-medium text-gray-700">
                    {filteredOrders.length} order{filteredOrders.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="text"
                    value={searchText}
                    onChange={(e) => {
                      setSearchText(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search orders..."
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-sm"
                    aria-label="Search orders"
                  />
                  <button
                    onClick={toggleFilters}
                    className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
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
          </div>
          {/* Filter Section */}
          {showFilters && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Search & Filter</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                <div>
                  <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Order Status</label>
                  <select
                    value={filters.orderStatus}
                    onChange={(e) => handleFilterChange("orderStatus", e.target.value)}
                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                    aria-label="Order status"
                  >
                    <option value="">All Status</option>
                    {orderStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Payment Status</label>
                  <select
                    value={filters.payStatus}
                    onChange={(e) => handleFilterChange("payStatus", e.target.value)}
                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                    aria-label="Payment status"
                  >
                    <option value="">All Payment Status</option>
                    {payStatusOptions.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2 lg:col-span-1 flex items-end">
                  <button
                    onClick={clearFilters}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 lg:px-4 lg:py-3 rounded-lg transition-all duration-200 text-sm lg:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={!hasActiveFilters()}
                    aria-label="Clear filters"
                  >
                    Clear Filters
                  </button>
                </div>
              </div>
              <div className="mt-3 lg:mt-4 pt-3 lg:pt-4 border-t border-gray-200">
                <p className="text-xs lg:text-sm text-gray-600">
                  {hasActiveFilters() ? "Filters applied" : "No filters applied"}
                </p>
              </div>
            </div>
          )}
          {/* Table Section */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Address</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Total</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Final</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Method</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Refund</th>
                    <th className="px-3 py-3 lg:px-6 lg:py-4 text-left text-xs lg:text-sm font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentOrders.map((order, index) => (
                    <React.Fragment key={order._id}>
                      <tr className="hover:bg-gray-50 transition-colors duration-150">
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">{startIndex + index + 1}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order._id}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">{formatDateVN(order.orderDate)}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">{order.acc_id?.name || order.acc_id?.username || "Guest"}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">{order.acc_id?.phone || order.phone || "N/A"}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 text-sm text-gray-900 max-w-xs truncate">{order.addressReceive || "N/A"}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">{formatPrice(order.totalPrice)}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">{formatPrice(order.discountAmount || 0)}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm font-medium text-gray-900 text-center">{formatPrice(order.finalPrice || order.totalPrice)}</td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {editingOrderId === order._id ? (
                            <select
                              className="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
                              value={editFormData.order_status || order.order_status}
                              onChange={(e) =>
                                handleEditChange("order_status", e.target.value)
                              }
                              disabled={loading}
                              aria-label="Edit order status"
                            >
                              {orderStatusOptions.map((opt) => (
                                <option
                                  key={opt.value}
                                  value={opt.value}
                                  disabled={getOrderStatusOptionDisabled(
                                    order.order_status,
                                    opt.value
                                  )}
                                >
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${order.order_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              order.order_status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                                order.order_status === 'shipping' ? 'bg-purple-100 text-purple-800' :
                                  order.order_status === 'delivered' ? 'bg-green-100 text-green-800' :
                                    order.order_status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                              }`}>
                              {displayStatus(order.order_status)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${order.payment_method === 'COD' ? 'bg-orange-100 text-orange-800' :
                            order.payment_method === 'VNPAY' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                            {displayStatus(order.payment_method)}
                          </span>
                        </td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {editingOrderId === order._id ? (
                            <select
                              className="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
                              value={editFormData.pay_status || order.pay_status}
                              onChange={(e) =>
                                handleEditChange("pay_status", e.target.value)
                              }
                              disabled={loading}
                              aria-label="Edit payment status"
                            >
                              {payStatusOptions.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${order.pay_status === 'paid' ? 'bg-green-100 text-green-800' :
                              order.pay_status === 'unpaid' ? 'bg-red-100 text-red-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                              {displayStatus(order.pay_status)}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {editingOrderId === order._id ? (
                            <>
                              <select
                                className="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs mb-2"
                                value={editFormData.refund_status || order.refund_status}
                                onChange={(e) =>
                                  handleEditChange("refund_status", e.target.value)
                                }
                                disabled={loading}
                                aria-label="Edit refund status"
                              >
                                {refundStatusOptions.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              {(editFormData.refund_status === "pending_refund" ||
                                editFormData.refund_status === "refunded" ||
                                order.refund_status === "refunded") && (
                                  <div className="mt-2">
                                    <input
                                      id={`refund-proof-upload-${order._id}`}
                                      type="file"
                                      accept="image/*"
                                      onChange={handleRefundProofChange}
                                      disabled={uploadingRefundProof}
                                      className="text-xs"
                                    />
                                    {(refundProofPreview || editFormData.refund_proof) && (
                                      <div className="mt-2">
                                        <img
                                          src={refundProofPreview || editFormData.refund_proof}
                                          alt="Refund proof preview"
                                          className="max-w-20 max-h-20 border border-gray-300 rounded"
                                        />
                                      </div>
                                    )}
                                  </div>
                                )}
                              {order.refund_proof && (
                                <div className="mt-2">
                                  <img
                                    src={order.refund_proof}
                                    alt="Refund proof"
                                    className="max-w-20 max-h-20 border border-gray-300 rounded"
                                  />
                                </div>
                              )}
                            </>
                          ) : (
                            <>
                              <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${order.refund_status === 'not_applicable' ? 'bg-gray-100 text-gray-800' :
                                order.refund_status === 'pending_refund' ? 'bg-yellow-100 text-yellow-800' :
                                  order.refund_status === 'refunded' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                                }`}>
                                {displayStatus(order.refund_status)}
                              </span>
                              {order.refund_proof && (
                                <div className="mt-2">
                                  <img
                                    src={order.refund_proof}
                                    alt="Refund proof"
                                    className="max-w-20 max-h-20 border border-gray-300 rounded cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => {
                                      setModalImageUrl(order.refund_proof);
                                      setShowRefundProofModal(true);
                                    }}
                                  />
                                </div>
                              )}
                            </>
                          )}
                        </td>
                        <td className="px-3 py-3 lg:px-6 lg:py-4 whitespace-nowrap text-sm text-gray-900 text-center">
                          {editingOrderId === order._id ? (
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={() => {
                                  if (!isOrderDataChanged(order)) {
                                    setToast({
                                      type: "info",
                                      message: "No changes detected",
                                    });
                                    setEditingOrderId(null);
                                    setEditFormData({
                                      order_status: "",
                                      pay_status: "",
                                      refund_status: "",
                                      refund_proof: "",
                                    });
                                    return;
                                  }
                                  updateOrder(order._id, editFormData);
                                }}
                                className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white rounded-md text-xs font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading || uploadingRefundProof}
                                aria-label={`Update order ${order._id}`}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setEditingOrderId(null);
                                  setEditFormData({
                                    order_status: "",
                                    pay_status: "",
                                    refund_status: "",
                                    refund_proof: "",
                                  });
                                  setRefundProofFile(null);
                                  setRefundProofPreview("");
                                }}
                                className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded-md text-xs font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                                aria-label={`Cancel editing order ${order._id}`}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col space-y-1">
                              <button
                                onClick={() => {
                                  setEditingOrderId(order._id);
                                  setEditFormData({
                                    order_status: order.order_status,
                                    pay_status: order.pay_status,
                                    refund_status: order.refund_status,
                                    refund_proof: order.refund_proof || "",
                                  });
                                }}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label={`Edit order ${order._id}`}
                                disabled={shouldDisableUpdate(
                                  order.payment_method,
                                  order.order_status,
                                  order.pay_status,
                                  order.refund_status
                                )}
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => cancelOrder(order._id)}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded-md text-xs font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                aria-label={`Cancel order ${order._id}`}
                                disabled={
                                  order.order_status !== "pending" || loading
                                }
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {filteredOrders.length > 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mt-4 lg:mt-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 lg:gap-4">
                <div className="text-sm text-gray-700">
                  Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
                  <span className="font-medium">{Math.min(endIndex, filteredOrders.length)}</span> of{" "}
                  <span className="font-medium">{filteredOrders.length}</span> orders
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    aria-label="Previous page"
                  >
                    Previous
                  </button>
                  <div className="flex space-x-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-200 ${currentPage === page
                          ? "bg-blue-600 text-white"
                          : "text-gray-500 bg-white border border-gray-300 hover:bg-gray-50"
                          }`}
                        onClick={() => handlePageChange(page)}
                        aria-label={`Page ${page}`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    aria-label="Next page"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Orders;