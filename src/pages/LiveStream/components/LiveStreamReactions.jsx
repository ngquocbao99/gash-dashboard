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
        <div className="bg-transparent p-0 w-full">
            <div className="flex items-center justify-between mb-3">
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold">
                    {totalReactions.toLocaleString()} total
                </div>
            </div>

            <div className="space-y-2">
                {REACTIONS.map(({ type, emoji, color, label }) => {
                    const count = reactionCounts[type] || 0;
                    const percentage = totalReactions > 0 ? (count / totalReactions) * 100 : 0;

                    return (
                        <div key={type} className="group p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-all duration-200">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <div
                                        className="p-1.5 rounded-lg transition-all group-hover:scale-105 flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${color}20` }}
                                    >
                                        <span className="text-base leading-none">{emoji}</span>
                                    </div>
                                    <span className="text-gray-800 font-medium text-xs truncate">{label}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 ml-2">
                                    <span className="text-gray-500 text-[10px] font-semibold">
                                        {percentage > 0 ? `${percentage.toFixed(1)}%` : '0%'}
                                    </span>
                                    <span className="text-gray-900 font-bold text-sm min-w-[40px] text-right">
                                        {count.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out"
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: color,
                                    }}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {totalReactions === 0 && (
                <div className="text-center py-6 bg-gray-50 rounded-lg">
                    <p className="text-gray-500 text-xs font-medium">No reactions yet</p>
                    <p className="text-gray-400 text-[10px] mt-1">Reactions will appear here</p>
                </div>
            )}
        </div>
    );
};

export default LiveStreamReactions;

