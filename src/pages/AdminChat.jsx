// AdminChat.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import io from "socket.io-client";
import axios from "axios";
import { motion } from "framer-motion";
import {
  FiSend,
  FiUser,
  FiUsers,
  FiLoader,
  FiImage,
  FiSmile,
  FiRefreshCcw,
} from "react-icons/fi";
import EmojiPicker from "emoji-picker-react";
import { AuthContext } from "../context/AuthContext";

const SOCKET_URL = "http://localhost:5000";
const API_URL = "http://localhost:5000";

export default function AdminChat() {
  const { user } = useContext(AuthContext) || {};
  const adminId = user?._id ? String(user._id) : "admin-fallback-id";

  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const socketRef = useRef(null);
  const endRef = useRef(null);
  const selectedRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  const getId = (obj) => {
    if (!obj) return null;
    if (obj._id) return String(obj._id);
    if (obj.id) return String(obj.id);
    return String(obj);
  };

  // =============== SOCKET ===================
  useEffect(() => {
    socketRef.current = io(SOCKET_URL, { transports: ["websocket"] });

    socketRef.current.on("connect", () => {
      console.info("✅ Socket connected:", socketRef.current.id);
    });

    socketRef.current.on("new_message", (msg) => {
      try {
        const convoId = String(
          typeof msg.conversationId === "object"
            ? msg.conversationId._id || msg.conversationId
            : msg.conversationId
        );

        if (selectedRef.current && convoId === getId(selectedRef.current)) {
          setMessages((prev) => [...prev, msg]);
        } else {
          setConversations((prev) =>
            prev.map((c) =>
              getId(c) === convoId
                ? {
                    ...c,
                    unreadCount: (c.unreadCount || 0) + 1,
                    lastMessage: msg.messageText || "📷 Image",
                  }
                : c
            )
          );
        }
      } catch (err) {
        console.error("Error handling new_message:", err);
      }
    });

    return () => socketRef.current.disconnect();
  }, []);

  // =============== LOAD DATA ===================
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      setLoadingConvos(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/conversations`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setConversations(res.data?.data || []);
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setLoadingConvos(false);
    }
  };

  const loadMessages = async (conv) => {
    try {
      setSelected(conv);
      setLoadingMessages(true);
      socketRef.current.emit("join_room", getId(conv));

      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/messages/${getId(conv)}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      setMessages(res.data?.data || []);
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  // =============== SEND ===================
  const handleSend = () => {
    if (!input.trim() || !selected) return;
    const msg = {
      conversationId: getId(selected),
      senderId: adminId,
      messageText: input.trim(),
      type: "text",
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, msg]);
    setInput("");
    socketRef.current.emit("send_message", msg);
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selected) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch(`${API_URL}/upload`, { method: "POST", body: formData });
      const data = await res.json();
      if (data.success && data.url) {
        socketRef.current.emit("send_message", {
          conversationId: getId(selected),
          senderId: adminId,
          type: "image",
          imageUrl: data.url,
          createdAt: new Date().toISOString(),
        });
      } else alert("Upload thất bại!");
    } catch (err) {
      alert("Lỗi upload ảnh!");
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const displayName = (conv) => {
    const acc = conv.accountId;
    if (!acc) return "Unknown";
    return typeof acc === "object"
      ? acc.username || acc.email || acc._id || "User"
      : String(acc);
  };

  // =============== UI ===================
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* SIDEBAR */}
        <aside className="lg:col-span-4 xl:col-span-3">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100 h-full flex flex-col"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FiUsers className="text-indigo-600" /> Active Chats
              </h2>
              <button
                onClick={loadConversations}
                className="text-gray-500 hover:text-indigo-600 transition"
                title="Refresh"
              >
                <FiRefreshCcw />
              </button>
            </div>

            <div className="flex-1 overflow-auto pr-2">
              {loadingConvos ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {conversations.map((c) => {
                    const cid = getId(c);
                    const active = selected && getId(selected) === cid;
                    return (
                      <motion.li
                        key={cid}
                        whileHover={{ scale: 1.01 }}
                        onClick={() => loadMessages(c)}
                        className={`cursor-pointer flex items-center justify-between p-3 rounded-xl border transition ${
                          active
                            ? "bg-indigo-50 border-indigo-200"
                            : "hover:bg-gray-50 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                            {displayName(c).charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800 text-sm">
                              {displayName(c)}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-[140px]">
                              {c.lastMessage || "No message"}
                            </p>
                          </div>
                        </div>
                        {c.unreadCount > 0 && (
                          <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                            {c.unreadCount}
                          </span>
                        )}
                      </motion.li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </aside>

        {/* CHAT AREA */}
        <section className="lg:col-span-8 xl:col-span-9">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-[75vh] overflow-hidden"
          >
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-lg font-semibold">Select a conversation</p>
              </div>
            ) : (
              <>
                {/* HEADER */}
                <div className="border-b border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {displayName(selected)}
                    </h3>
                    <p className="text-xs text-gray-500">Chat active</p>
                  </div>
                  <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                    Active
                  </span>
                </div>

                {/* MESSAGES */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                  {loadingMessages ? (
                    <div className="flex items-center justify-center h-full">
                      <FiLoader className="animate-spin text-indigo-600 text-2xl" />
                    </div>
                  ) : (
                    messages.map((m, i) => {
                      const isAdmin = String(m.senderId) === String(adminId);
                      return (
                        <div
                          key={i}
                          className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}
                        >
                          <motion.div
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${
                              isAdmin
                                ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-none"
                                : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
                            }`}
                          >
                            {m.type === "image" ? (
                              <img
                                src={m.imageUrl}
                                alt="uploaded"
                                className="rounded-lg border border-gray-200 max-w-[220px]"
                              />
                            ) : (
                              <p className="text-sm leading-relaxed">{m.messageText}</p>
                            )}
                            <div
                              className={`text-[10px] mt-1 ${
                                isAdmin ? "text-indigo-100" : "text-gray-400"
                              }`}
                            >
                              {new Date(m.createdAt).toLocaleTimeString("en-US", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </div>
                          </motion.div>
                        </div>
                      );
                    })
                  )}
                  <div ref={endRef}></div>
                </div>

                {/* INPUT */}
                <div className="border-t border-gray-200 bg-white px-4 py-3 relative">
                  <div className="flex items-center gap-3">
                    <button onClick={() => fileInputRef.current.click()}>
                      <FiImage className="text-gray-500 hover:text-indigo-600" size={20} />
                    </button>
                    <button onClick={() => setShowEmoji(!showEmoji)}>
                      <FiSmile className="text-gray-500 hover:text-indigo-600" size={20} />
                    </button>
                    {showEmoji && (
                      <div className="absolute bottom-12 left-10 z-50">
                        <EmojiPicker onEmojiClick={(e) => setInput((prev) => prev + e.emoji)} />
                      </div>
                    )}
                    <input
                      type="text"
                      className="flex-1 border border-gray-200 rounded-full px-4 py-2 focus:ring-2 focus:ring-indigo-200 outline-none"
                      placeholder="Type your message..."
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={!input.trim()}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition ${
                        !input.trim()
                          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      }`}
                    >
                      <FiSend size={18} />
                      <span>Send</span>
                    </button>
                    <input
                      type="file"
                      hidden
                      ref={fileInputRef}
                      accept="image/*"
                      onChange={handleImageUpload}
                    />
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </section>
      </div>
    </div>
  );
}