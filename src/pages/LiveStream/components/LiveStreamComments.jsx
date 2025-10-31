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
                    className="flex-1 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    disabled={isSending}
                />
                <button
                    type="submit"
                    disabled={!commentText.trim() || isSending}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors"
                >
                    {isSending ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <Send className="w-4 h-4" />
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
        <div className={`group relative p-2 rounded-lg border transition-all ${comment.isPinned ? 'bg-yellow-50 border-yellow-300' : 'bg-white border-gray-200 hover:border-gray-300'}`}>
            <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                        <span className="text-gray-900 font-bold text-sm truncate">{senderName}</span>
                        {isHost && (
                            <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">
                                Host
                            </span>
                        )}
                        <span className="text-gray-500 text-[10px]">{formatTimeAgo(comment.createdAt)}</span>
                    </div>
                    <p className="text-gray-800 text-sm break-words leading-relaxed">{comment.commentText || comment.content}</p>
                </div>
                {(canDelete || canPin || canUnpin) && (
                    <div className="relative">
                        <button
                            onClick={() => setShowMenu(!showMenu)}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-700 p-0.5 rounded transition-opacity"
                        >
                            <MoreVert className="w-3.5 h-3.5" />
                        </button>
                        {showMenu && (
                            <>
                                <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
                                <div className="absolute right-0 top-5 bg-white rounded-lg shadow-lg border border-gray-200 z-20 min-w-[110px]">
                                    {canPin && (
                                        <button
                                            onClick={handlePinComment}
                                            className="w-full px-3 py-1.5 text-left text-xs text-yellow-600 hover:bg-yellow-50 flex items-center gap-1.5"
                                        >
                                            <PushPin className="w-3.5 h-3.5" />
                                            Pin
                                        </button>
                                    )}
                                    {canUnpin && (
                                        <button
                                            onClick={handleUnpinComment}
                                            className="w-full px-3 py-1.5 text-left text-xs text-yellow-600 hover:bg-yellow-50 flex items-center gap-1.5"
                                        >
                                            <PushPin className="w-3.5 h-3.5" />
                                            Unpin
                                        </button>
                                    )}
                                    {canDelete && onHideComment && (
                                        <button
                                            onClick={handleHideComment}
                                            className="w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                                        >
                                            <Close className="w-3.5 h-3.5" />
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
    const commentsContainerRef = useRef(null);
    const socketRef = useRef(null);
    const isInitialLoadRef = useRef(true);
    const previousCommentsLengthRef = useRef(0);

    const isHost = user?.role === 'admin' || user?.role === 'manager';
    const isAdmin = user?.role === 'admin' || user?.role === 'manager';

    const fetchComments = useCallback(async () => {
        if (!liveId || !user) return;
        try {
            const response = isAdmin
                ? await Api.livestream.getAdminComments(liveId)
                : await Api.livestream.getComments(liveId);

            // Handle both response formats
            const commentsData = response?.data?.data || response?.data || [];
            const sorted = commentsData.sort((a, b) => {
                if (a.isPinned !== b.isPinned) return b.isPinned - a.isPinned;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });
            setComments(sorted);
            // Mark initial load as complete after first fetch
            isInitialLoadRef.current = false;
            previousCommentsLengthRef.current = sorted.length;
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

            if (response?.success || response?.data?.success) {
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


            if (response?.success || response?.data?.success) {

            } else {
                setError(response?.message || response?.data?.message || 'Unable to unpin comment');
            }
        } catch (error) {

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
            // Scroll to bottom when new comment is added (not on initial load)
            setTimeout(() => {
                if (!isInitialLoadRef.current && commentsContainerRef.current) {
                    const container = commentsContainerRef.current;
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            }, 100);
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
            socket.emit('joinLivestreamRoom', liveId);
        });

        socket.on('disconnect', () => {
        });

        socket.on('connect_error', (error) => {
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
            // Reset initial load flag when switching livestreams
            isInitialLoadRef.current = true;
            previousCommentsLengthRef.current = 0;
            fetchComments();
        }
    }, [isVisible, liveId, fetchComments]);

    // Only auto-scroll when comments length increases (new comment added), not on initial load
    useEffect(() => {
        const currentLength = comments.length;
        const previousLength = previousCommentsLengthRef.current;

        // Only scroll if:
        // 1. Not initial load (comments already fetched)
        // 2. Comments length increased (new comment added)
        // 3. Comments container is visible
        if (!isInitialLoadRef.current && currentLength > previousLength && isVisible && commentsContainerRef.current && commentsEndRef.current) {
            setTimeout(() => {
                // Scroll within the comments container, not the whole page
                const container = commentsContainerRef.current;
                if (container) {
                    container.scrollTo({
                        top: container.scrollHeight,
                        behavior: 'smooth'
                    });
                }
            }, 100);
        }

        previousCommentsLengthRef.current = currentLength;
    }, [comments, isVisible]);

    if (!isVisible) return null;

    return (
        <div className="bg-white rounded-lg shadow-md border border-gray-200 flex flex-col h-[calc(100vh-160px)] max-h-[800px] w-full max-w-full">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-3 flex items-center justify-between border-b-2 border-blue-700 rounded-t-lg">
                <div className="flex items-center gap-2">
                    <Chat className="w-4 h-4 text-white" />
                    <h3 className="text-white font-bold text-sm">Comments & Chat</h3>
                </div>
                <button
                    onClick={onToggle}
                    className="text-white hover:bg-white/20 p-1 rounded transition-colors"
                    title="Hide comments"
                >
                    <Close className="w-4 h-4" />
                </button>
            </div>

            {comments.some(c => c.isPinned) && (
                <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 border-b border-yellow-300 p-3 max-h-40 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-2 px-1">
                        <PushPin className="w-4 h-4 text-yellow-600" />
                        <span className="text-yellow-700 text-xs font-bold uppercase tracking-wide">
                            Pinned Message
                        </span>
                    </div>
                    <div className="space-y-1.5">
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

            <div ref={commentsContainerRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50 rounded-b-lg">
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
                <div className="bg-red-50 border-t border-red-200 p-2">
                    <p className="text-red-600 text-xs">{error}</p>
                </div>
            )}

            {user ? (
                <CommentInput onSendComment={handleSendComment} isSending={isSending} />
            ) : (
                <div className="bg-gray-100 border-t border-gray-200 p-3 text-center">
                    <p className="text-gray-600 text-xs">Login to comment</p>
                </div>
            )}
        </div>
    );
};

export default LiveStreamComments;

