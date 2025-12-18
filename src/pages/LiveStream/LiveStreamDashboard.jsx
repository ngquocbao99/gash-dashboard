import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import { useToast } from '../../hooks/useToast';
import { Stop } from '@mui/icons-material';
import { Room, RoomEvent } from 'livekit-client';
import VideoPreview from './components/VideoPreview';
import LiveStreamComments from './components/LiveStreamComments';
import LiveStreamReactions from './components/LiveStreamReactions';
import { LIVEKIT_CONFIG } from '../../config/livekit';
import Loading from '../../components/Loading';
import { Chat } from '@mui/icons-material';
import LiveStreamProducts from './components/LiveStreamProducts';
import io from 'socket.io-client';

// Normalize socket URL - remove trailing slash and ensure proper format
const getSocketURL = () => {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    // Remove trailing slash if present
    return apiUrl.replace(/\/$/, '');
};

const SOCKET_URL = getSocketURL();

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
    const [showComments, setShowComments] = useState(true); // Default: show comments
    const [isOwner, setIsOwner] = useState(false); // Check if current user is the owner

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
    const [liveDuration, setLiveDuration] = useState('00:00:00');

    // Refs
    const localVideoRef = useRef(null);
    const streamRef = useRef(null);
    const currentLivestreamRef = useRef(null);
    const isLiveRef = useRef(false);
    const isPublishingRef = useRef(false);
    const roomRef = useRef(null); // Store room ref to prevent stale disconnect
    const isReconnectingRef = useRef(false); // Flag to prevent multiple simultaneous reconnects
    const autoConnectAttemptedRef = useRef(false); // Flag to prevent multiple auto-connect attempts

    // Track ongoing API calls to prevent duplicate requests
    const ongoingCallsRef = useRef({
        updateViewerCount: false,
    });

    // Helper: Format date/time to dd/mm/yyyy HH:mm
    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (error) {
            return '';
        }
    };

    // Load livestream details function
    const loadLivestreamDetails = useCallback(async () => {
        try {
            setIsLoading(true);
            // Use getById to allow staff to access livestreams they don't own
            const response = await Api.livestream.getById(livestreamId);

            if (response.success) {
                const livestream = response.data?.livestream;

                if (livestream) {
                    // Ensure _id is set correctly (may be undefined)
                    // Backend returns peakViewers and minViewers calculated real-time
                    const livestreamWithId = {
                        ...livestream,
                        _id: livestream._id || livestreamId,
                        peakViewers: livestream.peakViewers ?? 0,
                        minViewers: livestream.minViewers ?? 0,
                        currentViewers: livestream.currentViewers ?? 0
                    };
                    setCurrentLivestream(livestreamWithId);
                    currentLivestreamRef.current = livestreamWithId;
                    setIsLive(livestream.status === 'live');
                    isLiveRef.current = livestream.status === 'live';

                    // Check if current user is the owner
                    const hostId = livestream.hostId?._id || livestream.hostId;
                    const userId = user?._id;
                    const isUserOwner = hostId && userId && (
                        hostId.toString() === userId.toString() ||
                        hostId === userId
                    );
                    setIsOwner(isUserOwner);
                } else {
                    showToast('Livestream not found', 'error');
                    navigate('/livestream');
                }
            } else {
                showToast(response.message || 'Unable to load livestream information', 'error');
                navigate('/livestream');
            }
        } catch (error) {
            console.error('Error loading livestream details:', error);
            showToast('Error loading livestream information', 'error');
            navigate('/livestream');
        } finally {
            setIsLoading(false);
        }
    }, [livestreamId, user, showToast, navigate]);

    // Load livestream data on mount
    useEffect(() => {
        loadLivestreamDetails();
    }, [livestreamId, loadLivestreamDetails]);

    // Timer for live duration
    useEffect(() => {
        if (!currentLivestream?.startTime) return;

        const updateTimer = () => {
            const startTime = new Date(currentLivestream.startTime);
            const endTime = currentLivestream.endTime ? new Date(currentLivestream.endTime) : null;
            const now = new Date();
            const end = endTime || now;

            const diffMs = end - startTime;
            const totalSeconds = Math.floor(diffMs / 1000);

            const hours = Math.floor(totalSeconds / 3600);
            const minutes = Math.floor((totalSeconds % 3600) / 60);
            const seconds = totalSeconds % 60;

            const formatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            setLiveDuration(formatted);
        };

        // Update immediately
        updateTimer();

        // Update every second if live
        let interval;
        if (isLive && !currentLivestream.endTime) {
            interval = setInterval(updateTimer, 1000);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [currentLivestream?.startTime, currentLivestream?.endTime, isLive]);

    // Handle viewer count update from socket (real-time) - only update currentViewers
    // Peak and min are calculated by backend and synced via periodic API calls
    const handleViewerCountUpdate = useCallback((count) => {
        setCurrentLivestream(prev => {
            if (!prev) {
                return prev;
            }

            // Only update currentViewers from socket
            // Peak and min come from backend via periodic sync
            const currentCount = typeof count === 'number' ? count : 0;

            if (prev.currentViewers === currentCount) {
                return prev;
            }

            return {
                ...prev,
                currentViewers: currentCount
            };
        });
    }, []);

    // Setup Socket.IO for viewer count updates (real-time via socket, with periodic sync)
    useEffect(() => {
        if (!isLive || !currentLivestream?._id) return;

        const livestreamIdForSocket = currentLivestream?._id;

        if (!livestreamIdForSocket) {
            return;
        }

        // Create socket with proper configuration
        const socket = io(SOCKET_URL, {
            transports: ['polling', 'websocket'], // Try polling first, then upgrade to websocket
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: false,
            autoConnect: true,
            // Additional options for better compatibility
            upgrade: true,
            rememberUpgrade: true,
        });

        let isConnected = false;
        let joinRoomAttempted = false;

        const joinRoom = () => {
            if (socket.connected && !joinRoomAttempted) {
                joinRoomAttempted = true;
                socket.emit('joinLivestreamRoom', livestreamIdForSocket);
            }
        };

        socket.on('connect', () => {
            isConnected = true;
            joinRoomAttempted = false;
            // Join livestream room to receive viewer count updates
            joinRoom();
        });

        socket.on('disconnect', (reason) => {
            isConnected = false;
            joinRoomAttempted = false;
            // Allow automatic reconnection
        });

        socket.on('connect_error', (error) => {
            // Socket.IO will automatically retry
            // Only log after multiple failures
            if (socket.io.reconnecting) {
                // Reconnecting, don't log
            }
        });

        socket.on('reconnect', (attemptNumber) => {
            isConnected = true;
            // Re-join room after reconnection
            joinRoom();
        });

        // Listen for viewer count updates from backend
        socket.on('viewer:count', (data) => {
            try {
                if (data?.liveId === livestreamIdForSocket && typeof data?.count === 'number') {
                    handleViewerCountUpdate(data.count);
                }
            } catch (e) {
                console.error('Error handling viewer count update:', e);
            }
        });

        return () => {
            // Cleanup function
            try {
                // Remove all listeners first
                socket.off('connect');
                socket.off('disconnect');
                socket.off('connect_error');
                socket.off('reconnect');
                socket.off('viewer:count');

                // Leave room before disconnecting (only if connected)
                if (socket.connected && joinRoomAttempted) {
                    socket.emit('leaveLivestreamRoom', livestreamIdForSocket);
                    // Wait a bit for the emit to complete
                    setTimeout(() => {
                        socket.disconnect();
                    }, 100);
                } else {
                    socket.disconnect();
                }
            } catch (error) {
                // Force disconnect if cleanup fails
                try {
                    socket.disconnect();
                } catch (e) {
                    // Ignore
                }
            }
        };
    }, [isLive, currentLivestream?._id, handleViewerCountUpdate]);



    // Periodic sync for viewer count (fallback and peak/min tracking) - more frequent for faster updates
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
                    const response = await Api.livestream.getById(livestreamId);
                    if (response.success) {
                        // Backend returns: { success: true, data: { livestream: {...} } }
                        const currentStream = response.data?.livestream;

                        if (currentStream) {
                            const newViewers = currentStream.currentViewers ?? 0;
                            const backendPeak = currentStream.peakViewers ?? 0;
                            const backendMin = currentStream.minViewers ?? 0;

                            // Get peak/min from backend (backend calculates real-time)
                            setCurrentLivestream(prev => {
                                if (!prev) return prev;

                                // Check if any value changed
                                const hasChanges =
                                    prev.currentViewers !== newViewers ||
                                    prev.peakViewers !== backendPeak ||
                                    prev.minViewers !== backendMin;

                                if (!hasChanges) {
                                    return prev;
                                }

                                return {
                                    ...prev,
                                    currentViewers: newViewers,
                                    peakViewers: backendPeak,
                                    minViewers: backendMin
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

        // Sync every 5 seconds for faster updates (was 30 seconds)
        const interval = setInterval(syncViewerCount, 5000);

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

            // Clear room refs
            if (roomRef.current) {
                roomRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    // Auto-connect and start live when data is loaded (only for owner)
    useEffect(() => {
        const connectIfNeeded = async () => {

            // Prevent multiple attempts
            if (autoConnectAttemptedRef.current) {
                // console.log('⏭️ Skipping auto-connect: already attempted');
                return;
            }

            // Only auto-connect if user is the owner
            if (currentLivestream && isLive && currentLivestream.roomName && !isConnected && !isReconnectingRef.current && isOwner) {
                autoConnectAttemptedRef.current = true;


                // Ensure media stream is started before connecting
                if (!streamRef.current) {
                    // console.log('🎥 Starting media stream before connect...');
                    try {
                        // Ensure audio is enabled before starting stream
                        if (!isAudioEnabled) {
                            setIsAudioEnabled(true);
                        }
                        await startMediaStream();
                        // console.log('Media stream started successfully');

                        // Verify audio track exists and is enabled
                        const audioTrack = streamRef.current?.getAudioTracks()[0];
                        if (audioTrack) {
                            audioTrack.enabled = true;
                            setIsAudioEnabled(true);
                            setIsAudioPlaying(true);
                        }
                    } catch (error) {
                        console.error('Failed to start media stream:', error);
                        autoConnectAttemptedRef.current = false;
                        showToast('Unable to access camera/microphone', 'error');
                        return;
                    }
                } else {
                    // Ensure audio is enabled in existing stream
                    const audioTrack = streamRef.current?.getAudioTracks()[0];
                    if (audioTrack) {
                        audioTrack.enabled = true;
                        setIsAudioEnabled(true);
                        setIsAudioPlaying(true);
                    }
                }

                // Try to get host token from API
                try {
                    const tokenResponse = await Api.livestream.getToken({ roomName: currentLivestream.roomName });
                    if (tokenResponse.success) {
                        // console.log('Token obtained, connecting to LiveKit...');
                        await connectToLiveKit(currentLivestream.roomName, tokenResponse.data.token);
                    } else {
                        console.error('Failed to get token:', tokenResponse);
                        showToast('Unable to get token', 'error');
                        autoConnectAttemptedRef.current = false; // Reset on error to allow retry
                    }
                } catch (error) {
                    console.error('Error getting token:', error);
                    showToast('Error getting token', 'error');
                    autoConnectAttemptedRef.current = false; // Reset on error to allow retry
                }
            } else {
            }
        };

        // Trigger auto-connect when conditions change (only for owner)
        if (currentLivestream && isLive && currentLivestream.roomName && !isConnected && !autoConnectAttemptedRef.current && isOwner) {
            // Debounce auto-connect to prevent multiple calls
            const timeoutId = setTimeout(connectIfNeeded, 1500);
            return () => {
                // console.log('🧹 Clearing auto-connect timeout');
                clearTimeout(timeoutId);
            };
        }

        // Reset flag when disconnected or stream changes
        if (!isLive || !currentLivestream || isConnected || !isOwner) {
            autoConnectAttemptedRef.current = false;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLivestream, isLive, isConnected, isOwner]);


    const startMediaStream = useCallback(async () => {
        try {
            setMediaError(null);

            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
            }

            // Always request audio by default (unless explicitly disabled)
            // This ensures audio is available even if isAudioEnabled state hasn't been set yet
            const shouldRequestAudio = isAudioEnabled !== false;

            // Try with enhanced audio constraints first (for Chrome/Edge)
            let constraints = {
                video: isVideoEnabled ? {
                    facingMode: 'user',
                    height: { ideal: 1920 },
                    width: { ideal: 1080 }
                } : false,
                audio: shouldRequestAudio ? {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1,
                    googEchoCancellation: true,
                    googAutoGainControl: true,
                    googNoiseSuppression: true,
                    googHighpassFilter: true,
                    googTypingNoiseDetection: true
                } : false
            };

            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {
                // Fallback to basic constraints if enhanced constraints fail
                if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
                    console.warn('⚠️ Enhanced audio constraints not supported, using basic constraints');
                    constraints = {
                        video: isVideoEnabled ? {
                            facingMode: 'user',
                            height: { ideal: 1920 },
                            width: { ideal: 1080 }
                        } : false,
                        audio: shouldRequestAudio ? {
                            echoCancellation: true,
                            noiseSuppression: true,
                            autoGainControl: true
                        } : false
                    };
                    stream = await navigator.mediaDevices.getUserMedia(constraints);
                } else {
                    throw error;
                }
            }
            streamRef.current = stream;

            // Ensure audio tracks are enabled and not muted
            const audioTracks = stream.getAudioTracks();
            audioTracks.forEach((track, index) => {


                // Always ensure audio track is enabled
                track.enabled = true;
                // console.log(`Audio track ${index} enabled:`, track.enabled);

                // Ensure audio track is not muted
                if (track.muted) {
                    // console.warn(`⚠️ Audio track ${index} is muted - check browser permissions`);
                }
            });

            // Log audio track info
            if (audioTracks.length === 0) {
                console.warn('⚠️ No audio tracks found in stream');
            }

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
                        console.error('Error playing video:', playError);
                    }
                }
            }

            return stream;
        } catch (error) {
            console.error('Error starting media stream:', error);
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
                                console.error('Error publishing video track:', publishError);
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

                // Always enable/disable the audio track
                audioTrack.enabled = newValue;

                // Update LiveKit track if published
                if (room && room.localParticipant && room.state === 'connected') {
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
                            found = true;
                            break;
                        }
                    }

                    // If not published yet and we're enabling audio, try to publish
                    if (!found && newValue) {
                        try {
                            // Ensure track is enabled before publishing
                            audioTrack.enabled = true;

                            // Wait for track to be ready if needed
                            let retries = 0;
                            while (audioTrack.readyState !== 'live' && retries < 5) {
                                await new Promise(resolve => setTimeout(resolve, 200));
                                retries++;
                            }

                            // Double-check: verify track is not already published (by ID)
                            const existingByTrackId = Array.from(room.localParticipant.audioTrackPublications.values())
                                .some(pub => pub.track?.id === audioTrack.id || pub.source === 'microphone');

                            if (existingByTrackId) {
                                console.log('ℹ️ Track already published (by ID), enabling it');
                                const existingPub = Array.from(room.localParticipant.audioTrackPublications.values())
                                    .find(pub => pub.track?.id === audioTrack.id || pub.source === 'microphone');
                                if (existingPub?.track) {
                                    existingPub.track.enabled = true;
                                }
                                audioTrack.enabled = true;
                                setIsPublishing(true);
                                isPublishingRef.current = true;
                                return;
                            }

                            // Only publish if track is ready
                            if (audioTrack.readyState === 'live') {
                                // Add timeout to prevent hanging
                                const publishPromise = room.localParticipant.publishTrack(audioTrack, {
                                    name: 'microphone',
                                    source: 'microphone'
                                });
                                const timeoutPromise = new Promise((_, reject) =>
                                    setTimeout(() => reject(new Error('Publish timeout after 10 seconds')), 10000)
                                );

                                const publication = await Promise.race([publishPromise, timeoutPromise]);

                                // CRITICAL: Ensure track is enabled after publishing
                                audioTrack.enabled = true;

                                // Wait for publication to be attached
                                await new Promise(resolve => setTimeout(resolve, 300));

                                // Verify publication and ensure track is enabled
                                const publishedAudio = Array.from(room.localParticipant.audioTrackPublications.values());
                                const publishedTrack = publishedAudio.find(pub =>
                                    pub.track?.id === audioTrack.id ||
                                    pub.trackSid === publication?.trackSid ||
                                    pub.source === 'microphone'
                                );

                                if (publishedTrack) {
                                    if (publishedTrack.track) {
                                        publishedTrack.track.enabled = true;
                                    }
                                    if (typeof publishedTrack.setEnabled === 'function') {
                                        try {
                                            publishedTrack.setEnabled(true);
                                        } catch (e) {
                                            // Ignore
                                        }
                                    }
                                }

                                // Ensure source track is enabled
                                audioTrack.enabled = true;

                                setIsPublishing(true);
                                isPublishingRef.current = true;
                                console.log('Audio track published via toggle');
                            } else {
                                console.warn('⚠️ Audio track not ready for publishing:', audioTrack.readyState);
                                audioTrack.enabled = newValue;
                            }
                        } catch (publishError) {
                            // Handle TrackInvalidError gracefully
                            if (publishError.message?.includes('already been published') ||
                                publishError.message?.includes('same ID')) {
                                console.log('ℹ️ Track already published (duplicate detected), enabling it');
                                const existingPub = Array.from(room.localParticipant.audioTrackPublications.values())
                                    .find(pub => pub.track?.id === audioTrack.id || pub.source === 'microphone');
                                if (existingPub?.track) {
                                    existingPub.track.enabled = true;
                                }
                                audioTrack.enabled = true;
                                setIsPublishing(true);
                                isPublishingRef.current = true;
                            } else {
                                console.error('Error publishing audio track:', publishError);
                                showToast('Unable to enable microphone', 'error');
                                // Revert state
                                setIsAudioEnabled(false);
                                setIsAudioPlaying(false);
                                audioTrack.enabled = false;
                            }
                        }
                    } else if (!found && newValue) {
                        audioTrack.enabled = newValue;
                    }
                } else if (newValue && !streamRef.current.getAudioTracks().length) {
                    // If no audio track and trying to enable, restart media stream
                    // console.log('🎤 No audio track found, restarting media stream...');
                    try {
                        await startMediaStream();
                    } catch (error) {
                        console.error('Error restarting media stream for audio:', error);
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
                    console.error('Error restarting media stream for audio:', error);
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
            console.error('Invalid connection parameters:', { roomName, hasToken: !!hostToken });
            setLivekitError('Room name and token are required');
            autoConnectAttemptedRef.current = false;
            showToast('Missing connection information (room name or token)', 'error');
            return;
        }

        // Validate token format (basic check - LiveKit tokens are JWT)
        if (typeof hostToken !== 'string' || hostToken.length < 10) {
            console.error('Invalid token format:', { tokenLength: hostToken?.length });
            setLivekitError('Invalid token');
            autoConnectAttemptedRef.current = false;
            showToast('Invalid token. Please try again.', 'error');
            return;
        }

        // Check LiveKit server URL
        if (!LIVEKIT_CONFIG.serverUrl || LIVEKIT_CONFIG.serverUrl.includes('example.com')) {
            console.error('LiveKit server URL not configured:', LIVEKIT_CONFIG.serverUrl);
            setLivekitError('LiveKit server URL not configured. Please set VITE_LIVEKIT_SERVER_URL in .env');
            showToast('LiveKit server not configured. Please check configuration.', 'error');
            autoConnectAttemptedRef.current = false;
            return;
        }

        // Validate server URL format
        if (!LIVEKIT_CONFIG.serverUrl.startsWith('wss://') && !LIVEKIT_CONFIG.serverUrl.startsWith('ws://')) {
            console.error('Invalid server URL format (must start with wss:// or ws://):', LIVEKIT_CONFIG.serverUrl);
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
                        } catch (disconnectError) {
                            console.warn('⚠️ Disconnect timeout or error:', disconnectError.message);
                        }
                    } else {
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

            // Verify stream was created successfully
            if (!streamRef.current) {
                setLivekitError('Unable to start media stream');
                autoConnectAttemptedRef.current = false;
                showToast('Unable to access camera/microphone', 'error');
                return;
            }

            // Ensure audio track is enabled
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = true;
                setIsAudioEnabled(true);
                setIsAudioPlaying(true);
            }

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
                    autoGainControl: true,
                    sampleRate: 48000,
                    channelCount: 1
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
                // console.log('Connected to LiveKit room');
                setIsConnected(true);
                setConnectionState('connected');
                setLocalParticipant(newRoom.localParticipant);

                // Connection successful

                // Auto-publish after connection is stable
                setTimeout(async () => {
                    if (!newRoom || newRoom.state !== 'connected' || !newRoom.localParticipant) {
                        return;
                    }

                    // Ensure media stream is available before publishing
                    if (!streamRef.current) {
                        console.warn('⚠️ No media stream available, attempting to start stream...');
                        try {
                            // Ensure audio is enabled
                            if (!isAudioEnabled) {
                                setIsAudioEnabled(true);
                            }
                            await startMediaStream();

                            // Verify stream was created
                            if (!streamRef.current) {
                                console.error('Failed to start media stream');
                                showToast('Unable to access camera/microphone', 'error');
                                return;
                            }

                            // Ensure audio track is enabled
                            const audioTrack = streamRef.current?.getAudioTracks()[0];
                            if (audioTrack) {
                                audioTrack.enabled = true;
                                setIsAudioEnabled(true);
                                setIsAudioPlaying(true);
                            }
                        } catch (error) {
                            showToast('Unable to access camera/microphone', 'error');
                            return;
                        }
                    }

                    // Final check - stream must exist and have active tracks
                    if (!streamRef.current) {
                        console.error('Media stream still not available after restart attempt');
                        return;
                    }

                    // Verify stream has active tracks
                    const videoTracks = streamRef.current.getVideoTracks();
                    const audioTracks = streamRef.current.getAudioTracks();
                    if (videoTracks.length === 0 && audioTracks.length === 0) {
                        console.warn('⚠️ Media stream exists but has no active tracks, attempting to restart...');
                        try {
                            if (!isAudioEnabled) {
                                setIsAudioEnabled(true);
                            }
                            await startMediaStream();

                            if (!streamRef.current) {
                                console.error('Failed to restart media stream');
                                return;
                            }
                        } catch (error) {
                            console.error('Error restarting media stream:', error);
                            return;
                        }
                    }

                    if (isPublishingRef.current) {
                        return;
                    }

                    isPublishingRef.current = true; // Set flag at start to prevent duplicate attempts

                    try {
                        const videoTrack = streamRef.current.getVideoTracks()[0];
                        const audioTrack = streamRef.current.getAudioTracks()[0];

                        // Publish video first
                        if (videoTrack && videoTrack.readyState === 'live') {
                            const existingVideo = Array.from(newRoom.localParticipant.videoTrackPublications.values());
                            // Check both by length AND by track ID to prevent duplicates
                            const isAlreadyPublished = existingVideo.length > 0 ||
                                existingVideo.some(pub => pub.track?.id === videoTrack.id);

                            if (!isAlreadyPublished) {
                                try {
                                    // Add timeout to prevent hanging
                                    const publishPromise = newRoom.localParticipant.publishTrack(videoTrack, { name: 'camera' });
                                    const timeoutPromise = new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('Publish timeout after 10 seconds')), 10000)
                                    );
                                    await Promise.race([publishPromise, timeoutPromise]);
                                } catch (publishError) {
                                    // Handle duplicate track error gracefully
                                    if (publishError.message?.includes('already been published') ||
                                        publishError.message?.includes('same ID')) {
                                    } else {
                                        console.error('Error publishing video track:', publishError);
                                        throw publishError;
                                    }
                                }
                            } else {
                            }
                        } else {
                            console.warn('⚠️ Video track not ready:', videoTrack?.readyState);
                        }

                        // Wait before publishing audio
                        await new Promise(resolve => setTimeout(resolve, 800));

                        // Publish audio - Simplified and more reliable approach
                        if (!audioTrack) {
                            console.error('No audio track found in stream! Cannot publish audio.');
                            // Try to restart stream with audio if missing
                            try {
                                setIsAudioEnabled(true);
                                await startMediaStream();
                                const newAudioTrack = streamRef.current?.getAudioTracks()[0];
                                if (newAudioTrack && newAudioTrack.readyState === 'live') {
                                    newAudioTrack.enabled = true;
                                    try {
                                        const publishPromise = newRoom.localParticipant.publishTrack(newAudioTrack, {
                                            name: 'microphone',
                                            source: 'microphone'
                                        });
                                        const timeoutPromise = new Promise((_, reject) =>
                                            setTimeout(() => reject(new Error('Publish timeout')), 10000)
                                        );
                                        const publication = await Promise.race([publishPromise, timeoutPromise]);
                                        // Ensure enabled after publish
                                        newAudioTrack.enabled = true;
                                        if (publication?.track) {
                                            publication.track.enabled = true;
                                        }
                                        if (typeof publication?.setEnabled === 'function') {
                                            publication.setEnabled(true);
                                        }
                                    } catch (restartPublishError) {
                                        console.error('Error publishing audio after restart:', restartPublishError);
                                    }
                                }
                            } catch (restartError) {
                            }
                        } else {
                            // Ensure audio track is enabled and ready
                            audioTrack.enabled = true;

                            // Wait for track to be ready if needed
                            let retries = 0;
                            while (audioTrack.readyState !== 'live' && retries < 3) {
                                await new Promise(resolve => setTimeout(resolve, 500));
                                retries++;
                            }

                            if (audioTrack.readyState === 'live' && audioTrack.enabled) {
                                // Check if already published
                                const existingAudio = Array.from(newRoom.localParticipant.audioTrackPublications.values());
                                const isAlreadyPublished = existingAudio.some(pub =>
                                    pub.track?.id === audioTrack.id ||
                                    pub.source === 'microphone'
                                );

                                if (!isAlreadyPublished) {
                                    // Unpublish any existing audio tracks first to avoid conflicts
                                    for (const pub of existingAudio) {
                                        try {
                                            if (pub.track) {
                                                await newRoom.localParticipant.unpublishTrack(pub.track).catch(() => { });
                                            }
                                        } catch (e) {
                                            // Ignore errors
                                        }
                                    }
                                    if (existingAudio.length > 0) {
                                        await new Promise(resolve => setTimeout(resolve, 300));
                                    }

                                    // Ensure track is enabled before publishing
                                    audioTrack.enabled = true;

                                    try {
                                        // Publish audio track
                                        const publishPromise = newRoom.localParticipant.publishTrack(audioTrack, {
                                            name: 'microphone',
                                            source: 'microphone'
                                        });
                                        const timeoutPromise = new Promise((_, reject) =>
                                            setTimeout(() => reject(new Error('Publish timeout after 10 seconds')), 10000)
                                        );
                                        const publication = await Promise.race([publishPromise, timeoutPromise]);

                                        // CRITICAL: Ensure track is enabled after publishing
                                        audioTrack.enabled = true;

                                        // Wait for publication to attach
                                        await new Promise(resolve => setTimeout(resolve, 500));

                                        // Find and enable the published track
                                        const publishedAudio = Array.from(newRoom.localParticipant.audioTrackPublications.values());
                                        const publishedTrack = publishedAudio.find(pub =>
                                            pub.track?.id === audioTrack.id ||
                                            pub.trackSid === publication?.trackSid ||
                                            pub.source === 'microphone'
                                        );

                                        if (publishedTrack) {
                                            if (publishedTrack.track) {
                                                publishedTrack.track.enabled = true;
                                            }
                                            if (typeof publishedTrack.setEnabled === 'function') {
                                                try {
                                                    publishedTrack.setEnabled(true);
                                                } catch (e) {
                                                    // Ignore
                                                }
                                            }
                                        }

                                        // Ensure source track stays enabled
                                        audioTrack.enabled = true;
                                    } catch (publishError) {
                                        // Handle duplicate track error gracefully
                                        if (publishError.message?.includes('already been published') ||
                                            publishError.message?.includes('same ID')) {
                                            const existingPub = existingAudio.find(pub => pub.track?.id === audioTrack.id);
                                            if (existingPub?.track) {
                                                existingPub.track.enabled = true;
                                            }
                                            audioTrack.enabled = true;
                                        } else {
                                            // Don't throw - allow video to continue even if audio fails
                                        }
                                    }
                                } else {
                                    // Already published - just ensure it's enabled
                                    const existingPub = existingAudio.find(pub =>
                                        pub.track?.id === audioTrack.id ||
                                        pub.source === 'microphone'
                                    );
                                    if (existingPub) {
                                        if (existingPub.track) {
                                            existingPub.track.enabled = true;
                                        }
                                        if (typeof existingPub.setEnabled === 'function') {
                                            try {
                                                existingPub.setEnabled(true);
                                            } catch (e) {
                                                // Ignore
                                            }
                                        }
                                    }
                                    audioTrack.enabled = true;
                                }
                            } else {
                                console.warn('⚠️ Audio track not ready:', {
                                    readyState: audioTrack.readyState,
                                    enabled: audioTrack.enabled
                                });
                                // Still try to publish if track exists (LiveKit might handle it)
                                if (audioTrack.readyState !== 'ended') {
                                    try {
                                        audioTrack.enabled = true;
                                        const publishPromise = newRoom.localParticipant.publishTrack(audioTrack, {
                                            name: 'microphone',
                                            source: 'microphone'
                                        });
                                        const timeoutPromise = new Promise((_, reject) =>
                                            setTimeout(() => reject(new Error('Publish timeout')), 10000)
                                        );
                                        await Promise.race([publishPromise, timeoutPromise]);
                                        audioTrack.enabled = true;
                                    } catch (retryError) {
                                        console.error('Retry audio publish failed:', retryError);
                                    }
                                }
                            }
                        }

                        setIsPublishing(true);
                    } catch (error) {
                        console.error('Error during publishing:', error);
                        isPublishingRef.current = false; // Reset on error to allow retry
                        showToast('Error publishing media. Please try refreshing.', 'error');
                    }
                }, 5000); // Reduced to 5 seconds
            });

            newRoom.on(RoomEvent.Disconnected, async (reason) => {
                console.log('Disconnected from LiveKit room:', reason);
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
                autoConnectAttemptedRef.current = false; // Reset to allow auto-connect to trigger again

                // Don't manually reconnect here - the auto-connect useEffect will handle it
                // This prevents the reconnection loop issue
            });

            newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
                // Only add non-host participants to remote participants
                if (participant.identity !== 'Host') {
                    setRemoteParticipants(prev => [...prev, participant]);
                }
            });

            newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
                // Only remove non-host participants from remote participants
                if (participant.identity !== 'Host') {
                    setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
                }
            });

            // Add connection error handling
            newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
                setConnectionState(state);
            });

            newRoom.on(RoomEvent.MediaDevicesError, (error) => {
                setMediaError('Media device error: ' + error.message);
            });

            // Handle WebRTC errors
            newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
            });

            newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
            });

            // Handle connection quality issues
            newRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
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

                await Promise.race([connectPromise, timeoutPromise]);

            } catch (error) {
                console.error('Connection failed:', error.message);

                // Clean up room on timeout or error
                try {
                    // Remove listeners to prevent memory leaks
                    newRoom.removeAllListeners();

                    // Disconnect if not already disconnected
                    if (newRoom.state !== 'disconnected' && newRoom.state !== 'disconnecting') {
                        await Promise.race([
                            newRoom.disconnect(),
                            new Promise((_, reject) => setTimeout(() => reject(new Error('Disconnect timeout')), 5000))
                        ]).catch(disconnectError => {
                        });
                    }
                } catch (disconnectError) {
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

        } catch (error) {
            // Restore original console.error in case of error
            if (typeof originalConsoleError !== 'undefined') {
                console.error = originalConsoleError;
            }

            console.error('Error connecting to LiveKit:', error);
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

            // console.log('Disconnected from LiveKit');
        } catch (error) {
            console.error('Error disconnecting from LiveKit:', error.message);
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
        if (!currentLivestream) {
            showToast('No livestream found', 'error');
            return;
        }

        // Check if user is the owner (host)
        const isOwner = currentLivestream.hostId && (
            (typeof currentLivestream.hostId === 'object' && (currentLivestream.hostId._id === user?._id || currentLivestream.hostId.id === user?._id)) ||
            (typeof currentLivestream.hostId === 'string' && currentLivestream.hostId === user?._id)
        );

        if (!isOwner) {
            showToast('Only the livestream owner can end the stream', 'error');
            return;
        }

        // Check if livestream is already ended
        if (currentLivestream.status === 'ended') {
            showToast('Livestream is already ended.', 'info');
            return;
        }

        // Check if livestream is not live
        if (currentLivestream.status !== 'live') {
            showToast(`Cannot end livestream. Current status: ${currentLivestream.status}`, 'warning');
            return;
        }

        // Declare livestreamIdStr outside try block so it's accessible in catch
        let livestreamIdStr = null;

        try {
            setIsLoading(true);

            // Stop publishing before disconnecting
            if (room && room.localParticipant && isPublishing) {
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
            }

            await disconnectFromLiveKit();
            stopMediaStream();

            // Get livestream ID - try multiple sources in order of preference
            let idToSend = null;

            // First priority: _id from currentLivestream (most reliable)
            if (currentLivestream._id) {
                idToSend = currentLivestream._id;
            }
            // Second priority: livestreamId from URL params
            else if (livestreamId) {
                idToSend = livestreamId;
            }
            // Third priority: livestreamId from currentLivestream object
            else if (currentLivestream.livestreamId) {
                idToSend = currentLivestream.livestreamId;
            }

            if (!idToSend) {
                console.error('No livestream ID found:', {
                    hasCurrentLivestream: !!currentLivestream,
                    currentLivestreamId: currentLivestream?._id,
                    currentLivestreamLivestreamId: currentLivestream?.livestreamId,
                    paramsLivestreamId: livestreamId
                });
                showToast('Livestream ID is missing', 'error');
                setIsLoading(false);
                return;
            }

            // Convert to string - handle MongoDB ObjectId objects if needed
            if (typeof idToSend === 'string') {
                livestreamIdStr = idToSend.trim();
            } else if (idToSend && typeof idToSend.toString === 'function') {
                // Handle MongoDB ObjectId objects or other objects with toString method
                livestreamIdStr = idToSend.toString().trim();
            } else {
                livestreamIdStr = String(idToSend).trim();
            }

            // Check if it's a valid ObjectId format (24 hex characters)
            const objectIdRegex = /^[0-9a-fA-F]{24}$/;
            if (!objectIdRegex.test(livestreamIdStr)) {
                console.error('Invalid livestream ID format:', {
                    received: livestreamIdStr,
                    length: livestreamIdStr.length,
                    type: typeof idToSend,
                    original: idToSend
                });
                showToast('Invalid livestream ID format. Please refresh and try again.', 'error');
                setIsLoading(false);
                return;
            }

            const response = await Api.livestream.end(livestreamIdStr);

            if (response.success) {
                setIsLive(false);
                isLiveRef.current = false;
                showToast('Livestream ended successfully', 'success');

                // Update current livestream status
                setCurrentLivestream(prev => prev ? { ...prev, status: 'ended' } : null);

                navigate('/livestream');
            } else {
                const errorMessage = response.message || 'Unable to stop livestream';
                console.error('Failed to end livestream:', response);
                showToast(errorMessage, 'error');
            }
        } catch (error) {
            console.error('Error ending livestream:', error);

            // Extract backend response data if available
            const backendResponse = error?.response?.data;
            const backendMessage = backendResponse?.message;
            const backendStatus = error?.response?.status;

            console.error('🔍 Error details:', {
                message: error?.message,
                backendResponse: backendResponse,
                backendMessage: backendMessage,
                status: backendStatus,
                currentLivestreamId: currentLivestream?._id || currentLivestream?.livestreamId,
                currentLivestreamStatus: currentLivestream?.status,
                paramsLivestreamId: livestreamId,
                requestPayload: livestreamIdStr ? { livestreamId: livestreamIdStr } : null,
                fullError: error
            });

            // Provide more specific error messages based on backend response
            let errorMessage = 'Error stopping livestream';

            // Priority 1: Use message from backend (most accurate)
            if (backendMessage) {
                errorMessage = backendMessage;
            }
            // Priority 2: Provide helpful message based on status code
            else if (backendStatus === 400) {
                // Check if we can determine the specific reason
                if (currentLivestream?.status !== 'live') {
                    errorMessage = `Livestream is not live (current status: ${currentLivestream?.status || 'unknown'}). It may have already been ended.`;
                } else {
                    errorMessage = 'Invalid request. The livestream may not exist or cannot be ended.';
                }
            } else if (backendStatus === 403) {
                errorMessage = 'You do not have permission to end this livestream. Only the host or admin can end it.';
            } else if (backendStatus === 404) {
                errorMessage = 'Livestream not found.';
            } else if (backendStatus === 500) {
                errorMessage = 'Server error. Please try again later.';
            }
            // Priority 3: Generic error message
            else if (error?.message && !error.message.includes('Network error')) {
                errorMessage = error.message;
            }

            // console.error('📢 Showing error message to user:', errorMessage);
            showToast(errorMessage, 'error');
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

    const checkLiveKitStatus = async () => {
        // Count only viewers (exclude host)
        const totalParticipants = room?.participants?.size || 0;
        const viewers = room?.participants ?
            Array.from(room.participants.values()).filter(p => p.identity !== 'Host').length : 0;

        // Check audio publishing status
        const audioPublications = room?.localParticipant ?
            Array.from(room.localParticipant.audioTrackPublications.values()) : [];
        const audioStatus = audioPublications.map(pub => ({
            trackSid: pub.trackSid,
            isMuted: pub.isMuted,
            enabled: pub.track?.enabled ?? false,
            readyState: pub.track?.readyState,
            kind: pub.track?.kind,
            name: pub.trackName || pub.source
        }));


        // Log detailed audio status
        if (audioStatus.length > 0) {
            audioStatus.forEach((audio, index) => {
                // Check actual track from stream, not just publication
                const actualAudioTrack = streamRef.current?.getAudioTracks()[0];
                const actualReadyState = actualAudioTrack?.readyState;
                const actualEnabled = actualAudioTrack?.enabled;
                const actualMuted = actualAudioTrack?.muted;

                // Use actual track state if publication track is undefined
                const effectiveEnabled = audio.enabled && (actualEnabled !== false);
                const effectiveMuted = audio.isMuted || actualMuted || false;
                const effectiveReadyState = actualReadyState || audio.readyState;

                const isTransmitting = effectiveEnabled && !effectiveMuted && effectiveReadyState === 'live';

                // Auto-fix if track is published but has issues (wrapped in async IIFE)
                if (room?.localParticipant && actualAudioTrack && actualReadyState === 'live') {
                    const publication = Array.from(room.localParticipant.audioTrackPublications.values())
                        .find(pub => pub.trackSid === audio.trackSid || pub.track?.id === actualAudioTrack.id);

                    // If publication track is undefined, not valid, disabled, or has no track instance, republish
                    const needsRepublish = publication && (
                        !publication.track ||
                        publication.track.readyState === undefined ||
                        !publication.track.enabled ||
                        publication.enabled === false
                    );

                    if (needsRepublish) {
                        (async () => {
                            try {
                                // Unpublish ALL audio tracks first
                                const allAudio = Array.from(room.localParticipant.audioTrackPublications.values());
                                for (const pub of allAudio) {
                                    if (pub.track) {
                                        await room.localParticipant.unpublishTrack(pub.track).catch(e => {
                                            // console.warn('Warning unpublishing:', e);
                                        });
                                    }
                                }
                                // Wait longer for cleanup
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                // Republish with correct track - ensure enabled before
                                actualAudioTrack.enabled = true;
                                const newPublication = await room.localParticipant.publishTrack(actualAudioTrack, {
                                    name: 'microphone',
                                    source: 'microphone'
                                });
                                // Wait for track instance to attach
                                await new Promise(resolve => setTimeout(resolve, 1000));
                                // Enable after republish
                                actualAudioTrack.enabled = true;
                                if (newPublication?.track) {
                                    newPublication.track.enabled = true;
                                } else {
                                    console.error('Republished but still no track instance!');
                                }
                                if (typeof newPublication?.setEnabled === 'function') {
                                    newPublication.setEnabled(true);
                                }

                            } catch (republishError) {
                                console.error('Error republishing audio:', republishError);
                            }
                        })();
                    } else if (!actualEnabled || !audio.enabled) {
                        actualAudioTrack.enabled = true;
                        if (publication?.track) {
                            publication.track.enabled = true;
                        }
                    }
                }
            });
        } else {
            // console.warn('⚠️ No audio tracks published!');

            // Try to republish if stream has audio track
            if (room?.localParticipant && streamRef.current) {
                const audioTrack = streamRef.current.getAudioTracks()[0];
                if (audioTrack && audioTrack.readyState === 'live' && isAudioEnabled) {

                    audioTrack.enabled = true;
                    room.localParticipant.publishTrack(audioTrack, {
                        name: 'microphone',
                        source: 'microphone'
                    }).then(() => {

                    }).catch((error) => {

                    });
                }
            }
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
        <div className="min-h-screen bg-gray-50">
            {/* Top Header Bar - Compact Dashboard Style */}
            <div className="bg-white border-b-2 border-gray-300 shadow-lg sticky top-0 z-50">
                <div className="max-w-[1920px] mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div>
                                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    {currentLivestream?.title || 'Livestream Dashboard'}
                                </h1>
                                {!isOwner && (
                                    <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        Support Mode - View and control the livestream
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Quick Stats - Compact */}
                            {currentLivestream && (
                                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 shadow-md">
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500 font-medium">Min</div>
                                        <div className="text-base font-bold text-gray-900">{currentLivestream.minViewers || 0}</div>
                                    </div>
                                    <div className="h-6 w-px bg-gray-300"></div>
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500 font-medium">Peak</div>
                                        <div className="text-base font-bold text-green-600">{currentLivestream.peakViewers || 0}</div>
                                    </div>
                                    <div className="h-6 w-px bg-gray-300"></div>
                                    <div className="text-center">
                                        <div className="text-xs text-gray-500 font-medium">Views</div>
                                        <div className="text-base font-bold text-purple-600">{remoteParticipants.length}</div>
                                    </div>
                                </div>
                            )}

                            {/* Connection Status - Compact - Only show for owner */}
                            {isOwner && (
                                <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 shadow-md">
                                    <div className="flex items-center gap-2">
                                        <svg className="w-4 h-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
                                        </svg>
                                        <span className="text-xs font-semibold text-gray-700">Connection</span>
                                    </div>
                                    <div className="h-6 w-px bg-gray-300"></div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${connectionState === 'connected' ? 'bg-green-500 animate-pulse' :
                                            connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
                                            }`}></div>
                                        <span className="text-xs font-semibold text-gray-700">{connectionState === 'connected' ? 'Connected' :
                                            connectionState === 'connecting' ? 'Connecting' : 'Disconnected'}</span>
                                    </div>
                                    <div className="h-6 w-px bg-gray-300"></div>
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${isPublishing ? 'bg-green-600' : 'bg-gray-400'}`}></div>
                                        <span className="text-xs font-semibold text-gray-700">{isPublishing ? 'Publishing' : 'Not Publishing'}</span>
                                    </div>
                                </div>
                            )}

                            {/* Status Badge */}
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold shadow-md ${isLive
                                ? 'bg-gradient-to-r from-red-400 to-red-600 text-white border border-red-500'
                                : 'bg-gradient-to-r from-gray-400 to-gray-600 text-white border border-gray-500'
                                }`}>
                                <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-white animate-pulse' : 'bg-white'}`}></div>
                                <span>{isLive ? 'LIVE' : 'Offline'}</span>
                            </div>

                            {/* End Stream Button - Only show for owner */}
                            {isOwner && (
                                <button
                                    onClick={handleEndLivestream}
                                    disabled={isLoading || !isLive}
                                    className="flex items-center gap-2 px-4 py-1.5 text-white rounded-lg disabled:bg-gray-300 disabled:cursor-not-allowed transition-all font-semibold text-sm shadow-md hover:shadow-lg bg-gradient-to-r from-red-500 to-red-700 hover:from-red-600 hover:to-red-800 transform hover:scale-105 disabled:transform-none"
                                >
                                    <Stop className="w-4 h-4" />
                                    {isLoading ? 'Stopping...' : 'End Stream'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Dashboard Content - Professional Layout */}
            <div className="max-w-[1920px] mx-auto p-4">
                <div className="grid grid-cols-12 gap-4">
                    {/* Left Sidebar - Connection Info & Quick Stats */}
                    <div className="col-span-12 lg:col-span-2 space-y-4 flex flex-col h-[calc(100vh-120px)] max-h-[900px]">
                        {/* Livestream Info Card */}
                        {currentLivestream && (
                            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex-shrink-0">
                                <h3 className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide flex items-center gap-2">
                                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    Livestream Info
                                </h3>
                                <div className="space-y-2">

                                    {currentLivestream.description && (
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] text-gray-600 font-semibold">Description</span>
                                            <div className="text-xs text-gray-700 line-clamp-2">
                                                {currentLivestream.description}
                                            </div>
                                        </div>
                                    )}
                                    <div className="pt-1.5 border-t border-gray-200">
                                        <div className="text-[10px] text-gray-600 font-semibold mb-0.5">Duration</div>
                                        <div className={`text-xs font-bold font-mono ${isLive ? 'text-green-600' : 'text-gray-700'}`}>
                                            {liveDuration}
                                        </div>
                                        {isLive && (
                                            <div className="flex items-center gap-1 mt-0.5">
                                                <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></div>
                                                <span className="text-[9px] text-red-600 font-semibold">LIVE</span>
                                            </div>
                                        )}
                                    </div>
                                    {currentLivestream.startTime && (
                                        <div className="pt-1.5 border-t border-gray-200">
                                            <div className="text-[10px] text-gray-600 font-semibold mb-0.5">Started</div>
                                            <div className="text-xs text-gray-900">
                                                {formatDateTime(currentLivestream.startTime)}
                                            </div>
                                        </div>
                                    )}
                                    {/* {currentLivestream.endTime && (
                                        <div className="pt-1.5 border-t border-gray-200">
                                            <div className="text-[10px] text-gray-600 font-semibold mb-0.5">Ended</div>
                                            <div className="text-xs text-gray-900">
                                                {formatDateTime(currentLivestream.endTime)}
                                            </div>
                                        </div>
                                    )} */}
                                    {currentLivestream.hostId && (
                                        <div className="pt-1.5 border-t border-gray-200">
                                            <div className="text-[10px] text-gray-600 font-semibold mb-0.5">Host</div>
                                            <div className="text-xs text-gray-900 truncate">
                                                {currentLivestream.hostId?.name || currentLivestream.hostId?.username || 'Unknown'}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Engagement Card */}
                        {currentLivestream && (
                            <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-3 flex-1 min-h-0 flex flex-col">
                                <h3 className="text-xs font-bold text-gray-900 mb-2 uppercase tracking-wide flex items-center gap-2 flex-shrink-0">
                                    <svg className="w-4 h-4 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                                    </svg>
                                    Reaction
                                </h3>
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    <LiveStreamReactions liveId={currentLivestream._id} />
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Center - Video Preview (Main Focus) - Only show for owner */}
                    {isOwner && (
                        <div className={`col-span-12 ${showComments ? 'lg:col-span-4' : 'lg:col-span-7'} flex flex-col`}>
                            <div className="h-[calc(100vh-120px)] max-h-[900px] flex flex-col">
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
                    )}

                    {/* Right Sidebar - Comments & Products */}
                    {currentLivestream && showComments && (
                        <>
                            <div className={`col-span-12 ${isOwner ? 'lg:col-span-3' : 'lg:col-span-5'}`}>
                                <LiveStreamComments
                                    liveId={currentLivestream._id}
                                    hostId={currentLivestream.hostId?._id || currentLivestream.hostId || user?._id}
                                    isVisible={showComments}
                                    onToggle={() => setShowComments(!showComments)}
                                />
                            </div>
                            {/* Products Management */}
                            <div className={`col-span-12 ${isOwner ? 'lg:col-span-3' : 'lg:col-span-5'} bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-120px)] max-h-[900px]`}>
                                <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-shrink-0">
                                    <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                        <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                        </svg>
                                        Products Management
                                    </h3>
                                </div>
                                <div className="flex-1 min-h-0 overflow-hidden">
                                    <div className="p-3 h-full">
                                        <LiveStreamProducts liveId={currentLivestream._id} />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {/* Products Management - When comments are hidden */}
                    {currentLivestream && !showComments && (
                        <div className={`col-span-12 ${isOwner ? 'lg:col-span-3' : 'lg:col-span-10'} bg-white rounded-lg shadow-lg border border-gray-200 overflow-hidden flex flex-col h-[calc(100vh-120px)] max-h-[900px]`}>
                            <div className="p-3 border-b border-gray-200 bg-gray-50 rounded-t-lg flex-shrink-0">
                                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wide flex items-center gap-2">
                                    <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                    Products Management
                                </h3>
                            </div>
                            <div className="flex-1 min-h-0 overflow-hidden">
                                <div className="p-3 h-full">
                                    <LiveStreamProducts liveId={currentLivestream._id} />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Toggle Comments Button - Only show when comments are hidden */}
            {currentLivestream && !showComments && (
                <button
                    onClick={() => setShowComments(true)}
                    className="fixed bottom-5 right-5 z-50 flex items-center gap-1.5 px-4 py-2.5 text-white rounded-lg shadow-lg transition-all duration-300 bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                >
                    <Chat className="w-4 h-4" />
                    <span className="font-semibold text-sm">Show Comments</span>
                </button>
            )}
        </div>
    );
};

export default LiveStreamDashboard;
