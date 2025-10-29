import React from 'react';
import { Fullscreen, FullscreenExit } from '@mui/icons-material';

const VideoPreview = ({
    localVideoRef,
    isVideoPlaying,
    isAudioPlaying,
    videoDimensions,
    isFullscreen,
    onToggleFullscreen,
    onToggleVideo,
    onToggleAudio,
    onCheckLiveKit,
    onRefresh,
    isConnected,
    isPublishing,
    connectionState,
    remoteParticipants,
    localParticipant,
    currentLivestream,
    mediaError,
    livekitError
}) => {
    return (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden hover:shadow-xl transition-shadow duration-300">
            {/* Video Container */}
            <div className="bg-gradient-to-br from-gray-900 to-black relative">
                <div className="flex justify-center items-center min-h-[520px] p-6">
                    <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl border-4 border-gray-800" style={{ width: 'min(420px, 90vw)', aspectRatio: '9/16' }}>
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted={false}
                            playsInline
                            controls={false}
                            className="w-full h-full object-cover"
                            style={{ backgroundColor: '#000' }}
                        />

                        {/* LIVE Badge */}
                        <div className="absolute top-4 left-4 flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-2 rounded-xl shadow-2xl shadow-red-500/50 backdrop-blur-sm">
                                <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse shadow-lg shadow-white/50"></div>
                                <span className="text-sm font-black uppercase tracking-wider">LIVE</span>
                            </div>
                        </div>

                        {/* Media Status Indicators */}
                        <div className="absolute top-4 right-4 flex flex-col gap-2">
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg backdrop-blur-sm ${isVideoPlaying
                                ? 'bg-green-500/90 text-white shadow-green-500/50'
                                : 'bg-red-500/90 text-white shadow-red-500/50'
                                }`}>
                                <span>{isVideoPlaying ? '📹' : '🚫'}</span>
                                <span>{isVideoPlaying ? 'VIDEO' : 'OFF'}</span>
                            </div>
                            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold shadow-lg backdrop-blur-sm ${isAudioPlaying
                                ? 'bg-green-500/90 text-white shadow-green-500/50'
                                : 'bg-red-500/90 text-white shadow-red-500/50'
                                }`}>
                                <span>{isAudioPlaying ? '🎤' : '🚫'}</span>
                                <span>{isAudioPlaying ? 'AUDIO' : 'OFF'}</span>
                            </div>
                        </div>

                        {/* Video Resolution */}
                        {videoDimensions.width > 0 && (
                            <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-md text-white px-3 py-1.5 rounded-lg text-xs font-mono font-semibold shadow-lg">
                                {videoDimensions.width}×{videoDimensions.height}
                            </div>
                        )}

                        {/* Fullscreen Button */}
                        <button
                            onClick={onToggleFullscreen}
                            className="absolute bottom-4 right-4 bg-black/80 backdrop-blur-md text-white p-2.5 rounded-xl hover:bg-black/90 transition-all duration-200 shadow-lg hover:scale-110 transform"
                        >
                            {isFullscreen ? <FullscreenExit className="w-5 h-5" /> : <Fullscreen className="w-5 h-5" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Controls Section */}
            <div className="p-8 border-t border-gray-200">
                {/* Primary Controls */}
                <div className="flex flex-wrap items-center justify-center gap-4 mb-6">
                    <button
                        onClick={onToggleVideo}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg transform hover:scale-105 active:scale-95 ${isVideoPlaying
                            ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 hover:from-gray-400 hover:to-gray-500 shadow-gray-500/20'
                            : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-red-500/30'
                            }`}
                    >
                        {isVideoPlaying ? 'Turn Off Video' : 'Turn On Video'}
                    </button>

                    <button
                        onClick={onToggleAudio}
                        className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all duration-200 shadow-lg transform hover:scale-105 active:scale-95 ${isAudioPlaying
                            ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-gray-900 hover:from-gray-400 hover:to-gray-500 shadow-gray-500/20'
                            : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 shadow-red-500/30'
                            }`}
                    >
                        {isAudioPlaying ? 'Turn Off Mic' : 'Turn On Mic'}
                    </button>

                    <button
                        onClick={onCheckLiveKit}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 font-semibold shadow-lg shadow-blue-500/30 transform hover:scale-105 active:scale-95"
                    >
                        🔍 Check Status
                    </button>
                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-gray-200">
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Video</div>
                        <div className={`inline-flex px-4 py-1.5 rounded-xl text-xs font-bold shadow-md ${isVideoPlaying
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                            }`}>
                            {isVideoPlaying ? 'ON' : 'OFF'}
                        </div>
                    </div>
                    <div className="text-center p-4 bg-gray-50 rounded-xl">
                        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Audio</div>
                        <div className={`inline-flex px-4 py-1.5 rounded-xl text-xs font-bold shadow-md ${isAudioPlaying
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600 text-white'
                            : 'bg-gradient-to-r from-red-500 to-red-600 text-white'
                            }`}>
                            {isAudioPlaying ? 'ON' : 'OFF'}
                        </div>
                    </div>
                    {videoDimensions.width > 0 && (
                        <>
                            <div className="text-center p-4 bg-gray-50 rounded-xl">
                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Resolution</div>
                                <div className="text-sm font-mono font-bold text-gray-900">
                                    {videoDimensions.width}×{videoDimensions.height}
                                </div>
                            </div>
                            <div className="text-center p-4 bg-gray-50 rounded-xl">
                                <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Aspect Ratio</div>
                                <div className="text-sm font-mono font-bold text-gray-900">
                                    {(videoDimensions.width / videoDimensions.height).toFixed(2)}:1
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {/* Error Messages */}
                {(mediaError || livekitError) && (
                    <div className="mt-6 space-y-3">
                        {mediaError && (
                            <div className="p-4 bg-red-50 border-2 border-red-300 text-red-700 rounded-xl text-sm shadow-md">
                                <strong className="font-bold">Media Error:</strong> {mediaError}
                            </div>
                        )}
                        {livekitError && (
                            <div className="p-4 bg-red-50 border-2 border-red-300 text-red-700 rounded-xl text-sm shadow-md">
                                <strong className="font-bold">LiveKit Error:</strong> {livekitError}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default VideoPreview;
