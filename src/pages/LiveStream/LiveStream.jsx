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
    const [isLive, setIsLive] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [startForm, setStartForm] = useState({ title: '', description: '' });
    const [showStartForm, setShowStartForm] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);
    const [totalItems, setTotalItems] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'live', 'ended'

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

        } catch (error) {
            setMediaError('Unable to access media devices');
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

            // Request media with specific error handling
            let stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
            } catch (error) {

                // Show specific error messages
                if (error.name === 'NotReadableError') {
                    if (error.message.includes('Device in use')) {
                        showToast('Camera/microphone is being used by another application. Please close other tabs/apps and reload the page.', 'error');
                        setMediaError('Device is being used by another application');
                    } else {
                        showToast('Unable to access camera/microphone. Please check device connection.', 'error');
                        setMediaError('Device connection error');
                    }
                } else if (error.name === 'NotAllowedError') {
                    showToast('Camera/microphone permission denied. Please enable permissions in browser.', 'error');
                    setMediaError('Permission denied');
                } else if (error.name === 'NotFoundError') {
                    showToast('Camera/microphone not found. Please check your devices.', 'error');
                    setMediaError('Device not found');
                } else {
                    showToast(`Camera/microphone access error: ${error.message}`, 'error');
                    setMediaError(error.message);
                }
                throw error;
            }

            streamRef.current = stream;

            // Attach to preview video in modal if available
            if (previewVideoRef.current) {
                previewVideoRef.current.srcObject = stream;

                try {
                    await previewVideoRef.current.play();
                    setIsVideoPlaying(true);
                    setIsAudioPlaying(true);

                    previewVideoRef.current.onloadedmetadata = () => {
                        checkMediaStatus();
                    };

                    // Check status after a delay
                    setTimeout(() => {
                        checkMediaStatus();
                    }, 500);
                } catch (playError) {
                }
            } else {
            }

            return stream;
        } catch (error) {
            setMediaError('Unable to access camera/microphone: ' + error.message);
            showToast('Unable to access camera/microphone. Please check permissions.', 'error');
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
            console.log('Connecting to LiveKit room:', roomName);
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
                console.log('Connected to LiveKit room');
                setIsConnected(true);
                setConnectionState('connected');
                setLocalParticipant(newRoom.localParticipant);

                // Wait a bit before publishing to ensure connection is stable
                setTimeout(async () => {
                    if (streamRef.current && newRoom.state === 'connected') {
                        try {
                            const videoTrack = streamRef.current?.getVideoTracks()[0];
                            const audioTrack = streamRef.current?.getAudioTracks()[0];

                            if (videoTrack && videoTrack.readyState === 'live') {
                                await newRoom.localParticipant.publishTrack(videoTrack, { name: 'camera' });
                            }

                            if (audioTrack && audioTrack.readyState === 'live') {
                                await newRoom.localParticipant.publishTrack(audioTrack, { name: 'microphone' });
                            }

                            setIsPublishing(true);

                        } catch (error) {

                        }
                    }
                }, 1000); // Wait 1 second for connection to stabilize
            });

            newRoom.on(RoomEvent.Disconnected, (reason) => {
                console.log('Disconnected from LiveKit room:', reason);
                setIsConnected(false);
                setConnectionState('disconnected');
                setLocalParticipant(null);
                setRemoteParticipants([]);
                setIsPublishing(false);
            });

            // Add connection error handling
            newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
                setConnectionState(state);
            });

            newRoom.on(RoomEvent.MediaDevicesError, (error) => {
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
                setRemoteParticipants(prev => prev.filter(p => p.identity !== participant.identity));
            });

            // Connect with timeout
            const connectPromise = newRoom.connect(LIVEKIT_CONFIG.serverUrl, hostToken);
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Connection timeout after 30 seconds')), 30000)
            );

            await Promise.race([connectPromise, timeoutPromise]);
            setRoom(newRoom);

            console.log('🎉 Successfully connected to LiveKit room');

            return newRoom;
        } catch (error) {
            // Restore original console.error in case of error
            if (typeof originalConsoleError !== 'undefined') {
            }

            console.error('❌ Error connecting to LiveKit:', error);
            setLivekitError(error.message);
            setConnectionState('error');

            // Provide specific error messages
            if (error.message.includes('timeout')) {
                showToast('Connection timeout. Please check your network connection.', 'error');
            } else if (error.message.includes('token')) {
                showToast('Invalid token. Please try again.', 'error');
            } else if (error.message.includes('server')) {
                showToast('Unable to connect to LiveKit server.', 'error');
            } else {
                showToast('Connection error: ' + error.message, 'error');
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
            }

            if (audioTrack) {
                await room.localParticipant.publishTrack(audioTrack, { name: 'microphone' });
            }

            setIsPublishing(true);
            console.log('🎉 Media published successfully');
        } catch (error) {
            console.error('❌ Error publishing media:', error);
            setLivekitError(error.message);
        }
    };


    // Load data on mount - after all function declarations
    useEffect(() => {
        setupMediaDevices();
    }, [setupMediaDevices]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
            setCurrentPage(1); // Reset to first page when searching
        }, 500); // 500ms delay

        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset to first page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, itemsPerPage]);


    // Start livestream
    const handleStartLivestream = async () => {
        if (!startForm.title.trim()) {
            showToast('Please enter livestream title', 'error');
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
            showToast('Only admin/manager can start livestream', 'error');
            return;
        }

        // Require both video and audio to start livestream
        if (!isVideoEnabled || !isAudioEnabled) {
            showToast('Please enable both video and audio to start livestream', 'warning');
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

                // Get livestream ID for navigation
                const livestreamId = response.data.livestreamId || response.data._id;
                console.log('🔄 Navigating to dashboard for livestream:', livestreamId);

                // Show success message
                showToast('Livestream started successfully! Redirecting to dashboard...', 'success');

                // Clean up video elements before navigation to prevent AbortError
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = null;
                }
                if (previewVideoRef.current) {
                    previewVideoRef.current.srcObject = null;
                }

                // Stop media stream here (LiveStreamDashboard will start its own)
                if (streamRef.current) {
                    streamRef.current.getTracks().forEach(track => track.stop());
                    streamRef.current = null;
                }

                // Reset form and state
                setStartForm({ title: '', description: '' });
                setShowStartForm(false);
                setCurrentLivestream(null);
                setIsLive(false);

                // Small delay to ensure cleanup completes before navigation
                setTimeout(() => {
                    // Navigate to dashboard - it will handle LiveKit connection itself
                    navigate(`/manage-livestream/${livestreamId}`);
                }, 300);
            } else {
                showToast(response.message || 'Unable to start livestream', 'error');
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
                    showToast(`Data error: ${message}`, 'error');
                } else if (status === 401) {
                    showToast('Please login to perform this action', 'error');
                } else if (status === 403) {
                    showToast('You do not have permission. Only admin/manager can start livestream', 'error');
                } else if (status === 500) {
                    showToast(`Server error: ${message}`, 'error');
                } else {
                    showToast(`API error (${status}): ${message}`, 'error');
                }
            } else if (error.request) {
                // Network error
                showToast('Network error. Please check your internet connection and try again', 'error');
            } else {
                // Other error
                showToast(`Unknown error: ${error.message}`, 'error');
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
                showToast('Livestream stopped successfully!', 'success');
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
            showToast('Not connected to LiveKit', 'warning');
            return;
        }

        if (!streamRef.current) {
            showToast('No media stream available', 'warning');
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
                showToast('Stopped publishing', 'success');
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
                showToast('Started publishing', 'success');
            }
        } catch (error) {
            console.error('Error toggling publishing:', error);
            showToast('Error toggling publishing', 'error');
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
        <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Livestream Management</h1>
                        <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage and start livestreams</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
                        {totalItems > 0 && (
                            <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
                                <span className="text-xs lg:text-sm font-medium text-gray-700">
                                    {totalItems} livestream{totalItems !== 1 ? 's' : ''}
                                </span>
                            </div>
                        )}
                        {!currentLivestream && isAdminOrManager && (
                            <button
                                onClick={() => setShowStartForm(true)}
                                className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
                            >
                                <LiveTv className="w-3 h-3 lg:w-4 lg:h-4" />
                                <span className="font-medium">Start Live</span>
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
                <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Search & Filter</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                    <div>
                        <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search Livestream</label>
                        <div className="relative">
                            <input
                                type="text"
                                placeholder="Search by title, description..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base pr-10"
                            />
                            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                        >
                            <option value="all">All Statuses</option>
                            <option value="live">Live</option>
                            <option value="ended">Ended</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Items per Page</label>
                        <select
                            value={itemsPerPage}
                            onChange={(e) => {
                                setItemsPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                        >
                            <option value={5}>5</option>
                            <option value={10}>10</option>
                            <option value={20}>20</option>
                            <option value={50}>50</option>
                        </select>
                    </div>
                    <div className="flex items-end">
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setStatusFilter('all');
                                setCurrentPage(1);
                            }}
                            disabled={!searchTerm && statusFilter === 'all'}
                            className="w-full px-3 py-2 lg:px-4 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Clear Filters
                        </button>
                    </div>
                </div>
            </div>

            {/* Streams List */}
            <StreamsList
                title="Your Livestreams"
                emptyMessage="No livestreams yet"
                type="all"
                currentPage={currentPage}
                itemsPerPage={itemsPerPage}
                searchTerm={debouncedSearchTerm}
                statusFilter={statusFilter}
                onPageChange={setCurrentPage}
                onTotalItemsChange={setTotalItems}
            />

            {/* Pagination Summary */}
            {totalItems > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6">
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                        <div className="text-xs lg:text-sm text-gray-600">
                            Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, totalItems)} of {totalItems} results
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-xs lg:text-sm text-gray-600">Go to page:</span>
                            <input
                                type="number"
                                min="1"
                                max={Math.ceil(totalItems / itemsPerPage)}
                                value={currentPage}
                                onChange={(e) => {
                                    const page = parseInt(e.target.value);
                                    if (page >= 1 && page <= Math.ceil(totalItems / itemsPerPage)) {
                                        setCurrentPage(page);
                                    }
                                }}
                                className="w-16 px-2 lg:px-3 py-1 lg:py-2 text-xs lg:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Current Livestream Status */}
            {currentLivestream && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">{currentLivestream.title}</h3>
                            <p className="text-gray-600">{currentLivestream.description}</p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                <span>ID: {currentLivestream.livestreamId}</span>
                                <span>Room: {currentLivestream.roomName}</span>
                                <span>Status: {isLive ? 'Live' : 'Stopped'}</span>
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
                                    {isLoading ? 'Stopping...' : 'Stop Stream'}
                                </button>
                            ) : (
                                <span className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-sm">
                                    Stopped
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
                            <h2 className="text-xl font-semibold text-gray-900">Start New Livestream</h2>
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
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Livestream Information</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Stream Title *
                                        </label>
                                        <input
                                            type="text"
                                            value={startForm.title}
                                            onChange={(e) => setStartForm({ ...startForm, title: e.target.value })}
                                            placeholder="Enter livestream title..."
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Stream Description
                                        </label>
                                        <textarea
                                            value={startForm.description}
                                            onChange={(e) => setStartForm({ ...startForm, description: e.target.value })}
                                            placeholder="Enter livestream description..."
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
                                Cancel
                            </button>
                            <button
                                onClick={handleStartLivestream}
                                disabled={isLoading || !startForm.title.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                            >
                                <PlayArrow className="w-4 h-4" />
                                {isLoading ? 'Starting...' : 'Start Stream'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveStream;
