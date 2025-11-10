import React from 'react';

const DeleteConfirmModal = ({
    isOpen,
    title = "Confirm Delete",
    message,
    itemName,
    onConfirm,
    onCancel,
    confirmText = "Delete",
    cancelText = "Cancel",
    isLoading = false
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
                <div className="p-6">
                    <div className="flex items-center mb-4">
                        <div className="shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                        </div>
                    </div>
                    <div className="text-center">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
                        <div className="text-gray-600 mb-6">
                            {message ? (
                                typeof message === 'string' ? <p>{message}</p> : message
                            ) : (
                                <p>
                                    Are you sure you want to delete <span className="font-semibold text-gray-900">{itemName}</span>?
                                    <br />
                                    <span className="text-sm text-gray-500">This action cannot be undone.</span>
                                </p>
                            )}
                        </div>
                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <button
                                onClick={onCancel}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isLoading}
                                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium hover:shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                            >
                                {isLoading ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                        <span>Processing...</span>
                                    </div>
                                ) : (
                                    confirmText
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DeleteConfirmModal;

