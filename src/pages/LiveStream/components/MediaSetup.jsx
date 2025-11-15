import React, { useEffect, useRef } from 'react';
import { Videocam, Mic, MicOff, Settings } from '@mui/icons-material';

const MediaSetup = ({
    mediaDevices,
    selectedCamera,
    selectedMicrophone,
    isVideoPlaying,
    isAudioPlaying,
    videoDimensions,
    mediaError,
    isVideoEnabled,
    isAudioEnabled,
    onCameraChange,
    onMicrophoneChange,
    onToggleVideo,
    onToggleAudio,
    previewVideoRef
}) => {
    // Sync muted state with audio enabled state
    useEffect(() => {
        if (previewVideoRef.current) {
            previewVideoRef.current.muted = !isAudioEnabled;
        }
    }, [isAudioEnabled]);

    return (
        <div
            className="bg-white rounded-2xl shadow-2xl border-2 mb-4 transition-shadow duration-300"
            style={{ borderColor: '#A86523' }}
        >
            <div className="p-4 sm:p-6 lg:p-8">
                <h4 className="text-lg sm:text-sx lg:text-2xl font-bold text-gray-900 mb-5 lg:mb-6">
                    Media Setup
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                    {/* Camera Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Camera
                        </label>
                        <select
                            value={selectedCamera}
                            onChange={(e) => onCameraChange(e.target.value)}
                            className="w-full px-4 py-2.5 border rounded-lg transition-all duration-200 bg-white text-sm lg:text-base border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523] focus:ring-2"
                        >
                            {mediaDevices.cameras?.map((camera, index) => (
                                <option key={camera.deviceId} value={camera.deviceId}>
                                    {camera.label || `Camera ${index + 1}`}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Microphone Selection */}
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Microphone
                        </label>
                        <select
                            value={selectedMicrophone}
                            onChange={(e) => onMicrophoneChange(e.target.value)}
                            className="w-full px-4 py-2.5 border rounded-lg transition-all duration-200 bg-white text-sm lg:text-base border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523] focus:ring-2"
                        >
                            {mediaDevices.microphones?.map((mic, index) => (
                                <option key={mic.deviceId} value={mic.deviceId}>
                                    {mic.label || `Microphone ${index + 1}`}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Media Preview */}
                <div className="mt-6 lg:mt-8 flex flex-col items-center w-full">
                    <label className="block text-sm font-semibold text-gray-700 mb-4 w-full text-center">
                        Live Preview
                    </label>
                    <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-xl overflow-hidden mx-auto shadow-xl border-2" style={{ width: '260px', aspectRatio: '9/16', borderColor: '#A86523' }}>
                        <video
                            ref={previewVideoRef}
                            autoPlay
                            muted={!isAudioEnabled}
                            playsInline
                            controls={false}
                            className="w-full h-full object-cover"
                            style={{ backgroundColor: '#000' }}
                        />
                        {/* <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-lg">
                            📹 Preview
                        </div> */}

                        {/* Media Status Indicators */}
                        {/* <div className="absolute top-3 right-3 flex flex-col gap-2">
                            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm ${isVideoPlaying
                                ? 'bg-green-500/90 text-white'
                                : 'bg-red-500/90 text-white'
                                }`}>
                                {isVideoPlaying ? '📹 Video ON' : '📹 Video OFF'}
                            </div>
                            <div className={`px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg backdrop-blur-sm ${isAudioPlaying
                                ? 'bg-green-500/90 text-white'
                                : 'bg-red-500/90 text-white'
                                }`}>
                                {isAudioPlaying ? '🎤 Audio ON' : '🎤 Audio OFF'}
                            </div>
                        </div> */}

                        {/* Video Dimensions */}
                        {videoDimensions.width > 0 && (
                            <div className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-sm text-white px-2 py-1 rounded-md text-[10px] font-semibold shadow-lg">
                                {videoDimensions.width}x{videoDimensions.height}
                            </div>
                        )}
                    </div>
                </div>

                {/* Media Error Display */}
                {/* {mediaError && (
                    <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 text-red-700 rounded-xl shadow-md">
                        <strong className="font-bold">Media Error:</strong> {mediaError}
                    </div>
                )} */}

                {/* Media Controls */}
                <div className="flex items-center justify-center gap-3 sm:gap-4 mt-6 lg:mt-8">
                    <button
                        onClick={onToggleVideo}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm lg:text-base shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${isVideoEnabled
                            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
                            : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white hover:from-gray-500 hover:to-gray-600'
                            }`}
                        style={{ '--tw-ring-color': '#A86523' }}
                    >
                        <Videocam className="w-4 h-4 lg:w-5 lg:h-5" />
                        {isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
                    </button>

                    <button
                        onClick={onToggleAudio}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm lg:text-base shadow-md hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2 ${isAudioEnabled
                            ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700'
                            : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white hover:from-gray-500 hover:to-gray-600'
                            }`}
                        style={{ '--tw-ring-color': '#A86523' }}
                    >
                        {isAudioEnabled ? <Mic className="w-4 h-4 lg:w-5 lg:h-5" /> : <MicOff className="w-4 h-4 lg:w-5 lg:h-5" />}
                        {isAudioEnabled ? 'Turn Off Mic' : 'Turn On Mic'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MediaSetup;
