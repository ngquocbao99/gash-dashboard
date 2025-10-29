import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { Chat, Close, PushPin, Send, MoreVert } from '@mui/icons-material';
import { AuthContext } from '../../../context/AuthContext';
import io from 'socket.io-client';
import Api from '../../../common/SummaryAPI';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// CommentInput Component
const CommentInput = ({ onSendComment, isSending }) => {
    const [commentText, setCommentText] = useState('');
    const maxLength = 500;

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!commentText.trim() || isSending) return;
        await onSendComment(commentText.trim());
        setCommentText('');
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
        }
    };

    return (
        <div className="bg-white border-t border-gray-200 p-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Write a comment..."
                    maxLength={maxLength}
                    className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    disabled={isSending}
                />
                <button
                    type="submit"
                    disabled={!commentText.trim() || isSending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors"
                >
                    {isSending ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Send className="w-5 h-5" />
                    )}
                </button>
            </form>
        </div>
    );
};

// CommentItem Component
const CommentItem = ({ comment, currentUserId, hostId, onHideComment, onPinComment, onUnpinComment, canModerate }) => {
    const [showMenu, setShowMenu] = useState(false);
    const senderData = comment.sender || comment.senderId;
    const senderName = senderData?.name || senderData?.username || 'Unknown User';
    const isHost = senderData?._id === hostId;
    const isCommentSender = currentUserId === senderData?._id;
    const canDelete = (isCommentSender || canModerate) && !comment.isPinned;
    const canPin = canModerate && !comment.isPinned;
    const canUnpin = canModerate && comment.isPinned;

    const formatTimeAgo = (timestamp) => {
        const now = new Date();
        const commentTime = new Date(timestamp);
        const diffMs = now - commentTime;
        const diffMins = Math.floor(diffMs / 60000);
        if (diffMins < 1) return 'now';
        if (diffMins < 60) return `${diffMins}m`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours}h`;
        const diffDays = Math.floor(diffHours / 24);
        return `${diffDays}d`;
    };

    const handleHideComment = async () => {
        if (comment.isPinned) {
            console.warn('⚠️ Cannot delete a pinned comment. Unpin it first.');
            alert('Cannot delete a pinned comment. Please unpin it first.');
            return;
        }
        if (!onHideComment) return;
        if (window.confirm('Are you sure you want to delete this comment?')) {
            await onHideComment(comment._id);
            setShowMenu(false);
        }
    };

    const handlePinComment = () => {
        if (!onPinComment) return;
        onPinComment(comment._id);
        setShowMenu(false);
    };

    const handleUnpinComment = () => {
        if (!onUnpinComment) return;
        onUnpinComment(comment._id);
        setShowMenu(false);
    };

    return (
        <div className={`group relative p-3 rounded-lg border transition-all ${comment.isPinned ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-900 font-bold text-sm truncate">{senderName}</span>
                        {isHost && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded">
                                Host
                            </span>
                        )}
                        <span className="text-gray-500 text-xs">{formatTimeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="text-gray-800 text-sm break-words">{comment.commentText || comment.content}</p>
                </div>
                {(canDelete || canPin || canUnpin) && (
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-1 rounded transition-opacity"
                        >
                            <MoreVert className="w-4 h-4" />
                        </button>
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                <div className="absolute right-0 top-6 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[130px]">
                                    {canPin && (
                                        <button
                                            onClick={handlePinComment}
                                            className="w-full px-4 py-2 text-left text-sm text-yellow-600 hover:bg-yellow-50 flex items-center gap-2"
                                        >
                                            <PushPin className="w-4 h-4" />
                                            Pin
                                        </button>
                                    )}
                                    {canUnpin && (
                                        <button
                                            onClick={handleUnpinComment}
                                            className="w-full px-4 py-2 text-left text-sm text-yellow-600 hover:bg-yellow-50 flex items-center gap-2"
                                        >
                                            <PushPin className="w-4 h-4" />
                                            Unpin
                                        </button>
                                    )}
                                    {canDelete && onHideComment && (
                                        <button
                                            onClick={handleHideComment}
                                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                        >
                                            <Close className="w-4 h-4" />
                                            Delete
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

// Main LiveStreamComments Component
const LiveStreamComments = ({ liveId, hostId, isVisible, onToggle }) => {
    const { user } = useContext(AuthContext);
    const [comments, setComments] = useState([]);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const commentsEndRef = useRef(null);
    const socketRef = useRef(null);

    const isHost = user?.role === 'admin' || user?.role === 'manager';
    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

    const fetchComments = useCallback(async () => {
        if (!liveId || !user) return;
        try {
            const response = isAdmin
                ? await Api.livestream.getAdminComments(liveId)
                : await Api.livestream.getComments(liveId);

            console.log('📥 Fetch comments response:', response);

            // Handle both response formats
            const commentsData = response?.data?.data || response?.data || [];
            const sorted = commentsData.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });
            setComments(sorted);
        } catch (error) {
            console.error('❌ Error fetching comments:', error);
        }
    }, [liveId, user, isAdmin]);

    const handleSendComment = async (content) => {
        if (!user || !liveId) return;
        try {
            setIsSending(true);
            setError('');

            const response = await Api.livestream.addComment({ liveId, commentText: content });

            if (response?.success || response?.data?.success) {
                console.log('✅ Comment sent, waiting for WebSocket update...');
            } else {
                setError(response?.message || response?.data?.message || 'Unable to send comment');
            }
        } catch (error) {
            console.error('❌ Error sending comment:', error);
            setError('Error sending comment');
        } finally {
            setIsSending(false);
        }
    };

    const handleHideComment = async (commentId) => {
        if (!user || !liveId) return;
        try {
            const response = await Api.livestream.hideComment(commentId);

            if (response?.success) {
                console.log('✅ Comment deleted, waiting for WebSocket update...');
            } else {
                setError(response?.message || 'Unable to delete comment');
            }
        } catch (error) {
            console.error('Error deleting comment:', error);
            setError('Error deleting comment');
        }
    };

    const handlePinComment = async (commentId) => {
        if (!user || !liveId) return;
        try {
            const response = await Api.livestream.pinComment(commentId, liveId);
            console.log('📌 Pin response:', response);

            if (response?.success || response?.data?.success) {
                console.log('✅ Comment pinned, waiting for WebSocket update...');
            } else {
                setError(response?.message || response?.data?.message || 'Unable to pin comment');
            }
        } catch (error) {
            console.error('❌ Error pinning comment:', error);
            setError(error?.response?.data?.message || 'Error pinning comment');
        }
    };

    const handleUnpinComment = async (commentId) => {
        if (!user || !liveId) return;
        try {
            const response = await Api.livestream.unpinComment(commentId, liveId);
            console.log('📍 Unpin response:', response);

            if (response?.success || response?.data?.success) {
                console.log('✅ Comment unpinned, waiting for WebSocket update...');
            } else {
                setError(response?.message || response?.data?.message || 'Unable to unpin comment');
            }
        } catch (error) {
            console.error('❌ Error unpinning comment:', error);
            setError(error?.response?.data?.message || 'Error unpinning comment');
        }
    };

    const handleCommentAdded = useCallback((data) => {
        if (data?.liveId === liveId && data?.comment) {
            setComments(prev => {
                if (prev.some(c => c._id === data.comment._id)) return prev;
                const updated = [...prev, data.comment].sort((a, b) => {
                    if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
                    return new Date(a.createdAt) - new Date(b.createdAt);
                });
                return updated;
            });
        }
    }, [liveId]);

    const handleCommentDeleted = useCallback((data) => {
        if (data?.liveId === liveId) {
            setComments(prev => prev.filter(c => c._id !== data.commentId));
        }
    }, [liveId]);

    const handleCommentPinned = useCallback((data) => {
        if (data?.liveId === liveId && data?.comment) {
            setComments(prev => {
                const updated = prev.map(c =>
                    c._id === data.comment._id ? { ...c, isPinned: true } : { ...c, isPinned: false }
                );
                return updated.sort((a, b) => {
                    if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
                    return new Date(a.createdAt) - new Date(b.createdAt);
                });
            });
        }
    }, [liveId]);

    const handleCommentUnpinned = useCallback((data) => {
        if (data?.liveId === liveId && data?.commentId) {
            setComments(prev => {
                const updated = prev.map(c =>
                    c._id === data.commentId ? { ...c, isPinned: false } : c
                );
                return updated.sort((a, b) => {
                    if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
                    return new Date(a.createdAt) - new Date(b.createdAt);
                });
            });
        }
    }, [liveId]);

    useEffect(() => {
        if (!liveId) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            console.log('🔌 Socket connected for comments');
            socket.emit('joinLivestreamRoom', liveId);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected from comments');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
        });

        socket.on('comment:added', handleCommentAdded);
        socket.on('comment:deleted', handleCommentDeleted);
        socket.on('comment:pinned', handleCommentPinned);
        socket.on('comment:unpinned', handleCommentUnpinned);

        return () => {
            if (socket.connected) {
                socket.emit('leaveLivestreamRoom', liveId);
            }
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connect_error');
            socket.off('comment:added');
            socket.off('comment:deleted');
            socket.off('comment:pinned');
            socket.off('comment:unpinned');
            socket.close();
        };
    }, [liveId, handleCommentAdded, handleCommentDeleted, handleCommentPinned, handleCommentUnpinned]);

    useEffect(() => {
        if (isVisible && liveId) {
            fetchComments();
        }
    }, [isVisible, liveId, fetchComments]);

    useEffect(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [comments]);

    if (!isVisible) return null;

    return (
        <div className="fixed right-0 top-0 h-full w-[420px] bg-white border-l border-gray-200 flex flex-col z-40 shadow-2xl">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-5 flex items-center justify-between border-b border-blue-700">
                <div className="flex items-center gap-2">
                    <Chat className="w-5 h-5 text-white" />
                    <h3 className="text-white font-bold text-lg">Comments & Chat</h3>
                </div>
                <button
                    onClick={onToggle}
                    className="text-white hover:bg-white/20 p-1 rounded-full transition-colors"
                >
                    <Close className="w-5 h-5" />
                </button>
            </div>

            {comments.some(c => c.isPinned) && (
                <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 border-b border-yellow-300 p-4 max-h-48 overflow-y-auto shadow-inner">
                    <div className="flex items-center gap-2 mb-3 px-2">
                        <PushPin className="w-4 h-4 text-yellow-600" />
                        <span className="text-yellow-700 text-xs font-bold uppercase tracking-wide">
                            Pinned Message
                        </span>
                    </div>
                    <div className="space-y-2">
                        {comments
                            .filter(c => c.isPinned)
                            .slice(0, 1)
                            .map((comment) => (
                                <CommentItem
                                    key={comment._id}
                                    comment={comment}
                                    currentUserId={user?._id}
                                    hostId={hostId}
                                    onHideComment={handleHideComment}
                                    onPinComment={handlePinComment}
                                    onUnpinComment={handleUnpinComment}
                                    canModerate={isHost || isAdmin}
                                />
                            ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                {comments
                    .filter(c => !c.isPinned)
                    .map((comment) => (
                        <CommentItem
                            key={comment._id}
                            comment={comment}
                            currentUserId={user?._id}
                            hostId={hostId}
                            onHideComment={handleHideComment}
                            onPinComment={handlePinComment}
                            onUnpinComment={handleUnpinComment}
                            canModerate={isHost || isAdmin}
                        />
                    ))}
                <div ref={commentsEndRef} />
            </div>

            {error && (
                <div className="bg-red-50 border-t border-red-200 p-3">
                    <p className="text-red-600 text-sm">{error}</p>
                </div>
            )}

            {user ? (
                <CommentInput onSendComment={handleSendComment} isSending={isSending} />
            ) : (
                <div className="bg-gray-100 border-t border-gray-200 p-4 text-center">
                    <p className="text-gray-600 text-sm">Login to comment</p>
                </div>
            )}
        </div>
    );
};

export default LiveStreamComments;

