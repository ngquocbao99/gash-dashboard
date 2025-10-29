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
            if (response.data?.success) {
                const data = response.data.data || {};
                setReactionCounts({
                    like: data.like || 0,
                    love: data.love || 0,
                    haha: data.haha || 0,
                    wow: data.wow || 0,
                    sad: data.sad || 0,
                    angry: data.angry || 0,
                });
            }
        } catch (error) {
            console.error('Error fetching reactions:', error);
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
            console.log('🔌 Socket connected for reactions');
            socket.emit('joinLiveProductRoom', liveId);
        });

        socket.on('disconnect', () => {
            console.log('🔌 Socket disconnected from reactions');
        });

        socket.on('connect_error', (error) => {
            console.error('❌ Socket connection error:', error);
        });

        socket.on('reaction:added', (data) => {
            console.log('🎉 Real-time reaction received:', data);
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
            <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-300">
                <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide mb-4">Reactions</h3>
                <div className="flex items-center justify-center py-8">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
            </div>
        );
    }

    const totalReactions = Object.values(reactionCounts).reduce((sum, count) => sum + count, 0);

    return (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-200 hover:shadow-xl transition-shadow duration-300">
            <div className="flex items-center justify-between mb-5">
                <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">Reactions</h3>
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-4 py-1.5 rounded-xl text-sm font-bold shadow-md">
                    {totalReactions.toLocaleString()} total
                </div>
            </div>

            <div className="space-y-4">
                {REACTIONS.map(({ type, emoji, color, label }) => {
                    const count = reactionCounts[type] || 0;
                    const percentage = totalReactions > 0 ? (count / totalReactions) * 100 : 0;

                    return (
                        <div key={type} className="group p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-all duration-200">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div
                                        className="p-2 rounded-lg transition-all group-hover:scale-110 flex items-center justify-center shadow-sm"
                                        style={{ backgroundColor: `${color}20` }}
                                    >
                                        <span className="text-2xl leading-none">{emoji}</span>
                                    </div>
                                    <span className="text-gray-800 font-semibold">{label}</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-gray-500 text-xs font-semibold uppercase tracking-wider">
                                        {percentage > 0 ? `${percentage.toFixed(1)}%` : '0%'}
                                    </span>
                                    <span className="text-gray-900 font-bold text-lg min-w-[60px] text-right">
                                        {count.toLocaleString()}
                                    </span>
                                </div>
                            </div>
                            <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                                <div
                                    className="h-full rounded-full transition-all duration-700 ease-out shadow-sm"
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
                <div className="text-center py-12 bg-gray-50 rounded-xl">
                    <p className="text-gray-500 font-medium">No reactions yet</p>
                    <p className="text-gray-400 text-sm mt-1">Reactions will appear here in real-time</p>
                </div>
            )}
        </div>
    );
};

export default LiveStreamReactions;

