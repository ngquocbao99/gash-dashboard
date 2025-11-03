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
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            {/* Video Container */}
            <div className="bg-gradient-to-br from-gray-900 to-black relative">
                <div className="flex justify-center items-center min-h-[400px] p-4">
                    <div className="relative bg-black rounded-lg overflow-hidden shadow-lg border-2 border-gray-800" style={{ width: 'min(360px, 90vw)', aspectRatio: '9/16' }}>
                        <video
                            ref={localVideoRef}
                            autoPlay
                            muted={true}
                            playsInline
                            controls={false}
                            className="w-full h-full object-cover"
                            style={{ backgroundColor: '#000' }}
                        />

                        {/* LIVE Badge */}
                        <div className="absolute top-3 left-3 flex items-center gap-1.5">
                            <div className="flex items-center gap-1.5 bg-gradient-to-r from-red-600 to-red-700 text-white px-2.5 py-1 rounded-lg shadow-lg shadow-red-500/50 backdrop-blur-sm">
                                <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
                                <span className="text-xs font-bold uppercase tracking-wide">LIVE</span>
                            </div>
                        </div>

                        {/* Media Status Indicators */}
                        {/* <div className="absolute top-3 right-3 flex flex-col gap-1.5">
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold shadow-md backdrop-blur-sm ${isVideoPlaying
                                ? 'bg-green-500/90 text-white'
                                : 'bg-red-500/90 text-white'
                                }`}>
                                <span className="text-xs">{isVideoPlaying ? '📹' : '🚫'}</span>
                                <span>{isVideoPlaying ? 'VIDEO' : 'OFF'}</span>
                            </div>
                            <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold shadow-md backdrop-blur-sm ${isAudioPlaying
                                ? 'bg-green-500/90 text-white'
                                : 'bg-red-500/90 text-white'
                                }`}>
                                <span className="text-xs">{isAudioPlaying ? '🎤' : '🚫'}</span>
                                <span>{isAudioPlaying ? 'AUDIO' : 'OFF'}</span>
                            </div>
                        </div> */}

                        {/* Video Resolution */}
                        {videoDimensions.width > 0 && (
                            <div className="absolute bottom-3 left-3 bg-black/80 backdrop-blur-md text-white px-2 py-1 rounded text-[10px] font-mono font-semibold shadow-md">
                                {videoDimensions.width}×{videoDimensions.height}
                            </div>
                        )}

                        {/* Fullscreen Button */}
                        <button
                            onClick={onToggleFullscreen}
                            className="absolute bottom-3 right-3 bg-black/80 backdrop-blur-md text-white p-1.5 rounded-lg hover:bg-black/90 transition-all duration-200 shadow-md"
                        >
                            {isFullscreen ? <FullscreenExit className="w-4 h-4" /> : <Fullscreen className="w-4 h-4" />}
                        </button>
                    </div>
                </div>
            </div>

            {/* Controls Section */}
            <div className="p-3 border-t border-gray-200 bg-gray-50">
                {/* Primary Controls */}
                <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
                    <button
                        onClick={onToggleVideo}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${isVideoPlaying
                            ? 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                            : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                    >
                        {isVideoPlaying ? 'Turn Off Video' : 'Turn On Video'}
                    </button>

                    <button
                        onClick={onToggleAudio}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${isAudioPlaying
                            ? 'bg-gray-200 text-gray-900 hover:bg-gray-300'
                            : 'bg-red-600 text-white hover:bg-red-700'
                            }`}
                    >
                        {isAudioPlaying ? 'Turn Off Mic' : 'Turn On Mic'}
                    </button>

                </div>

                {/* Status Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-3 border-t border-gray-300">
                    <div className="text-center p-2 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Video</div>
                        <div className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold ${isVideoPlaying
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                            }`}>
                            {isVideoPlaying ? 'ON' : 'OFF'}
                        </div>
                    </div>
                    <div className="text-center p-2 bg-white rounded-lg border border-gray-200">
                        <div className="text-[10px] font-semibold text-gray-500 mb-1.5 uppercase">Audio</div>
                        <div className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold ${isAudioPlaying
                            ? 'bg-green-500 text-white'
                            : 'bg-red-500 text-white'
                            }`}>
                            {isAudioPlaying ? 'ON' : 'OFF'}
                        </div>
                    </div>
                </div>

                {/* Error Messages */}
                {(mediaError || livekitError) && (
                    <div className="mt-4 space-y-2">
                        {mediaError && (
                            <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-xs">
                                <strong className="font-bold">Media Error:</strong> {mediaError}
                            </div>
                        )}
                        {livekitError && (
                            <div className="p-3 bg-red-50 border border-red-300 text-red-700 rounded-lg text-xs">
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
