// AdminChat.jsx
import React, { useEffect, useState, useRef, useContext } from "react";
import io from "socket.io-client";
import axios from "axios";
import {
  FiSend,
  FiUser,
  FiUsers,
  FiLoader,
  FiImage,
  FiSmile,
  FiRefreshCcw,
  FiCheck,
  FiX,
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
  const [viewerImage, setViewerImage] = useState(null); // null = hidden, string = image URL

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

    // 1. Push message into the open chat
    if (selectedRef.current && convoId === getId(selectedRef.current)) {
      setMessages((prev) => [...prev, msg]);
    }

    // 2. UPDATE SIDEBAR LIVE: lastMessage + unread count
    setConversations((prev) =>
      prev.map((c) => {
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
          };
        }
        return c;
      })
    );
  } catch (err) {
    console.error("Error handling new_message:", err);
  }
});

    socketRef.current.on("conversation_created", (convo) => {
      const newConvo = {
        ...convo,
        lastMessage: convo.lastMessage || "New conversation",
        unreadCount: 1,
        status: convo.status || "open",
        staffId: convo.staffId || null,
      };
      setConversations((prev) => [...prev, newConvo]);
      socketRef.current.emit("join_room", getId(newConvo));
    });

    socketRef.current.on("conversation_taken", (updatedConvo) => {
      setConversations((prev) =>
        prev.map((c) =>
          getId(c) === getId(updatedConvo)
            ? { ...c, ...updatedConvo, staffId: getId(updatedConvo.staffId) }
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
          staffId: getId(updatedConvo.staffId),
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
      const res = await axios.get(`${API_URL}/conversations`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      const convos = res.data?.data || [];
      // Ensure every conversation has a proper lastMessage string
      const normalized = convos.map((c) => ({
        ...c,
        lastMessage: c.lastMessage || "No message",
        unreadCount: c.unreadCount || 0,
        status: c.status || "open",
        staffId: c.staffId ? getId(c.staffId) : null,
        accountId:
          typeof c.accountId === "string" ? { _id: c.accountId } : c.accountId, // Fallback to object if string
      }));

      setConversations(normalized);
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
      } else alert("Upload thất bại!");
    } catch (err) {
      alert("Lỗi upload ảnh!");
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

  const displayName = (conv) => {
    const acc = conv.accountId;
    if (!acc) return "Unknown";
    return typeof acc === "object"
      ? acc.username || acc.email || acc._id || "User"
      : String(acc);
  };

  const canOpenChat = (conv) => {
    return (
      conv.status === "open" ||
      (conv.status === "pending" && String(conv.staffId) === adminId)
    );
  };

  // =============== UI ===================
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto flex flex-col lg:flex-row gap-6 h-[calc(100vh-3rem)]">
        {/* SIDEBAR */}
        <aside className="w-full lg:w-1/3 xl:w-1/4">
          <div className="bg-white rounded-2xl shadow-lg p-5 border border-gray-100 flex flex-col h-full">
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
                        onClick={() =>
                          canOpenChat(c)
                            ? loadMessages(c)
                            : alert(
                                "This conversation is assigned to another staff."
                              )
                        }
                        className={`cursor-pointer flex items-center justify-between p-3 rounded-xl border transition ${
                          active
                            ? "bg-indigo-50 border-indigo-200"
                            : "hover:bg-gray-50 border-transparent"
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                            {displayName(c).charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-800 text-sm">
                              {displayName(c)}
                            </p>
                            <p className="text-xs text-gray-500 truncate max-w-[140px]">
                              {c.lastMessage || "No message"}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {c.unreadCount > 0 && (
                            <span className="text-xs bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                              {c.unreadCount}
                            </span>
                          )}
                          {c.status === "open" ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTakeConversation(c);
                              }}
                              className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded-full flex items-center gap-1"
                            >
                              <FiCheck /> Take
                            </button>
                          ) : c.status === "pending" &&
                            String(c.staffId) === adminId ? (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
                              Assigned to you
                            </span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              Assigned
                            </span>
                          )}
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
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 flex flex-col h-full overflow-hidden">
            {!selected ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
                <div className="text-4xl mb-3">💬</div>
                <p className="text-lg font-semibold">Select a conversation</p>
              </div>
            ) : (
              <>
                {/* HEADER */}
                <div className="border-b border-gray-200 px-6 py-3 bg-gray-50 flex items-center justify-between flex-shrink-0">
                  <div>
                    <h3 className="font-semibold text-gray-800">
                      {displayName(selected)}
                    </h3>
                    <p className="text-xs text-gray-500">Chat active</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-green-100 text-green-600 px-2 py-1 rounded">
                      Active
                    </span>
                    {selected.status === "pending" &&
                      String(selected.staffId) === adminId && (
                        <button
                          onClick={handleCloseConversation}
                          className="text-xs bg-red-500 text-white px-2 py-1 rounded flex items-center gap-1"
                        >
                          <FiX /> Close
                        </button>
                      )}
                  </div>
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
                          className={`flex ${
                            isAdmin ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[75%] min-w-[100px] p-3 rounded-2xl shadow-sm break-all whitespace-pre-wrap
      ${
        isAdmin
          ? "bg-gradient-to-r from-indigo-600 to-indigo-500 text-white rounded-br-none"
          : "bg-white text-gray-800 border border-gray-200 rounded-bl-none"
      }`}
                          >
                            {m.type === "image" ? (
                              <div
                                className="relative group cursor-pointer"
                                onClick={() => {
                                  setViewerImage(m.imageUrl);
                                  // Reset zoom/pan when opening
                                  setTimeout(() => {
                                    const img =
                                      document.querySelector("[data-scale]");
                                    if (img) {
                                      img.style.transform = "scale(1)";
                                      img.dataset.scale = "1";
                                      img.dataset.tx = "0";
                                      img.dataset.ty = "0";
                                    }
                                  }, 50);
                                }}
                              >
                                <img
                                  src={m.imageUrl}
                                  alt="sent"
                                  className="rounded-lg border border-gray-200 max-w-[220px] max-h-[300px] object-cover transition group-hover:brightness-90"
                                />
                                {/* Optional: subtle zoom icon on hover */}
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                                  <div className="bg-black/50 rounded-full p-2">
                                    <svg
                                      className="w-8 h-8 text-white"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                      />
                                    </svg>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="text-sm leading-relaxed break-words">
                                {m.messageText}
                              </p>
                            )}
                            <div
                              className={`text-[10px] mt-1.5 ${
                                isAdmin ? "text-indigo-100" : "text-gray-400"
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
                      );
                    })
                  )}
                  <div ref={endRef}></div>
                </div>

                {/* INPUT */}
                <div className="border-t border-gray-200 bg-white px-4 py-3 flex-shrink-0 relative">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <button onClick={() => fileInputRef.current.click()}>
                        <FiImage
                          className="text-gray-500 hover:text-indigo-600"
                          size={20}
                        />
                      </button>
                      <button onClick={() => setShowEmoji(!showEmoji)}>
                        <FiSmile
                          className="text-gray-500 hover:text-indigo-600"
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
                          className="w-full border border-gray-200 rounded-xl px-4 py-2 pr-14 resize-none focus:ring-2 focus:ring-indigo-200 outline-none min-h-[40px] max-h-[120px]"
                          placeholder="Type your message..."
                          value={input}
                          rows={1}
                          maxLength={500}
                          onChange={(e) => {
                            setInput(e.target.value);
                            e.target.style.height = "auto";
                            e.target.style.height =
                              e.target.scrollHeight + "px";
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSend();
                            }
                          }}
                        />
                        <div className="absolute right-3 bottom-1 text-xs text-gray-400 pointer-events-none">
                          {input.length}/500
                        </div>
                      </div>
                      <button
                        onClick={handleSend}
                        disabled={!input.trim() || input.length > 500}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition ${
                          !input.trim() || input.length > 500
                            ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                            : "bg-indigo-600 hover:bg-indigo-700 text-white"
                        }`}
                      >
                        <FiSend size={18} />
                        <span>Send</span>
                      </button>
                    </div>
                  </div>
                  <input
                    type="file"
                    hidden
                    ref={fileInputRef}
                    accept="image/*"
                    onChange={handleImageUpload}
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
