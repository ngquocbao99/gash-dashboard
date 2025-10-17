import React, { useState, useCallback, useContext } from 'react';
import { FaEdit, FaTrash } from 'react-icons/fa';
import { ToastContext } from '../../context/ToastContext';
import Api from '../../common/SummaryAPI';
import ImageModal from '../../components/ImageModal';

const ProductVariantList = ({
    variants,
    onVariantUpdated,
    onVariantDeleted,
    onEditVariant
}) => {
    const { showToast } = useContext(ToastContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');

    // Delete variant
    const handleDeleteVariant = useCallback(async (variantId) => {
        if (!window.confirm('Are you sure you want to delete this variant?')) return;

        setLoading(true);
        setError('');

        try {
            await Api.newVariants.delete(variantId);
            showToast("Variant deleted successfully", "success");

            // Notify parent
            if (onVariantDeleted) {
                onVariantDeleted();
            }
        } catch (err) {
            const errorMessage = err.response?.data?.message || err.message || 'Failed to delete variant';
            setError(errorMessage);
            showToast(errorMessage, "error");
            console.error("Delete variant error:", err);
        } finally {
            setLoading(false);
        }
    }, [onVariantDeleted, showToast]);


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

            <div className="overflow-x-auto">
                <table className="w-full border border-gray-200 rounded-lg overflow-hidden">
                    <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Color</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Size</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Price</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Stock</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Image</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {variants.map((variant, vIdx) => (
                            <tr key={variant._id} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-sm text-gray-900">{vIdx + 1}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{variant.productColorId?.color_name || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">{variant.productSizeId?.size_name || 'N/A'}</td>
                                <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(variant.variantPrice || 0)}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">{variant.stockQuantity || 0}</td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    {variant.variantImage ? (
                                        <img
                                            src={variant.variantImage}
                                            alt="Variant"
                                            className="w-12 h-12 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-all duration-200 hover:scale-110"
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
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                                            <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    )}
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variant.variantStatus === 'active'
                                        ? 'bg-green-100 text-green-800'
                                        : variant.variantStatus === 'inactive'
                                            ? 'bg-gray-100 text-gray-800'
                                            : 'bg-yellow-100 text-yellow-800'
                                        }`}>
                                        {variant.variantStatus || 'N/A'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-sm text-gray-900">
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={() => onEditVariant && onEditVariant(variant)}
                                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                                            title="Edit Variant"
                                        >
                                            <FaEdit className="w-3 h-3" />
                                        </button>
                                        <button
                                            onClick={() => handleDeleteVariant(variant._id)}
                                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 border border-red-200 hover:border-red-300"
                                            title="Delete Variant"
                                            disabled={loading}
                                        >
                                            <FaTrash className="w-3 h-3" />
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Image Modal */}
            <ImageModal
                isOpen={showImageModal}
                onClose={handleCloseImageModal}
                imageUrl={selectedImage}
                alt="Variant Image"
            />
        </>
    );
};

export default ProductVariantList;
