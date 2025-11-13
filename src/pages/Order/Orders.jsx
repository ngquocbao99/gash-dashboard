import RefundProofModal from "../RefundProofModal";
import CancelOrderModal from "./CancelOrderModal"; // Adjust path as needed
import OrderDetails from "./OrderDetails";
import React, {
  useState,
  useEffect,
  useContext,
  useCallback,
  useRef,
} from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import { ToastContext } from "../../context/ToastContext";
import { io } from "socket.io-client";
import Api from "../../common/SummaryAPI";

// Định dạng ngày dd/MM/yyyy
function formatDateVN(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "N/A";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// Format price to VND
function formatPrice(price) {
  if (typeof price !== "number" || isNaN(price)) return "N/A";
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(price);
}

// Format Order ID to show only last 8 characters
function formatOrderId(orderId) {
  if (!orderId || typeof orderId !== "string") return "N/A";
  if (orderId.length <= 8) return orderId;
  return "..." + orderId.slice(-8);
}

function formatUpdatedAt(dateStr) {
  if (!dateStr) return "Never updated";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "Invalid date";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${month}/${year} ${hours}:${minutes}`;
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

  // Handle undefined or null currentStatus
  if (!currentStatus || typeof currentStatus !== "string") {
    return true; // Disable all options if status is invalid
  }

  // If current status is delivered or cancelled, disable all options
  if (currentStatus === "delivered" || currentStatus === "cancelled") {
    return true;
  }

  // If option value is the same as current status, don't disable
  if (optionValue === currentStatus) {
    return false;
  }

  // Check if the transition is allowed - add safety check
  const allowedOptions = allowedTransitions[currentStatus];
  if (!allowedOptions || !Array.isArray(allowedOptions)) {
    return true; // Disable if no valid transitions found
  }

  return !allowedOptions.includes(optionValue);
};

const Orders = () => {
  const [showRefundProofModal, setShowRefundProofModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const handleViewOrderDetails = (order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  const handleCloseOrderDetails = () => {
    setShowOrderDetails(false);
    setSelectedOrder(null);
  };

  const { user, isAuthLoading } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [editingOrderId, setEditingOrderId] = useState(null);
  const [editFormData, setEditFormData] = useState({
    order_status: "",
    pay_status: "",
  });
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [cancelFormData, setCancelFormData] = useState({
    cancelReason: "",
    customReason: "",
  });

  const isOrderDataChanged = (order) => {
    // Admin API chỉ hỗ trợ các trường cơ bản, không bao gồm feedback_order
    const fields = ["order_status", "pay_status"];
    for (let key of fields) {
      const oldVal = order[key] ?? "";
      const newVal = editFormData[key] ?? "";
      if (oldVal !== newVal) return true;
    }
    return false;
  };

  const [filters, setFilters] = useState({
    orderStatus: "",
    payStatus: "",
    paymentMethod: "",
    startDate: "",
    endDate: "",
  });
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
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

  const displayStatus = (str) => {
    if (!str || typeof str !== "string") return str || "N/A";
    if (str === "not_applicable") return "Not Applicable";
    if (str === "pending_refund") return "Pending Refund";
    if (str === "refunded") return "Refunded";
    return str.charAt(0).toUpperCase() + str.slice(1);
  };

  // Check if order status update is allowed
  const isOrderStatusUpdateAllowed = (status) => {
    return (
      status === "pending" || status === "confirmed" || status === "shipping"
    );
  };

  // Check if refund status update is allowed (only for cancelled VNPAY paid orders)
  const isRefundStatusUpdateAllowed = (method, status, pay) => {
    return status === "cancelled" && method === "VNPAY" && pay === "paid";
  };

  const shouldDisableUpdate = (method, status, pay) => {
    // Check if order status update is not allowed
    if (!isOrderStatusUpdateAllowed(status)) {
      return true;
    }

    // Check if order is finalized (cannot be updated)
    return (
      (method === "COD" && status === "delivered" && pay === "paid") ||
      (method === "COD" && status === "cancelled" && pay === "unpaid") ||
      (method === "VNPAY" && status === "delivered" && pay === "paid") ||
      (method === "VNPAY" && status === "cancelled" && pay === "unpaid")
    );
  };

  // Check if update button should be disabled
  const shouldDisableUpdateButton = (method, status, pay) => {
    // Allow refund management for cancelled VNPAY paid orders
    if (isRefundStatusUpdateAllowed(method, status, pay)) {
      return false;
    }

    // Disable for cancelled and delivered orders (except cancelled VNPAY paid)
    if (status === "cancelled" || status === "delivered") {
      return true;
    }

    // For other cases, use existing logic
    return shouldDisableUpdate(method, status, pay);
  };

  const hasActiveFilters = useCallback(() => {
    return (
      filters.orderStatus ||
      filters.payStatus ||
      filters.paymentMethod ||
      filters.startDate ||
      filters.endDate ||
      searchText
    );
  }, [filters, searchText]);

  const fetchOrders = useCallback(async () => {
    if (!user?._id) {
      setError("User not authenticated");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const response = await Api.orders.getAll();

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
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    let filtered = orders;

    // Filter by order status
    if (filters.orderStatus) {
      filtered = filtered.filter(
        (order) => order.order_status === filters.orderStatus
      );
    }

    // Filter by payment status
    if (filters.payStatus) {
      filtered = filtered.filter(
        (order) => order.pay_status === filters.payStatus
      );
    }

    // Filter by payment method
    if (filters.paymentMethod) {
      filtered = filtered.filter(
        (order) => order.payment_method === filters.paymentMethod
      );
    }

    // Filter by date range
    if (filters.startDate) {
      const start = new Date(filters.startDate);
      filtered = filtered.filter((order) => new Date(order.orderDate) >= start);
    }
    if (filters.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter((order) => new Date(order.orderDate) <= end);
    }

    // Filter by search text (Name Receive, Phone, Address)
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          (order.name && order.name.toLowerCase().includes(searchLower)) ||
          (order.acc_id?.name &&
            order.acc_id.name.toLowerCase().includes(searchLower)) ||
          (order.acc_id?.username &&
            order.acc_id.username.toLowerCase().includes(searchLower)) ||
          (order.phone && order.phone.toLowerCase().includes(searchLower)) ||
          (order.acc_id?.phone &&
            order.acc_id.phone.toLowerCase().includes(searchLower)) ||
          (order.addressReceive &&
            order.addressReceive.toLowerCase().includes(searchLower))
      );
    }

    setFilteredOrders(filtered);
  }, [orders, filters, searchText]);

  const updateOrder = useCallback(
    async (orderId, updatedData) => {
      setLoading(true);
      setError("");
      try {
        const originalOrder = orders.find((o) => o._id === orderId);
        if (!originalOrder) {
          showToast(
            "Order not found in current list. Please refresh the page.",
            "error"
          );
          fetchOrders();
          return;
        }

        const changedFields = {};
        // Admin API chỉ hỗ trợ các trường cơ bản, không bao gồm feedback_order
        ["order_status", "pay_status"].forEach((key) => {
          const oldVal = originalOrder[key] ?? "";
          const newVal = updatedData[key] ?? "";
          if (oldVal !== newVal) changedFields[key] = newVal;
        });

        if (Object.keys(changedFields).length === 0) {
          showToast("No changes detected", "info");
          setEditingOrderId(null);
          setEditFormData({
            order_status: "",
            pay_status: "",
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

        if (
          newStatus &&
          !allowedTransitions[currentStatus].includes(newStatus)
        ) {
          showToast(
            `Invalid status transition: ${currentStatus} → ${newStatus}. Allowed: ${allowedTransitions[currentStatus].join(", ") || "none"
            }`,
            "error"
          );
          return;
        }

        // Check if order status update is allowed
        if (!isOrderStatusUpdateAllowed(originalOrder.order_status)) {
          showToast(
            "Order status cannot be updated for cancelled or delivered orders",
            "error"
          );
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
          showToast("This order is finalized and cannot be updated", "error");
          return;
        }

        // Business rules validation
        const newPayStatus =
          changedFields.pay_status || originalOrder.pay_status;

        // COD rules
        if (originalOrder.payment_method === "COD") {
          if (
            ["pending", "confirmed", "shipping"].includes(
              newStatus || currentStatus
            ) &&
            newPayStatus === "paid"
          ) {
            showToast("COD orders cannot be paid before delivery", "error");
            return;
          }
        }

        // VNPAY rules
        if (originalOrder.payment_method === "VNPAY") {
          if (
            (newStatus || currentStatus) !== "cancelled" &&
            newPayStatus !== "paid"
          ) {
            showToast(
              "VNPAY orders must remain paid unless cancelled",
              "error"
            );
            return;
          }
        }

        let response;
        try {
          response = await Api.orders.update(orderId, changedFields);
        } catch (error) {

          // Handle specific error cases
          if (
            error.response?.data?.message === "Order not found" ||
            error.response?.status === 404
          ) {
            showToast(
              "Order not found. This might be a backend issue. Please refresh the page and try again.",
              "error"
            );
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
        });
        showToast("Order updated successfully!", "success");
      } catch (err) {
        showToast(err.message || "Failed to update order", "error");
      } finally {
        setLoading(false);
      }
    },
    [orders, fetchOrders, showToast]
  );

  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      orderStatus: "",
      payStatus: "",
      paymentMethod: "",
      startDate: "",
      endDate: "",
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

  // Handle URL query parameter for orderId
  useEffect(() => {
    if (orders.length > 0) {
      const urlParams = new URLSearchParams(location.search);
      const orderId = urlParams.get('orderId');
      if (orderId) {
        const order = orders.find(o => o._id === orderId);
        if (order) {
          handleViewOrderDetails(order);
          // Clear the URL parameter
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, [orders, location.search]);

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

  // Show loading state while auth is being verified
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
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">
              Order Management
            </h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">
              Manage and track customer orders
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
            <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
              <span className="text-xs lg:text-sm font-medium text-gray-700">
                {filteredOrders.length} order
                {filteredOrders.length !== 1 ? "s" : ""}
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
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search by name, phone, address..."
                className="px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base w-40 sm:w-48"
                aria-label="Search orders"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      {showFilters && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
          <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">
            Search & Filter
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
            {/* Order Status */}
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Order Status
              </label>
              <select
                value={filters.orderStatus}
                onChange={(e) =>
                  handleFilterChange("orderStatus", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
              >
                <option value="">All Status</option>
                {orderStatusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Status */}
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Payment Status
              </label>
              <select
                value={filters.payStatus}
                onChange={(e) =>
                  handleFilterChange("payStatus", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
              >
                <option value="">All Payment Status</option>
                {payStatusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method */}
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Method
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) =>
                  handleFilterChange("paymentMethod", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
              >
                <option value="">All Methods</option>
                <option value="COD">COD</option>
                <option value="VNPAY">VNPAY</option>
              </select>
            </div>

            {/* Start Date */}
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

            {/* End Date */}
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

            {/* Clear Button */}
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters()}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Unified State: Loading / Empty / Error */}
      {loading || filteredOrders.length === 0 || error ? (
        <div
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
          role="status"
        >
          <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
            {/* ── LOADING ── */}
            {loading ? (
              <>
                <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
                <p className="text-gray-600 font-medium">Loading orders...</p>
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
                  onClick={fetchOrders}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                >
                  Retry
                </button>
              </div>
            ) : (
              /* ── NO ORDERS ── */
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
                      d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                    />
                  </svg>
                </div>

                <div className="text-center">
                  <h3 className="text-base font-medium text-gray-900">
                    No orders found
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {orders.length === 0
                      ? "No orders have been placed yet"
                      : "Try adjusting your search or filter criteria"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Orders Table - Only when data exists */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[1600px]">
              {/* ---------- HEADER ---------- */}
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-[3%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    #
                  </th>
                  <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Create Date
                  </th>
                  <th className="w-[8%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Updated Date
                  </th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Name Receive
                  </th>
                  <th className="w-[6%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="w-[15%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Address
                  </th>
                  <th className="w-[6%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Final
                  </th>
                  <th className="w-[6%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="w-[6%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Method
                  </th>
                  <th className="w-[6%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Payment
                  </th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Cancel Reason
                  </th>
                  <th className="w-[8%] px-2 lg:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-200">
                {currentOrders.map((order, index) => (
                  <React.Fragment key={order._id}>
                    <tr className="hover:bg-gray-50 transition-colors duration-150">
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        <div
                          className="text-xs lg:text-sm font-medium text-gray-900"
                          title={order._id}
                        >
                          {formatOrderId(order._id)}
                        </div>
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900 text-center">
                        {formatDateVN(order.orderDate)}
                      </td>
                      <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-600">
                        {order.updatedAt
                          ? formatUpdatedAt(order.updatedAt)
                          : "—"}
                      </td>
                      <td className="px-2 lg:px-4 py-3">
                        <div className="text-xs lg:text-sm font-medium text-gray-900 break-words max-w-xs">
                          {order.name ||
                            order.acc_id?.name ||
                            order.acc_id?.username ||
                            "Guest"}
                        </div>
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                        {order.acc_id?.phone || order.phone || "N/A"}
                      </td>
                      <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 max-w-xs">
                        <div className="break-words">
                          {order.addressReceive || "N/A"}
                        </div>
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm font-medium text-gray-900 text-center">
                        {formatPrice(order.finalPrice || order.totalPrice)}
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        {editingOrderId === order._id ? (
                          <select
                            className="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs lg:text-sm"
                            value={
                              editFormData.order_status || order.order_status
                            }
                            onChange={(e) =>
                              handleEditChange("order_status", e.target.value)
                            }
                            disabled={loading}
                            aria-label="Edit order status"
                          >
                            {orderStatusOptions
                              .filter((opt) => opt.value !== "cancelled") // Remove 'cancelled' option
                              .map((opt) => (
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
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${order.order_status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : order.order_status === "confirmed"
                                ? "bg-blue-100 text-blue-800"
                                : order.order_status === "shipping"
                                  ? "bg-purple-100 text-purple-800"
                                  : order.order_status === "delivered"
                                    ? "bg-green-100 text-green-800"
                                    : order.order_status === "cancelled"
                                      ? "bg-red-100 text-red-800"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {displayStatus(order.order_status)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ${order.payment_method === "COD"
                            ? "bg-orange-100 text-orange-800"
                            : order.payment_method === "VNPAY"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {displayStatus(order.payment_method)}
                        </span>
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        {editingOrderId === order._id ? (
                          <select
                            className="px-2 py-1 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs lg:text-sm"
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
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${order.pay_status === "paid"
                              ? "bg-green-100 text-green-800"
                              : order.pay_status === "unpaid"
                                ? "bg-red-100 text-red-800"
                                : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {displayStatus(order.pay_status)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${order.cancelReason
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                            }`}
                        >
                          {displayStatus(order.cancelReason || "N/A")}
                        </span>
                      </td>
                      <td className="px-2 lg:px-4 py-3">
                        <div className="flex justify-center items-center space-x-1">
                          {editingOrderId === order._id ? (
                            <>
                              <button
                                onClick={() => {
                                  if (!isOrderDataChanged(order)) {
                                    showToast("No changes detected", "info");
                                    setEditingOrderId(null);
                                    setEditFormData({
                                      order_status: "",
                                      pay_status: "",
                                    });
                                    return;
                                  }
                                  updateOrder(order._id, editFormData);
                                }}
                                className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-all duration-200 border border-green-200 hover:border-green-300"
                                disabled={loading}
                                aria-label={`Update order ${order._id}`}
                                title="Save changes"
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
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              </button>
                              <button
                                onClick={() => {
                                  setEditingOrderId(null);
                                  setEditFormData({
                                    order_status: "",
                                    pay_status: "",
                                  });
                                }}
                                className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-200 hover:border-gray-300"
                                disabled={loading}
                                aria-label={`Cancel editing order ${order._id}`}
                                title="Cancel editing"
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
                                    d="M6 18L18 6M6 6l12 12"
                                  />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleViewOrderDetails(order)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                                aria-label={`View details for order ${order._id}`}
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
                              <button
                                onClick={() => {
                                  // Check if refund management is allowed
                                  if (
                                    isRefundStatusUpdateAllowed(
                                      order.payment_method,
                                      order.order_status,
                                      order.pay_status
                                    )
                                  ) {
                                    handleViewOrderDetails(order);
                                    return;
                                  }

                                  // Check if order status update is allowed
                                  if (
                                    !isOrderStatusUpdateAllowed(
                                      order.order_status
                                    )
                                  ) {
                                    showToast(
                                      "Order status cannot be updated for cancelled or delivered orders",
                                      "error"
                                    );
                                    return;
                                  }

                                  setEditingOrderId(order._id);
                                  setEditFormData({
                                    order_status: order.order_status,
                                    pay_status: order.pay_status,
                                  });
                                }}
                                className={`p-1.5 rounded-lg transition-all duration-200 border ${(isOrderStatusUpdateAllowed(
                                  order.order_status
                                ) &&
                                  !shouldDisableUpdate(
                                    order.payment_method,
                                    order.order_status,
                                    order.pay_status
                                  )) ||
                                  isRefundStatusUpdateAllowed(
                                    order.payment_method,
                                    order.order_status,
                                    order.pay_status
                                  )
                                  ? isRefundStatusUpdateAllowed(
                                    order.payment_method,
                                    order.order_status,
                                    order.pay_status
                                  )
                                    ? "text-orange-600 hover:text-orange-800 hover:bg-orange-100 border-orange-200 hover:border-orange-300"
                                    : "text-blue-600 hover:text-blue-800 hover:bg-blue-100 border-blue-200 hover:border-blue-300"
                                  : "text-gray-400 cursor-not-allowed border-gray-200 bg-gray-50"
                                  }`}
                                aria-label={`${isRefundStatusUpdateAllowed(
                                  order.payment_method,
                                  order.order_status,
                                  order.pay_status
                                )
                                  ? "Manage refund"
                                  : "Edit order"
                                  } ${order._id}`}
                                disabled={shouldDisableUpdateButton(
                                  order.payment_method,
                                  order.order_status,
                                  order.pay_status
                                )}
                                title={
                                  isRefundStatusUpdateAllowed(
                                    order.payment_method,
                                    order.order_status,
                                    order.pay_status
                                  )
                                    ? "Manage Refund"
                                    : !isOrderStatusUpdateAllowed(
                                      order.order_status
                                    )
                                      ? "Order status cannot be updated for cancelled or delivered orders"
                                      : shouldDisableUpdate(
                                        order.payment_method,
                                        order.order_status,
                                        order.pay_status
                                      )
                                        ? "This order is finalized and cannot be updated"
                                        : "Edit Order"
                                }
                              >
                                <svg
                                  className="w-3 h-3 lg:w-4 lg:h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  {isRefundStatusUpdateAllowed(
                                    order.payment_method,
                                    order.order_status,
                                    order.pay_status
                                  ) ? (
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
                                    />
                                  ) : (
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                    />
                                  )}
                                </svg>
                              </button>
                              {isOrderStatusUpdateAllowed(
                                order.order_status
                              ) && (
                                  <button
                                    onClick={() => {
                                      setCancelOrderId(order._id);
                                      setCancelModalOpen(true);
                                      setCancelFormData({
                                        cancelReason: "",
                                        customReason: "",
                                      });
                                    }}
                                    className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 border border-red-200 hover:border-red-300"
                                    aria-label={`Cancel order ${order._id}`}
                                    title="Cancel Order"
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
                                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                      />
                                    </svg>
                                  </button>
                                )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filteredOrders.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 mt-4 lg:mt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to{" "}
              <span className="font-medium">
                {Math.min(endIndex, filteredOrders.length)}
              </span>{" "}
              of <span className="font-medium">{filteredOrders.length}</span>{" "}
              orders
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
                      className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${currentPage === page
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

      {/* Cancel Order Modal */}
      <CancelOrderModal
        isOpen={cancelModalOpen}
        onClose={() => {
          setCancelModalOpen(false);
          setCancelOrderId(null);
          setCancelFormData({ cancelReason: "", customReason: "" });
        }}
        orderId={cancelOrderId}
        onConfirm={async (reason) => {
          if (!cancelOrderId || !reason) {
            showToast("Please select a cancel reason", "error");
            return;
          }

          setLoading(true);
          setError("");

          try {
            const updateData = {
              order_status: "cancelled",
              cancelReason: reason,
            };

            const response = await Api.orders.update(cancelOrderId, updateData);

            // Update local orders state
            setOrders((prevOrders) =>
              prevOrders.map((order) =>
                order._id === cancelOrderId
                  ? { ...order, ...response.data }
                  : order
              )
            );

            setCancelModalOpen(false);
            setCancelOrderId(null);
            setCancelFormData({ cancelReason: "", customReason: "" });
            showToast("Order cancelled successfully!", "success");
          } catch (err) {
            setError(err.message || "Failed to cancel order");
            showToast(err.message || "Failed to cancel order", "error");
          } finally {
            setLoading(false);
          }
        }}
      />

      {/* Order Details Modal */}
      <OrderDetails
        order={selectedOrder}
        isOpen={showOrderDetails}
        onClose={handleCloseOrderDetails}
      />

      {/* Refund Proof Modal */}
      <RefundProofModal
        isOpen={showRefundProofModal}
        onClose={() => setShowRefundProofModal(false)}
        imageUrl={modalImageUrl}
      />
    </div>
  );
};

export default Orders;
