import React, { useState, useCallback } from "react";
import Api from "../common/SummaryAPI";
import Loading from "./Loading";

const UploadRefundProofModal = ({
    isOpen,
    onClose,
    currentProof,
    onUpload,
    isUploading,
    error: externalError,
    onImageClick
}) => {
    const [refundProofPreview, setRefundProofPreview] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [internalError, setInternalError] = useState(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [isUploadingLocal, setIsUploadingLocal] = useState(false);

    // Use external error if provided, otherwise use internal error
    const error = externalError || internalError;

    // Combined uploading state - show loading if either local or external is uploading
    const isUploadingCombined = isUploading || isUploadingLocal;

    // Upload helper (single image)
    const uploadSingleImage = useCallback(async (file) => {
        if (!file) return '';
        try {
            const response = await Api.upload.image(file);

            // Try different possible response structures
            const imageUrl = response.data?.url ||
                response.data?.data?.url ||
                response.data?.imageUrl ||
                response.data?.data?.imageUrl ||
                response.data;

            if (!imageUrl) {
                return '';
            }

            return imageUrl;
        } catch (err) {
            // Re-throw with more context
            throw err;
        }
    }, []);

    // Handle refund proof upload
    const handleRefundProofChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setSelectedFile(file);

            // Create preview
            const reader = new FileReader();
            reader.onload = (e) => {
                setRefundProofPreview(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    // Handle remove preview
    const handleRemovePreview = () => {
        setRefundProofPreview(null);
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('refund-proof-upload');
        if (fileInput) fileInput.value = '';
    };

    // Handle upload button click - show confirmation first
    const handleUploadClick = () => {
        if (!selectedFile && !currentProof) {
            return;
        }
        // Show confirmation modal
        setShowConfirmModal(true);
    };

    // Handle confirmed upload
    const handleConfirmUpload = async () => {
        setShowConfirmModal(false);

        // Set local loading state immediately
        setIsUploadingLocal(true);
        setInternalError(null);

        if (!selectedFile && !currentProof) {
            setIsUploadingLocal(false);
            return;
        }

        try {
            let refundProofUrl = currentProof;

            // Upload refund proof if provided
            if (selectedFile) {
                try {
                    refundProofUrl = await uploadSingleImage(selectedFile);

                    // Validate that upload was successful
                    if (!refundProofUrl || refundProofUrl === '') {
                        throw new Error("Failed to upload refund proof. Please try again.");
                    }
                } catch (uploadErr) {
                    // Handle upload-specific errors
                    console.error("Refund Proof Upload Error:", uploadErr);

                    let uploadErrorMessage = "Failed to upload refund proof";

                    // Check for network errors
                    if (uploadErr.code === 'ERR_NETWORK' || uploadErr.message?.includes('Network Error') || !uploadErr.response) {
                        uploadErrorMessage = "Failed to upload refund proof. Please try again later.";
                    } else if (uploadErr.response?.status === 500) {
                        uploadErrorMessage = "Failed to upload refund proof. Server error - please try again later";
                    } else if (uploadErr.response?.status === 413) {
                        uploadErrorMessage = "File too large - please choose a smaller image";
                    } else if (uploadErr.response?.status === 400) {
                        uploadErrorMessage = uploadErr.response?.data?.message || "Invalid file format";
                    } else if (uploadErr.response?.data?.message) {
                        uploadErrorMessage = uploadErr.response.data.message;
                    } else if (uploadErr.message) {
                        uploadErrorMessage = uploadErr.message;
                    }

                    // Re-throw with formatted message
                    const error = new Error(uploadErrorMessage);
                    error.code = uploadErr.code;
                    error.response = uploadErr.response;
                    throw error;
                }
            }

            // Validate that we have a refund proof URL
            if (!refundProofUrl) {
                throw new Error("Refund proof is required");
            }

            // Call parent's onUpload callback
            await onUpload(refundProofUrl);

            // Reset state on success
            setRefundProofPreview(null);
            setSelectedFile(null);
            setInternalError(null);
            setIsUploadingLocal(false);
            const fileInput = document.getElementById('refund-proof-upload');
            if (fileInput) fileInput.value = '';
        } catch (err) {
            // Set internal error to display in modal
            let errorMessage = "Failed to upload refund proof";

            if (err?.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err?.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err?.message) {
                errorMessage = err.message;
            }

            setInternalError(errorMessage);
            setIsUploadingLocal(false);
            // Don't re-throw, let user see the error and try again
        }
    };

    // Reset state when modal closes
    const handleClose = () => {
        setRefundProofPreview(null);
        setSelectedFile(null);
        setInternalError(null);
        setShowConfirmModal(false);
        setIsUploadingLocal(false);
        const fileInput = document.getElementById('refund-proof-upload');
        if (fileInput) fileInput.value = '';
        onClose();
    };

    // Handle cancel confirmation
    const handleCancelConfirm = () => {
        setShowConfirmModal(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-60 p-4">
            <div className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-md flex flex-col transform transition-all duration-300" style={{ borderColor: '#A86523' }}>
                {/* Modal Header */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0" style={{ borderColor: '#A86523' }}>
                    <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
                        <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                        Upload Refund Proof
                    </h3>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': '#A86523' }}
                        aria-label="Close modal"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Modal Content */}
                <div className="p-4 sm:p-5 relative">
                    {/* Loading Overlay */}
                    {isUploadingCombined && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm rounded-lg flex items-center justify-center z-10">
                            <Loading
                                type="inline"
                                size="medium"
                                message="Uploading refund proof..."
                                subMessage="Please wait while we process your file"
                            />
                        </div>
                    )}

                    {/* Error Message */}
                    {error && (
                        <div className="mb-3 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="h-4 w-4 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-xs sm:text-sm text-red-800">{error}</p>
                            </div>
                        </div>
                    )}

                    <div className={isUploadingCombined ? 'opacity-50 pointer-events-none' : ''}>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Refund Proof
                            {currentProof && (
                                <span className="text-xs text-green-600 ml-2">
                                    (Current proof available)
                                </span>
                            )}
                        </label>

                        {/* Hidden file input */}
                        <input
                            type="file"
                            accept="image/*"
                            onChange={handleRefundProofChange}
                            required
                            className="hidden"
                            id="refund-proof-upload"
                        />

                        {/* Upload Button */}
                        {!refundProofPreview && (
                            <label
                                htmlFor="refund-proof-upload"
                                className="flex flex-col items-center justify-center w-full h-40 border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 bg-white hover:bg-gray-50 border-gray-300"
                            >
                                <svg
                                    className="w-8 h-8 mb-2 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 4v16m8-8H4"
                                    />
                                </svg>
                                <p className="text-sm font-medium text-gray-600">
                                    Upload
                                </p>
                            </label>
                        )}

                        {/* Preview of new upload */}
                        {refundProofPreview && (
                            <div className="mt-2">
                                <p className="text-sm text-gray-600 mb-2">Preview:</p>
                                <div className="relative inline-block">
                                    <img
                                        src={refundProofPreview}
                                        alt="Refund proof preview"
                                        className="w-40 h-40 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                        onClick={() => onImageClick && onImageClick(refundProofPreview, 'Refund proof preview')}
                                    />
                                    <button
                                        type="button"
                                        onClick={handleRemovePreview}
                                        className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                                        title="Remove preview"
                                    >
                                        ×
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Current proof (if exists and no new preview) */}
                        {currentProof && !refundProofPreview && (
                            <div className="mt-2">
                                <p className="text-sm text-gray-600 mb-2">Current proof:</p>
                                <img
                                    src={currentProof}
                                    alt="Current refund proof"
                                    className="w-40 h-40 object-cover rounded-lg border border-gray-300 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => onImageClick && onImageClick(currentProof, 'Current refund proof')}
                                />
                            </div>
                        )}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className={`flex items-center justify-end p-3 sm:p-4 border-t shrink-0 space-x-3 ${isUploadingCombined ? 'opacity-50 pointer-events-none' : ''}`} style={{ borderColor: '#A86523' }}>
                    <button
                        onClick={handleClose}
                        disabled={isUploadingCombined}
                        className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUploadClick}
                        disabled={isUploadingCombined || (!selectedFile && !currentProof)}
                        className="px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-md"
                        style={{ backgroundColor: '#E9A319' }}
                        onMouseEnter={(e) => !isUploadingCombined && !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#A86523')}
                        onMouseLeave={(e) => !isUploadingCombined && !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E9A319')}
                    >
                        <span>
                            Upload
                        </span>
                    </button>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-70 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-md flex flex-col transform transition-all duration-300" style={{ borderColor: '#A86523' }}>
                        {/* Modal Header */}
                        <div className="flex items-center justify-between p-3 sm:p-4 border-b shrink-0" style={{ borderColor: '#A86523' }}>
                            <h3 className="text-base sm:text-lg font-bold text-gray-900 flex items-center">
                                <svg className="w-5 h-5 mr-2 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                Confirm
                            </h3>
                            <button
                                type="button"
                                onClick={handleCancelConfirm}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                                style={{ '--tw-ring-color': '#A86523' }}
                                aria-label="Close modal"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* Modal Content */}
                        <div className="p-4 sm:p-5">
                            <div className="mb-4">
                                <p className="text-sm sm:text-base text-gray-700 mb-3">
                                    You are about to upload the refund proof. This action can only be performed <strong className="text-orange-600">once</strong> and cannot be undone.
                                </p>
                                <p className="text-sm text-gray-600">
                                    Are you sure you want to proceed with uploading the refund proof?
                                </p>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-end p-3 sm:p-4 border-t shrink-0 space-x-3" style={{ borderColor: '#A86523' }}>
                            <button
                                onClick={handleCancelConfirm}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmUpload}
                                disabled={isUploadingCombined}
                                className="px-4 py-2 text-sm text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-md"
                                style={{ backgroundColor: '#E9A319' }}
                                onMouseEnter={(e) => !isUploadingCombined && !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#A86523')}
                                onMouseLeave={(e) => !isUploadingCombined && !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#E9A319')}
                            >
                                {isUploadingCombined && (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                )}
                                <span>
                                    {isUploadingCombined ? 'Uploading...' : 'Confirm'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UploadRefundProofModal;

