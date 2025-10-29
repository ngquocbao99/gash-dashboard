import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import { useToast } from '../../hooks/useToast';
import { Stop, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { Room, RoomEvent } from 'livekit-client';
import VideoPreview from './components/VideoPreview';
import LiveStreamComments from './components/LiveStreamComments';
import LiveStreamReactions from './components/LiveStreamReactions';
import { LIVEKIT_CONFIG } from '../../config/livekit';
import Loading from '../../components/Loading';
import { Chat } from '@mui/icons-material';

const LiveStreamDashboard = () => {
    const { user } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();
    const { livestreamId } = useParams();

    // State
    const [isLoading, setIsLoading] = useState(false);
    const [currentLivestream, setCurrentLivestream] = useState(null);
    const [isLive, setIsLive] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showComments, setShowComments] = useState(false);

    // LiveKit state
    const [room, setRoom] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [livekitError, setLivekitError] = useState(null);
    const [localParticipant, setLocalParticipant] = useState(null);
    const [remoteParticipants, setRemoteParticipants] = useState([]);

    // Media state
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [mediaError, setMediaError] = useState(null);
    const [isVideoPlaying, setIsVideoPlaying] = useState(true);
    const [isAudioPlaying, setIsAudioPlaying] = useState(true);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

    // Refs
    const localVideoRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const currentLivestreamRef = useRef(null);
    const isLiveRef = useRef(false);
    const isPublishingRef = useRef(false);
    const reconnectAttemptsRef = useRef(0);
    const maxReconnectAttempts = 5;
    const roomRef = useRef(null); // Store room ref to prevent stale disconnect
    const isReconnectingRef = useRef(false); // Flag to prevent multiple simultaneous reconnects
    const autoConnectAttemptedRef = useRef(false); // Flag to prevent multiple auto-connect attempts

    // Performance optimization: Cache for API responses (similar to backend)
    const apiCacheRef = useRef({
        viewerCount: null, // Cached viewer count data
    });
    const CACHE_TTL = 4000; // 4 seconds (matching backend cache)

    // Track ongoing API calls to prevent duplicate requests
    const ongoingCallsRef = useRef({
        updateViewerCount: false,
    });

    // Load livestream details function
    const loadLivestreamDetails = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await Api.livestream.getHost();
            // console.log('📋 Response from getHost:', response);
            if (response.success) {
                // Backend returns: { success: true, data: { livestream: {...} } }
                const livestream = response.data?.livestream;
                // console.log('📋 Livestream object:', livestream);

                if (livestream && (livestream._id === livestreamId || livestream.livestreamId === parseInt(livestreamId))) {
                    // Ensure _id is set correctly (may be undefined)
                    const livestreamWithId = {
                        ...livestream,
                        _id: livestream._id || livestreamId
                    };
                    setCurrentLivestream(livestreamWithId);
                    currentLivestreamRef.current = livestreamWithId;
                    setIsLive(livestream.status === 'live');
                    isLiveRef.current = livestream.status === 'live';
                } else {
                    showToast('No live livestream found', 'error');
                    navigate('/livestream');
                }
            } else {
                showToast('Unable to load livestream information', 'error');
            }
        } catch (error) {
            console.error('Error loading livestream details:', error);
            showToast('Error loading livestream information', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [livestreamId, showToast, navigate]);

    // Load livestream data on mount
    useEffect(() => {
        loadLivestreamDetails();
        setupMediaDevices();
    }, [livestreamId, loadLivestreamDetails]);

    // Handle viewer count update from socket (real-time)
    const handleViewerCountUpdate = useCallback((count) => {
        setCurrentLivestream(prev => {
            if (!prev || prev.currentViewers === count) {
                return prev;
            }
            // Update current viewers, and track peak/min
            const newPeak = Math.max(prev.peakViewers || 0, count);
            const newMin = prev.minViewers !== undefined
                ? Math.min(prev.minViewers, count)
                : count;

            return {
                ...prev,
                currentViewers: count,
                peakViewers: newPeak,
                minViewers: newMin
            };
        });

        // Update cache
        apiCacheRef.current.viewerCount = {
            viewers: count,
            peakViewers: Math.max(apiCacheRef.current.viewerCount?.peakViewers || 0, count),
            minViewers: apiCacheRef.current.viewerCount?.minViewers !== undefined
                ? Math.min(apiCacheRef.current.viewerCount.minViewers, count)
                : count,
            timestamp: Date.now()
        };
    }, []);

    // Setup socket for viewer count updates (real-time via socket, with periodic sync)
    useEffect(() => {
        if (!isLive || !currentLivestream?._id) return;

        const socket = new WebSocket(`${import.meta.env.VITE_SOCKET_URL}/livestream/${currentLivestream?._id}`);

        socket.onopen = () => {
            // console.log('🔗 Socket connected for viewer count updates');
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (data.type === 'viewerCountUpdate') {
                    handleViewerCountUpdate(data.count);
                }
            } catch (e) {
                console.error('Error parsing socket message:', e);
            }
        };

        socket.onerror = (error) => {
            console.error('Socket error:', error);
        };

        socket.onclose = () => {
            // console.log('Socket closed for viewer count updates');
        };

        return () => {
            socket.close();
        };
    }, [isLive, currentLivestream?._id, handleViewerCountUpdate]);

    // Periodic sync for viewer count (fallback and peak/min tracking) - less frequent
    useEffect(() => {
        if (!isLive || !currentLivestream) return;

        const syncViewerCount = async () => {
            try {
                // Prevent duplicate calls
                if (ongoingCallsRef.current.updateViewerCount) {
                    return;
                }
                ongoingCallsRef.current.updateViewerCount = true;

                try {
                    const response = await Api.livestream.getHost();
                    if (response.success) {
                        // Backend returns: { success: true, data: { livestream: {...} } }
                        const currentStream = response.data?.livestream;

                        if (currentStream && (currentStream._id === livestreamId || currentStream.livestreamId === parseInt(livestreamId))) {
                            const newViewers = currentStream.currentViewers ?? 0;

                            // Cache the result
                            apiCacheRef.current.viewerCount = {
                                viewers: newViewers,
                                peakViewers: currentStream.peakViewers,
                                minViewers: currentStream.minViewers,
                                timestamp: Date.now()
                            };

                            // Only update if changed (optimize re-renders)
                            setCurrentLivestream(prev => {
                                if (!prev || prev.currentViewers === newViewers) {
                                    return prev;
                                }
                                return {
                                    ...prev,
                                    currentViewers: newViewers,
                                    peakViewers: currentStream.peakViewers ?? prev.peakViewers,
                                    minViewers: currentStream.minViewers ?? prev.minViewers
                                };
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error syncing viewer count:', error);
                } finally {
                    ongoingCallsRef.current.updateViewerCount = false;
                }
            } catch (error) {
                console.error('Error in syncViewerCount:', error);
            }
        };

        // Initial sync
        syncViewerCount();

        // Sync every 30 seconds (socket handles real-time updates, this is just for consistency)
        const interval = setInterval(syncViewerCount, 30000);

        return () => {
            clearInterval(interval);
            // Reset flag on unmount (eslint warning is safe - ref is stable)
            // eslint-disable-next-line react-hooks/exhaustive-deps
            ongoingCallsRef.current.updateViewerCount = false;
        };
    }, [isLive, currentLivestream, livestreamId]);

    // Cleanup on unmount - CRITICAL for preventing reconnect loops
    useEffect(() => {
        return () => {
            // console.log('🧹 Cleaning up on unmount...');
            const roomToClean = roomRef.current || room;

            if (roomToClean) {
                // console.log('🔌 Disconnecting room...');
                try {
                    roomToClean.removeAllListeners();
                    if (roomToClean.state !== 'disconnected') {
                        roomToClean.disconnect().catch((error) => {
                            console.warn('Warning disconnecting on unmount:', error);
                        });
                    }
                } catch (error) {
                    console.warn('Error during cleanup disconnect:', error);
                }
            }

            if (streamRef.current) {
                // console.log('🎥 Stopping media stream...');
                stopMediaStream();
            }

            // Reset all flags to allow fresh start on return
            // console.log('🔄 Resetting all connection flags...');
            isPublishingRef.current = false;
            autoConnectAttemptedRef.current = false;
            isReconnectingRef.current = false;
            reconnectAttemptsRef.current = 0;

            // Clear room refs
            if (roomRef.current) {
                roomRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Auto-show video when going live
    useEffect(() => {
        if (isLive && streamRef.current) {
            setTimeout(() => {
                ensureVideoVisible();
            }, 500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLive]);

    // Auto-connect and start live when data is loaded
    useEffect(() => {
        const connectIfNeeded = async () => {
            // console.log('🔗 connectIfNeeded called', {
            //     autoConnectAttempted: autoConnectAttemptedRef.current,
            //     isReconnecting: isReconnectingRef.current,
            //     hasCurrentLivestream: !!currentLivestream,
            //     hasRoomName: !!currentLivestream?.roomName,
            //     isLive,
            //     isConnected
            // });

            // Prevent multiple attempts
            if (autoConnectAttemptedRef.current) {
                // console.log('⏭️ Skipping auto-connect: already attempted');
                return;
            }

            if (currentLivestream && isLive && currentLivestream.roomName && !isConnected && !isReconnectingRef.current) {
                autoConnectAttemptedRef.current = true;
                // console.log('🔄 Auto-connecting to livestream...', {
                //     roomName: currentLivestream.roomName,
                //     isLive,
                //     isConnected,
                //     hasStream: !!streamRef.current
                // });

                // Ensure media stream is started before connecting
                if (!streamRef.current) {
                    // console.log('🎥 Starting media stream before connect...');
                    try {
                        await startMediaStream();
                        // console.log('✅ Media stream started successfully');
                    } catch (error) {
                        console.error('❌ Failed to start media stream:', error);
                        autoConnectAttemptedRef.current = false;
                        showToast('Unable to access camera/microphone', 'error');
                        return;
                    }
                } else {
                    // console.log('ℹ️ Media stream already active');
                }

                // Try to get host token from API
                try {
                    // console.log('🎫 Getting host token...');
                    const tokenResponse = await Api.livestream.getToken({ roomName: currentLivestream.roomName });
                    if (tokenResponse.success) {
                        // console.log('✅ Token obtained, connecting to LiveKit...');
                        await connectToLiveKit(currentLivestream.roomName, tokenResponse.data.token);
                    } else {
                        console.error('❌ Failed to get token:', tokenResponse);
                        showToast('Unable to get token', 'error');
                        autoConnectAttemptedRef.current = false; // Reset on error to allow retry
                    }
                } catch (error) {
                    console.error('❌ Error getting token:', error);
                    showToast('Error getting token', 'error');
                    autoConnectAttemptedRef.current = false; // Reset on error to allow retry
                }
            } else {
                // console.log('⏭️ Conditions not met for auto-connect:', {
                //     hasCurrentLivestream: !!currentLivestream,
                //     isLive,
                //     hasRoomName: !!currentLivestream?.roomName,
                //     isConnected,
                //     isReconnecting: isReconnectingRef.current
                // });
            }
        };

        // Trigger auto-connect when conditions change
        if (currentLivestream && isLive && currentLivestream.roomName && !isConnected && !autoConnectAttemptedRef.current) {
            // console.log('⏰ Scheduling auto-connect in 1.5s...', {
            //     roomName: currentLivestream.roomName,
            //     isLive,
            //     isConnected
            // });
            // Debounce auto-connect to prevent multiple calls
            const timeoutId = setTimeout(connectIfNeeded, 1500);
            return () => {
                // console.log('🧹 Clearing auto-connect timeout');
                clearTimeout(timeoutId);
            };
        }

        // Reset flag when disconnected or stream changes
        if (!isLive || !currentLivestream || isConnected) {
            // if (autoConnectAttemptedRef.current) {
            //     console.log('🔄 Resetting auto-connect flag', {
            //         isLive,
            //         hasStream: !!currentLivestream,
            //         isConnected
            //     });
            // }
            autoConnectAttemptedRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLivestream, isLive, isConnected]);

    const setupMediaDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            const microphones = devices.filter(device => device.kind === 'audioinput');

            // console.log('✅ Media devices loaded:', { cameras: cameras.length, microphones: microphones.length });
        } catch (error) {
            console.error('❌ Error loading media devices:', error);
            setMediaError('Unable to access media devices');
        }
    };

    const startMediaStream = useCallback(async () => {
        try {
            setMediaError(null);

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: isVideoEnabled ? {
                    facingMode: 'user',
                    height: { ideal: 1920 },
                    width: { ideal: 1080 }
                } : false,
                audio: isAudioEnabled ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1, // Mono audio
                    sampleSize: 16
                } : false
            };

            // console.log('🎥 Requesting media with constraints:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            // console.log('✅ Media stream obtained:', {
            //     videoTracks: stream.getVideoTracks().length,
            //     audioTracks: stream.getAudioTracks().length
            // });

            // Ensure audio tracks are enabled and not muted
            const audioTracks = stream.getAudioTracks();
            audioTracks.forEach((track, index) => {
                // console.log(`🎤 Audio track ${index}:`, {
                //     enabled: track.enabled,
                //     muted: track.muted,
                //     readyState: track.readyState,
                //     label: track.label,
                //     kind: track.kind,
                //     settings: track.getSettings()
                // });

                // Ensure audio track is enabled
                if (!track.enabled) {
                    track.enabled = true;
                    // console.log(`🎤 Enabled audio track ${index}`);
                }

                // Ensure audio track is not muted
                if (track.muted) {
                    // Note: muted is read-only, but we can check settings
                    console.warn(`⚠️ Audio track ${index} is muted - check browser permissions`);
                }
            });

            if (localVideoRef.current) {
                // Only set srcObject if it's different to avoid AbortError
                if (localVideoRef.current.srcObject !== stream) {
                    localVideoRef.current.srcObject = stream;
                }
                try {
                    await localVideoRef.current.play();
                    setIsVideoPlaying(true);
                    setIsAudioPlaying(true);
                } catch (playError) {
                    // Ignore AbortError - it happens when play is interrupted by a new load
                    if (playError.name !== 'AbortError') {
                        console.error('❌ Error playing video:', playError);
                    }
                }
            }

            return stream;
        } catch (error) {
            console.error('❌ Error starting media stream:', error);
            setMediaError('Unable to access camera/microphone: ' + error.message);
            showToast('Unable to access camera/microphone', 'error');
            throw error;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isVideoEnabled, isAudioEnabled]);

    const stopMediaStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        setIsVideoPlaying(false);
        setIsAudioPlaying(false);
    };

    const checkMediaStatus = useCallback(() => {
        if (!streamRef.current) {
            setIsVideoPlaying(false);
            setIsAudioPlaying(false);
            return;
        }

        const stream = streamRef.current;
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        if (videoTrack) {
            setIsVideoPlaying(videoTrack.readyState === 'live' && videoTrack.enabled);
        } else {
            setIsVideoPlaying(false);
        }

        if (audioTrack) {
            setIsAudioPlaying(audioTrack.readyState === 'live' && audioTrack.enabled);
        } else {
            setIsAudioPlaying(false);
        }

        const videoElement = localVideoRef.current;
        if (videoElement) {
            setVideoDimensions({
                width: videoElement.videoWidth || 0,
                height: videoElement.videoHeight || 0
            });
        }
    }, []);

    const toggleVideo = useCallback(async () => {
        const newValue = !isVideoEnabled;
        setIsVideoEnabled(newValue);
        setIsVideoPlaying(newValue);

        if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                // Update LiveKit track if already published
                if (room && room.localParticipant) {
                    const publications = Array.from(room.localParticipant.videoTrackPublications.values());
                    let found = false;

                    // Check by track reference AND track ID to prevent duplicate publishing
                    for (const publication of publications) {
                        if (publication.track === videoTrack || publication.track?.id === videoTrack.id) {
                            // Track already published, just enable/disable it
                            if (publication.track) {
                                publication.track.enabled = newValue;
                            }
                            videoTrack.enabled = newValue;
                            // console.log('📹 Video track enabled:', newValue);
                            found = true;
                            break;
                        }
                    }

                    // If not published yet and we're enabling video, try to publish
                    if (!found && newValue && videoTrack.readyState === 'live') {
                        // console.log('📹 Video not published yet, attempting to publish...');
                        try {
                            if (room.state !== 'connected') {
                                console.warn('⚠️ Room not connected, skipping video publish');
                                return;
                            }

                            // Double-check: verify track is not already published (by ID)
                            const existingByTrackId = Array.from(room.localParticipant.videoTrackPublications.values())
                                .some(pub => pub.track?.id === videoTrack.id);

                            if (existingByTrackId) {
                                // console.log('ℹ️ Track already published (by ID), enabling it');
                                videoTrack.enabled = newValue;
                                return;
                            }

                            // Add timeout to prevent hanging
                            const publishPromise = room.localParticipant.publishTrack(videoTrack, { name: 'camera' });
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Publish timeout after 10 seconds')), 10000)
                            );

                            await Promise.race([publishPromise, timeoutPromise]);
                            // console.log('📹 Video track published successfully after toggle');
                            setIsPublishing(true);
                            isPublishingRef.current = true;
                        } catch (publishError) {
                            // Handle TrackInvalidError gracefully
                            if (publishError.message?.includes('already been published') ||
                                publishError.message?.includes('same ID')) {
                                // console.log('ℹ️ Track already published (duplicate detected), enabling it');
                                videoTrack.enabled = newValue;
                                setIsPublishing(true);
                            } else {
                                console.error('❌ Error publishing video track:', publishError);
                                showToast('Unable to enable camera', 'error');
                                // Revert state
                                setIsVideoEnabled(false);
                                setIsVideoPlaying(false);
                            }
                        }
                    } else {
                        videoTrack.enabled = newValue;
                    }
                } else {
                    videoTrack.enabled = newValue;
                }
            }
        }
        setTimeout(checkMediaStatus, 100);
    }, [isVideoEnabled, checkMediaStatus, room, showToast]);

    const toggleAudio = useCallback(async () => {
        const newValue = !isAudioEnabled;
        setIsAudioEnabled(newValue);
        setIsAudioPlaying(newValue);

        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                // Enable/disable the audio track
                audioTrack.enabled = newValue;
                // console.log(`🎤 Audio track enabled set to: ${newValue}`, {
                //     trackId: audioTrack.id,
                //     muted: audioTrack.muted,
                //     readyState: audioTrack.readyState
                // });

                // Update LiveKit track if published
                if (room && room.localParticipant) {
                    const publications = Array.from(room.localParticipant.audioTrackPublications.values());
                    let found = false;

                    // Check by track reference AND track ID to prevent duplicate publishing
                    for (const publication of publications) {
                        if (publication.track === audioTrack || publication.track?.id === audioTrack.id) {
                            // Track already published, just enable/disable it
                            if (publication.track) {
                                publication.track.enabled = newValue;
                            }
                            audioTrack.enabled = newValue;
                            // console.log('🎤 LiveKit audio track enabled:', newValue, {
                            //     publicationSid: publication.trackSid,
                            //     isMuted: publication.isMuted,
                            //     isSubscribed: publication.isSubscribed,
                            //     trackEnabled: publication.track?.enabled ?? audioTrack.enabled
                            // });
                            found = true;
                            break;
                        }
                    }

                    // If not published yet and we're enabling audio, try to publish
                    if (!found && newValue && audioTrack.readyState === 'live') {
                        // console.log('🎤 Audio not published yet, attempting to publish...');
                        try {
                            if (room.state !== 'connected') {
                                console.warn('⚠️ Room not connected, skipping audio publish');
                                return;
                            }

                            // Double-check: verify track is not already published (by ID)
                            const existingByTrackId = Array.from(room.localParticipant.audioTrackPublications.values())
                                .some(pub => pub.track?.id === audioTrack.id);

                            if (existingByTrackId) {
                                // console.log('ℹ️ Track already published (by ID), enabling it');
                                audioTrack.enabled = newValue;
                                return;
                            }

                            // Add timeout to prevent hanging
                            const publishPromise = room.localParticipant.publishTrack(audioTrack, {
                                name: 'microphone',
                                source: 'microphone'
                            });
                            const timeoutPromise = new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Publish timeout after 10 seconds')), 10000)
                            );

                            await Promise.race([publishPromise, timeoutPromise]);
                            // console.log('🎤 Audio track published successfully after toggle');
                            setIsPublishing(true);
                            isPublishingRef.current = true;
                        } catch (publishError) {
                            // Handle TrackInvalidError gracefully
                            if (publishError.message?.includes('already been published') ||
                                publishError.message?.includes('same ID')) {
                                // console.log('ℹ️ Track already published (duplicate detected), enabling it');
                                audioTrack.enabled = newValue;
                                setIsPublishing(true);
                            } else {
                                console.error('❌ Error publishing audio track:', publishError);
                                showToast('Unable to enable microphone', 'error');
                                // Revert state
                                setIsAudioEnabled(false);
                                setIsAudioPlaying(false);
                                audioTrack.enabled = false;
                            }
                        }
                    } else {
                        audioTrack.enabled = newValue;
                    }
                } else if (newValue && !streamRef.current.getAudioTracks().length) {
                    // If no audio track and trying to enable, restart media stream
                    // console.log('🎤 No audio track found, restarting media stream...');
                    try {
                        await startMediaStream();
                    } catch (error) {
                        console.error('❌ Error restarting media stream for audio:', error);
                        showToast('Unable to enable microphone', 'error');
                        setIsAudioEnabled(false);
                        setIsAudioPlaying(false);
                    }
                }
            } else if (newValue) {
                // No audio track but trying to enable - restart media stream
                // console.log('🎤 No audio track available, restarting media stream...');
                try {
                    await startMediaStream();
                } catch (error) {
                    console.error('❌ Error restarting media stream for audio:', error);
                    showToast('Unable to enable microphone', 'error');
                    setIsAudioEnabled(false);
                    setIsAudioPlaying(false);
                }
            }
        }

        setTimeout(checkMediaStatus, 100);
    }, [isAudioEnabled, checkMediaStatus, room, showToast, startMediaStream]);

    const connectToLiveKit = async (roomName, hostToken) => {
        // Prevent multiple simultaneous connections
        if (isReconnectingRef.current) {
            // console.log('🔄 Already reconnecting, skipping duplicate call');
            return;
        }

        // Prevent connection if already connected to same room
        const currentRoom = roomRef.current || room;
        if (currentRoom && currentRoom.name === roomName && currentRoom.state === 'connected') {
            // console.log('🔄 Already connected to same room, skipping');
            setIsConnected(true);
            setConnectionState('connected');
            setRoom(currentRoom);
            isReconnectingRef.current = false;
            return;
        }

        // If connecting to different room or current room is not connected, cleanup first
        if (currentRoom && currentRoom.name !== roomName) {
            // console.log('🔄 Switching to different room, cleaning up...');
            try {
                currentRoom.removeAllListeners();
                if (currentRoom.state !== 'disconnected' && currentRoom.state !== 'disconnecting') {
                    await Promise.race([
                        currentRoom.disconnect(),
                        new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 3000))
                    ]).catch(() => { });
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                console.warn('⚠️ Error cleaning up before new connection:', error.message);
            } finally {
                if (roomRef.current === currentRoom) {
                    roomRef.current = null;
                }
                setRoom(null);
            }
        }

        // Validate inputs
        if (!roomName || !hostToken) {
            console.error('❌ Invalid connection parameters:', { roomName, hasToken: !!hostToken });
            setLivekitError('Room name and token are required');
            autoConnectAttemptedRef.current = false;
            showToast('Missing connection information (room name or token)', 'error');
            return;
        }

        // Validate token format (basic check - LiveKit tokens are JWT)
        if (typeof hostToken !== 'string' || hostToken.length < 10) {
            console.error('❌ Invalid token format:', { tokenLength: hostToken?.length });
            setLivekitError('Invalid token');
            autoConnectAttemptedRef.current = false;
            showToast('Invalid token. Please try again.', 'error');
            return;
        }

        // Check LiveKit server URL
        if (!LIVEKIT_CONFIG.serverUrl || LIVEKIT_CONFIG.serverUrl.includes('example.com')) {
            console.error('❌ LiveKit server URL not configured:', LIVEKIT_CONFIG.serverUrl);
            setLivekitError('LiveKit server URL not configured. Please set VITE_LIVEKIT_SERVER_URL in .env');
            showToast('LiveKit server not configured. Please check configuration.', 'error');
            autoConnectAttemptedRef.current = false;
            return;
        }

        // Validate server URL format
        if (!LIVEKIT_CONFIG.serverUrl.startsWith('wss://') && !LIVEKIT_CONFIG.serverUrl.startsWith('ws://')) {
            console.error('❌ Invalid server URL format (must start with wss:// or ws://):', LIVEKIT_CONFIG.serverUrl);
            setLivekitError('Server URL format invalid (must start with wss:// or ws://)');
            showToast('LiveKit server URL format is incorrect.', 'error');
            autoConnectAttemptedRef.current = false;
            return;
        }

        try {
            isReconnectingRef.current = true;
            // console.log('🔗 Connecting to LiveKit room:', roomName);
            // console.log('🔗 LiveKit Server URL:', LIVEKIT_CONFIG.serverUrl);
            // console.log('🔗 Token length:', hostToken.length);
            setLivekitError(null);
            setConnectionState('connecting');

            // Clean up existing room connection properly
            const existingRoom = roomRef.current || room;
            if (existingRoom) {
                // console.log('🔌 Cleaning up existing room connection...', existingRoom.state);
                try {
                    // Remove all event listeners first to prevent memory leaks
                    existingRoom.removeAllListeners();

                    // Only disconnect if not already disconnected
                    if (existingRoom.state !== 'disconnected' && existingRoom.state !== 'disconnecting') {
                        // console.log('🔌 Disconnecting existing room...');
                        try {
                            await Promise.race([
                                existingRoom.disconnect(),
                                new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 3000))
                            ]);
                            // console.log('✅ Existing room disconnected');
                        } catch (disconnectError) {
                            console.warn('⚠️ Disconnect timeout or error:', disconnectError.message);
                        }
                    } else {
                        // console.log('ℹ️ Room already in disconnected/disconnecting state');
                    }

                    // Wait longer for cleanup to complete (WebSocket needs time to close)
                    await new Promise(resolve => setTimeout(resolve, 1500));
                } catch (error) {
                    console.warn('⚠️ Error cleaning up existing room (non-critical):', error.message);
                    // Continue anyway - cleanup error shouldn't block new connection
                } finally {
                    // Clear refs
                    if (roomRef.current === existingRoom) {
                        roomRef.current = null;
                    }
                    setRoom(null);
                }
            }

            // Start media stream first
            await startMediaStream();

            const roomOptions = {
                adaptiveStream: true,
                dynacast: true,
                // Disable data channels to prevent DataChannel errors
                dataChannelOptions: {
                    ordered: false,
                    maxRetransmits: 0
                },
                defaultAudioCaptureOptions: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                defaultVideoCaptureOptions: {
                    resolution: { width: 1920, height: 1080 },
                    facingMode: 'user'
                },
                publishDefaults: {
                    videoEncoding: {
                        maxBitrate: 3_000_000,
                        maxFramerate: 30
                    },
                    red: false
                }
            };

            const newRoom = new Room(roomOptions);

            newRoom.on(RoomEvent.Connected, async () => {
                console.log('✅ Connected to LiveKit room');
                setIsConnected(true);
                setConnectionState('connected');
                setLocalParticipant(newRoom.localParticipant);

                // Reset reconnect attempts counter on successful connection
                reconnectAttemptsRef.current = 0;

                // Auto-publish after connection is stable
                setTimeout(async () => {
                    if (!newRoom || newRoom.state !== 'connected' || !newRoom.localParticipant) {
                        // console.log('⚠️ Room not ready for publishing:', {
                        //     hasRoom: !!newRoom,
                        //     roomState: newRoom?.state,
                        //     hasParticipant: !!newRoom?.localParticipant
                        // });
                        return;
                    }

                    if (!streamRef.current) {
                        console.warn('⚠️ No media stream available');
                        return;
                    }

                    if (isPublishingRef.current) {
                        // console.log('⚠️ Already publishing or attempted to publish');
                        // Check if tracks are actually published
                        // const videoPublications = Array.from(newRoom.localParticipant.videoTrackPublications.values());
                        // const audioPublications = Array.from(newRoom.localParticipant.audioTrackPublications.values());
                        // console.log('📊 Current publications:', {
                        //     video: videoPublications.length,
                        //     audio: audioPublications.length
                        // });
                        return;
                    }

                    // console.log('📤 Starting to publish media...');
                    isPublishingRef.current = true; // Set flag at start to prevent duplicate attempts

                    try {
                        const videoTrack = streamRef.current.getVideoTracks()[0];
                        const audioTrack = streamRef.current.getAudioTracks()[0];

                        // console.log('📊 Available tracks:', {
                        //     video: !!videoTrack,
                        //     videoState: videoTrack?.readyState,
                        //     audio: !!audioTrack,
                        //     audioState: audioTrack?.readyState
                        // });

                        // Publish video first
                        if (videoTrack && videoTrack.readyState === 'live') {
                            const existingVideo = Array.from(newRoom.localParticipant.videoTrackPublications.values());
                            // Check both by length AND by track ID to prevent duplicates
                            const isAlreadyPublished = existingVideo.length > 0 ||
                                existingVideo.some(pub => pub.track?.id === videoTrack.id);

                            if (!isAlreadyPublished) {
                                // console.log('📹 Publishing video track...');
                                try {
                                    // Add timeout to prevent hanging
                                    const publishPromise = newRoom.localParticipant.publishTrack(videoTrack, { name: 'camera' });
                                    const timeoutPromise = new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('Publish timeout after 10 seconds')), 10000)
                                    );
                                    await Promise.race([publishPromise, timeoutPromise]);
                                    // console.log('✅ Video track published');
                                } catch (publishError) {
                                    // Handle duplicate track error gracefully
                                    if (publishError.message?.includes('already been published') ||
                                        publishError.message?.includes('same ID')) {
                                        // console.log('ℹ️ Video track already published (duplicate), continuing...');
                                    } else {
                                        console.error('❌ Error publishing video track:', publishError);
                                        throw publishError;
                                    }
                                }
                            } else {
                                // console.log('ℹ️ Video already published (or duplicate detected)');
                            }
                        } else {
                            console.warn('⚠️ Video track not ready:', videoTrack?.readyState);
                        }

                        // Wait before publishing audio
                        await new Promise(resolve => setTimeout(resolve, 2000));

                        // Publish audio
                        if (audioTrack && audioTrack.readyState === 'live') {
                            const existingAudio = Array.from(newRoom.localParticipant.audioTrackPublications.values());
                            // Check both by length AND by track ID to prevent duplicates
                            const isAlreadyPublished = existingAudio.length > 0 ||
                                existingAudio.some(pub => pub.track?.id === audioTrack.id);

                            if (!isAlreadyPublished) {
                                if (!audioTrack.enabled) {
                                    audioTrack.enabled = true;
                                }
                                // console.log('🎤 Publishing audio track...');
                                try {
                                    // Add timeout to prevent hanging
                                    const publishPromise = newRoom.localParticipant.publishTrack(audioTrack, {
                                        name: 'microphone',
                                        source: 'microphone'
                                    });
                                    const timeoutPromise = new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('Publish timeout after 10 seconds')), 10000)
                                    );
                                    await Promise.race([publishPromise, timeoutPromise]);
                                    // console.log('✅ Audio track published');
                                } catch (publishError) {
                                    // Handle duplicate track error gracefully
                                    if (publishError.message?.includes('already been published') ||
                                        publishError.message?.includes('same ID')) {
                                        // console.log('ℹ️ Audio track already published (duplicate), continuing...');
                                    } else {
                                        console.error('❌ Error publishing audio track:', publishError);
                                        throw publishError;
                                    }
                                }
                            } else {
                                // console.log('ℹ️ Audio already published (or duplicate detected)');
                            }
                        } else {
                            console.warn('⚠️ Audio track not ready:', audioTrack?.readyState);
                        }

                        setIsPublishing(true);
                        // console.log('🎉 Publishing completed successfully');
                    } catch (error) {
                        console.error('❌ Error during publishing:', error);
                        isPublishingRef.current = false; // Reset on error to allow retry
                        showToast('Error publishing media. Please try refreshing.', 'error');
                    }
                }, 5000); // Reduced to 5 seconds
            });

            newRoom.on(RoomEvent.Disconnected, async (reason) => {
                console.log('❌ Disconnected from LiveKit room:', reason);
                setIsConnected(false);
                setConnectionState('disconnected');
                setLocalParticipant(null);
                setRemoteParticipants([]);
                setIsPublishing(false);
                isPublishingRef.current = false;

                // Reset reconnecting flag on disconnect
                isReconnectingRef.current = false;

                // Clean up any pending operations
                if (newRoom.localParticipant) {
                    try {
                        // Unpublish all tracks gracefully
                        const videoTracks = Array.from(newRoom.localParticipant.videoTrackPublications.values());
                        const audioTracks = Array.from(newRoom.localParticipant.audioTrackPublications.values());

                        for (const videoTrack of videoTracks) {
                            await newRoom.localParticipant.unpublishTrack(videoTrack.track);
                        }
                        for (const audioTrack of audioTracks) {
                            await newRoom.localParticipant.unpublishTrack(audioTrack.track);
                        }
                    } catch (error) {
                        console.warn('⚠️ Error during track cleanup:', error);
                    }
                }

                // DISABLE AUTO-RECONNECT - Let auto-connect logic handle it instead
                // console.log('ℹ️ Disconnect detected. Resetting auto-connect flag to allow re-connection.');
                autoConnectAttemptedRef.current = false; // Reset to allow auto-connect to trigger again

                // Don't manually reconnect here - the auto-connect useEffect will handle it
                // This prevents the reconnection loop issue
            });

            newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
                // console.log('👤 Participant connected:', participant.identity);
                // Only add non-host participants to remote participants
                if (participant.identity !== 'Host') {
                    setRemoteParticipants(prev => [...prev, participant]);
                }
            });

            newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
                // console.log('👤 Participant disconnected:', participant.identity);
                // Only remove non-host participants from remote participants
                if (participant.identity !== 'Host') {
                    setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
                }
            });

            // Add connection error handling
            newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
                // console.log('🔗 Connection state changed:', state);
                setConnectionState(state);
            });

            newRoom.on(RoomEvent.MediaDevicesError, (error) => {
                console.error('❌ Media devices error:', error);
                setMediaError('Media device error: ' + error.message);
            });

            // Handle WebRTC errors
            newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
                // console.log('📤 Track published:', publication.trackSid, 'by', participant.identity);
            });

            newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
                // console.log('📤 Track unpublished:', publication.trackSid, 'by', participant.identity);
            });

            // Handle connection quality issues
            newRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
                // console.log('📊 Connection quality changed:', quality, 'for', participant.identity);
            });

            // Handle DataChannel errors - ignore them to prevent disconnection
            newRoom.on(RoomEvent.DataReceived, (payload, participant, kind, topic) => {
                // Silently handle data - don't log to prevent console spam
            });

            // Add global error handler to catch and ignore DataChannel errors
            const originalConsoleError = console.error;
            console.error = (...args) => {
                const message = args[0]?.toString() || '';
                if (message.includes('DataChannel error') || message.includes('Unknown DataChannel error')) {
                    // Ignore DataChannel errors to prevent disconnection
                    return;
                }
                originalConsoleError.apply(console, args);
            };

            // Create connection promise with proper error handling
            const connectPromise = newRoom.connect(LIVEKIT_CONFIG.serverUrl, hostToken);

            // Connection timeout - increased to 45 seconds for better reliability
            const timeoutPromise = new Promise((_, reject) => {
                const timeoutId = setTimeout(() => {
                    reject(new Error(`Connection timeout after 45 seconds. Server: ${LIVEKIT_CONFIG.serverUrl}`));
                }, 45000);

                // Clear timeout if connection succeeds
                connectPromise
                    .then(() => clearTimeout(timeoutId))
                    .catch(() => clearTimeout(timeoutId));
            });

            try {
                // console.log('⏳ Waiting for connection...');
                await Promise.race([connectPromise, timeoutPromise]);
                // console.log('✅ Connection promise resolved');
            } catch (error) {
                console.error('❌ Connection failed:', error.message);

                // Clean up room on timeout or error
                try {
                    // Remove listeners to prevent memory leaks
                    newRoom.removeAllListeners();

                    // Disconnect if not already disconnected
                    if (newRoom.state !== 'disconnected' && newRoom.state !== 'disconnecting') {
                        // console.log('🧹 Disconnecting failed room connection...');
                        await Promise.race([
                            newRoom.disconnect(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000))
                        ]).catch(disconnectError => {
                            console.warn('⚠️ Disconnect timeout or error (non-critical):', disconnectError.message);
                        });
                    }
                } catch (disconnectError) {
                    console.warn('⚠️ Error during cleanup (non-critical):', disconnectError.message);
                } finally {
                    // Always clean up refs
                    if (roomRef.current === newRoom) {
                        roomRef.current = null;
                    }
                    setRoom(null);
                }

                throw error;
            }
            setRoom(newRoom);
            roomRef.current = newRoom; // Store in ref
            isReconnectingRef.current = false; // Reset reconnecting flag

            // Restore original console.error
            console.error = originalConsoleError;

            // console.log('🎉 Successfully connected to LiveKit room');
        } catch (error) {
            // Restore original console.error in case of error
            if (typeof originalConsoleError !== 'undefined') {
                console.error = originalConsoleError;
            }

            console.error('❌ Error connecting to LiveKit:', error);
            setLivekitError(error.message);
            setConnectionState('error');
            isReconnectingRef.current = false; // Reset reconnecting flag on error

            // Provide specific error messages and diagnostic info
            if (error.message.includes('timeout')) {
                const diagnosticInfo = `
                    🔍 Diagnostic Info:
                    - Server URL: ${LIVEKIT_CONFIG.serverUrl}
                    - Room Name: ${roomName}
                    - Token Length: ${hostToken?.length || 0}
                    - Possible causes:
                      1. LiveKit server is not accessible from this machine
                      2. Token expired or invalid
                      3. Firewall/network blocking WebSocket connection
                      4. Server URL is incorrect
                `;
                console.error('💡 Connection Timeout Diagnostics:', diagnosticInfo);
                showToast('Connection timeout. Please check network and LiveKit server.', 'error');
            } else if (error.message.includes('token') || error.message.includes('unauthorized') || error.message.includes('403')) {
                console.error('💡 Token Error - Possible causes:', {
                    tokenLength: hostToken?.length,
                    roomName,
                    serverUrl: LIVEKIT_CONFIG.serverUrl
                });
                showToast('Invalid or expired token. Please try again.', 'error');
            } else if (error.message.includes('server') || error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
                console.error('💡 Server Connection Error:', {
                    serverUrl: LIVEKIT_CONFIG.serverUrl,
                    roomName
                });
                showToast('Unable to connect to LiveKit server. Check network and server URL.', 'error');
            } else {
                console.error('💡 Connection Error Details:', {
                    message: error.message,
                    serverUrl: LIVEKIT_CONFIG.serverUrl,
                    roomName
                });
                showToast(`Connection error: ${error.message}`, 'error');
            }

            // Reset auto-connect flag on error to allow manual retry
            autoConnectAttemptedRef.current = false;
        }
    };

    const disconnectFromLiveKit = async () => {
        const roomToDisconnect = roomRef.current || room;
        if (!roomToDisconnect) return;

        try {
            // console.log('🔌 Disconnecting from LiveKit...', roomToDisconnect.state);

            // Stop publishing first
            if (roomToDisconnect.localParticipant) {
                try {
                    const videoTracks = Array.from(roomToDisconnect.localParticipant.videoTrackPublications.values());
                    const audioTracks = Array.from(roomToDisconnect.localParticipant.audioTrackPublications.values());

                    for (const videoTrack of videoTracks) {
                        if (videoTrack.track) {
                            await roomToDisconnect.localParticipant.unpublishTrack(videoTrack.track).catch(e => {
                                console.warn('⚠️ Error unpublishing video track:', e.message);
                            });
                        }
                    }
                    for (const audioTrack of audioTracks) {
                        if (audioTrack.track) {
                            await roomToDisconnect.localParticipant.unpublishTrack(audioTrack.track).catch(e => {
                                console.warn('⚠️ Error unpublishing audio track:', e.message);
                            });
                        }
                    }
                    // console.log('📤 Stopped publishing tracks');
                } catch (error) {
                    console.warn('⚠️ Error stopping tracks:', error.message);
                }
            }

            // Remove all listeners to prevent memory leaks
            roomToDisconnect.removeAllListeners();

            // Wait a bit before disconnecting
            await new Promise(resolve => setTimeout(resolve, 300));

            // Disconnect with timeout
            if (roomToDisconnect.state !== 'disconnected') {
                await Promise.race([
                    roomToDisconnect.disconnect(),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000))
                ]).catch(e => {
                    console.warn('⚠️ Disconnect timeout (forcing cleanup):', e.message);
                });
            }

            // console.log('✅ Disconnected from LiveKit');
        } catch (error) {
            console.error('❌ Error disconnecting from LiveKit:', error.message);
        } finally {
            // Always force cleanup
            if (roomRef.current === roomToDisconnect) {
                roomRef.current = null;
            }
            setRoom(null);
            setIsConnected(false);
            setConnectionState('disconnected');
            setLocalParticipant(null);
            setRemoteParticipants([]);
            setIsPublishing(false);
            isPublishingRef.current = false;
            isReconnectingRef.current = false;
        }
    };

    const handleEndLivestream = async () => {
        if (!currentLivestream) return;

        try {
            setIsLoading(true);

            // Stop publishing before disconnecting
            if (room && room.localParticipant && isPublishing) {
                // console.log('🛑 Stopping publishing before ending livestream...');
                const videoTracks = Array.from(room.localParticipant.videoTrackPublications.values());
                const audioTracks = Array.from(room.localParticipant.audioTrackPublications.values());

                for (const videoTrack of videoTracks) {
                    await room.localParticipant.unpublishTrack(videoTrack.track);
                }
                for (const audioTrack of audioTracks) {
                    await room.localParticipant.unpublishTrack(audioTrack.track);
                }

                setIsPublishing(false);
                isPublishingRef.current = false;
                // console.log('✅ Stopped publishing');
            }

            await disconnectFromLiveKit();
            stopMediaStream();

            // console.log('📤 Ending livestream with ID:', currentLivestream.livestreamId);
            // console.log('📤 Current livestream object:', currentLivestream);

            // Try both _id and livestreamId
            const idToSend = currentLivestream._id || currentLivestream.livestreamId;
            // console.log('📤 Using ID:', idToSend);

            const response = await Api.livestream.end(idToSend);

            if (response.success) {
                setIsLive(false);
                isLiveRef.current = false;
                showToast('Livestream stopped successfully!', 'success');

                // Update current livestream status
                setCurrentLivestream(prev => prev ? { ...prev, status: 'ended' } : null);

                navigate('/livestream');
            } else {
                showToast(response.message || 'Unable to stop livestream', 'error');
            }
        } catch (error) {
            console.error('Error ending livestream:', error);
            showToast('Error stopping livestream', 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            localVideoRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    const checkLiveKitStatus = () => {
        // Count only viewers (exclude host)
        const totalParticipants = room?.participants?.size || 0;
        const viewers = room?.participants ?
            Array.from(room.participants.values()).filter(p => p.identity !== 'Host').length : 0;

        const status = {
            room: !!room,
            isConnected,
            connectionState,
            roomName: room?.name,
            totalParticipants: totalParticipants,
            viewers: viewers, // Only viewers, not including host
            localParticipant: !!room?.localParticipant,
            videoTracks: room?.localParticipant?.videoTrackPublications?.size || 0,
            audioTracks: room?.localParticipant?.audioTrackPublications?.size || 0
        };
        console.log('📊 LiveKit Status:', status); // Keep this one as it's used for debugging
    };

    const ensureVideoVisible = () => {
        if (localVideoRef.current && streamRef.current) {
            // Only set srcObject if different
            if (localVideoRef.current.srcObject !== streamRef.current) {
                localVideoRef.current.srcObject = streamRef.current;
            }

            localVideoRef.current.play()
                .then(() => {
                    checkMediaStatus();
                })
                .catch((error) => {
                    // Ignore AbortError
                    if (error.name !== 'AbortError') {
                        console.error('❌ Video play() failed:', error);
                    }
                });
        }
    };

    if (isLoading) {
        return (
            <Loading
                type="page"
                size="large"
                message="Loading livestream..."
                subMessage="Please wait a moment"
                fullScreen={true}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50">
            {/* Top Header Bar - Enhanced */}
            <div className="bg-white border-b border-gray-200 shadow-md sticky top-0 z-30 backdrop-blur-sm bg-white/95">
                <div className="px-8 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-5">
                            <div className="border-l border-gray-300 pl-5">
                                <div className="flex items-center gap-3">

                                    <div>
                                        <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                                            {currentLivestream?.title || 'LiveStream Dashboard'}
                                        </h1>
                                        {currentLivestream?.description && (
                                            <p className="text-sm text-gray-600 mt-0.5">{currentLivestream.description}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {/* Status Badge - Enhanced */}
                            <div className={`flex items-center gap-3 px-5 py-2.5 rounded-xl text-sm font-semibold shadow-lg transition-all ${isLive
                                ? 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-500/30'
                                : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-gray-500/20'
                                }`}>
                                <div className={`w-2.5 h-2.5 rounded-full ${isLive ? 'bg-white animate-pulse shadow-lg shadow-white/50' : 'bg-white/70'}`}></div>
                                <span className="uppercase tracking-wide">{isLive ? 'LIVE' : 'Offline'}</span>
                            </div>

                            {/* End Stream Button - Enhanced */}
                            <button
                                onClick={handleEndLivestream}
                                disabled={isLoading || !isLive}
                                className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl hover:from-red-700 hover:to-red-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl disabled:shadow-none font-semibold transform hover:scale-105 active:scale-95"
                            >
                                <Stop className="w-5 h-5" />
                                {isLoading ? 'Stopping...' : 'End Stream'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - Grid Layout */}
            <div className={`grid grid-cols-12 gap-8 p-8 transition-all duration-300 ${showComments ? 'pr-[440px]' : ''}`}>
                {/* Left Sidebar - Stats (3 columns) */}
                <div className="col-span-12 lg:col-span-3 space-y-6">
                    {/* Stream Info Card - Enhanced */}
                    {currentLivestream && (
                        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-5">
                                <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">Stream Info</h3>
                            </div>
                            <div className="space-y-4">
                                <div className="p-3 bg-gray-50 rounded-xl">
                                    <div className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Stream ID</div>
                                    <div className="text-sm font-mono font-semibold text-gray-900 break-all">{currentLivestream._id?.slice(-8) || 'N/A'}</div>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-xl">
                                    <div className="text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Room Name</div>
                                    <div className="text-sm font-mono font-semibold text-gray-900 break-all">{currentLivestream.roomName || 'N/A'}</div>
                                </div>
                                <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                                    <div className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wider">Current Viewers</div>
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-4xl font-black bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">{currentLivestream.currentViewers || 0}</span>
                                        <span className="text-sm text-blue-600 font-semibold">watching</span>
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-200">
                                        <div className="text-xs font-semibold text-green-700 mb-1 uppercase tracking-wider">Peak</div>
                                        <div className="text-2xl font-bold text-green-700">{currentLivestream.peakViewers || 0}</div>
                                    </div>
                                    <div className="p-3 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-200">
                                        <div className="text-xs font-semibold text-orange-700 mb-1 uppercase tracking-wider">Min</div>
                                        <div className="text-2xl font-bold text-orange-700">{currentLivestream.minViewers || 0}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Connection Status Card - Enhanced */}
                    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-shadow duration-300">
                        <div className="flex items-center gap-3 mb-5">
                            <h3 className="text-base font-bold text-gray-900 uppercase tracking-wide">Connection</h3>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Status</div>
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-md ${connectionState === 'connected'
                                    ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                                    : connectionState === 'connecting'
                                        ? 'bg-gradient-to-r from-yellow-500 to-orange-600 text-white'
                                        : 'bg-gradient-to-r from-red-500 to-rose-600 text-white'
                                    }`}>
                                    <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-white animate-pulse' :
                                        connectionState === 'connecting' ? 'bg-white animate-pulse' : 'bg-white/70'
                                        }`}></div>
                                    {connectionState === 'connected' ? 'Connected' :
                                        connectionState === 'connecting' ? 'Connecting' : 'Disconnected'}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Publishing</div>
                                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold shadow-md ${isPublishing ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white' : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white'
                                    }`}>
                                    {isPublishing ? 'Publishing' : 'Not Publishing'}
                                </div>
                            </div>
                            <div className="p-3 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border border-purple-200">
                                <div className="text-xs font-semibold text-purple-700 mb-1 uppercase tracking-wider">Viewers in Room</div>
                                <div className="text-2xl font-bold text-purple-700">{remoteParticipants.length}</div>
                            </div>
                        </div>
                    </div>

                    {/* Reactions Stats - Enhanced */}
                    {currentLivestream && (
                        <LiveStreamReactions liveId={currentLivestream._id} />
                    )}
                </div>

                {/* Main Content - Video (9 columns) */}
                <div className="col-span-12 lg:col-span-9">
                    <VideoPreview
                        localVideoRef={localVideoRef}
                        isVideoPlaying={isVideoPlaying}
                        isAudioPlaying={isAudioPlaying}
                        videoDimensions={videoDimensions}
                        isFullscreen={isFullscreen}
                        onToggleFullscreen={toggleFullscreen}
                        onToggleVideo={toggleVideo}
                        onToggleAudio={toggleAudio}
                        onCheckLiveKit={checkLiveKitStatus}
                        isConnected={isConnected}
                        isPublishing={isPublishing}
                        connectionState={connectionState}
                        remoteParticipants={remoteParticipants}
                        localParticipant={localParticipant}
                        currentLivestream={currentLivestream}
                        mediaError={mediaError}
                        livekitError={livekitError}
                    />
                </div>
            </div>

            {/* Comments Panel - Fixed Right Sidebar */}
            {currentLivestream && (
                <>
                    {/* Toggle Comments Button - Enhanced */}
                    <button
                        onClick={() => setShowComments(!showComments)}
                        className={`fixed bottom-8 right-8 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 ${showComments
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/50'
                            : 'bg-white text-gray-900 hover:bg-gray-50 border-2 border-gray-300 shadow-gray-500/30 hover:border-blue-500'
                            }`}
                    >
                        <Chat className="w-6 h-6" />
                        <span className="font-bold text-base">Comments</span>
                        {currentLivestream && (
                            <span className={`px-3 py-1 ${showComments ? 'bg-white/20' : 'bg-blue-500'} text-white text-sm font-bold rounded-full shadow-md`}>
                                {currentLivestream.currentViewers || 0}
                            </span>
                        )}
                    </button>

                    {/* Comments Panel - Slide from right */}
                    <LiveStreamComments
                        liveId={currentLivestream._id}
                        hostId={currentLivestream.hostId?._id || currentLivestream.hostId || user?._id}
                        isVisible={showComments}
                        onToggle={() => setShowComments(!showComments)}
                    />
                </>
            )}
        </div>
    );
};

export default LiveStreamDashboard;
