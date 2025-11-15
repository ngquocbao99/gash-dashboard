import React, { useState, useEffect, useCallback } from 'react';
import Api from '../../../common/SummaryAPI';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const REACTIONS = [
    { type: 'like', emoji: '👍', color: '#3B82F6', label: 'Like' },
    { type: 'love', emoji: '❤️', color: '#EF4444', label: 'Love' },
    { type: 'haha', emoji: '😂', color: '#F59E0B', label: 'Haha' },
    { type: 'wow', emoji: '😮', color: '#8B5CF6', label: 'Wow' },
    { type: 'sad', emoji: '😢', color: '#6B7280', label: 'Sad' },
    { type: 'angry', emoji: '😡', color: '#DC2626', label: 'Angry' },
];

const LiveStreamReactions = ({ liveId }) => {
    const [reactionCounts, setReactionCounts] = useState({
        like: 0,
        love: 0,
        haha: 0,
        wow: 0,
        sad: 0,
        angry: 0,
    });
    const [isLoading, setIsLoading] = useState(true);

    const fetchReactions = useCallback(async () => {
        if (!liveId) return;
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const response = await Api.livestream.getReactions(liveId, token);

            let reactions = null;

            // Check standard structure: response.data.success && response.data.data.reactions
            if (response?.data?.success && response?.data?.data?.reactions) {
                reactions = response.data.data.reactions;
            }
            // Check if reactions is directly in response.data
            else if (response?.data?.reactions) {
                reactions = response.data.reactions;
            }
            // Check if response.data.data exists (without success flag)
            else if (response?.data?.data?.reactions) {
                reactions = response.data.data.reactions;
            }
            // Check if reactions is at root level of response.data
            else if (response?.data && typeof response.data === 'object') {
                const data = response.data;
                if (data.like !== undefined || data.love !== undefined || data.haha !== undefined) {
                    // Data is reactions directly
                    reactions = data;
                }
            }

            if (reactions) {
                // Set reaction counts directly from server (get current state, no calculation)
                setReactionCounts({
                    like: Number(reactions.like) || 0,
                    love: Number(reactions.love) || 0,
                    haha: Number(reactions.haha) || 0,
                    wow: Number(reactions.wow) || 0,
                    sad: Number(reactions.sad) || 0,
                    angry: Number(reactions.angry) || 0,
                });
            } else {
                // Keep existing state (don't reset to 0)
            }
        } catch (error) {
            // Don't reset counts on error - keep existing state
        } finally {
            setIsLoading(false);
        }
    }, [liveId]);

    const handleReactionAdded = useCallback((data) => {
        if (data?.liveId === liveId && data?.reaction) {
            const reactionType = data.reaction.reactionType;
            setReactionCounts(prev => ({
                ...prev,
                [reactionType]: (prev[reactionType] || 0) + 1,
            }));
        }
    }, [liveId]);

    useEffect(() => {
        fetchReactions();
    }, [fetchReactions]);

    useEffect(() => {
        if (!liveId) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            socket.emit('joinLiveProductRoom', liveId);
        });

        socket.on('disconnect', () => {
        });

        socket.on('connect_error', (error) => {
        });

        socket.on('reaction:added', (data) => {
            if (data?.reaction && data?.liveId === liveId) {
                handleReactionAdded(data);
            }
        });

        return () => {
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connect_error');
            socket.off('reaction:added');
            socket.close();
        };
    }, [liveId, handleReactionAdded]);

    if (isLoading) {
        return (
            <div className="bg-transparent p-0">
                <div className="flex items-center justify-center py-4">
                    <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    const totalReactions = Object.values(reactionCounts).reduce((sum, count) => sum + count, 0);

    return (
        <div className="bg-transparent p-0 w-full h-full flex flex-col">
            <div className="flex items-center justify-between mb-1.5 flex-shrink-0">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-2 py-0.5 rounded-lg text-[9px] font-bold shadow-sm">
                    {totalReactions.toLocaleString()} total
                </div>
            </div>

            <div className="flex flex-col gap-1 flex-1 min-h-0 justify-between">
                {REACTIONS.map(({ type, emoji, color, label }) => {
                    const count = reactionCounts[type] || 0;
                    const percentage = totalReactions > 0 ? (count / totalReactions) * 100 : 0;

                    return (
                        <div key={type} className="group p-1.5 bg-gray-50 rounded-lg hover:bg-gray-100 border border-gray-200/50 hover:border-gray-300 transition-all duration-200 flex-shrink-0">
                            <div className="flex items-center gap-2">
                                <div
                                    className="p-1 rounded-lg transition-all group-hover:scale-105 flex items-center justify-center shrink-0 shadow-sm"
                                    style={{ backgroundColor: `${color}15` }}
                                >
                                    <span className="text-base leading-none">{emoji}</span>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between mb-0.5">
                                        <span className="text-gray-800 font-semibold text-[10px]">{label}</span>
                                        <span className="text-gray-900 font-bold text-[11px]">{count.toLocaleString()}</span>
                                    </div>
                                    {percentage > 0 && (
                                        <div className="w-full bg-gray-200 rounded-full h-1 overflow-hidden shadow-inner">
                                            <div
                                                className="h-full rounded-full transition-all duration-500 shadow-sm"
                                                style={{
                                                    width: `${percentage}%`,
                                                    backgroundColor: color
                                                }}
                                            ></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default LiveStreamReactions;

