import RefundProofModal from "../RefundProofModal";
import CancelOrderModal from "./CancelOrderModal"; // Adjust path as needed
import OrderDetails from "./OrderDetails";
import UpdateOrderStatusModal from "../../components/UpdateOrderStatusModal";
import UploadRefundProofModal from "../../components/UploadRefundProofModal";
import DebugOrderModal from "../../components/DebugOrderModal";
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

// Format Order ID to show as #XXXXXX (last 6 characters uppercase)
function formatOrderId(orderId) {
  if (!orderId || typeof orderId !== "string") return "N/A";
  const last6 = orderId.slice(-6).toUpperCase();
  return "#" + last6;
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


const Orders = () => {
  const [showRefundProofModal, setShowRefundProofModal] = useState(false);
  const [modalImageUrl, setModalImageUrl] = useState("");
  const [showOrderDetails, setShowOrderDetails] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [autoOpenRefundModal, setAutoOpenRefundModal] = useState(false);

  const handleViewOrderDetails = (order, shouldAutoOpenRefund = false) => {
    setSelectedOrder(order);
    setAutoOpenRefundModal(shouldAutoOpenRefund);
    setShowOrderDetails(true);
  };

  const handleCloseOrderDetails = () => {
    setShowOrderDetails(false);
    setSelectedOrder(null);
    setAutoOpenRefundModal(false);
  };

  const { user, isAuthLoading } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [selectedOrderForUpdate, setSelectedOrderForUpdate] = useState(null);
  const [updateFormData, setUpdateFormData] = useState({
    order_status: "",
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState("");
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState(null);
  const [cancelFormData, setCancelFormData] = useState({
    cancelReason: "",
    customReason: "",
  });
  const [showRefundProofUploadModal, setShowRefundProofUploadModal] = useState(false);
  const [selectedOrderForRefund, setSelectedOrderForRefund] = useState(null);
  const [uploadingRefundProof, setUploadingRefundProof] = useState(false);
  const [refundError, setRefundError] = useState("");
  const [showDebugOrderModal, setShowDebugOrderModal] = useState(false);


  const [filters, setFilters] = useState({
    orderStatus: "",
    payStatus: "",
    paymentMethod: "",
    startDate: "",
    endDate: "",
    nameReceive: "",
    hasVoucher: "",
  });
  const [searchText, setSearchText] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);
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
  const isOrderStatusUpdateAllowed = (status, paymentMethod, payStatus) => {
    // VNPAY orders that are unpaid cannot be updated (only cancellation is allowed)
    if (paymentMethod === "VNPAY" && payStatus === "unpaid") {
      return false;
    }

    return (
      status === "pending" || status === "confirmed" || status === "shipping"
    );
  };

  // Check if refund status update is allowed (only for cancelled VNPAY paid orders that are not yet refunded)
  const isRefundStatusUpdateAllowed = (method, status, pay, refundStatus) => {
    return status === "cancelled" &&
      method === "VNPAY" &&
      pay === "paid" &&
      refundStatus !== "refunded";
  };

  const shouldDisableUpdate = (method, status, pay) => {
    // Check if order status update is not allowed
    if (!isOrderStatusUpdateAllowed(status, method, pay)) {
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
  const shouldDisableUpdateButton = (method, status, pay, refundStatus) => {
    // Allow refund management for cancelled VNPAY paid orders (not yet refunded)
    if (isRefundStatusUpdateAllowed(method, status, pay, refundStatus)) {
      return false;
    }

    // Disable for cancelled and delivered orders (except cancelled VNPAY paid not refunded)
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
      filters.nameReceive ||
      filters.hasVoucher ||
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

    // Filter by Name Receive
    if (filters.nameReceive) {
      const nameLower = filters.nameReceive.toLowerCase();
      filtered = filtered.filter(
        (order) =>
          (order.name && order.name.toLowerCase().includes(nameLower)) ||
          (order.acc_id?.name &&
            order.acc_id.name.toLowerCase().includes(nameLower)) ||
          (order.acc_id?.username &&
            order.acc_id.username.toLowerCase().includes(nameLower))
      );
    }

    // Filter by Voucher
    if (filters.hasVoucher) {
      if (filters.hasVoucher === "yes") {
        filtered = filtered.filter((order) => {
          // Check if order has voucher - check both voucher object and voucher_id
          return !!(order.voucher || order.voucher_id);
        });
      } else if (filters.hasVoucher === "no") {
        filtered = filtered.filter((order) => {
          // Check if order has no voucher
          return !order.voucher && !order.voucher_id;
        });
      }
    }

    // Filter by search text (Phone, Address)
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      filtered = filtered.filter(
        (order) =>
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
        if (!isOrderStatusUpdateAllowed(originalOrder.order_status, originalOrder.payment_method, originalOrder.pay_status)) {
          showToast(
            "Order status cannot be updated for cancelled or delivered orders, or VNPAY unpaid orders",
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
        showToast("Order edited successfully", "success");
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
      nameReceive: "",
      hasVoucher: "",
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
      const token = localStorage.getItem("token");
      socketRef.current = io(
        import.meta.env.VITE_API_URL || "http://localhost:5000",
        {
          transports: ["websocket", "polling"],
          auth: { token },
          withCredentials: true,
        }
      );
    }

    const socket = socketRef.current;

    // Connect and authenticate
    socket.on("connect", () => {
      console.log("✅ Dashboard Orders Socket connected:", socket.id);
      // Emit user connection
      socket.emit("userConnected", user._id);
      // Also authenticate with token
      const token = localStorage.getItem("token");
      if (token) {
        socket.emit("authenticate", token);
      }
    });

    // Updated handler: receive full order object from backend
    socket.on("orderUpdated", (payload) => {
      const updatedOrder = payload.order || payload; // backend sends { userId, order }

      console.log("📦 Order updated via Socket.IO in dashboard:", updatedOrder._id);

      setOrders((prevOrders) => {
        const existingIndex = prevOrders.findIndex((o) => o._id === updatedOrder._id);

        if (existingIndex !== -1) {
          // Update existing order
          const updated = [...prevOrders];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...updatedOrder,
          };
          // Re-sort by orderDate
          return updated.sort(
            (a, b) => new Date(b.orderDate) - new Date(a.orderDate)
          );
        } else {
          // New order - add to beginning
          return [
            updatedOrder,
            ...prevOrders,
          ].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
        }
      });

      // Also update filteredOrders immediately so UI reflects change without re-filter
      setFilteredOrders((prevFiltered) => {
        const existingIndex = prevFiltered.findIndex((o) => o._id === updatedOrder._id);

        if (existingIndex !== -1) {
          const updated = [...prevFiltered];
          updated[existingIndex] = {
            ...updated[existingIndex],
            ...updatedOrder,
          };
          return updated.sort(
            (a, b) => new Date(b.orderDate) - new Date(a.orderDate)
          );
        } else {
          return [
            updatedOrder,
            ...prevFiltered,
          ].sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));
        }
      });

      // Show toast notification for order updates
      showToast(`Order ${updatedOrder._id.slice(-8)} status updated`, "success");
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Dashboard Orders Socket connection error:", err.message);
    });

    socket.on("disconnect", (reason) => {
      console.warn("⚠️ Dashboard Orders Socket disconnected:", reason);
    });

    return () => {
      socket.off("connect");
      socket.off("orderUpdated");
      socket.off("connect_error");
      socket.off("disconnect");
      if (socket.connected) {
        socket.disconnect();
      }
      socketRef.current = null;
    };
  }, [user, showToast]);

  const totalPages = Math.ceil(filteredOrders.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentOrders = filteredOrders.slice(startIndex, endIndex);

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

  const handlePageChange = useCallback((page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  }, [totalPages]);

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

  const handleEditChange = useCallback((field, value) => {
    setEditFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Handle opening update modal
  const handleOpenUpdateModal = (order) => {
    // Check if refund management is allowed
    if (
      isRefundStatusUpdateAllowed(
        order.payment_method,
        order.order_status,
        order.pay_status,
        order.refund_status
      )
    ) {
      // Open OrderDetails modal and auto-open refund modal
      handleViewOrderDetails(order, true);
      return;
    }

    // Check if order status update is allowed
    if (
      !isOrderStatusUpdateAllowed(
        order.order_status,
        order.payment_method,
        order.pay_status
      )
    ) {
      showToast(
        "Order status cannot be updated for cancelled or delivered orders, or VNPAY unpaid orders",
        "error"
      );
      return;
    }

    setSelectedOrderForUpdate(order);
    setUpdateFormData({
      order_status: order.order_status || "",
    });
    setUpdateError("");
    setShowUpdateModal(true);
  };

  // Handle closing update modal
  const handleCloseUpdateModal = () => {
    setShowUpdateModal(false);
    setSelectedOrderForUpdate(null);
    setUpdateFormData({ order_status: "" });
    setUpdateError("");
  };

  // Handle closing refund proof upload modal
  const handleCloseRefundProofUploadModal = () => {
    setShowRefundProofUploadModal(false);
    setSelectedOrderForRefund(null);
    setRefundError("");
  };

  // Handle refund proof upload
  const handleRefundProofUpload = async (refundProofUrl) => {
    if (!selectedOrderForRefund?._id) return;

    // Check if refund status update is allowed (only for VNPAY + paid + cancelled orders)
    if (
      !isRefundStatusUpdateAllowed(
        selectedOrderForRefund.payment_method,
        selectedOrderForRefund.order_status,
        selectedOrderForRefund.pay_status,
        selectedOrderForRefund.refund_status
      )
    ) {
      showToast("Refund can only be updated for cancelled VNPAY paid orders", "error");
      throw new Error("Refund can only be updated for cancelled VNPAY paid orders");
    }

    // Validate refund proof is required
    if (!refundProofUrl) {
      showToast("Refund proof is required", "error");
      throw new Error("Refund proof is required");
    }

    setUploadingRefundProof(true);
    setRefundError("");

    try {
      // Update refund data - only refund_proof
      // Don't send order_status, pay_status, or cancelReason to avoid validation errors
      const updateData = {};

      // Always update proof if we have a URL
      if (refundProofUrl) {
        updateData.refund_proof = refundProofUrl;

        // When proof is uploaded successfully, automatically set refund_status to "refunded"
        // Only if not already refunded and a new proof was uploaded
        const isRefunded = selectedOrderForRefund.refund_status === 'refunded';
        if (!isRefunded && refundProofUrl !== selectedOrderForRefund?.refund_proof) {
          updateData.refund_status = "refunded";
        }
      }

      const response = await Api.orders.update(selectedOrderForRefund._id, updateData);
      console.log("Refund Update Response:", response);

      // Update local orders state
      const updatedData = response?.data || response;
      setOrders((prevOrders) =>
        prevOrders.map((order) =>
          order._id === selectedOrderForRefund._id
            ? { ...order, ...updatedData }
            : order
        )
      );

      // Close modal
      handleCloseRefundProofUploadModal();

      // Show success message
      showToast("Refund proof uploaded successfully", "success");
    } catch (err) {
      // Handle order update errors
      console.error("Refund Update Error:", err);

      let errorMessage = "Failed to update refund status";

      // Extract error message from response
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err?.message) {
        errorMessage = err.message;
      }

      // Check for network errors
      if (err.code === 'ERR_NETWORK' || err.message?.includes('Network Error') || !err.response) {
        errorMessage = "Failed to upload refund proof. Please try again later.";
      } else if (err?.response?.status === 500) {
        errorMessage = "Failed to upload refund proof. Server error - please try again later";
      }

      setRefundError(errorMessage);
      throw err; // Re-throw to be handled by modal
    } finally {
      setUploadingRefundProof(false);
    }
  };

  // Handle update from modal
  const handleUpdateFromModal = async () => {
    if (!selectedOrderForUpdate?._id) return;

    // Check if order status update is allowed
    if (
      !isOrderStatusUpdateAllowed(
        selectedOrderForUpdate.order_status,
        selectedOrderForUpdate.payment_method,
        selectedOrderForUpdate.pay_status
      )
    ) {
      showToast(
        "Order status cannot be updated for cancelled or delivered orders, or VNPAY unpaid orders",
        "error"
      );
      return;
    }

    // Validate order_status is provided
    if (!updateFormData.order_status || updateFormData.order_status.trim() === "") {
      showToast("Please select an order status", "error");
      setUpdateError("Order status is required");
      return;
    }

    // Check if there are any changes
    const currentStatus = selectedOrderForUpdate.order_status;
    const newStatus = updateFormData.order_status;

    if (currentStatus === newStatus) {
      showToast("No changes detected", "info");
      handleCloseUpdateModal();
      return;
    }

    // Validate order status transition
    const allowedTransitions = {
      pending: ["confirmed", "cancelled"],
      confirmed: ["shipping", "cancelled"],
      shipping: ["delivered", "cancelled"],
      delivered: [],
      cancelled: [],
    };

    if (
      !allowedTransitions[currentStatus] ||
      !allowedTransitions[currentStatus].includes(newStatus)
    ) {
      showToast(
        `Invalid status transition: ${currentStatus} → ${newStatus}. Please follow the workflow: Pending → Confirmed → Shipping → Delivered`,
        "error"
      );
      setUpdateError(`Invalid status transition: ${currentStatus} → ${newStatus}`);
      return;
    }

    setIsUpdating(true);
    setUpdateError("");
    try {
      // Prepare update data
      const updateData = { order_status: updateFormData.order_status };

      // For VNPAY orders, if not cancelling, ensure pay_status remains paid
      if (
        selectedOrderForUpdate.payment_method === "VNPAY" &&
        updateFormData.order_status !== "cancelled"
      ) {
        // Keep the current pay_status (should be "paid" for VNPAY)
        if (selectedOrderForUpdate.pay_status) {
          updateData.pay_status = selectedOrderForUpdate.pay_status;
        }
      }

      const response = await Api.orders.update(selectedOrderForUpdate._id, updateData);

      // Update local state
      const updatedData = response?.data || response;
      setOrders((prev) =>
        prev.map((order) =>
          order._id === selectedOrderForUpdate._id
            ? { ...order, ...updatedData }
            : order
        )
      );

      // Close modal
      handleCloseUpdateModal();

      // Show success message
      showToast("Order edited successfully", "success");
    } catch (err) {
      // Extract error message from response
      let errorMessage = "Failed to update order";
      
      if (err?.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (!err.response) {
        errorMessage = "Failed to update order. Please try again later.";
      }
      
      showToast(errorMessage, "error");
      setUpdateError(errorMessage);
      if (err?.response?.data) {
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateFormChange = (field, value) => {
    setUpdateFormData((prev) => ({ ...prev, [field]: value }));
  };

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
    <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">
            Order Management
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
          <div className="bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 backdrop-blur-md px-2 lg:px-4 py-1 lg:py-2 rounded-xl border-2 border-yellow-400/50 shadow-md">
            <span className="text-xs lg:text-sm font-semibold text-gray-700">
              {filteredOrders.length} order
              {filteredOrders.length !== 1 ? "s" : ""}
            </span>
          </div>
          {/* {(user?.role === "admin" || user?.role === "manager") && (
            <button
              className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 transform hover:scale-105"
              onClick={() => setShowDebugOrderModal(true)}
              aria-label="Generate debug orders"
              title="Generate random orders for testing (Debug feature)"
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
                  d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                />
              </svg>
              <span className="font-medium hidden sm:inline">Debug Orders</span>
              <span className="font-medium sm:hidden">Debug</span>
            </button>
          )} */}
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
          <div className="mb-3 lg:mb-4">
            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
              Name Receive
            </label>
            <input
              type="text"
              placeholder="Search by recipient name...."
              value={filters.nameReceive}
              onChange={(e) =>
                handleFilterChange("nameReceive", e.target.value)
              }
              className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
            />
          </div>
          <div className="flex flex-wrap items-end gap-3 lg:gap-4">
            {/* Order Status */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Order Status
              </label>
              <select
                value={filters.orderStatus}
                onChange={(e) =>
                  handleFilterChange("orderStatus", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
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
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Payment Status
              </label>
              <select
                value={filters.payStatus}
                onChange={(e) =>
                  handleFilterChange("payStatus", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
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
            <div className="flex-1 min-w-[120px]">
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Method
              </label>
              <select
                value={filters.paymentMethod}
                onChange={(e) =>
                  handleFilterChange("paymentMethod", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              >
                <option value="">All Methods</option>
                <option value="COD">COD</option>
                <option value="VNPAY">VNPAY</option>
              </select>
            </div>

            {/* Voucher */}
            <div className="flex-1 min-w-[150px]">
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                Voucher
              </label>
              <select
                value={filters.hasVoucher}
                onChange={(e) =>
                  handleFilterChange("hasVoucher", e.target.value)
                }
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              >
                <option value="">All</option>
                <option value="yes">Has Voucher</option>
                <option value="no">No Voucher</option>
              </select>
            </div>

            {/* Start Date */}
            <div className="flex-1 min-w-[150px]">
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

            {/* End Date */}
            <div className="flex-1 min-w-[150px]">
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
          </div>
        </div>
      )}
      {/* Unified State: Loading / Empty / Error */}
      {
        loading || filteredOrders.length === 0 || error ? (
          <div
            className="backdrop-blur-xl rounded-xl border p-6"
            style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}
            role="status"
          >
            <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
              {/* ── LOADING ── */}
              {loading ? (
                <>
                  <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#FCEFCB', borderTopColor: '#E9A319' }}></div>
                  <p className="text-gray-600 font-medium">
                    Loading orders...
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
                    onClick={fetchOrders}
                    className="px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
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
                        d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                      />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-medium text-gray-900">No orders available</h3>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          /* Orders Table - Only when data exists */
          <div className="backdrop-blur-xl rounded-xl border overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
            <div className="overflow-x-auto">
              <table className="w-full table-fixed min-w-[1200px]">
                {/* ---------- HEADER ---------- */}
                <thead className="backdrop-blur-sm border-b" style={{ borderColor: '#A86523' }}>
                  <tr>
                    <th className="w-[4%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      #
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Order ID
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Create Date
                    </th>
                    <th className="w-[16%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Recipient Name
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Final
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Status
                    </th>
                    <th className="w-[9%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Method
                    </th>
                    <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Payment
                    </th>
                    <th className="w-[15%] px-2 lg:px-4 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {currentOrders.map((order, index) => (
                    <React.Fragment key={order._id}>
                      <tr
                        className={`hover:bg-gradient-to-r hover:from-yellow-50/50 hover:via-amber-50/50 hover:to-orange-50/50 transition-all duration-300 border-b-2 border-gray-200/40`}
                      >
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
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                          {formatDateVN(order.orderDate)}
                        </td>
                        <td className="px-2 lg:px-4 py-3">
                          <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                            {order.name ||
                              order.acc_id?.name ||
                              order.acc_id?.username ||
                              "Guest"}
                          </div>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm font-medium text-gray-900">
                          {formatPrice(order.finalPrice || order.totalPrice)}
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm ${order.order_status === "pending"
                              ? "bg-yellow-100 text-yellow-800"
                              : order.order_status === "confirmed"
                                ? "bg-blue-100 text-blue-800"
                                : order.order_status === "shipping"
                                  ? "bg-purple-100 text-purple-800"
                                  : order.order_status === "delivered"
                                    ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                                    : order.order_status === "cancelled"
                                      ? "bg-red-600 text-white"
                                      : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {displayStatus(order.order_status)}
                          </span>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm ${order.payment_method === "COD"
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
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm ${order.pay_status === "paid"
                              ? "bg-gradient-to-r from-green-400 to-emerald-500 text-white"
                              : order.pay_status === "unpaid"
                                ? "bg-red-600 text-white"
                                : "bg-gray-100 text-gray-800"
                              }`}
                          >
                            {displayStatus(order.pay_status)}
                          </span>
                        </td>
                        <td className="px-2 lg:px-4 py-3">
                          <div className="flex justify-center items-center space-x-1">
                            <button
                              onClick={() => handleViewOrderDetails(order)}
                              className="p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm"
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
                              onClick={() => handleOpenUpdateModal(order)}
                              disabled={shouldDisableUpdateButton(
                                order.payment_method,
                                order.order_status,
                                order.pay_status,
                                order.refund_status
                              )}
                              className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${shouldDisableUpdateButton(
                                order.payment_method,
                                order.order_status,
                                order.pay_status,
                                order.refund_status
                              )
                                ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                : isRefundStatusUpdateAllowed(
                                  order.payment_method,
                                  order.order_status,
                                  order.pay_status,
                                  order.refund_status
                                )
                                  ? 'border-orange-400/60 bg-gradient-to-br from-orange-100/80 via-amber-100/80 to-yellow-100/80 hover:from-orange-200 hover:via-amber-200 hover:to-yellow-200 text-orange-700 hover:text-orange-800 backdrop-blur-sm'
                                  : 'border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm'
                                }`}
                              aria-label={`${isRefundStatusUpdateAllowed(
                                order.payment_method,
                                order.order_status,
                                order.pay_status,
                                order.refund_status
                              )
                                ? "Process refund"
                                : "Edit order"
                                } ${order._id}`}
                              title={
                                isRefundStatusUpdateAllowed(
                                  order.payment_method,
                                  order.order_status,
                                  order.pay_status,
                                  order.refund_status
                                )
                                  ? "Process Refund"
                                  : !isOrderStatusUpdateAllowed(
                                    order.order_status,
                                    order.payment_method,
                                    order.pay_status
                                  )
                                    ? "Order status cannot be updated for cancelled or delivered orders, or VNPAY unpaid orders"
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
                                  order.pay_status,
                                  order.refund_status
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
                            <button
                              onClick={() => {
                                if (order.order_status !== "pending") return;
                                setCancelOrderId(order._id);
                                setCancelModalOpen(true);
                                setCancelFormData({
                                  cancelReason: "",
                                  customReason: "",
                                });
                              }}
                              disabled={order.order_status !== "pending"}
                              className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${order.order_status === "pending"
                                ? 'text-white bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700'
                                : 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                }`}
                              aria-label={`Cancel order ${order._id}`}
                              title={order.order_status === "pending" ? "Cancel Order" : "Cancel only available for pending orders"}
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
      {
        filteredOrders.length > 0 && (
          <div className="backdrop-blur-xl rounded-xl border p-4 lg:p-6 mt-4 lg:mt-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
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
            showToast("Order cancelled successfully", "success");
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
        autoOpenRefundModal={autoOpenRefundModal}
      />

      {/* Refund Proof Modal */}
      <RefundProofModal
        isOpen={showRefundProofModal}
        onClose={() => setShowRefundProofModal(false)}
        imageUrl={modalImageUrl}
      />

      {/* Update Status Modal */}
      <UpdateOrderStatusModal
        isOpen={showUpdateModal && !!selectedOrderForUpdate}
        onClose={handleCloseUpdateModal}
        order={selectedOrderForUpdate}
        updateFormData={updateFormData}
        onFormChange={handleUpdateFormChange}
        onUpdate={handleUpdateFromModal}
        isUpdating={isUpdating}
        error={updateError}
      />

      {/* Upload Refund Proof Modal */}
      <UploadRefundProofModal
        isOpen={showRefundProofUploadModal && !!selectedOrderForRefund}
        onClose={handleCloseRefundProofUploadModal}
        currentProof={selectedOrderForRefund?.refund_proof}
        onUpload={handleRefundProofUpload}
        isUploading={uploadingRefundProof}
        error={refundError}
        onImageClick={(imageUrl, alt) => {
          setModalImageUrl(imageUrl);
          setShowRefundProofModal(true);
        }}
      />

      {/* Debug Order Modal */}
      <DebugOrderModal
        isOpen={showDebugOrderModal}
        onClose={() => setShowDebugOrderModal(false)}
        onOrdersGenerated={() => {
          fetchOrders();
          setShowDebugOrderModal(false);
        }}
      />
    </div>
  );
};

export default Orders;
