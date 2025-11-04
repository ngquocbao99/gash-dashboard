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
    return (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 mb-6 hover:shadow-xl transition-shadow duration-300">
            <h2 className="text-lg font-bold text-gray-900 mb-5 uppercase tracking-wide">Media Setup</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Camera Selection */}
                <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                        Camera
                    </label>
                    <select
                        value={selectedCamera}
                        onChange={(e) => onCameraChange(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 font-medium"
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
                    <label className="block text-sm font-semibold text-gray-700 mb-2 uppercase tracking-wider">
                        Microphone
                    </label>
                    <select
                        value={selectedMicrophone}
                        onChange={(e) => onMicrophoneChange(e.target.value)}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all duration-200 font-medium"
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
            <div className="mt-8 flex flex-col items-center w-full">
                <label className="block text-sm font-bold text-gray-900 mb-4 w-full text-center uppercase tracking-wider">
                    Live Preview
                </label>
                <div className="relative bg-gradient-to-br from-gray-900 to-black rounded-2xl overflow-hidden mx-auto shadow-2xl border-4 border-gray-800" style={{ width: '280px', aspectRatio: '9/16' }}>
                    <video
                        ref={previewVideoRef}
                        autoPlay
                        muted
                        playsInline
                        controls={false}
                        className="w-full h-full object-cover"
                        style={{ backgroundColor: '#000' }}
                    />
                    <div className="absolute top-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-sm font-semibold shadow-lg">
                        📹 Preview
                    </div>

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
                        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg">
                            {videoDimensions.width}x{videoDimensions.height}
                        </div>
                    )}
                </div>

                {/* Media Error Display */}
                {/* {mediaError && (
                    <div className="mt-4 p-4 bg-red-50 border-2 border-red-300 text-red-700 rounded-xl shadow-md">
                        <strong className="font-bold">Media Error:</strong> {mediaError}
                    </div>
                )} */}
            </div>

            {/* Media Controls */}
            <div className="flex items-center justify-center gap-4 mt-6">
                <button
                    onClick={onToggleVideo}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 font-semibold shadow-lg ${isVideoEnabled
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-500/30'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white hover:from-gray-500 hover:to-gray-600 shadow-gray-500/20'
                        }`}
                >
                    <Videocam className="w-5 h-5" />
                    {isVideoEnabled ? 'Turn Off Video' : 'Turn On Video'}
                </button>

                <button
                    onClick={onToggleAudio}
                    className={`flex items-center gap-3 px-6 py-3 rounded-xl transition-all duration-200 transform hover:scale-105 active:scale-95 font-semibold shadow-lg ${isAudioEnabled
                        ? 'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-green-500/30'
                        : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white hover:from-gray-500 hover:to-gray-600 shadow-gray-500/20'
                        }`}
                >
                    {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                    {isAudioEnabled ? 'Turn Off Mic' : 'Turn On Mic'}
                </button>
            </div>
        </div>
    );
};

export default MediaSetup;
