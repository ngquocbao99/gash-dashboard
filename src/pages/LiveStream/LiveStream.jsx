import React, { useState, useEffect, useContext, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Api from '../../common/SummaryAPI';
import { useToast } from '../../hooks/useToast';
import { LiveTv, PlayArrow, Stop, Security, Videocam } from '@mui/icons-material';
import { Room, RoomEvent } from 'livekit-client';
import VideoPreview from './components/VideoPreview';
import MediaSetup from './components/MediaSetup';
import StreamsList from './components/StreamsList';
import { LIVEKIT_CONFIG } from '../../config/livekit';

const LiveStream = () => {
    const { user } = useContext(AuthContext);
    const { showToast } = useToast();
    const navigate = useNavigate();

    // Main state
    const [isLoading, setIsLoading] = useState(false);
    const [currentLivestream, setCurrentLivestream] = useState(null);
    const [hostLivestreams, setHostLivestreams] = useState([]);
    const [liveStreams, setLiveStreams] = useState([]);
    const [isLive, setIsLive] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [startForm, setStartForm] = useState({ title: '', description: '' });
    const [showStartForm, setShowStartForm] = useState(false);

    // LiveKit state
    const [room, setRoom] = useState(null);
    const [isConnected, setIsConnected] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [connectionState, setConnectionState] = useState('disconnected');
    const [livekitError, setLivekitError] = useState(null);
    const [participants, setParticipants] = useState([]);
    const [localParticipant, setLocalParticipant] = useState(null);
    const [remoteParticipants, setRemoteParticipants] = useState([]);

    // Media state
    const [isVideoEnabled, setIsVideoEnabled] = useState(true);
    const [isAudioEnabled, setIsAudioEnabled] = useState(true);
    const [mediaError, setMediaError] = useState(null);
    const [mediaDevices, setMediaDevices] = useState({ cameras: [], microphones: [] });
    const [selectedCamera, setSelectedCamera] = useState('');
    const [selectedMicrophone, setSelectedMicrophone] = useState('');
    const [isVideoPlaying, setIsVideoPlaying] = useState(true);
    const [isAudioPlaying, setIsAudioPlaying] = useState(true);
    const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0 });

    // Refs
    const localVideoRef = useRef(null);
    const videoRef = useRef(null);
    const streamRef = useRef(null);
    const previewVideoRef = useRef(null);

    // Load data on mount - moved after function declarations

    // Cleanup - only on unmount
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
            // Small delay to ensure video element is rendered
            setTimeout(() => {
                ensureVideoVisible();
            }, 500);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isLive]);

    // Auto-start media stream when modal opens
    useEffect(() => {
        if (showStartForm && !currentLivestream) {
            // Small delay to ensure modal and video elements are rendered
            const timer = setTimeout(() => {
                if (!streamRef.current) {
                    startMediaStream().catch(error => {
                        console.error('Auto-start media stream failed:', error);
                        // Error is already handled in startMediaStream with Toast
                    });
                }
            }, 500);
            return () => clearTimeout(timer);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [showStartForm, currentLivestream]);

    // Media setup
    const setupMediaDevices = useCallback(async () => {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const cameras = devices.filter(device => device.kind === 'videoinput');
            const microphones = devices.filter(device => device.kind === 'audioinput');

            setMediaDevices({ cameras, microphones });

            if (cameras.length > 0) {
                setSelectedCamera(cameras[0].deviceId);
            }
            if (microphones.length > 0) {
                setSelectedMicrophone(microphones[0].deviceId);
            }

            console.log('✅ Media devices loaded:', { cameras: cameras.length, microphones: microphones.length });
        } catch (error) {
            console.error('❌ Error loading media devices:', error);
            setMediaError('Không thể truy cập thiết bị media');
        }
    }, []);

    const startMediaStream = async () => {
        try {
            setMediaError(null);

            // Stop existing stream first
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }

            // Allow both to be off in preview (before starting livestream)
            // The requirement will be checked in handleStartLivestream
            if (!isVideoEnabled && !isAudioEnabled) {
                setIsVideoPlaying(false);
                setIsAudioPlaying(false);
                return null;
            }

            const constraints = {
                video: isVideoEnabled ? {
                    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                    facingMode: 'user',
                    height: { ideal: 1920 },
                    width: { ideal: 1080 }
                } : false,
                audio: isAudioEnabled ? {
                    deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true
                } : false
            };

            console.log('🎥 Requesting media with constraints:', constraints);

            // Request media with specific error handling
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {
                console.error('❌ Error requesting media:', error);

                // Show specific error messages
                if (error.name === 'NotReadableError') {
                    if (error.message.includes('Device in use')) {
                        showToast('Camera/microphone đang được sử dụng bởi ứng dụng khác. Vui lòng đóng các tab/ứng dụng khác và tải lại trang.', 'error');
                        setMediaError('Thiết bị đang được sử dụng bởi ứng dụng khác');
                    } else {
                        showToast('Không thể truy cập camera/microphone. Vui lòng kiểm tra kết nối thiết bị.', 'error');
                        setMediaError('Lỗi kết nối thiết bị');
                    }
                } else if (error.name === 'NotAllowedError') {
                    showToast('Bạn đã từ chối quyền truy cập camera/microphone. Vui lòng bật lại quyền trong trình duyệt.', 'error');
                    setMediaError('Bị từ chối quyền truy cập');
                } else if (error.name === 'NotFoundError') {
                    showToast('Không tìm thấy camera/microphone. Vui lòng kiểm tra thiết bị.', 'error');
                    setMediaError('Không tìm thấy thiết bị');
                } else {
                    showToast(`Lỗi truy cập camera/microphone: ${error.message}`, 'error');
                    setMediaError(error.message);
                }
                throw error;
            }

            streamRef.current = stream;
            console.log('✅ Media stream obtained:', {
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length
            });

            // Attach to preview video in modal if available
            if (previewVideoRef.current) {
                console.log('✅ Attaching stream to preview video element');
                previewVideoRef.current.srcObject = stream;

                try {
                    await previewVideoRef.current.play();
                    console.log('✅ Preview video playing');
                    setIsVideoPlaying(true);
                    setIsAudioPlaying(true);

                    previewVideoRef.current.onloadedmetadata = () => {
                        console.log('✅ Preview video metadata loaded');
                        checkMediaStatus();
                    };

                    // Check status after a delay
                    setTimeout(() => {
                        checkMediaStatus();
                    }, 500);
                } catch (playError) {
                    console.error('❌ Error playing preview video:', playError);
                }
            } else {
                console.warn('⚠️ previewVideoRef.current is null! Video element may not be rendered yet.');
            }

            console.log('✅ Media stream started');
            return stream;
        } catch (error) {
            console.error('❌ Error starting media stream:', error);
            setMediaError('Không thể truy cập camera/microphone: ' + error.message);
            showToast('Không thể truy cập camera/microphone. Vui lòng kiểm tra quyền truy cập.', 'error');
            throw error;
        }
    };

    const stopMediaStream = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }

        if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
        }

        if (previewVideoRef.current) {
            previewVideoRef.current.srcObject = null;
        }

        setIsVideoPlaying(false);
        setIsAudioPlaying(false);
    };

    const checkMediaStatus = () => {
        if (!streamRef.current) {
            setIsVideoPlaying(false);
            setIsAudioPlaying(false);
            return;
        }

        const stream = streamRef.current;
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];

        // Check video status
        if (videoTrack) {
            const isVideoActive = videoTrack.readyState === 'live' && videoTrack.enabled;
            setIsVideoPlaying(isVideoActive);
        } else {
            setIsVideoPlaying(false);
        }

        // Check audio status
        if (audioTrack) {
            const isAudioActive = audioTrack.readyState === 'live' && audioTrack.enabled;
            setIsAudioPlaying(isAudioActive);
        } else {
            setIsAudioPlaying(false);
        }

        // Update video dimensions if video element exists (prefer preview, then local)
        const videoElement = previewVideoRef.current || localVideoRef.current;
        if (videoElement) {
            setVideoDimensions({
                width: videoElement.videoWidth || 0,
                height: videoElement.videoHeight || 0
            });
        }
    };

    const toggleVideo = () => {
        const newValue = !isVideoEnabled;
        setIsVideoEnabled(newValue);

        // Update playing state based on enabled state
        setIsVideoPlaying(newValue);

        if (streamRef.current) {
            const videoTrack = streamRef.current.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = newValue;
            }
        }
        setTimeout(checkMediaStatus, 100);
    };

    const toggleAudio = () => {
        const newValue = !isAudioEnabled;
        setIsAudioEnabled(newValue);

        // Update playing state based on enabled state
        setIsAudioPlaying(newValue);

        if (streamRef.current) {
            const audioTrack = streamRef.current.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = newValue;
            }
        }
        setTimeout(checkMediaStatus, 100);
    };

    // Connect to LiveKit
    const connectToLiveKit = async (roomName, hostToken) => {
        try {
            console.log('🔗 Connecting to LiveKit room:', roomName);
            setLivekitError(null);
            setConnectionState('connecting');

            // Validate inputs
            if (!roomName || !hostToken) {
                throw new Error('Room name and token are required');
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

                // Wait a bit before publishing to ensure connection is stable
                setTimeout(async () => {
                    if (streamRef.current && newRoom.state === 'connected') {
                        console.log('📤 Auto-publishing media after connection...');
                        try {
                            const videoTrack = streamRef.current?.getVideoTracks()[0];
                            const audioTrack = streamRef.current?.getAudioTracks()[0];

                            console.log('📹 Tracks found:', { video: !!videoTrack, audio: !!audioTrack });

                            if (videoTrack && videoTrack.readyState === 'live') {
                                await newRoom.localParticipant.publishTrack(videoTrack, { name: 'camera' });
                                console.log('📹 Video track published');
                            }

                            if (audioTrack && audioTrack.readyState === 'live') {
                                await newRoom.localParticipant.publishTrack(audioTrack, { name: 'microphone' });
                                console.log('🎤 Audio track published');
                            }

                            setIsPublishing(true);
                            console.log('🎉 Media published successfully');
                        } catch (error) {
                            console.error('❌ Error auto-publishing:', error);
                            // Don't disconnect on publish error, just log it
                        }
                    }
                }, 1000); // Wait 1 second for connection to stabilize
            });

            newRoom.on(RoomEvent.Disconnected, (reason) => {
                console.log('❌ Disconnected from LiveKit room:', reason);
                setIsConnected(false);
                setConnectionState('disconnected');
                setLocalParticipant(null);
                setRemoteParticipants([]);
                setIsPublishing(false);
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

            newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
                console.log('👤 Participant connected:', participant.identity);
                setRemoteParticipants(prev => [...prev, participant]);
            });

            newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
                console.log('👤 Participant disconnected:', participant.identity);
                setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
            });

            // Connect with timeout
            const connectPromise = newRoom.connect(LIVEKIT_CONFIG.serverUrl, hostToken);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
            );

            await Promise.race([connectPromise, timeoutPromise]);
            setRoom(newRoom);

            // Restore original console.error
            console.error = originalConsoleError;

            console.log('🎉 Successfully connected to LiveKit room');

            return newRoom;
        } catch (error) {
            // Restore original console.error in case of error
            if (typeof originalConsoleError !== 'undefined') {
                console.error = originalConsoleError;
            }

            console.error('❌ Error connecting to LiveKit:', error);
            setLivekitError(error.message);
            setConnectionState('error');

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

            throw error;
        }
    };

    // Disconnect from LiveKit
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
                setIsConnected(false);
                setConnectionState('disconnected');
                setLocalParticipant(null);
                setRemoteParticipants([]);
                setIsPublishing(false);
                console.log('✅ Disconnected from LiveKit');
            } catch (error) {
                console.error('❌ Error disconnecting from LiveKit:', error);
                // Force cleanup even if disconnect fails
                setRoom(null);
                setIsConnected(false);
                setConnectionState('disconnected');
                setLocalParticipant(null);
                setRemoteParticipants([]);
                setIsPublishing(false);
            }
        }
    };

    // Publish media to LiveKit
    const publishMediaToLiveKit = async () => {
        if (!room || !isConnected) {
            console.log('❌ Not connected to LiveKit room yet');
            return;
        }

        if (!streamRef.current) {
            console.log('❌ No media stream available');
            return;
        }

        try {
            console.log('📤 Publishing media to LiveKit...');

            const videoTrack = streamRef.current.getVideoTracks()[0];
            const audioTrack = streamRef.current.getAudioTracks()[0];

            if (videoTrack) {
                await room.localParticipant.publishTrack(videoTrack, { name: 'camera' });
                console.log('📹 Video track published');
            }

            if (audioTrack) {
                await room.localParticipant.publishTrack(audioTrack, { name: 'microphone' });
                console.log('🎤 Audio track published');
            }

            setIsPublishing(true);
            console.log('🎉 Media published successfully');
        } catch (error) {
            console.error('❌ Error publishing media:', error);
            setLivekitError(error.message);
        }
    };

    // Load streams
    const loadHostLivestreams = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await Api.livestream.getHost();
            if (response.success) {
                const livestreams = response.data?.livestreams || response.data || [];
                setHostLivestreams(livestreams);
            } else {
                showToast('Không thể tải danh sách livestream', 'error');
            }
        } catch (error) {
            console.error('Error loading host livestreams:', error);
            showToast('Lỗi khi tải danh sách livestream', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    const loadLiveStreams = useCallback(async () => {
        try {
            const response = await Api.livestream.getLive();
            console.log('📡 Dashboard loadLiveStreams response:', response);
            if (response.success) {
                const streams = response.data?.streams || response.data || [];
                console.log('📡 Dashboard streams found:', streams);
                setLiveStreams(streams);
            }
        } catch (error) {
            console.error('Error loading live streams:', error);
        }
    }, []);

    // Load data on mount - after all function declarations
    useEffect(() => {
        loadHostLivestreams();
        loadLiveStreams();
        setupMediaDevices();
    }, [loadHostLivestreams, loadLiveStreams, setupMediaDevices]);

    // Real-time viewer count update for current livestream
    useEffect(() => {
        if (!isLive || !currentLivestream) return;

        const updateViewerCount = async () => {
            try {
                const response = await Api.livestream.getHost();
                if (response.success) {
                    const livestreams = response.data?.livestreams || response.data || [];
                    const currentStream = livestreams.find(ls => ls._id === currentLivestream.livestreamId);
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
    }, [isLive, currentLivestream]);

    // Start livestream
    const handleStartLivestream = async () => {
        if (!startForm.title.trim()) {
            showToast('Vui lòng nhập tiêu đề livestream', 'error');
            return;
        }

        // Debug: Check user authentication and role
        console.log('🔍 User info:', user);
        console.log('🔍 User role:', user?.role);
        console.log('🔍 Is admin/manager:', user?.role === 'admin' || user?.role === 'manager');

        // Check if user is authenticated
        if (!user) {
            showToast('Bạn cần đăng nhập để thực hiện chức năng này', 'error');
            return;
        }

        // Check if user has required role
        if (user.role !== 'admin' && user.role !== 'manager') {
            showToast('Chỉ admin/manager mới có thể bắt đầu livestream', 'error');
            return;
        }

        // Require both video and audio to start livestream
        if (!isVideoEnabled || !isAudioEnabled) {
            showToast('Vui lòng bật cả video và audio để bắt đầu livestream', 'warning');
            return;
        }

        try {
            setIsLoading(true);

            // Create stream with both video and audio enabled
            const constraints = {
                video: {
                    deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
                    facingMode: 'user',
                    height: { ideal: 1920 },
                    width: { ideal: 1080 }
                },
                audio: {
                    deviceId: selectedMicrophone ? { exact: selectedMicrophone } : undefined,
                    echoCancellation: true,
                    noiseSuppression: true
                }
            };

            console.log('🎥 Requesting media with constraints (both required):', constraints);
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;
            console.log('✅ Media stream obtained:', {
                videoTracks: stream.getVideoTracks().length,
                audioTracks: stream.getAudioTracks().length
            });

            // Debug: Log request data
            const requestData = {
                title: startForm.title,
                description: startForm.description
            };
            console.log('📤 Sending livestream start request:', requestData);
            console.log('📤 API URL:', import.meta.env.VITE_API_URL || 'http://localhost:5000');
            console.log('📤 Auth token:', localStorage.getItem('token') ? 'Present' : 'Missing');

            const response = await Api.livestream.start(requestData);
            console.log('📤 Start livestream response:', response);

            if (response.success) {
                console.log('📤 Livestream started successfully:', response.data);
                setCurrentLivestream(response.data);
                setIsLive(true);
                setStartForm({ title: '', description: '' });
                setShowStartForm(false);
                showToast('Livestream đã được bắt đầu thành công! Chuyển đến dashboard...', 'success');

                // Connect to LiveKit first
                await connectToLiveKit(response.data.roomName, response.data.hostToken);

                // Clean up video elements before navigation to prevent AbortError
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = null;
                }
                if (previewVideoRef.current) {
                    previewVideoRef.current.srcObject = null;
                }

                // Navigate to dashboard for this livestream
                const livestreamId = response.data.livestreamId || response.data._id;
                console.log('🔄 Navigating to dashboard for livestream:', livestreamId);
                navigate(`/livestream/${livestreamId}`);

                // Update lists in background
                loadHostLivestreams();
                loadLiveStreams();
            } else {
                showToast(response.message || 'Không thể bắt đầu livestream', 'error');
                stopMediaStream();
            }
        } catch (error) {
            console.error('Error starting livestream:', error);

            // Provide specific error messages based on error type
            if (error.response) {
                // Server responded with error status
                const status = error.response.status;
                const message = error.response.data?.message || error.response.data?.error || 'Unknown server error';

                if (status === 400) {
                    showToast(`Lỗi dữ liệu: ${message}`, 'error');
                } else if (status === 401) {
                    showToast('Bạn cần đăng nhập để thực hiện chức năng này', 'error');
                } else if (status === 403) {
                    showToast('Bạn không có quyền thực hiện chức năng này. Chỉ admin/manager mới có thể bắt đầu livestream', 'error');
                } else if (status === 500) {
                    showToast(`Lỗi server: ${message}`, 'error');
                } else {
                    showToast(`Lỗi API (${status}): ${message}`, 'error');
                }
            } else if (error.request) {
                // Network error
                showToast('Lỗi kết nối mạng. Vui lòng kiểm tra kết nối internet và thử lại', 'error');
            } else {
                // Other error
                showToast(`Lỗi không xác định: ${error.message}`, 'error');
            }

            stopMediaStream();
        } finally {
            setIsLoading(false);
        }
    };

    // End livestream
    const handleEndLivestream = async () => {
        if (!currentLivestream) return;

        try {
            setIsLoading(true);
            await disconnectFromLiveKit();
            stopMediaStream();

            const response = await Api.livestream.end(currentLivestream.livestreamId);

            if (response.success) {
                setCurrentLivestream(null);
                setIsLive(false);
                showToast('Livestream đã được dừng thành công!', 'success');
                loadHostLivestreams();
                loadLiveStreams();
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

    // Toggle fullscreen
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            videoRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    };

    // Check LiveKit status
    const checkLiveKitStatus = () => {
        const status = {
            room: !!room,
            isConnected,
            connectionState,
            roomName: room?.name,
            participants: room?.participants?.size || 0,
            localParticipant: !!room?.localParticipant,
            videoTracks: room?.localParticipant?.videoTrackPublications?.size || 0,
            audioTracks: room?.localParticipant?.audioTrackPublications?.size || 0
        };
        console.log('📊 LiveKit Status:', status);
    };

    // Toggle LiveKit publishing
    const toggleLiveKitPublishing = async () => {
        if (!room || !isConnected) {
            showToast('Chưa kết nối với LiveKit', 'warning');
            return;
        }

        if (!streamRef.current) {
            showToast('Không có media stream', 'warning');
            return;
        }

        try {
            if (isPublishing) {
                // Unpublish
                console.log('🛑 Manually unpublishing media...');
                const videoTracks = Array.from(room.localParticipant.videoTrackPublications.values());
                const audioTracks = Array.from(room.localParticipant.audioTrackPublications.values());

                for (const videoTrack of videoTracks) {
                    await room.localParticipant.unpublishTrack(videoTrack.track);
                }
                for (const audioTrack of audioTracks) {
                    await room.localParticipant.unpublishTrack(audioTrack.track);
                }

                setIsPublishing(false);
                showToast('Đã dừng publish', 'success');
            } else {
                // Re-publish
                console.log('🔄 Re-publishing media...');
                const videoTrack = streamRef.current.getVideoTracks()[0];
                const audioTrack = streamRef.current.getAudioTracks()[0];

                if (videoTrack && videoTrack.readyState === 'live') {
                    await room.localParticipant.publishTrack(videoTrack, { name: 'camera' });
                    console.log('📹 Video track re-published');
                }

                if (audioTrack && audioTrack.readyState === 'live') {
                    await room.localParticipant.publishTrack(audioTrack, { name: 'microphone' });
                    console.log('🎤 Audio track re-published');
                }

                setIsPublishing(true);
                showToast('Đã bật publish', 'success');
            }
        } catch (error) {
            console.error('Error toggling publishing:', error);
            showToast('Lỗi khi toggle publish', 'error');
            setLivekitError(error.message);
        }
    };

    const ensureVideoVisible = () => {
        if (localVideoRef.current && streamRef.current) {
            localVideoRef.current.srcObject = streamRef.current;
            localVideoRef.current.play()
                .then(() => {
                    checkMediaStatus();
                })
                .catch((error) => {
                    console.error('❌ Video play() failed:', error);
                });
        }
    };

    const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';

    return (
        <div className="p-6">
            {/* Header */}
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <LiveTv className="w-8 h-8 text-blue-600" />
                        Livestream Management
                    </h1>
                    <p className="text-gray-600 mt-1">Quản lý và bắt đầu livestream</p>
                </div>

                {/* Start Live Button - Top Right */}
                {!currentLivestream && isAdminOrManager && (
                    <button
                        onClick={() => setShowStartForm(true)}
                        className="flex items-center gap-2 px-6 py-3 bg-linear-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg"
                    >
                        <LiveTv className="w-5 h-5" />
                        <span className="font-semibold">Bắt đầu Live</span>
                    </button>
                )}
            </div>

            {/* Streams Lists */}
            <StreamsList
                title="Streams đang live"
                streams={liveStreams}
                emptyMessage="Không có stream nào đang live"
            />

            <StreamsList
                title="Livestream của bạn"
                streams={hostLivestreams}
                emptyMessage="Chưa có livestream nào"
            />

            {/* Current Livestream Status */}
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
                        <div className="flex items-center gap-2">
                            {isLive ? (
                                <button
                                    onClick={handleEndLivestream}
                                    disabled={isLoading}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                                >
                                    <Stop className="w-4 h-4" />
                                    {isLoading ? 'Đang dừng...' : 'Dừng Stream'}
                                </button>
                            ) : (
                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                                    Đã dừng
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Video Preview - Only show when live */}
            {isLive && (
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
                    onRefresh={loadHostLivestreams}
                    onTogglePublishing={toggleLiveKitPublishing}
                    isConnected={isConnected}
                    isPublishing={isPublishing}
                    connectionState={connectionState}
                    remoteParticipants={remoteParticipants}
                    localParticipant={localParticipant}
                    currentLivestream={currentLivestream}
                    mediaError={mediaError}
                    livekitError={livekitError}
                />
            )}

            {/* Start Stream Modal */}
            {showStartForm && !currentLivestream && isAdminOrManager && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        {/* Modal Header */}
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                            <h2 className="text-xl font-semibold text-gray-900">Bắt đầu Livestream mới</h2>
                            <button
                                onClick={() => {
                                    setShowStartForm(false);
                                    setStartForm({ title: '', description: '' });
                                    stopMediaStream();
                                }}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-6 space-y-6 overflow-y-auto" style={{ marginTop: '70px' }}>
                            {/* Media Setup */}
                            <MediaSetup
                                mediaDevices={mediaDevices}
                                selectedCamera={selectedCamera}
                                selectedMicrophone={selectedMicrophone}
                                isVideoPlaying={isVideoPlaying}
                                isAudioPlaying={isAudioPlaying}
                                videoDimensions={videoDimensions}
                                mediaError={mediaError}
                                isVideoEnabled={isVideoEnabled}
                                isAudioEnabled={isAudioEnabled}
                                onCameraChange={setSelectedCamera}
                                onMicrophoneChange={setSelectedMicrophone}
                                onToggleVideo={toggleVideo}
                                onToggleAudio={toggleAudio}
                                previewVideoRef={previewVideoRef}
                            />

                            {/* Start Form */}
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Thông tin Livestream</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Tiêu đề Stream *
                                        </label>
                                        <input
                                            type="text"
                                            value={startForm.title}
                                            onChange={(e) => setStartForm({ ...startForm, title: e.target.value })}
                                            placeholder="Nhập tiêu đề livestream..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Mô tả Stream
                                        </label>
                                        <textarea
                                            value={startForm.description}
                                            onChange={(e) => setStartForm({ ...startForm, description: e.target.value })}
                                            placeholder="Nhập mô tả livestream..."
                                            rows={3}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex justify-end gap-3">
                            <button
                                onClick={() => {
                                    setShowStartForm(false);
                                    setStartForm({ title: '', description: '' });
                                    stopMediaStream();
                                }}
                                disabled={isLoading}
                                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
                            >
                                Hủy
                            </button>
                            <button
                                onClick={handleStartLivestream}
                                disabled={isLoading || !startForm.title.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                <PlayArrow className="w-4 h-4" />
                                {isLoading ? 'Đang tạo...' : 'Bắt đầu Stream'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveStream;
