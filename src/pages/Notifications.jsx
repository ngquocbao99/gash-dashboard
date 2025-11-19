import React, { useState, useEffect, useRef, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlus,
  FiTrash2,
  FiSend,
  FiEdit2,
  FiX,
  FiFileText,
} from "react-icons/fi";
import { io } from "socket.io-client"; // 🧩 SOCKET ADDED
import Loading from "../components/Loading";
import DeleteConfirmModal from "../components/DeleteConfirmModal";

export default function Notifications() {
  const [tab, setTab] = useState("notifications");
  const [notifications, setNotifications] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [showFilters, setShowFilters] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showEditTemplate, setShowEditTemplate] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);

  const [filterType, setFilterType] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Infinite scroll state
  const [displayedItems, setDisplayedItems] = useState(10); // Number of items to display initially
  const itemsPerLoad = 10; // Number of items to load each time
  const scrollContainerRef = useRef(null);

  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    recipient: "all",
    userId: "",
    // selectedUsers will be stored separately in stateSelectedUsers
  });

  const [newTemplate, setNewTemplate] = useState({
    name: "",
    title: "",
    message: "",
  });

  const [editingTemplate, setEditingTemplate] = useState(null);

  // ===== Select Users Modal state =====
  const [showSelectUsersModal, setShowSelectUsersModal] = useState(false);
  const [users, setUsers] = useState([]); // accounts list
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]); // array of user _id
  const [selectAll, setSelectAll] = useState(false);
  const [searchUser, setSearchUser] = useState("");
  const [notificationToDelete, setNotificationToDelete] = useState(null);
  const [notificationDeleteMessage, setNotificationDeleteMessage] = useState("");
  const [showNotificationConfirm, setShowNotificationConfirm] = useState(false);
  const [notificationDeleteLoading, setNotificationDeleteLoading] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [showTemplateConfirm, setShowTemplateConfirm] = useState(false);
  const [templateDeleteLoading, setTemplateDeleteLoading] = useState(false);

  // 🧩 SOCKET ADDED — kết nối realtime admin (1 lần)
  const [socket, setSocket] = useState(null);
  useEffect(() => {
    try {
      const baseURL = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "");
      const s = io(baseURL, {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        withCredentials: true,
      });
      setSocket(s);

      s.on("connect", () => console.log("🔌 Admin socket connected:", s.id));
      s.on("connect_error", (err) => console.warn("⚠️ Admin socket connect_error:", err.message));
      s.on("disconnect", (reason) => console.warn("⚠️ Admin socket disconnected:", reason));

      return () => {
        if (s && s.disconnect) s.disconnect();
      };
    } catch (err) {
      console.error("❌ Failed to init admin socket:", err);
    }
  }, []);

  // ===== FETCH =====
  useEffect(() => {
    fetchNotifications();
    fetchTemplates();
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoadingList(true);
      const res = await axios.get("http://localhost:5000/notifications/admin/all");
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setNotifications([]);
    } finally {
      setLoadingList(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get("http://localhost:5000/notifications/admin/templates");
      setTemplates(res.data || []);
    } catch (err) {
      console.error("Failed to load templates:", err);
      setTemplates([]);
    }
  };

  // ===== FETCH ACCOUNTS (for Select Users modal) =====
  const fetchAccountsForSelect = async () => {
    try {
      setUsersLoading(true);
      setUsersError("");
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/accounts", {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      // Expecting array of accounts
      const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.data) ? res.data.data : [];
      setUsers(data);
      // If previously selected ids exist, keep them selected (if still present)
      if (selectedUsers.length > 0) {
        const existingSelected = data.filter((u) => selectedUsers.includes(u._id)).map((u) => u._id);
        setSelectedUsers(existingSelected);
        setSelectAll(existingSelected.length === data.length && data.length > 0);
      } else {
        setSelectAll(false);
      }
    } catch (err) {
      console.error("Failed to load accounts:", err);
      setUsers([]);
      setUsersError("Failed to load accounts. Check your token and network.");
      setSelectAll(false);
    } finally {
      setUsersLoading(false);
    }
  };

  // ===== CREATE NOTIFICATION =====
  const handleSendNotification = async () => {
    if (!newNotification.title || !newNotification.message)
      return alert("Please enter both title and message.");

    try {
      setSending(true);
      const payload = {
        title: newNotification.title,
        message: newNotification.message,
        type: "system",
      };

      if (newNotification.recipient === "all") {
        payload.recipientType = "all";
      } else if (newNotification.recipient === "single") {
        payload.recipientType = "specific";
        // for single we accept userId string in userId field
        if (!newNotification.userId || newNotification.userId.trim() === "") {
          alert("Please enter the user ID for single recipient.");
          setSending(false);
          return;
        }
        payload.userId = newNotification.userId.trim();
      } else if (newNotification.recipient === "multiple") {
        payload.recipientType = "multiple";
        payload.userIds = newNotification.userId
          .split(",")
          .map((u) => u.trim())
          .filter((u) => u);
        if (!payload.userIds.length) {
          alert("Please enter at least one user ID for multiple recipients.");
          setSending(false);
          return;
        }
      } else if (newNotification.recipient === "specific") {
  // admin chọn nhiều user => gửi kiểu "multiple"
  payload.recipientType = "multiple";
  payload.userIds = selectedUsers.slice(); // array of _id
  if (!payload.userIds || payload.userIds.length === 0) {
    alert("Please select at least one user.");
    setSending(false);
    return;
  }
}


      const res = await axios.post("http://localhost:5000/notifications/admin/create", payload);
      alert("✅ Notification sent successfully!");
      setNewNotification({ title: "", message: "", recipient: "all", userId: "" });
      // reset selections
      setSelectedUsers([]);
      setSelectAll(false);
      fetchNotifications();

      // 🧩 SOCKET EMIT
      try {
        if (socket && socket.connected) {
          socket.emit("adminSentNotification", res.data);
          console.log("📡 adminSentNotification emitted:", res.data);
        } else {
          console.warn("⚠️ Admin socket not connected — cannot emit realtime");
        }
      } catch (emitErr) {
        console.error("❌ Error emitting adminSentNotification:", emitErr);
      }
    } catch (err) {
      console.error(err);
      alert("❌ Failed to send notification.");
    } finally {
      setSending(false);
    }
  };

  // ===== DELETE NOTIFICATION =====
  const handleDeleteNotification = (notification) => {
    if (!notification) return;
    const deleteCount = notification.notificationIds?.length || 1;
    const message = deleteCount > 1
      ? `Delete this notification group (${deleteCount} notifications)?`
      : "Delete this notification?";
    setNotificationToDelete(notification);
    setNotificationDeleteMessage(message);
    setShowNotificationConfirm(true);
  };

  const confirmDeleteNotification = useCallback(async () => {
    if (!notificationToDelete) return;
    setNotificationDeleteLoading(true);
    try {
      const idsToDelete = notificationToDelete.notificationIds || [notificationToDelete._id];
      await Promise.all(
        idsToDelete.map(id => axios.delete(`http://localhost:5000/notifications/admin/${id}`))
      );

      try {
        if (socket && socket.connected) {
          idsToDelete.forEach(id => {
            socket.emit("adminDeletedNotification", { notificationId: id });
          });
          console.log("📡 adminDeletedNotification emitted for", idsToDelete.length, "notification(s)");
        } else {
          console.warn("⚠️ Admin socket not connected — cannot emit realtime deletion");
        }
      } catch (emitErr) {
        console.error("❌ Error emitting adminDeletedNotification:", emitErr);
      }

      fetchNotifications();
      setShowNotificationConfirm(false);
      setNotificationToDelete(null);
      setNotificationDeleteMessage("");
    } catch (err) {
      console.error(err);
      alert("Failed to delete notification(s).");
    } finally {
      setNotificationDeleteLoading(false);
    }
  }, [notificationToDelete, socket, fetchNotifications]);

  const cancelDeleteNotification = () => {
    if (notificationDeleteLoading) return;
    setShowNotificationConfirm(false);
    setNotificationToDelete(null);
    setNotificationDeleteMessage("");
  };

  // ===== TEMPLATE =====
  const applyTemplateToForm = (template) => {
      setNewNotification({
        title: template.title || "",
        message: template.message || "",
      recipient: "all",
        userId: "",
      });
    // Reset selected users when applying template
    setSelectedUsers([]);
    setSelectAll(false);
  };

  const handleEditTemplate = (template) => {
    setEditingTemplate({ ...template });
    setShowEditTemplate(true);
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;
    try {
      await axios.patch(
        `http://localhost:5000/notifications/admin/templates/${editingTemplate._id}`,
        {
          name: editingTemplate.name,
          title: editingTemplate.title,
          message: editingTemplate.message,
          type: editingTemplate.type || "system",
        }
      );
      alert("✅ Template updated!");
      setShowEditTemplate(false);
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to update template.");
    }
  };

  const handleDeleteTemplate = (template) => {
    if (!template) return;
    setTemplateToDelete(template);
    setShowTemplateConfirm(true);
  };

  const confirmDeleteTemplate = useCallback(async () => {
    if (!templateToDelete) return;
    setTemplateDeleteLoading(true);
    try {
      await axios.delete(`http://localhost:5000/notifications/admin/templates/${templateToDelete._id}`);
      fetchTemplates();
      setShowTemplateConfirm(false);
      setTemplateToDelete(null);
    } catch (err) {
      console.error(err);
      alert("Failed to delete template.");
    } finally {
      setTemplateDeleteLoading(false);
    }
  }, [templateToDelete, fetchTemplates]);

  const cancelDeleteTemplate = () => {
    if (templateDeleteLoading) return;
    setShowTemplateConfirm(false);
    setTemplateToDelete(null);
  };

  const handleCreateTemplate = async () => {
    if (!newTemplate.name || !newTemplate.title || !newTemplate.message)
      return alert("Please fill all fields.");
    try {
      setSavingTemplate(true);
      await axios.post("http://localhost:5000/notifications/admin/templates", {
        name: newTemplate.name,
        title: newTemplate.title,
        message: newTemplate.message,
        type: "system",
      });
      alert("✅ Template created successfully!");
      setShowCreateTemplate(false);
      setNewTemplate({ name: "", title: "", message: "" });
      fetchTemplates();
    } catch (err) {
      console.error(err);
      alert("❌ Failed to create template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  // ===== Select Users modal helpers =====
  const toggleUserSelection = (userId) => {
    setSelectedUsers((prev) => {
      if (prev.includes(userId)) {
        return prev.filter((id) => id !== userId);
      } else {
        return [...prev, userId];
      }
    });
  };

  useEffect(() => {
    // update selectAll when selectedUsers or users changes
    if (!users || users.length === 0) {
      setSelectAll(false);
      return;
    }
    setSelectAll(selectedUsers.length === users.length && users.length > 0);
  }, [selectedUsers, users]);

  const handleToggleSelectAll = () => {
    if (selectAll) {
      setSelectedUsers([]);
      setSelectAll(false);
    } else {
      const allIds = users.map((u) => u._id);
      setSelectedUsers(allIds);
      setSelectAll(true);
    }
  };

  const openSelectUsersModal = () => {
    setShowSelectUsersModal(true);
    // fetch accounts when opening
    fetchAccountsForSelect();
  };

  const closeSelectUsersModal = () => {
    setShowSelectUsersModal(false);
  };

  const confirmSelectUsers = () => {
    // copy selectedUsers into newNotification as well if needed
    // but we keep selectedUsers state as source of truth
    setShowSelectUsersModal(false);
  };

  // ===== FILTER + GROUP =====
  // Group notifications by title + message + createdAt (rounded to nearest second) to show as single items
  const groupedNotifications = notifications.reduce((acc, n) => {
    // Round createdAt to nearest second for grouping
    const createdAtRound = new Date(n.createdAt);
    createdAtRound.setMilliseconds(0);
    const groupKey = `${n.title}|${n.message}|${createdAtRound.getTime()}`;
    
    if (!acc.has(groupKey)) {
      // Store the notification with recipient count and all IDs in the group
      acc.set(groupKey, {
        ...n,
        recipientCount: 1,
        recipients: n.userId ? [n.userId] : [],
        notificationIds: [n._id], // Track all notification IDs in this group
        isAllUsers: !n.userId // Track if this is sent to all users
      });
    } else {
      // Increment recipient count and collect recipients
      const existing = acc.get(groupKey);
      existing.recipientCount += 1;
      existing.notificationIds.push(n._id); // Add this notification ID to the group
      if (n.userId) {
        // Avoid duplicate recipients
        const recipientId = typeof n.userId === 'object' ? n.userId._id : n.userId;
        if (!existing.recipients.find(r => {
          const rId = typeof r === 'object' ? r._id : r;
          return rId === recipientId;
        })) {
          existing.recipients.push(n.userId);
        }
      } else {
        existing.isAllUsers = true;
      }
    }
    return acc;
  }, new Map());

  const uniqueNotifications = Array.from(groupedNotifications.values());

  const filtered = uniqueNotifications.filter((n) => {
    const matchType = filterType ? n.type === filterType : true;
    const matchKeyword = searchKeyword
      ? n.title.toLowerCase().includes(searchKeyword.toLowerCase())
      : true;
    return matchType && matchKeyword;
  });

  // Check if any filters are active
  const hasActiveFilters = () => {
    return searchKeyword || filterType !== '';
  };

  // Clear all filters
  const clearFilters = () => {
    setFilterType("");
    setSearchKeyword("");
    setDisplayedItems(10); // Reset to initial display count
  };

  // Toggle filters
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Get items to display (infinite scroll)
  const currentItems = filtered.slice(0, displayedItems);

  // Infinite scroll handler
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer || displayedItems >= filtered.length) return;

    let isLoading = false;

    const handleScroll = () => {
      if (isLoading || displayedItems >= filtered.length) return;

      const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
      // Load more when user is within 100px of bottom
      if (scrollHeight - scrollTop - clientHeight < 100) {
        isLoading = true;
        setDisplayedItems(prev => {
          const next = Math.min(prev + itemsPerLoad, filtered.length);
          // Reset loading flag after state update
          setTimeout(() => {
            isLoading = false;
          }, 100);
          return next;
        });
      }
    };

    scrollContainer.addEventListener('scroll', handleScroll);
    return () => {
      if (scrollContainer) {
        scrollContainer.removeEventListener('scroll', handleScroll);
      }
    };
  }, [displayedItems, filtered.length, itemsPerLoad]);

  // Reset displayed items when filters change
  useEffect(() => {
    setDisplayedItems(10);
  }, [filterType, searchKeyword]);


  // ===== UI =====
  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">
            Notification Management
          </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
          <div className="bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 backdrop-blur-md px-2 lg:px-4 py-1 lg:py-2 rounded-xl border-2 border-yellow-400/50 shadow-md">
            <span className="text-xs lg:text-sm font-semibold text-gray-700">
              {filtered.length} notification{filtered.length !== 1 ? "s" : ""}
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
            <span className="font-medium hidden sm:inline">{showFilters ? "Hide Filters" : "Show Filters"}</span>
            <span className="font-medium sm:hidden">Filters</span>
          </button>
          <button
            className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
            onClick={() => setShowCreateTemplate(true)}
          >
            <FiFileText />
            <span className="font-medium">Create Template</span>
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
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search by title...</label>
              <input
                type="text"
                placeholder="Search by title..."
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                value={searchKeyword}
                onChange={(e) => {
                  setSearchKeyword(e.target.value);
                  setDisplayedItems(10); // Reset to initial display count
                }}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 lg:gap-4">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setDisplayedItems(10); // Reset to initial display count
                  }}
                >
                  <option value="">All Types</option>
                  <option value="system">System</option>
                  <option value="order">Order</option>
                  <option value="promotion">Promotion</option>
                </select>
              </div>
            </div>
          </div>
        )}

      <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
        {/* LEFT: Notification List */}
        <div className="lg:w-1/3 backdrop-blur-xl rounded-xl border overflow-hidden flex flex-col" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
          <div className="backdrop-blur-sm border-b px-4 lg:px-6 py-3 lg:py-4 flex justify-between items-center" style={{ borderColor: '#A86523' }}>
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800">
              Sent Notifications
            </h2>
          </div>

          {loadingList ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <Loading
              type="page"
              size="medium"
              message="Loading notifications..."
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
              <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                  />
                </svg>
              </div>
              <div className="text-center">
                <h3 className="text-base font-medium text-gray-900">No notifications found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {notifications.length === 0
                    ? "Get started by creating your first notification"
                    : "Try adjusting your search or filter criteria"}
                </p>
              </div>
            </div>
          </div>
          ) : (
          <ul ref={scrollContainerRef} className="notification-list-container divide-y divide-gray-100 flex-1 overflow-y-auto" style={{ maxHeight: '600px' }}>
            {currentItems.map((n) => (
              <li
                key={n._id}
                className="flex items-start justify-between px-4 lg:px-6 py-3 lg:py-4 hover:bg-gradient-to-r hover:from-yellow-50/50 hover:via-amber-50/50 hover:to-orange-50/50 transition-all duration-300 border-b-2 border-gray-200/40"
              >
                {/* Left side */}
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-gray-900">{n.title}</h3>
                      <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full capitalize">
                        {n.type || "system"}
                      </span>
                    </div>
                  <p className="text-gray-600 text-sm line-clamp-1 mt-1">{n.message}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      To:{" "}
                      {n.isAllUsers || (!n.userId && !n.recipients?.length)
                        ? "All Users"
                        : n.recipientCount > 1
                        ? `${n.recipientCount} users`
                        : n.recipients?.[0]
                        ? (typeof n.recipients[0] === 'object' 
                            ? n.recipients[0].fullName || n.recipients[0].username || n.recipients[0].email || "Unknown"
                            : "User")
                        : n.userId
                        ? (typeof n.userId === 'object'
                            ? n.userId.fullName || n.userId.username || n.userId.email || "Unknown"
                            : "User")
                        : "Unknown"}
                    </p>
                </div>

                {/* Right side (time + delete) */}
                <div className="flex flex-col items-end text-right gap-2 ml-4">
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {new Date(n.createdAt).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() => handleDeleteNotification(n)}
                    className="p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 text-white bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
                    title={n.notificationIds?.length > 1 ? `Delete notification group (${n.notificationIds.length} notifications)` : "Delete notification"}
                  >
                    <FiTrash2 className="w-3 h-3 lg:w-4 lg:h-4" />
                  </button>
                </div>
              </li>
            ))}
            {displayedItems < filtered.length && (
              <li className="px-4 lg:px-6 py-4 text-center">
                <Loading
                  type="default"
                  size="small"
                  message="Loading more notifications..."
                />
              </li>
          )}
        </ul>
        )}
        </div>

        {/* RIGHT: Create Notification Form */}
        <div className="lg:w-2/3 backdrop-blur-xl rounded-xl border overflow-hidden flex flex-col" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
          <div className="backdrop-blur-sm border-b px-4 lg:px-6 py-3 lg:py-4" style={{ borderColor: '#A86523' }}>
            <h2 className="text-lg lg:text-xl font-semibold text-gray-800">
              Create Notification
            </h2>
          </div>
          <div className="p-4 lg:p-6 flex flex-col flex-1 overflow-y-auto">
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  placeholder="Title"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={newNotification.title}
                  onChange={(e) =>
                    setNewNotification({ ...newNotification, title: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  placeholder="Message"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60 min-h-[120px]"
                  value={newNotification.message}
                  onChange={(e) =>
                    setNewNotification({ ...newNotification, message: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Recipient</label>
                <select
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={newNotification.recipient}
                  onChange={(e) =>
                    setNewNotification({ ...newNotification, recipient: e.target.value })
                  }
                >
                  <option value="all">All Users</option>
                  <option value="single">Single User (by ID)</option>
                  <option value="multiple">Multiple Users (by IDs)</option>
                  <option value="specific">Specific Users (choose)</option>
                </select>
              </div>

              {(newNotification.recipient === "single" ||
                newNotification.recipient === "multiple") && (
                <div>
                  <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                    {newNotification.recipient === "single" ? "User ID" : "User IDs (comma-separated)"}
                  </label>
                  <input
                    type="text"
                    placeholder={
                      newNotification.recipient === "single"
                        ? "Enter user ID"
                        : "Enter multiple IDs, separated by commas"
                    }
                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                    value={newNotification.userId}
                    onChange={(e) =>
                      setNewNotification({ ...newNotification, userId: e.target.value })
                    }
                  />
                </div>
              )}

              {newNotification.recipient === "specific" && (
                <div>
                  <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Select Users</label>
                  <div className="flex items-center gap-3">
                <button
                      onClick={openSelectUsersModal}
                      className="px-3 lg:px-4 py-2 lg:py-3 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 transition-all duration-200"
                >
                      Select Users
                </button>
                    <div className="text-sm text-gray-700">
                      {selectedUsers.length > 0 ? (
                        <span>{selectedUsers.length} user{selectedUsers.length > 1 ? "s" : ""} selected</span>
                      ) : (
                        <span className="text-gray-400">No users selected</span>
                      )}
              </div>
            </div>
        </div>
              )}

              <button
                onClick={handleSendNotification}
                disabled={sending}
                className={`mt-2 bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] text-white px-4 py-3 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105 ${
                  sending ? "opacity-70 cursor-not-allowed" : ""
                }`}
              >
                {sending ? (
                  <>
                    <Loading type="inline" size="small" message="" className="mr-1" />
                    Sending...
                  </>
                ) : (
                  <>
                    <FiSend /> Send Notification
                  </>
                )}
              </button>
          </div>

            {/* Templates Section */}
            <div className="mt-6 pt-6 border-t" style={{ borderColor: '#A86523' }}>
              <h3 className="text-base font-semibold text-gray-800 mb-3">Templates</h3>
                  {templates.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No templates found.</p>
                  ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto">
                  {templates.map((t) => (
                    <div
                      key={t._id}
                      className="p-3 border-2 border-gray-200/60 rounded-xl hover:bg-gradient-to-r hover:from-yellow-50/50 hover:via-amber-50/50 hover:to-orange-50/50 transition-all duration-300"
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm text-gray-900 truncate">{t.name || "(unnamed)"}</h4>
                          <p className="text-xs text-gray-600 mt-1 line-clamp-1">{t.title}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                            <button
                              onClick={() => applyTemplateToForm(t)}
                            className="p-1.5 rounded-lg transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm"
                            title="Apply template"
                            >
                            <FiSend className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleEditTemplate(t)}
                            className="p-1.5 rounded-lg transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm"
                              title="Edit template"
                            >
                            <FiEdit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDeleteTemplate(t)}
                            className="p-1.5 rounded-lg transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 text-white bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700"
                              title="Delete template"
                            >
                            <FiTrash2 className="w-3 h-3" />
                            </button>
                          </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* === Modals === */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-6 rounded-xl w-full max-w-lg shadow-xl relative"
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <button
                onClick={() => setShowCreate(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>

              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <FiSend /> Create Notification
              </h2>

              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Title"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={newNotification.title}
                  onChange={(e) =>
                    setNewNotification({ ...newNotification, title: e.target.value })
                  }
                />
                <textarea
                  placeholder="Message"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60 min-h-[120px]"
                  value={newNotification.message}
                  onChange={(e) =>
                    setNewNotification({ ...newNotification, message: e.target.value })
                  }
                />
                <select
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={newNotification.recipient}
                  onChange={(e) =>
                    setNewNotification({ ...newNotification, recipient: e.target.value })
                  }
                >
                  
                  <option value="specific">Specific Users (choose)</option>
                </select>

                {(newNotification.recipient === "single" ||
                  newNotification.recipient === "multiple") && (
                  <input
                    type="text"
                    placeholder={
                      newNotification.recipient === "single"
                        ? "Enter user ID"
                        : "Enter multiple IDs, separated by commas"
                    }
                    className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                    value={newNotification.userId}
                    onChange={(e) =>
                      setNewNotification({ ...newNotification, userId: e.target.value })
                    }
                  />
                )}

                {newNotification.recipient === "specific" && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={openSelectUsersModal}
                      className="px-3 lg:px-4 py-2 lg:py-3 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 transition-all duration-200"
                    >
                      Select Users
                    </button>
                    <div className="text-sm text-gray-700">
                      {selectedUsers.length > 0 ? (
                        <span>{selectedUsers.length} user{selectedUsers.length > 1 ? "s" : ""} selected</span>
                      ) : (
                        <span className="text-gray-400">No users selected</span>
                      )}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleSendNotification}
                  disabled={sending}
                  className={`mt-2 bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105 ${
                    sending ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {sending ? (
                    <>
                      <Loading type="inline" size="small" message="" className="mr-1" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <FiSend /> Send Notification
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Select Users Modal (popup B) */}
<AnimatePresence>
  {showSelectUsersModal && (
    <motion.div
      className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-60"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="bg-white p-4 lg:p-6 rounded-xl w-full max-w-2xl shadow-xl relative backdrop-blur-xl border"
        style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}
        initial={{ scale: 0.95 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0.95 }}
      >
        <button
          onClick={closeSelectUsersModal}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
        >
          <FiX size={20} />
        </button>

        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          Select Users
        </h2>

        {/* Search input */}
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search users by name, username, or email..."
            className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
            value={searchUser}
            onChange={(e) => setSearchUser(e.target.value)}
          />
        </div>

        {/* Select All checkbox */}
        {users.length > 0 && (
          <label className="flex items-center gap-2 mb-2 font-medium">
            <input
              type="checkbox"
              checked={
                users.length > 0 && selectedUsers.length === users.length
              }
              onChange={(e) => {
                if (e.target.checked) {
                  setSelectedUsers(users.map((u) => u._id));
                } else {
                  setSelectedUsers([]);
                }
              }}
              className="w-4 h-4"
            />
            <span>Select All</span>
          </label>
        )}

        {/* Filtered user list */}
        {(() => {
          const filteredUsers = users.filter(
            (u) =>
              u.fullName?.toLowerCase().includes(searchUser.toLowerCase()) ||
              u.username?.toLowerCase().includes(searchUser.toLowerCase()) ||
              u.email?.toLowerCase().includes(searchUser.toLowerCase())
          );

          return (
            <div className="max-h-80 overflow-y-auto border rounded-lg p-2">
              {usersLoading ? (
                <div className="p-4 text-center text-gray-500">
                  Loading accounts...
                </div>
              ) : usersError ? (
                <div className="p-4 text-center text-red-500">{usersError}</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No users found.</div>
              ) : (
                <ul className="space-y-2">
                  {filteredUsers.map((u) => {
                    const displayName =
                      u.name || u.fullName || u.username || u.email || "Unknown";
                    return (
                      <li
                        key={u._id}
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(u._id)}
                            onChange={() => toggleUserSelection(u._id)}
                            className="w-4 h-4"
                          />
                          <div className="text-sm">
                            <div className="font-medium">{u.username}</div>
                            <div className="text-xs text-gray-500">
                              {displayName !== u.username ? displayName : u.email}
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })()}

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={closeSelectUsersModal}
            className="px-3 lg:px-4 py-2 lg:py-3 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={confirmSelectUsers}
            className="px-3 lg:px-4 py-2 lg:py-3 text-sm font-medium text-white bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            Confirm ({selectedUsers.length})
          </button>
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>


      {/* === Edit Template Modal === */}
      <AnimatePresence>
        {showEditTemplate && editingTemplate && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-4 lg:p-6 rounded-xl w-full max-w-lg shadow-xl relative backdrop-blur-xl border"
              style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <button
                onClick={() => setShowEditTemplate(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>

              <h2 className="text-xl font-semibold mb-4">
                Edit Template
              </h2>

              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Template Name"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={editingTemplate.name || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Title"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={editingTemplate.title || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                />
                <textarea
                  placeholder="Message"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60 min-h-[120px]"
                  value={editingTemplate.message || ""}
                  onChange={(e) => setEditingTemplate({ ...editingTemplate, message: e.target.value })}
                />
                <button
                  onClick={handleSaveTemplate}
                  className="mt-2 bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105"
                >
                  <FiEdit2 /> Update Template
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* === Create Template Modal === */}
      <AnimatePresence>
        {showCreateTemplate && (
          <motion.div
            className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white p-4 lg:p-6 rounded-xl w-full max-w-lg shadow-xl relative backdrop-blur-xl border"
              style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
            >
              <button
                onClick={() => setShowCreateTemplate(false)}
                className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
              >
                <FiX size={20} />
              </button>

              <h2 className="text-xl font-semibold mb-4">
                Create Template
              </h2>

              <div className="flex flex-col gap-3">
                <input
                  type="text"
                  placeholder="Template Name"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={newTemplate.name}
                  onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Title"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
                  value={newTemplate.title}
                  onChange={(e) => setNewTemplate({ ...newTemplate, title: e.target.value })}
                />
                <textarea
                  placeholder="Message"
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60 min-h-[120px]"
                  value={newTemplate.message}
                  onChange={(e) => setNewTemplate({ ...newTemplate, message: e.target.value })}
                />
                <button
                  onClick={handleCreateTemplate}
                  disabled={savingTemplate}
                  className={`mt-2 bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] text-white px-4 py-2 rounded-xl shadow-lg hover:shadow-xl flex items-center justify-center gap-2 transition-all duration-300 transform hover:scale-105 ${
                    savingTemplate ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {savingTemplate ? (
                    <>
                      <Loading type="inline" size="small" message="" className="mr-1" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FiPlus /> Save Template
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <DeleteConfirmModal
        isOpen={showNotificationConfirm && !!notificationToDelete}
        title="Delete Notification"
        message={notificationDeleteMessage}
        onConfirm={confirmDeleteNotification}
        onCancel={cancelDeleteNotification}
        confirmText="Delete"
        isLoading={notificationDeleteLoading}
      />

      <DeleteConfirmModal
        isOpen={showTemplateConfirm && !!templateToDelete}
        title="Delete Template"
        message={
          templateToDelete ? (
            <>
              Are you sure you want to delete template{" "}
              <span className="font-semibold text-gray-900">{templateToDelete.name || templateToDelete.title}</span>?
            </>
          ) : null
        }
        onConfirm={confirmDeleteTemplate}
        onCancel={cancelDeleteTemplate}
        confirmText="Delete"
        isLoading={templateDeleteLoading}
      />
    </div>
  );
}
