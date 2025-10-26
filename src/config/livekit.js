// LiveKit Configuration for Frontend
export const LIVEKIT_CONFIG = {
    // LiveKit server URL - Update this with your actual LiveKit server URL
    serverUrl: import.meta.env.VITE_LIVEKIT_SERVER_URL || 'wss://livekit-server.example.com',

    // Room settings
    roomSettings: {
        adaptiveStream: true,
        dynacast: true,
        publishDefaults: {
            videoSimulcastLayers: [
                { resolution: { width: 320, height: 180 }, encoding: { maxBitrate: 100_000 } },
                { resolution: { width: 640, height: 360 }, encoding: { maxBitrate: 300_000 } },
                { resolution: { width: 1280, height: 720 }, encoding: { maxBitrate: 1_000_000 } }
            ]
        }
    },

    // Media constraints
    mediaConstraints: {
        video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
        },
        audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
        }
    }
};

export default LIVEKIT_CONFIG;
