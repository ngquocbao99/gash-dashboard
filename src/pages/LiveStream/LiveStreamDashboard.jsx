import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import { useToast } from '../../hooks/useToast';
import { Stop, Fullscreen, FullscreenExit } from '@mui/icons-material';
import { Room, RoomEvent } from 'livekit-client';
import VideoPreview from './components/VideoPreview';
import { LIVEKIT_CONFIG } from '../../config/livekit';
import Loading from '../../components/Loading';

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

    // Load livestream details function
    const loadLivestreamDetails = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await Api.livestream.getHost();
            console.log('📋 Response from getHost:', response);
            if (response.success) {
                const livestreams = response.data?.livestreams || response.data || [];
                console.log('📋 Livestreams array:', livestreams);
                const livestream = livestreams.find(ls => ls._id === livestreamId || ls.livestreamId === parseInt(livestreamId));
                if (livestream) {
                    setCurrentLivestream(livestream);
                    currentLivestreamRef.current = livestream;
                    setIsLive(livestream.status === 'live');
                    isLiveRef.current = livestream.status === 'live';
                } else {
                    showToast('Không tìm thấy livestream', 'error');
                    navigate('/livestream');
                }
            } else {
                showToast('Không thể tải thông tin livestream', 'error');
            }
        } catch (error) {
            console.error('Error loading livestream details:', error);
            showToast('Lỗi khi tải thông tin livestream', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [livestreamId, showToast, navigate]);

    // Load livestream data on mount
    useEffect(() => {
        loadLivestreamDetails();
        setupMediaDevices();
    }, [livestreamId, loadLivestreamDetails]);

    // Real-time viewer count update
    useEffect(() => {
        if (!isLive || !currentLivestream) return;

        const updateViewerCount = async () => {
            try {
                const response = await Api.livestream.getHost();
                if (response.success) {
                    const livestreams = response.data?.livestreams || response.data || [];
                    const currentStream = livestreams.find(ls => ls._id === livestreamId);
                    if (currentStream) {
                        setCurrentLivestream(prev => ({
                            ...prev,
                            currentViewers: currentStream.currentViewers,
                            peakViewers: currentStream.peakViewers,
                            minViewers: currentStream.minViewers
                        }));
                    }
                }
            } catch (error) {
                console.error('Error updating viewer count:', error);
            }
        };

        // Update every 5 seconds
        const interval = setInterval(updateViewerCount, 5000);
        return () => clearInterval(interval);
    }, [isLive, currentLivestream, livestreamId]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (room) {
                room.disconnect().catch((error) => {
                    console.error('Error disconnecting on unmount:', error);
                });
            }
            if (streamRef.current) {
                stopMediaStream();
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
            if (currentLivestream && isLive && currentLivestream.roomName && !isConnected && !isReconnectingRef.current) {
                console.log('🔄 Auto-connecting to livestream...');
                // Try to get host token from API
                try {
                    const tokenResponse = await Api.livestream.getToken({ roomName: currentLivestream.roomName });
                    if (tokenResponse.success) {
                        connectToLiveKit(currentLivestream.roomName, tokenResponse.data.token);
                    } else {
                        showToast('Không thể lấy token', 'error');
                    }
                } catch (error) {
                    console.error('Error getting token:', error);
                    showToast('Lỗi khi lấy token', 'error');
                }
            }
        };

        // Debounce auto-connect to prevent multiple calls
        const timeoutId = setTimeout(connectIfNeeded, 1000);
        return () => clearTimeout(timeoutId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentLivestream, isLive, isConnected]);

    const setupMediaDevices = async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            const microphones = devices.filter(device => device.kind === 'audioinput');

            console.log('✅ Media devices loaded:', { cameras: cameras.length, microphones: microphones.length });
        } catch (error) {
            console.error('❌ Error loading media devices:', error);
            setMediaError('Không thể truy cập thiết bị media');
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
                    noiseSuppression: true
                } : false
            };

            console.log('🎥 Requesting media with constraints:', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            console.log('✅ Media stream obtained:', {
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length
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
            setMediaError('Không thể truy cập camera/microphone: ' + error.message);
            showToast('Không thể truy cập camera/microphone', 'error');
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
                videoTrack.enabled = newValue;

                // Update LiveKit track if published
                if (room && room.localParticipant) {
                    const publications = Array.from(room.localParticipant.videoTrackPublications.values());
                    for (const publication of publications) {
                        if (publication.track === videoTrack) {
                            publication.setEnabled(newValue);
                            console.log('📹 Video track enabled:', newValue);
                            break;
                        }
                    }
                }
            }
        }
        setTimeout(checkMediaStatus, 100);
    }, [isVideoEnabled, checkMediaStatus, room]);

    const toggleAudio = useCallback(async () => {
        const newValue = !isAudioEnabled;
        setIsAudioEnabled(newValue);
        setIsAudioPlaying(newValue);

        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = newValue;

                // Update LiveKit track if published
                if (room && room.localParticipant) {
                    const publications = Array.from(room.localParticipant.audioTrackPublications.values());
                    for (const publication of publications) {
                        if (publication.track === audioTrack) {
                            publication.setEnabled(newValue);
                            console.log('🎤 Audio track enabled:', newValue);
                            break;
                        }
                    }
                }
            }
        }
        setTimeout(checkMediaStatus, 100);
    }, [isAudioEnabled, checkMediaStatus, room]);

    const connectToLiveKit = async (roomName, hostToken) => {
        // Prevent multiple simultaneous connections
        if (isReconnectingRef.current) {
            console.log('🔄 Already reconnecting, skipping duplicate call');
            return;
        }

        // Prevent connection if already connected to same room
        if (room && room.name === roomName && room.state === 'connected') {
            console.log('🔄 Already connected to same room, skipping');
            return;
        }

        try {
            isReconnectingRef.current = true;
            console.log('🔗 Connecting to LiveKit room:', roomName);
            setLivekitError(null);
            setConnectionState('connecting');

            // Validate inputs
            if (!roomName || !hostToken) {
                throw new Error('Room name and token are required');
            }

            // Only disconnect if room is actually connected
            const existingRoom = roomRef.current || room;
            if (existingRoom && existingRoom.state === 'connected') {
                console.log('🔌 Disconnecting existing connected room...');
                try {
                    await existingRoom.disconnect();
                    // Wait a bit for cleanup
                    await new Promise(resolve => setTimeout(resolve, 500));
                } catch (error) {
                    console.error('Error disconnecting existing room:', error);
                }
            } else if (existingRoom) {
                console.log('🔌 Existing room not connected, skipping disconnect');
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

                // Wait a bit before publishing to ensure connection is stable
                setTimeout(async () => {
                    // Double-check connection is still stable and not already publishing
                    if (streamRef.current && newRoom.state === 'connected' && !isReconnectingRef.current && !isPublishingRef.current) {
                        console.log('📤 Auto-publishing media after connection...');
                        try {
                            const videoTrack = streamRef.current?.getVideoTracks()[0];
                            const audioTrack = streamRef.current?.getAudioTracks()[0];

                            console.log('📹 Tracks found:', { video: !!videoTrack, audio: !!audioTrack });

                            // Check if tracks are already published
                            const existingVideoTracks = Array.from(newRoom.localParticipant.videoTrackPublications.values());
                            const existingAudioTracks = Array.from(newRoom.localParticipant.audioTrackPublications.values());

                            if (videoTrack && videoTrack.readyState === 'live' && existingVideoTracks.length === 0) {
                                await newRoom.localParticipant.publishTrack(videoTrack, { name: 'camera' });
                                console.log('📹 Video track published');
                            }

                            if (audioTrack && audioTrack.readyState === 'live' && existingAudioTracks.length === 0) {
                                await newRoom.localParticipant.publishTrack(audioTrack, { name: 'microphone' });
                                console.log('🎤 Audio track published');
                            }

                            setIsPublishing(true);
                            isPublishingRef.current = true;
                            console.log('🎉 Media published successfully');
                        } catch (error) {
                            console.error('❌ Error auto-publishing:', error);
                            // Don't disconnect on publish error, just log it
                        }
                    } else {
                        console.log('⚠️ Connection not stable or already publishing, skipping auto-publish');
                    }
                }, 2000); // Wait 2 seconds for connection to stabilize
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

                // Only attempt reconnection for unexpected disconnections
                if (reason !== 'CLIENT_INITIATED' && reason !== 'SERVER_SHUTDOWN' && reason !== 'ROOM_DELETED' && isLiveRef.current && !isReconnectingRef.current) {
                    if (reconnectAttemptsRef.current < maxReconnectAttempts) {
                        reconnectAttemptsRef.current += 1;
                        console.log(`🔄 Attempting to reconnect (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`);

                        // Use longer delay to prevent rapid reconnection loops
                        const delay = Math.min(5000 * reconnectAttemptsRef.current, 30000); // Max 30 seconds
                        setTimeout(async () => {
                            if (currentLivestreamRef.current && currentLivestreamRef.current.roomName && isLiveRef.current && !isReconnectingRef.current) {
                                try {
                                    console.log('🔄 Reconnecting to room:', currentLivestreamRef.current.roomName);
                                    const tokenResponse = await Api.livestream.getToken({ roomName: currentLivestreamRef.current.roomName });
                                    if (tokenResponse.success) {
                                        await connectToLiveKit(currentLivestreamRef.current.roomName, tokenResponse.data.token);
                                    } else {
                                        console.error('❌ Failed to get token for reconnection');
                                        showToast('Không thể lấy token để kết nối lại', 'error');
                                    }
                                } catch (error) {
                                    console.error('❌ Reconnection failed:', error);
                                    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
                                        showToast('Không thể kết nối lại sau nhiều lần thử', 'error');
                                    }
                                }
                            }
                        }, delay);
                    } else {
                        console.error('❌ Max reconnection attempts reached. Stopping reconnection.');
                        showToast('Không thể kết nối lại sau nhiều lần thử', 'error');
                    }
                } else {
                    console.log('ℹ️ No reconnection needed - disconnection was intentional or max attempts reached');
                }
            });

            newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
                console.log('👤 Participant connected:', participant.identity);
                // Only add non-host participants to remote participants
                if (participant.identity !== 'Host') {
                    setRemoteParticipants(prev => [...prev, participant]);
                }
            });

            newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
                console.log('👤 Participant disconnected:', participant.identity);
                // Only remove non-host participants from remote participants
                if (participant.identity !== 'Host') {
                    setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
                }
            });

            // Add connection error handling
            newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
                console.log('🔗 Connection state changed:', state);
                setConnectionState(state);
            });

            newRoom.on(RoomEvent.MediaDevicesError, (error) => {
                console.error('❌ Media devices error:', error);
                setMediaError('Media device error: ' + error.message);
            });

            // Handle WebRTC errors
            newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
                console.log('📤 Track published:', publication.trackSid, 'by', participant.identity);
            });

            newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
                console.log('📤 Track unpublished:', publication.trackSid, 'by', participant.identity);
            });

            // Handle connection quality issues
            newRoom.on(RoomEvent.ConnectionQualityChanged, (quality, participant) => {
                console.log('📊 Connection quality changed:', quality, 'for', participant.identity);
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

            const connectPromise = newRoom.connect(LIVEKIT_CONFIG.serverUrl, hostToken);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout after 15 seconds')), 15000)
            );

            try {
                await Promise.race([connectPromise, timeoutPromise]);
            } catch (error) {
                // Clean up room on timeout
                try {
                    await newRoom.disconnect();
                } catch (disconnectError) {
                    console.warn('Error disconnecting room after timeout:', disconnectError);
                }
                throw error;
            }
            setRoom(newRoom);
            roomRef.current = newRoom; // Store in ref
            isReconnectingRef.current = false; // Reset reconnecting flag

            // Restore original console.error
            console.error = originalConsoleError;

            console.log('🎉 Successfully connected to LiveKit room');
        } catch (error) {
            // Restore original console.error in case of error
            if (typeof originalConsoleError !== 'undefined') {
                console.error = originalConsoleError;
            }

            console.error('❌ Error connecting to LiveKit:', error);
            setLivekitError(error.message);
            setConnectionState('error');
            isReconnectingRef.current = false; // Reset reconnecting flag on error

            // Provide specific error messages
            if (error.message.includes('timeout')) {
                showToast('Kết nối timeout. Vui lòng kiểm tra kết nối mạng.', 'error');
            } else if (error.message.includes('token')) {
                showToast('Token không hợp lệ. Vui lòng thử lại.', 'error');
            } else if (error.message.includes('server')) {
                showToast('Không thể kết nối đến server LiveKit.', 'error');
            } else {
                showToast('Lỗi kết nối: ' + error.message, 'error');
            }
        }
    };

    const disconnectFromLiveKit = async () => {
        if (room) {
            try {
                console.log('🔌 Disconnecting from LiveKit...');

                // Stop publishing first
                if (room.localParticipant) {
                    try {
                        const videoTracks = Array.from(room.localParticipant.videoTrackPublications.values());
                        const audioTracks = Array.from(room.localParticipant.audioTrackPublications.values());

                        for (const videoTrack of videoTracks) {
                            await room.localParticipant.unpublishTrack(videoTrack.track);
                        }
                        for (const audioTrack of audioTracks) {
                            await room.localParticipant.unpublishTrack(audioTrack.track);
                        }
                        console.log('📤 Stopped publishing tracks');
                    } catch (error) {
                        console.warn('⚠️ Error stopping tracks:', error);
                    }
                }

                // Wait a bit before disconnecting
                await new Promise(resolve => setTimeout(resolve, 500));

                await room.disconnect();
                setRoom(null);
                roomRef.current = null;
                setIsConnected(false);
                setConnectionState('disconnected');
                setLocalParticipant(null);
                setRemoteParticipants([]);
                setIsPublishing(false);
                isPublishingRef.current = false;
                console.log('✅ Disconnected from LiveKit');
            } catch (error) {
                console.error('❌ Error disconnecting from LiveKit:', error);
                // Force cleanup even if disconnect fails
                setRoom(null);
                roomRef.current = null;
                setIsConnected(false);
                setConnectionState('disconnected');
                setLocalParticipant(null);
                setRemoteParticipants([]);
                setIsPublishing(false);
                isPublishingRef.current = false;
            }
        }
    };

    const handleEndLivestream = async () => {
        if (!currentLivestream) return;

        try {
            setIsLoading(true);

            // Stop publishing before disconnecting
            if (room && room.localParticipant && isPublishing) {
                console.log('🛑 Stopping publishing before ending livestream...');
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
                console.log('✅ Stopped publishing');
            }

            await disconnectFromLiveKit();
            stopMediaStream();

            console.log('📤 Ending livestream with ID:', currentLivestream.livestreamId);
            console.log('📤 Current livestream object:', currentLivestream);

            // Try both _id and livestreamId
            const idToSend = currentLivestream._id || currentLivestream.livestreamId;
            console.log('📤 Using ID:', idToSend);

            const response = await Api.livestream.end(idToSend);

            if (response.success) {
                setIsLive(false);
                isLiveRef.current = false;
                showToast('Livestream đã được dừng thành công!', 'success');

                // Update current livestream status
                setCurrentLivestream(prev => prev ? { ...prev, status: 'ended' } : null);

                navigate('/livestream');
            } else {
                showToast(response.message || 'Không thể dừng livestream', 'error');
            }
        } catch (error) {
            console.error('Error ending livestream:', error);
            showToast('Lỗi khi dừng livestream', 'error');
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
        console.log('📊 LiveKit Status:', status);
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
                message="Đang tải livestream..."
                subMessage="Vui lòng đợi trong giây lát"
                fullScreen={true}
            />
        );
    }

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">{currentLivestream?.title || 'LiveStream Details'}</h1>
                    <p className="text-gray-600 mt-1">{currentLivestream?.description || ''}</p>
                </div>

                <button
                    onClick={() => navigate('/livestream')}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
                >
                    ← Quay lại
                </button>
            </div>

            {/* Livestream Info */}
            {currentLivestream && (
                <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{currentLivestream.title}</h3>
                            <p className="text-gray-600">{currentLivestream.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                <span>ID: {currentLivestream.livestreamId}</span>
                                <span>Room: {currentLivestream.roomName}</span>
                                <span>Status: {isLive ? 'Đang live' : 'Đã dừng'}</span>
                                <span>Viewers: {currentLivestream.currentViewers || 0}</span>
                                <span>Peak: {currentLivestream.peakViewers || 0}</span>
                            </div>
                        </div>
                        <button
                            onClick={handleEndLivestream}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                            <Stop className="w-4 h-4" />
                            {isLoading ? 'Đang dừng...' : 'Dừng Stream'}
                        </button>
                    </div>
                </div>
            )}

            {/* Video Preview */}
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
    );
};

export default LiveStreamDashboard;
