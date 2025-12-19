// AdminChat.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import io from "socket.io-client";
import axios from "axios";
import {
  FaUsers,
  FaUser,
  FaPaperPlane,
  FaImage,
  FaSmile,
  FaSyncAlt,
  FaCheck,
  FaTimes,
} from "react-icons/fa";
import EmojiPicker from "emoji-picker-react";
import { AuthContext } from "../context/AuthContext";
import SummaryAPI from "../common/SummaryAPI";
import Loading from "../components/Loading";
import { useToast } from "../hooks/useToast";

const SOCKET_URL = "http://localhost:5000";
const API_URL = "http://localhost:5000";

export default function AdminChat() {
  const { user } = useContext(AuthContext) || {};
  const { showToast } = useToast();
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
  const userRef = useRef(null);
  const userCacheRef = useRef(new Map()); // Cache for user details
  const [viewerImage, setViewerImage] = useState(null); // null = hidden, string = image URL

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

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
      console.info("Socket connected:", socketRef.current.id);
    });

socketRef.current.on("new_message", (msg) => {
  try {
    const convoId = String(
      typeof msg.conversationId === "object"
        ? msg.conversationId._id || msg.conversationId
        : msg.conversationId
    );

    // 1. Push message into the open chat
    if (selectedRef.current && convoId === getId(selectedRef.current)) {
      setMessages((prev) => [...prev, msg]);
    }

    // 2. UPDATE SIDEBAR LIVE: lastMessage + unread count
    setConversations((prev) => {
      const updated = prev.map((c) => {
        if (getId(c) === convoId) {
          return {
            ...c,
            lastMessage:
              msg.messageText ||
              (msg.type === "image" ? "Image" :
               msg.type === "sticker" ? "Sticker" :
               msg.type === "emoji" ? "Emoji" : "Media"),
            unreadCount:
              selectedRef.current && getId(selectedRef.current) === convoId
                ? 0
                : (c.unreadCount || 0) + 1,
            updatedAt: new Date().toISOString(), // Update timestamp for sorting
          };
        }
        return c;
      });
      // Sort by updatedAt descending to bring updated conversations to top
      return updated.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
    });
  } catch (err) {
    console.error("Error handling new_message:", err);
  }
});

socketRef.current.on("conversation_updated", (updatedConvo) => {
  try {
    const convoId = getId(updatedConvo);
    const updatedStaffId = updatedConvo.staffId ? getId(updatedConvo.staffId) : null;
    const updatedStatus = updatedConvo.status;
    const isAdmin = userRef.current?.role === 'admin';
    
    // Filter: Remove if closed
    if (updatedStatus === "closed") {
      setConversations((prev) => {
        const filtered = prev.filter((c) => getId(c) !== convoId);
        if (selectedRef.current && getId(selectedRef.current) === convoId) {
          setSelected(null);
        }
        return filtered;
      });
      return;
    }
    
    setConversations((prev) => {
      const exists = prev.some((c) => getId(c) === convoId);
      let updated;
      if (exists) {
        // Update existing conversation
        updated = prev.map((c) => {
          if (getId(c) === convoId) {
            // Ensure accountId is properly cached
            let accountId = updatedConvo.accountId || c.accountId;
            if (accountId && typeof accountId === "object" && accountId._id && (accountId.username || accountId.email)) {
              userCacheRef.current.set(String(accountId._id), accountId);
            }
            
            return {
              ...c,
              ...updatedConvo,
              lastMessage: updatedConvo.lastMessage || c.lastMessage,
              accountId: accountId,
              staffId: updatedStaffId || c.staffId,
              updatedAt: updatedConvo.updatedAt || c.updatedAt,
            };
          }
          return c;
        });
      } else {
        // Ensure accountId is properly cached
        let accountId = updatedConvo.accountId;
        if (typeof accountId === "string") {
          const cached = userCacheRef.current.get(accountId);
          accountId = cached || { _id: accountId };
        } else if (accountId && typeof accountId === "object" && accountId._id && (accountId.username || accountId.email)) {
          userCacheRef.current.set(String(accountId._id), accountId);
        }
        
        updated = [
          {
            ...updatedConvo,
            lastMessage: updatedConvo.lastMessage || "New conversation",
            unreadCount: 1,
            status: updatedStatus || "open",
            staffId: updatedStaffId,
            accountId: accountId,
          },
          ...prev,
        ];
      }
      // Sort by updatedAt descending
      return updated.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
    });
  } catch (err) {
    console.error("Error handling conversation_updated:", err);
  }
});

    socketRef.current.on("conversation_created", (convo) => {
      // Ensure accountId is properly cached
      let accountId = convo.accountId;
      if (typeof accountId === "string") {
        const cached = userCacheRef.current.get(accountId);
        accountId = cached || { _id: accountId };
      } else if (accountId && typeof accountId === "object" && accountId._id && (accountId.username || accountId.email)) {
        userCacheRef.current.set(String(accountId._id), accountId);
      }
      
      const newConvo = {
        ...convo,
        lastMessage: convo.lastMessage || "New conversation",
        unreadCount: 1,
        status: convo.status || "open",
        staffId: convo.staffId ? getId(convo.staffId) : null,
        accountId: accountId,
      };
      
      if (newConvo.status === "closed") {
        return; // Don't add closed conversations
      }
      
      setConversations((prev) => {
        // Check if conversation already exists
        const exists = prev.some((c) => getId(c) === getId(newConvo));
        if (exists) {
          return prev.map((c) =>
            getId(c) === getId(newConvo) ? newConvo : c
          );
        }
        // Add to beginning and sort by updatedAt
        return [newConvo, ...prev].sort((a, b) => {
          const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return bTime - aTime;
        });
      });
      socketRef.current.emit("join_room", getId(newConvo));
    });

    socketRef.current.on("conversation_taken", (updatedConvo) => {
      setConversations((prev) =>
        prev.map((c) =>
          getId(c) === getId(updatedConvo)
            ? {
                ...c,
                ...updatedConvo,
                staffId: updatedConvo.staffId ? getId(updatedConvo.staffId) : c.staffId,
                accountId: (() => {
                  // Ensure accountId is properly cached
                  let accountId = updatedConvo.accountId || c.accountId;
                  if (accountId && typeof accountId === "object" && accountId._id && (accountId.username || accountId.email)) {
                    userCacheRef.current.set(String(accountId._id), accountId);
                  }
                  return accountId;
                })(),
              }
            : c
        )
      );
      if (
        selectedRef.current &&
        getId(selectedRef.current) === getId(updatedConvo)
      ) {
        setSelected((prev) => ({
          ...prev,
          ...updatedConvo,
          staffId: updatedConvo.staffId ? getId(updatedConvo.staffId) : prev.staffId,
          accountId: updatedConvo.accountId || prev.accountId, // Preserve populated accountId
        }));
      }
    });

    socketRef.current.on("conversation_closed", ({ conversationId }) => {
      const id = String(conversationId);
      setConversations((prev) => prev.filter((c) => getId(c) !== id));
      if (selectedRef.current && getId(selectedRef.current) === id) {
        setSelected(null);
      }
      socketRef.current.emit("leave_room", id);
    });

    socketRef.current.on("messages_read", ({ conversationId, readerId }) => {
      // Optionally handle if needed, but frontend manages unread for now
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
      const isAdmin = user?.role === 'admin';
      const url = `${API_URL}/conversations?isAdmin=${isAdmin}`;
      const res = await axios.get(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const convos = res.data?.data || [];
      // Ensure every conversation has a proper lastMessage string and accountId is properly handled
      const normalized = convos.map((c) => {
        // Ensure accountId is properly handled
        let accountId = c.accountId;
        if (typeof accountId === "string") {
          // If it's a string, check if we have it in cache
          const cached = userCacheRef.current.get(accountId);
          if (cached) {
            accountId = cached;
          } else {
            // Store as object with _id for now, will be populated when fetched
            accountId = { _id: accountId };
          }
        } else if (accountId && typeof accountId === "object") {
          // If it's an object but missing username/email, try to cache it
          if (accountId._id && !accountId.username && !accountId.email) {
            const cached = userCacheRef.current.get(String(accountId._id));
            if (cached) {
              accountId = { ...accountId, ...cached };
            }
          }
          // Cache the accountId if it has username/email
          if (accountId._id && (accountId.username || accountId.email)) {
            userCacheRef.current.set(String(accountId._id), accountId);
          }
        }
        
        return {
          ...c,
          lastMessage: c.lastMessage || "No message",
          unreadCount: c.unreadCount || 0,
          status: c.status || "open",
          staffId: c.staffId ? getId(c.staffId) : null,
          accountId: accountId,
        };
      });

      // Sort by updatedAt descending
      const sorted = normalized.sort((a, b) => {
        const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return bTime - aTime;
      });
      setConversations(sorted);
      
      // Pre-fetch user details for any accountIds that are just IDs
      sorted.forEach(conv => {
        const acc = conv.accountId;
        if (acc) {
          let userId = null;
          if (typeof acc === "string") {
            userId = acc;
          } else if (typeof acc === "object" && acc._id && !acc.username && !acc.email) {
            userId = String(acc._id);
          }
          
          if (userId && !userCacheRef.current.has(userId)) {
            // Fetch in background
            fetchUserDetails(userId).then(userData => {
              if (userData) {
                // Update conversation with fetched user data
                setConversations(prev => prev.map(c => {
                  const cAcc = c.accountId;
                  const cUserId = typeof cAcc === "string" ? cAcc : (cAcc?._id ? String(cAcc._id) : null);
                  if (cUserId === userId) {
                    return { ...c, accountId: userData };
                  }
                  return c;
                }));
              }
            });
          }
        }
      });
    } catch (err) {
      console.error("Error loading conversations:", err);
    } finally {
      setLoadingConvos(false);
    }
  };

  useEffect(() => {
    if (conversations.length > 0) {
      conversations.forEach((c) =>
        socketRef.current.emit("join_room", getId(c))
      );
    }
  }, [conversations]);

  const loadMessages = async (conv) => {
    try {
      setSelected(conv);
      setLoadingMessages(true);
      socketRef.current.emit("join_room", getId(conv));

      const token = localStorage.getItem("token");
      const res = await axios.get(
        `${API_URL}/messages/${getId(conv)}/messages`,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );
      setMessages(res.data?.data || []);

      // Mark as read
      socketRef.current.emit("mark_read", {
        conversationId: getId(conv),
        readerId: adminId,
      });
      setConversations((prev) =>
        prev.map((c) =>
          getId(c) === getId(conv) ? { ...c, unreadCount: 0 } : c
        )
      );
    } catch (err) {
      console.error("Error loading messages:", err);
    } finally {
      setLoadingMessages(false);
    }
  };

  const handleTakeConversation = (conv) => {
    socketRef.current.emit("take_conversation", {
      staffId: adminId,
      conversationId: getId(conv),
    });
    // If this conversation is currently selected, update it
    if (selectedRef.current && getId(selectedRef.current) === getId(conv)) {
      setSelected((prev) => ({
        ...prev,
        staffId: adminId,
        status: "pending",
      }));
    }
  };

  const handleCloseConversation = () => {
    if (!selected) return;
    socketRef.current.emit("close_conversation", {
      conversationId: getId(selected),
    });
  };

  // =============== SEND ===================
  const handleSend = () => {
    if (!input.trim() || input.length > 500 || !selected) return;

    const msg = {
      conversationId: getId(selected),
      senderId: adminId,
      messageText: input.trim(),
      type: "text",
    };

    setInput("");
    socketRef.current.emit("send_message", msg);
    // No optimistic update → no duplicates
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selected) return;
    const formData = new FormData();
    formData.append("image", file);
    try {
      const res = await fetch(`${API_URL}/upload`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        socketRef.current.emit("send_message", {
          conversationId: getId(selected),
          senderId: adminId,
          type: "image",
          imageUrl: data.url,
          createdAt: new Date().toISOString(),
        });
      } else showToast("Upload thất bại!", "error");
    } catch (err) {
      showToast("Lỗi upload ảnh!", "error");
    }
  };

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") setViewerImage(null);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  // Fetch user details if not in cache
  const fetchUserDetails = async (userId) => {
    if (!userId) return null;
    const userIdStr = String(userId);
    
    // Check cache first
    if (userCacheRef.current.has(userIdStr)) {
      return userCacheRef.current.get(userIdStr);
    }
    
    try {
      const userData = await SummaryAPI.accounts.getById(userIdStr);
      if (userData) {
        userCacheRef.current.set(userIdStr, userData);
        return userData;
      }
    } catch (err) {
      console.error("Error fetching user details:", err);
    }
    return null;
  };

  const displayName = async (conv) => {
    const acc = conv.accountId;
    if (!acc) return "Unknown";
    
    // Handle populated accountId object
    if (typeof acc === "object" && acc !== null) {
      // Check if it's a populated object with username/email
      if (acc.username) return acc.username;
      if (acc.email) return acc.email;
      // If it has _id but no username/email, fetch from API
      if (acc._id) {
        const userData = await fetchUserDetails(acc._id);
        if (userData?.username) return userData.username;
        if (userData?.email) return userData.email;
        return `User ${String(acc._id).slice(-6)}`;
      }
    }
    
    // If it's a string ID, fetch from API
    if (typeof acc === "string") {
      const userData = await fetchUserDetails(acc);
      if (userData?.username) return userData.username;
      if (userData?.email) return userData.email;
      return `User ${acc.slice(-6)}`;
    }
    
    return "Unknown User";
  };

  // Synchronous version for display (uses cache)
  const getDisplayName = (conv) => {
    const acc = conv.accountId;
    if (!acc) return "Unknown";
    
    // Handle populated accountId object
    if (typeof acc === "object" && acc !== null) {
      if (acc.username) return acc.username;
      if (acc.email) return acc.email;
      if (acc._id) {
        // Check cache
        const cached = userCacheRef.current.get(String(acc._id));
        if (cached?.username) return cached.username;
        if (cached?.email) return cached.email;
        // Fetch in background
        fetchUserDetails(acc._id).then(userData => {
          if (userData) {
            // Update conversation if it's in the list
            setConversations(prev => prev.map(c => {
              if (getId(c) === getId(conv) && c.accountId?._id === acc._id) {
                return { ...c, accountId: { ...c.accountId, ...userData } };
              }
              return c;
            }));
          }
        });
        return `User ${String(acc._id).slice(-6)}`;
      }
    }
    
    // If it's a string ID, check cache
    if (typeof acc === "string") {
      const cached = userCacheRef.current.get(acc);
      if (cached?.username) return cached.username;
      if (cached?.email) return cached.email;
      // Fetch in background
      fetchUserDetails(acc).then(userData => {
        if (userData) {
          setConversations(prev => prev.map(c => {
            if (getId(c) === getId(conv) && String(c.accountId) === acc) {
              return { ...c, accountId: userData };
            }
            return c;
          }));
        }
      });
      return `User ${acc.slice(-6)}`;
    }
    
    return "Unknown User";
  };

  const canOpenChat = (conv) => {
    return true;
  };

  const canMessage = (conv) => {
    return true;
  };

  // =============== UI ===================
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-3rem)]">
        {/* SIDEBAR */}
        <aside className="w-full lg:w-2/5 xl:w-1/3">
          <div className="backdrop-blur-xl bg-white rounded-xl border p-5 flex flex-col h-full shadow-lg" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <FaUsers className="text-[#E9A319]" /> Active Chats
              </h2>
              <button
                onClick={loadConversations}
                className="text-gray-500 hover:text-[#E9A319] transition-colors p-2 rounded-lg hover:bg-yellow-50"
                title="Refresh"
              >
                <FaSyncAlt />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 -mr-2">
              {loadingConvos ? (
                <div className="space-y-2">
                  {[...Array(6)].map((_, i) => (
                    <div
                      key={i}
                      className="h-12 bg-gray-100 rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : (
                <ul className="space-y-2">
                  {conversations.map((c) => {
                    const cid = getId(c);
                    const active = selected && getId(selected) === cid;
                    return (
                      <li
                        key={cid}
                        onClick={() => {
                          loadMessages(c);
                        }}
                        className={`cursor-pointer flex items-center justify-between p-3 rounded-xl border-2 transition-all duration-300 ${
                          active
                            ? "bg-gradient-to-r from-yellow-50/50 via-amber-50/50 to-orange-50/50 border-yellow-400/50 shadow-md"
                            : "hover:bg-gradient-to-r hover:from-yellow-50/30 hover:via-amber-50/30 hover:to-orange-50/30 border-gray-200/40 hover:border-yellow-400/40"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-white flex items-center justify-center font-bold shadow-md">
                            {getDisplayName(c).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800 text-sm">
                              {getDisplayName(c)}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-[140px]">
                              {c.lastMessage || "No message"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.unreadCount > 0 && (
                            <span className="text-xs bg-gradient-to-r from-red-500 to-pink-500 text-white px-2 py-0.5 rounded-full shadow-md font-semibold">
                              {c.unreadCount}
                            </span>
                          )}
                          {c.status === "open" ? (
                            <span className="text-xs bg-gradient-to-r from-green-400/20 via-emerald-400/20 to-teal-400/20 text-green-700 px-2 py-0.5 rounded-full border border-green-400/50">
                              Open
                            </span>
                          ) : c.status === "pending" ? (
                            <span className="text-xs bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 text-gray-700 px-2 py-0.5 rounded-full border border-yellow-400/50">
                              Assigned
                            </span>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </aside>

        {/* CHAT AREA */}
        <section className="flex-1">
          <div className="backdrop-blur-xl bg-white rounded-xl border flex flex-col h-full overflow-hidden shadow-lg" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <FaUsers className="text-6xl text-gray-300 mb-3" />
                <p className="text-lg font-semibold">Select a conversation</p>
              </div>
            ) : (
              <>
                {/* HEADER */}
                <div className="border-b-2 px-6 py-3 bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 backdrop-blur-sm flex items-center justify-between flex-shrink-0" style={{ borderColor: '#A86523' }}>
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {getDisplayName(selected)}
                    </h3>
                    <p className="text-xs text-gray-500">
                      {selected.status === "pending"
                        ? "Assigned"
                        : "Chat active"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {selected.status === "open" ? (
                      <span className="text-xs bg-gradient-to-r from-green-400/20 via-emerald-400/20 to-teal-400/20 text-green-700 px-2 py-1 rounded-xl border border-green-400/50 shadow-sm">
                        Open
                      </span>
                    ) : selected.status === "pending" ? (
                      <>
                        <span className="text-xs bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 text-gray-700 px-2 py-1 rounded-xl border border-yellow-400/50 shadow-sm">
                          Assigned
                        </span>
                        <button
                          onClick={handleCloseConversation}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-300 shadow-md bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white hover:shadow-lg transform hover:scale-105"
                        >
                          <FaTimes size={18} />
                          <span>Close</span>
                        </button>
                      </>
                    ) : (
                      <span className="text-xs bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 text-gray-700 px-2 py-1 rounded-xl border border-yellow-400/50 shadow-sm">
                        Assigned
                      </span>
                    )}
                  </div>
                </div>

 {/* MESSAGES */}
<div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-gray-50 to-gray-100">
  {loadingMessages ? (
    <div className="flex items-center justify-center h-full">
      <Loading type="default" size="small" message="Loading messages..." />
    </div>
  ) : (
    messages.map((m, i) => {
      const senderId = String(m.senderId);
      const isMe = senderId === String(adminId); // staff/admin đang login = bên phải

      // Lấy cache
      let sender = userCacheRef.current.get(senderId);

      // Nếu cache chưa có → fetch user
      if (!sender) {
        fetchUserDetails(senderId).then((data) => {
          if (data) {
            userCacheRef.current.set(senderId, data);
            setMessages((prev) => [...prev]);
          }
        });
      }

      // FE ROLE MAP — không cần BE trả role
      const roleMap = {
        admin: "Admin",
        manager: "Manager",
        staff: "Staff",
        user: "User",
      };

      // ---------------- ROLE RESOLVE ----------------
      let resolvedRole;

      if (isMe) {
        // Nếu là chính mình
        resolvedRole = roleMap[user?.role] || "User";
      } else {
        // Role từ backend
        resolvedRole = sender?.role;

        // Nếu BE không trả role thì FE fallback
        if (!resolvedRole) {
          const uname = sender?.username?.toLowerCase() || "";

          if (uname.includes("admin")) resolvedRole = "admin";
          else if (uname.includes("manager")) resolvedRole = "manager";
          else if (uname.includes("staff")) resolvedRole = "staff";
          else resolvedRole = "user";
        }
      }

      const finalRole = resolvedRole.charAt(0).toUpperCase() + resolvedRole.slice(1);

      // ---------------- NAME RESOLVE ----------------
      let senderName;

      if (isMe) {
        senderName = `${user?.username || "You"} (${finalRole})`;
      } else {
        const name =
          sender?.username ||
          sender?.email ||
          `User ${senderId.slice(-4)}`;
        senderName = `${name} (${finalRole})`;
      }

      return (
        <div
          key={i}
          className={`flex ${isMe ? "justify-end" : "justify-start"}`}
        >
          <div className="max-w-[75%] flex flex-col gap-1">

            {/* TÊN NGƯỜI GỬI */}
            <span
              className={`text-xs font-medium px-1 ${
                isMe ? "text-right text-gray-400" : "text-left text-gray-500"
              }`}
            >
              {senderName}
            </span>

            {/* BONG BÓNG TIN NHẮN */}
            <div
              className={`
                p-3 rounded-2xl shadow-lg
                transition-all duration-300 backdrop-blur-xl
                ${
                  isMe
                    ? "bg-gradient-to-br from-[#E9A319] to-[#A86523] text-white rounded-br-md"
                    : "bg-white border border-gray-200 text-gray-800 rounded-bl-md"
                }
              `}
            >
              {m.type === "image" ? (
                <div
                  className="relative cursor-pointer"
                  onClick={() => {
                    const imageUrl = m.imageUrl || m.attachments;
                    const fullUrl = imageUrl?.startsWith("http")
                      ? imageUrl
                      : `${API_URL}${imageUrl?.startsWith("/") ? "" : "/"}${imageUrl}`;
                    setViewerImage(fullUrl);
                  }}
                >
                  <img
                    src={
                      (m.imageUrl || m.attachments)?.startsWith("http")
                        ? (m.imageUrl || m.attachments)
                        : `${API_URL}${
                            (m.imageUrl || m.attachments)?.startsWith("/")
                              ? ""
                              : "/"
                          }${m.imageUrl || m.attachments}`
                    }
                    alt="sent"
                    className="rounded-xl border border-gray-200 max-w-[240px] max-h-[320px] object-cover shadow-md"
                  />
                </div>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
                  {m.messageText}
                </p>
              )}

              {/* TIME */}
              <div
                className={`text-[10px] mt-1 ${
                  isMe ? "text-yellow-100 text-right" : "text-gray-400 text-left"
                }`}
              >
                {(() => {
                  const date = new Date(m.createdAt);
                  const now = new Date();
                  const isToday =
                    date.getDate() === now.getDate() &&
                    date.getMonth() === now.getMonth() &&
                    date.getFullYear() === now.getFullYear();

                  if (isToday) {
                    return date.toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                  }
                  return date.toLocaleDateString("en-GB", {
                    weekday: "short",
                    day: "2-digit",
                    month: "short",
                  });
                })()}
              </div>
            </div>
          </div>
        </div>
      );
    })
  )}

  <div ref={endRef}></div>
</div>

                {/* INPUT */}
                <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0 relative">
                  {/* Show message if conversation is pending and user can't message */}
                  {!canMessage(selected) ? (
                    <div className="flex items-center justify-center py-4 text-gray-500 text-sm">
                      <p>
                        {user?.role === 'admin' 
                          ? "You can view this conversation but cannot send messages. Only the assigned staff can message."
                          : "Please click \"Take\" button to start interacting with this conversation."}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => fileInputRef.current.click()}
                          disabled={!canMessage(selected)}
                          className={`p-2 rounded-lg transition-colors ${!canMessage(selected) ? "opacity-50 cursor-not-allowed" : "hover:bg-yellow-50"}`}
                          title="Upload image"
                        >
                          <FaImage
                            className={`${!canMessage(selected) ? "text-gray-400" : "text-gray-600 hover:text-[#E9A319]"}`}
                            size={20}
                          />
                        </button>
                        <button 
                          onClick={() => setShowEmoji(!showEmoji)}
                          disabled={!canMessage(selected)}
                          className={`p-2 rounded-lg transition-colors ${!canMessage(selected) ? "opacity-50 cursor-not-allowed" : "hover:bg-yellow-50"}`}
                          title="Add emoji"
                        >
                          <FaSmile
                            className={`${!canMessage(selected) ? "text-gray-400" : "text-gray-600 hover:text-[#E9A319]"}`}
                            size={20}
                          />
                        </button>
                        {showEmoji && (
                          <div className="absolute bottom-12 left-10 z-50">
                            <EmojiPicker
                              onEmojiClick={(e) =>
                                setInput((prev) => (prev + e.emoji).slice(0, 500))
                              }
                            />
                          </div>
                        )}
                        <div className="flex-1 relative">
                          <textarea
                            className={`w-full border-2 border-gray-300/60 rounded-xl px-4 py-2 pr-14 resize-none focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60 min-h-[40px] max-h-[120px] ${
                              !canMessage(selected)
                                ? "bg-gray-100 cursor-not-allowed"
                                : ""
                            }`}
                            placeholder={
                              !canMessage(selected)
                                ? user?.role === 'admin' 
                                  ? "You can view but cannot send messages to this conversation..."
                                  : "Take this conversation to start chatting..."
                                : "Type your message..."
                            }
                            value={input}
                            rows={1}
                            maxLength={500}
                            disabled={!canMessage(selected)}
                            onChange={(e) => {
                              setInput(e.target.value);
                              e.target.style.height = "auto";
                              e.target.style.height =
                                e.target.scrollHeight + "px";
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (canMessage(selected)) {
                                  handleSend();
                                }
                              }
                            }}
                          />
                          <div className="absolute right-3 bottom-4 text-xs text-gray-400 pointer-events-none">
                            {input.length}/500
                          </div>
                        </div>
                        <button
                          onClick={handleSend}
                          disabled={
                            !input.trim() || 
                            input.length > 500 || 
                            !canMessage(selected)
                          }
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-300 shadow-md ${
                            !input.trim() || 
                            input.length > 500 || 
                            !canMessage(selected)
                              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                              : "bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] text-white hover:shadow-lg transform hover:scale-105"
                          }`}
                        >
                          <FaPaperPlane size={18} />
                          <span>Send</span>
                        </button>
                      </div>
                    </div>
                  )}
                  <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={!canMessage(selected)}
                  />
                </div>
              </>
            )}
          </div>
        </section>
      </div>

      {/* FULLSCREEN IMAGE VIEWER WITH ZOOM & PAN */}
      {viewerImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/95"
          onClick={() => setViewerImage(null)}
        >
          <div
            className="relative max-w-full max-h-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            onWheel={(e) => {
              e.preventDefault();
              const delta = e.deltaY > 0 ? 0.9 : 1.1;
              const img = e.currentTarget.querySelector("img");
              const newScale =
                (img.dataset.scale ? parseFloat(img.dataset.scale) : 1) * delta;
              if (newScale >= 0.5 && newScale <= 5) {
                img.style.transform = `scale(${newScale})`;
                img.dataset.scale = newScale;
              }
            }}
            style={{ touchAction: "pan-x pan-y pinch-zoom" }}
          >
            <img
              src={viewerImage}
              alt="Full view"
              className="max-w-none max-h-screen object-contain transition-transform duration-200 select-none"
              style={{ transform: "scale(1)", touchAction: "none" }}
              data-scale="1"
              draggable={false}
              onMouseDown={(e) => {
                if (e.button !== 0) return; // only left click
                const img = e.currentTarget;
                const startX = e.clientX;
                const startY = e.clientY;
                const startTranslateX = img.dataset.tx
                  ? parseFloat(img.dataset.tx)
                  : 0;
                const startTranslateY = img.dataset.ty
                  ? parseFloat(img.dataset.ty)
                  : 0;

                const onMove = (e) => {
                  const dx = e.clientX - startX;
                  const dy = e.clientY - startY;
                  img.dataset.tx = startTranslateX + dx;
                  img.dataset.ty = startTranslateY + dy;
                  img.style.transform = `scale(${img.dataset.scale}) translate(${img.dataset.tx}px, ${img.dataset.ty}px)`;
                };

                const onUp = () => {
                  document.removeEventListener("mousemove", onMove);
                  document.removeEventListener("mouseup", onUp);
                };

                document.addEventListener("mousemove", onMove);
                document.addEventListener("mouseup", onUp);
              }}
            />

            {/* Zoom indicator */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-3 py-1 rounded-full text-sm
"
            >
              {(() => {
                const scale =
                  (viewerImage &&
                    document.querySelector("[data-scale]")?.dataset.scale) ||
                  1;
                return `${Math.round(scale * 100)}%`;
              })()}
            </div>

            {/* Close button */}
            <button
              onClick={() => setViewerImage(null)}
              className="absolute top-4 right-4 bg-gray-800 hover:bg-gray-700 text-white rounded-full p-2 transition"
            >
              <svg
                className="w-6 h-6"
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
          </div>
        </div>
      )}
    </div>
  );
}
