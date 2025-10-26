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
        <div className="bg-white p-6 rounded-lg shadow-sm border mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Live Video</h2>

            <div className="flex justify-center mb-4">
                <div className="relative bg-black rounded-lg overflow-hidden" style={{ width: '300px', aspectRatio: '9/16' }}>
                    <video
                        ref={localVideoRef}
                        autoPlay
                        muted
                        playsInline
                        controls={false}
                        className="w-full h-full object-cover"
                        style={{ backgroundColor: '#000' }}
                    />

                    <div className="absolute top-4 left-4 flex items-center gap-2">
                        <div className="flex items-center gap-2 bg-red-600 text-white px-2 py-1 rounded">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium">LIVE</span>
                        </div>
                    </div>

                    <div className="absolute top-4 right-16 flex flex-col gap-1">
                        <div className={`px-2 py-1 rounded text-xs ${isVideoPlaying ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                            }`}>
                            {isVideoPlaying ? '📹 Video ON' : '📹 Video OFF'}
                        </div>
                        <div className={`px-2 py-1 rounded text-xs ${isAudioPlaying ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                            }`}>
                            {isAudioPlaying ? '🎤 Audio ON' : '🎤 Audio OFF'}
                        </div>
                    </div>

                    {videoDimensions.width > 0 && (
                        <div className="absolute bottom-4 left-4 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                            {videoDimensions.width}x{videoDimensions.height}
                        </div>
                    )}

                    <button
                        onClick={onToggleFullscreen}
                        className="absolute top-4 right-4 bg-black bg-opacity-50 text-white p-2 rounded hover:bg-opacity-70 transition-colors"
                    >
                        {isFullscreen ? <FullscreenExit className="w-5 h-5" /> : <Fullscreen className="w-5 h-5" />}
                    </button>
                </div>
            </div>

            <div className="flex items-center justify-center gap-4">
                <button
                    onClick={onToggleVideo}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    {isVideoPlaying ? 'Tắt Video' : 'Bật Video'}
                </button>

                <button
                    onClick={onToggleAudio}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                    {isAudioPlaying ? 'Tắt Mic' : 'Bật Mic'}
                </button>

                <button
                    onClick={onCheckLiveKit}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Check LiveKit
                </button>

                <button
                    onClick={onRefresh}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                >
                    Refresh
                </button>
            </div>

            <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Trạng thái Media</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium">Video:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${isVideoPlaying ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {isVideoPlaying ? 'Đang phát' : 'Đã dừng'}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium">Audio:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${isAudioPlaying ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            }`}>
                            {isAudioPlaying ? 'Đang phát' : 'Đã dừng'}
                        </span>
                    </div>
                    {videoDimensions.width > 0 && (
                        <>
                            <div>
                                <span className="font-medium">Kích thước:</span>
                                <span className="ml-2 text-gray-600">{videoDimensions.width}x{videoDimensions.height}</span>
                            </div>
                            <div>
                                <span className="font-medium">Tỷ lệ:</span>
                                <span className="ml-2 text-gray-600">
                                    {(videoDimensions.width / videoDimensions.height).toFixed(2)}:1
                                </span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                <h3 className="text-sm font-medium text-blue-900 mb-2">LiveKit Status</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                        <span className="font-medium">Connection:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${connectionState === 'connected' ? 'bg-green-100 text-green-800' :
                            connectionState === 'connecting' ? 'bg-yellow-100 text-yellow-800' :
                                connectionState === 'error' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {connectionState}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium">Publishing:</span>
                        <span className={`ml-2 px-2 py-1 rounded text-xs ${isPublishing ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                            {isPublishing ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div>
                        <span className="font-medium">Viewers:</span>
                        <span className="ml-2 text-gray-600">{remoteParticipants.length}</span>
                    </div>
                    <div>
                        <span className="font-medium">Room:</span>
                        <span className="ml-2 text-gray-600">{currentLivestream?.roomName || 'N/A'}</span>
                    </div>
                </div>
            </div>

            {mediaError && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    <strong>Media Error:</strong> {mediaError}
                </div>
            )}

            {livekitError && (
                <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
                    <strong>LiveKit Error:</strong> {livekitError}
                </div>
            )}
        </div>
    );
};

export default VideoPreview;
