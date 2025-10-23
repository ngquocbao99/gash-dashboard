// Notifications.jsx
import React, { useState, useEffect } from "react";
import axios from "axios";
import { motion } from "framer-motion";
import {
  FiSend,
  FiTrash2,
  FiEdit2,
  FiSave,
  FiX,
  FiSettings,
  FiBell,
  FiUsers,
} from "react-icons/fi";

export default function Notifications() {
  // notifications list from backend
  const [notifications, setNotifications] = useState([]);
  // new notification form
  const [newNotification, setNewNotification] = useState({
    title: "",
    message: "",
    recipient: "all", // 'all' | 'single'
    userId: "",
  });

  // preferences for notification categories
  const [preferences, setPreferences] = useState({
    system: true,
    order: true,
    promotion: true,
  });

  // templates and editing state
  const [templates, setTemplates] = useState([
    {
      id: 1,
      name: "Promotion",
      title: "🎁 New Offer",
      message: "Get 10% off your order today — limited time only!",
    },
    {
      id: 2,
      name: "Order Update",
      title: "📦 Order Update",
      message: "Your order is being processed and will ship soon.",
    },
  ]);
  const [editingTemplate, setEditingTemplate] = useState(null);

  // loading & UI states
  const [loadingList, setLoadingList] = useState(false);
  const [sending, setSending] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);

  // Fetch notifications once at mount
  useEffect(() => {
    fetchNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------
  // API calls
  // ---------------------------
  const fetchNotifications = async () => {
    try {
      setLoadingList(true);
      const res = await axios.get("http://localhost:5000/notifications/admin/all");
      // Expecting an array response as in original code
      setNotifications(Array.isArray(res.data) ? res.data : res.data || []);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      // fallback to empty list
      setNotifications([]);
    } finally {
      setLoadingList(false);
    }
  };

  const handleSendNotification = async () => {
    // client-side validation
    if (!newNotification.title.trim() || !newNotification.message.trim()) {
      return alert("Please enter both title and message.");
    }
    if (newNotification.recipient === "single" && !newNotification.userId.trim()) {
      return alert("Please enter the recipient user ID.");
    }

    try {
      setSending(true);
      const payload = {
        title: newNotification.title,
        message: newNotification.message,
        userId: newNotification.recipient === "all" ? null : newNotification.userId,
        type: "system",
      };

      await axios.post("http://localhost:5000/notifications/admin/create", payload);

      alert("Notification sent successfully.");
      // reset form
      setNewNotification({ title: "", message: "", recipient: "all", userId: "" });
      // refresh list
      fetchNotifications();
    } catch (err) {
      console.error("Send notification failed:", err.response?.data || err.message);
      alert("Failed to send notification.");
    } finally {
      setSending(false);
    }
  };

  const handleDeleteNotification = async (id) => {
    const confirmed = window.confirm("Are you sure you want to delete this notification?");
    if (!confirmed) return;

    try {
      await axios.delete(`http://localhost:5000/notifications/admin/${id}`);
      // refresh list
      fetchNotifications();
    } catch (err) {
      console.error("Failed to delete notification:", err);
      alert("Failed to delete notification.");
    }
  };

  // Save preferences locally (keeps original behavior)
  const handleSavePreferences = () => {
    // you can replace this with API call if you want server persistence
    alert("Notification preferences saved.");
    console.log("Preferences saved:", preferences);
  };

  // Templates operations (local state)
  const handleStartEditTemplate = (template) => {
    // create a shallow copy to edit
    setEditingTemplate({ ...template });
  };

  const handleCancelEditTemplate = () => {
    setEditingTemplate(null);
  };

  const handleSaveTemplate = () => {
    if (!editingTemplate) return;
    if (!editingTemplate.name.trim() || !editingTemplate.title.trim() || !editingTemplate.message.trim()) {
      return alert("Please fill template name, title and message.");
    }

    setSavingTemplate(true);
    try {
      setTemplates((prev) => prev.map((t) => (t.id === editingTemplate.id ? editingTemplate : t)));
      alert("Template updated.");
      setEditingTemplate(null);
    } catch (err) {
      console.error("Failed to save template:", err);
      alert("Failed to save template.");
    } finally {
      setSavingTemplate(false);
    }
  };

  // Quick apply template to new notification form
  const applyTemplateToForm = (template) => {
    setNewNotification((prev) => ({
      ...prev,
      title: template.title,
      message: template.message,
    }));
  };

  // Simple helper: small skeleton cards for loading
  const Skeleton = ({ className = "" }) => (
    <div className={`animate-pulse bg-gray-100 rounded-md ${className}`} />
  );

  // --------------
  // Render
  // --------------
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Page header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 flex items-center gap-3">
            <FiBell className="text-indigo-600" /> Notifications Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Manage system notifications, templates and delivery preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchNotifications}
            className="bg-white border border-gray-200 px-3 py-2 rounded-lg shadow-sm text-sm text-gray-700 hover:bg-gray-50"
          >
            Refresh
          </button>
        </div>
      </motion.div>

      {/* Grid layout: left = form + preferences + templates, right = list */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Send Notification card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.05 }}
            className="bg-white rounded-2xl shadow-md p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                  <FiSend />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Send New Notification</h2>
                  <p className="text-sm text-gray-500">Compose and deliver messages to users.</p>
                </div>
              </div>
              <div className="text-sm text-gray-400">Status: <strong className="text-gray-700">{sending ? "Sending..." : "Ready"}</strong></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex flex-col">
                <span className="text-sm text-gray-600 mb-1">Title</span>
                <input
                  className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Enter notification title"
                  value={newNotification.title}
                  onChange={(e) => setNewNotification({ ...newNotification, title: e.target.value })}
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm text-gray-600 mb-1">Recipient</span>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  value={newNotification.recipient}
                  onChange={(e) => setNewNotification({ ...newNotification, recipient: e.target.value })}
                >
                  <option value="all">All users</option>
                  <option value="single">Specific user</option>
                </select>
              </label>
            </div>

            {newNotification.recipient === "single" && (
              <div className="mt-3">
                <label className="flex flex-col">
                  <span className="text-sm text-gray-600 mb-1">User ID</span>
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    placeholder="Enter user ID"
                    value={newNotification.userId}
                    onChange={(e) => setNewNotification({ ...newNotification, userId: e.target.value })}
                  />
                </label>
              </div>
            )}

            <div className="mt-3">
              <label className="flex flex-col">
                <span className="text-sm text-gray-600 mb-1">Message</span>
                <textarea
                  rows="4"
                  className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Write your notification message..."
                  value={newNotification.message}
                  onChange={(e) => setNewNotification({ ...newNotification, message: e.target.value })}
                />
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => {
                  // quick validation done inside handleSendNotification
                  handleSendNotification();
                }}
                disabled={sending}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white font-semibold shadow-sm ${
                  sending ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                }`}
              >
                <FiSend />
                {sending ? "Sending..." : "Send Notification"}
              </button>

              <div className="ml-auto flex items-center gap-2">
                <span className="text-sm text-gray-500">Apply template:</span>
                <select
                  className="border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  onChange={(e) => {
                    const id = Number(e.target.value);
                    const t = templates.find((tpl) => tpl.id === id);
                    if (t) applyTemplateToForm(t);
                  }}
                  defaultValue=""
                >
                  <option value="">-- choose template --</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </motion.div>

          {/* Preferences card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.08 }}
            className="bg-white rounded-2xl shadow-md p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-yellow-50 text-yellow-600 rounded-lg flex items-center justify-center">
                  <FiSettings />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Notification Preferences</h3>
                  <p className="text-sm text-gray-500">Toggle which categories you want to receive.</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  checked={preferences.system}
                  onChange={(e) => setPreferences({ ...preferences, system: e.target.checked })}
                />
                <div>
                  <div className="text-sm font-medium">System</div>
                  <div className="text-xs text-gray-500">Critical system alerts</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  checked={preferences.order}
                  onChange={(e) => setPreferences({ ...preferences, order: e.target.checked })}
                />
                <div>
                  <div className="text-sm font-medium">Order</div>
                  <div className="text-xs text-gray-500">Order updates and shipment</div>
                </div>
              </label>

              <label className="flex items-center gap-2 p-3 border rounded-lg">
                <input
                  type="checkbox"
                  checked={preferences.promotion}
                  onChange={(e) => setPreferences({ ...preferences, promotion: e.target.checked })}
                />
                <div>
                  <div className="text-sm font-medium">Promotion</div>
                  <div className="text-xs text-gray-500">Marketing & discount messages</div>
                </div>
              </label>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={handleSavePreferences}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 shadow-sm"
              >
                <FiSave /> Save Preferences
              </button>
            </div>
          </motion.div>

          {/* Templates card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.11 }}
            className="bg-white rounded-2xl shadow-md p-6 border border-gray-100"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-50 text-pink-600 rounded-lg flex items-center justify-center">
                  <FiEdit2 />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Notification Templates</h3>
                  <p className="text-sm text-gray-500">Manage reusable templates for messages.</p>
                </div>
              </div>
            </div>

            {editingTemplate ? (
              <div className="space-y-3">
                <label className="flex flex-col text-sm">
                  <span className="text-gray-600 mb-1">Template Name</span>
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-2"
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                  />
                </label>

                <label className="flex flex-col text-sm">
                  <span className="text-gray-600 mb-1">Title</span>
                  <input
                    className="border border-gray-200 rounded-lg px-3 py-2"
                    value={editingTemplate.title}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, title: e.target.value })}
                  />
                </label>

                <label className="flex flex-col text-sm">
                  <span className="text-gray-600 mb-1">Message</span>
                  <textarea
                    rows="4"
                    className="border border-gray-200 rounded-lg px-3 py-2"
                    value={editingTemplate.message}
                    onChange={(e) => setEditingTemplate({ ...editingTemplate, message: e.target.value })}
                  />
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSaveTemplate}
                    disabled={savingTemplate}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
                      savingTemplate ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    <FiSave /> {savingTemplate ? "Saving..." : "Save Template"}
                  </button>

                  <button
                    onClick={handleCancelEditTemplate}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                  >
                    <FiX /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <ul className="divide-y divide-gray-100">
                  {templates.map((t) => (
                    <li key={t.id} className="py-3 flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{t.name}</div>
                        <div className="text-sm text-gray-600">{t.title}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleStartEditTemplate(t)}
                          className="text-sm inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
                        >
                          <FiEdit2 /> Edit
                        </button>
                        <button
                          onClick={() => applyTemplateToForm(t)}
                          className="text-sm inline-flex items-center gap-2 px-3 py-1 rounded-md bg-gray-50 text-gray-700 hover:bg-gray-100"
                        >
                          Apply
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        </div>

        {/* RIGHT COLUMN - Notifications list */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.14 }}
            className="bg-white rounded-2xl p-4 shadow-md border border-gray-100"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center">
                  <FiUsers />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-800">Notifications</h3>
                  <p className="text-xs text-gray-500">Recently sent system messages</p>
                </div>
              </div>

              <div className="text-sm text-gray-500">{loadingList ? "Loading..." : `${notifications.length} total`}</div>
            </div>

            {/* list */}
            <div className="max-h-[60vh] overflow-auto">
              {loadingList ? (
                <div className="space-y-3">
                  <SkeletonItem />
                  <SkeletonItem />
                  <SkeletonItem />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-gray-500">No notifications yet.</div>
              ) : (
                <ul className="space-y-3">
                  {notifications.map((n) => (
                    <li key={n._id || `${n.title}_${Math.random()}`} className="flex items-start justify-between gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">{n.title}</div>
                        <div className="text-sm text-gray-600 mt-1">{n.message}</div>
                        <div className="text-xs text-gray-400 mt-2">
                          Recipient: {n.userId ? `User ID ${n.userId}` : "All users"} • Type: {n.type ?? "system"}
                        </div>
                        <div className="text-xs text-gray-300 mt-1">{n.createdAt ? new Date(n.createdAt).toLocaleString() : ""}</div>
                      </div>

                      <div className="flex flex-col items-center gap-2">
                        <button
                          onClick={() => handleDeleteNotification(n._id)}
                          title="Delete notification"
                          className="p-2 rounded-md text-red-600 hover:bg-red-50"
                        >
                          <FiTrash2 />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );

  

  function SkeletonItem() {
    return (
      <div className="flex gap-3 p-3 items-start">
        <div className="w-10 h-10 rounded-md bg-gray-100 animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-3 bg-gray-100 rounded w-3/4 animate-pulse" />
          <div className="h-3 bg-gray-100 rounded w-full animate-pulse" />
          <div className="h-2 bg-gray-100 rounded w-1/2 animate-pulse mt-2" />
        </div>
      </div>
    );
  }
}
