import React, { useState, useCallback, useContext } from 'react';
import { ToastContext } from '../../context/ToastContext';
import Api from '../../common/SummaryAPI';
import ImageModal from '../../components/ImageModal';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

const ProductVariantList = ({
    variants,
    onVariantUpdated,
    onVariantDeleted,
    onEditVariant,
    viewOnly = false
}) => {
    const { showToast } = useContext(ToastContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [variantToDelete, setVariantToDelete] = useState(null);

    // Show delete confirmation
    const handleDeleteClick = useCallback((variant) => {
        setVariantToDelete(variant);
        setShowDeleteConfirm(true);
    }, []);

    // Cancel delete
    const handleCancelDelete = useCallback(() => {
        setShowDeleteConfirm(false);
        setVariantToDelete(null);
    }, []);

    // Delete variant
    const handleDeleteVariant = useCallback(async () => {
        if (!variantToDelete) return;

        const variantId = variantToDelete._id || variantToDelete.id;
        if (!variantId) {
            showToast("Variant ID not found!", "error");
            return;
        }

        setLoading(true);
        setError('');

        try {
            await Api.newVariants.delete(variantId);
            showToast("Variant deleted successfully", "success");
            setShowDeleteConfirm(false);
            setVariantToDelete(null);

            // Notify parent
            if (onVariantDeleted) {
                onVariantDeleted();
            }
        } catch (err) {
            let errorMessage = err.response?.data?.message || err.message || 'Failed to delete variant';

            // Improve error message for active orders
            if (errorMessage.includes('active orders') || errorMessage.includes('pending, confirmed, or shipping')) {
                errorMessage = "Cannot delete variant because it still contains active orders";
            }

            // Only show toast, don't set error state (error state is for fetch operations)
            showToast(errorMessage, "error");
            console.error("Delete variant error:", err);
        } finally {
            setLoading(false);
            setError(''); // Clear any previous error state
        }
    }, [variantToDelete, onVariantDeleted, showToast]);


    // Handle image click
    const handleImageClick = useCallback((imageUrl) => {
        setSelectedImage(imageUrl);
        setShowImageModal(true);
    }, []);

    // Close image modal
    const handleCloseImageModal = useCallback(() => {
        setShowImageModal(false);
        setSelectedImage('');
    }, []);

    if (!variants || variants.length === 0) {
        return (
            <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <p className="text-gray-500 mb-2">No variants available</p>
                <p className="text-sm text-gray-400">Add variants to activate this product</p>
            </div>
        );
    }

    return (
        <>

            <div className="bg-white rounded-xl shadow-xl">
                <div className="overflow-x-auto">
                    <div>
                        <table className="w-full min-w-[760px] table-fixed">
                            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
                                <tr>
                                    <th className="w-[6%] px-3 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">#</th>
                                    <th className="w-[16%] px-3 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Color</th>
                                    <th className="w-[14%] px-3 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Size</th>
                                    <th className="w-[16%] px-3 lg:px-4 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Price</th>
                                    <th className="w-[12%] px-3 lg:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Stock</th>
                                    <th className="w-[18%] px-3 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Image</th>
                                    <th className="w-[12%] px-3 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Status</th>
                                    {!viewOnly && (
                                        <th className="w-[10%] px-3 lg:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Actions</th>
                                    )}
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {variants.map((variant, vIdx) => {
                                    const isDisabled = variant.variantStatus === 'discontinued' || variant.isDeleted;
                                    return (
                                        <tr
                                            key={variant._id || variant.id || vIdx}
                                            className={`hover:bg-[#FDF5E7] transition-colors duration-150 ${isDisabled ? 'opacity-60' : ''}`}
                                        >
                                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 whitespace-nowrap">{vIdx + 1}</td>
                                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 whitespace-nowrap">{variant.productColorId?.color_name || 'N/A'}</td>
                                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 whitespace-nowrap">{variant.productSizeId?.size_name || 'N/A'}</td>
                                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 text-right font-semibold whitespace-nowrap">
                                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(variant.variantPrice || 0)}
                                            </td>
                                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 text-center whitespace-nowrap">{variant.stockQuantity || 0}</td>
                                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                                                {variant.variantImage ? (
                                                    <div className="flex items-center gap-2">
                                                        <img
                                                            src={variant.variantImage}
                                                            alt="Variant"
                                                            className="w-12 h-12 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-90 transition-all duration-200 hover:scale-105"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleImageClick(variant.variantImage);
                                                            }}
                                                            title="Click to view larger image"
                                                            onError={(e) => {
                                                                e.target.style.opacity = '0.5';
                                                                e.target.alt = 'Image not available';
                                                            }}
                                                        />
                                                        {variant.isMain && (
                                                            <span className="text-xs font-medium text-[#A86523] bg-[#FCEFCB] px-2 py-1 rounded-md border border-[#E9A319]">
                                                                Main
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="w-12 h-12 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex items-center justify-center">
                                                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 whitespace-nowrap">
                                                <span
                                                    className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${variant.variantStatus === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : variant.variantStatus === 'inactive'
                                                            ? 'bg-gray-100 text-gray-800 border border-gray-200'
                                                            : 'bg-yellow-100 text-yellow-800'
                                                        }`}
                                                >
                                                    {variant.variantStatus || 'N/A'}
                                                </span>
                                            </td>
                                            {!viewOnly && (
                                                <td className="px-3 lg:px-4 py-3 text-xs lg:text-sm text-center text-gray-900 whitespace-nowrap">
                                                    <div className="flex justify-center items-center space-x-1">
                                                        {(() => {
                                                            const isDisabled = variant.variantStatus === 'discontinued' || variant.isDeleted;
                                                            return (
                                                                <>
                                                                    <button
                                                                        onClick={() => onEditVariant && onEditVariant(variant)}
                                                                        disabled={isDisabled}
                                                                        className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${isDisabled
                                                                            ? 'text-gray-400 bg-gray-50/80 border-gray-300/60 cursor-not-allowed'
                                                                            : 'border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm'
                                                                            } disabled:hover:scale-100`}
                                                                        title={isDisabled ? "Cannot edit discontinued/deleted variant" : "Edit Variant"}
                                                                        aria-label={`Edit variant ${variant._id || variant.id}`}
                                                                    >
                                                                        <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                                        </svg>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteClick(variant)}
                                                                        disabled={isDisabled || loading}
                                                                        className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${isDisabled
                                                                            ? 'text-gray-400 bg-gray-50/80 border-gray-300/60 cursor-not-allowed'
                                                                            : 'text-white bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700'
                                                                            } disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100`}
                                                                        title={isDisabled ? "Cannot delete discontinued/deleted variant" : "Delete Variant"}
                                                                        aria-label={`Delete variant ${variant._id || variant.id}`}
                                                                    >
                                                                        <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    </button>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Image Modal */}
            <ImageModal
                isOpen={showImageModal}
                onClose={handleCloseImageModal}
                imageUrl={selectedImage}
                alt="Variant Image"
            />

            {/* Delete Confirmation Modal */}
            <DeleteConfirmModal
                isOpen={showDeleteConfirm && variantToDelete !== null}
                title="Delete Variant"
                itemName={variantToDelete ? (variantToDelete.variantName || `${variantToDelete.productColorId?.color_name || ''} ${variantToDelete.productSizeId?.size_name || ''}`).trim() || 'this variant' : ''}
                message={
                    variantToDelete ? (
                        <>
                            Are you sure you want to delete this variant?
                            <br />
                            <span className="text-sm text-gray-500">This action cannot be undone.</span>
                        </>
                    ) : null
                }
                confirmText="Delete"
                cancelText="Cancel"
                onConfirm={handleDeleteVariant}
                onCancel={handleCancelDelete}
                isLoading={loading}
            />
        </>
    );
};

export default ProductVariantList;
