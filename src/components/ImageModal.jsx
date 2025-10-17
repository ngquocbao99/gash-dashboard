import React, { useEffect } from 'react';

const ImageModal = ({ isOpen, onClose, imageUrl, alt = 'Image' }) => {
    // Handle ESC key press
    useEffect(() => {
        const handleEscKey = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscKey);
            // Prevent body scroll when modal is open
            document.body.style.overflow = 'hidden';
        }

        return () => {
            document.removeEventListener('keydown', handleEscKey);
            document.body.style.overflow = 'unset';
        };
    }, [isOpen, onClose]);

    if (!isOpen || !imageUrl) return null;

    return (
        <div
            className="fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex items-center justify-center z-[60] p-4 animate-in fade-in-0 duration-300"
            onClick={onClose}
        >
            <div
                className="relative max-w-5xl max-h-[95vh] w-full h-full flex items-center justify-center"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close button */}
                <button
                    className="absolute top-4 right-4 z-10 p-3 bg-black bg-opacity-60 text-white rounded-full hover:bg-opacity-80 transition-all duration-200 shadow-lg"
                    onClick={onClose}
                    aria-label="Close image"
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                {/* Image container with loading state */}
                <div className="relative w-full h-full flex items-center justify-center">
                    <img
                        src={imageUrl}
                        alt={alt}
                        className="max-w-full max-h-full object-contain rounded-lg shadow-2xl transition-all duration-300 transform scale-100"
                        onError={(e) => {
                            e.target.style.display = 'none';
                            e.target.nextSibling.style.display = 'flex';
                        }}
                        onLoad={(e) => {
                            e.target.style.opacity = '1';
                        }}
                        style={{ opacity: 0 }}
                    />

                    {/* Error fallback */}
                    <div
                        className="hidden flex-col items-center justify-center w-full h-full bg-gray-100 rounded-lg"
                    >
                        <svg className="w-16 h-16 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p className="text-gray-500 text-lg font-medium">Image not available</p>
                        <p className="text-gray-400 text-sm mt-2">The image could not be loaded</p>
                    </div>
                </div>

                {/* Loading indicator */}
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin opacity-50"></div>
                </div>
            </div>
        </div>
    );
};

export default ImageModal;


