import React, { useState, useCallback, useContext } from 'react';
import { FaPlus, FaEdit } from 'react-icons/fa';
import { ToastContext } from '../../context/ToastContext';
import CreateVariantModal from '../ProductVariant/CreateVariantModal';
import EditVariantModal from '../ProductVariant/EditVariantModal';
import ProductVariantList from '../ProductVariant/ProductVariantList';
import ImageModal from '../../components/ImageModal';

const ProductDetailsModal = ({
    isOpen,
    onClose,
    product,
    productVariants,
    getCategoryName,
    colors,
    sizes,
    onVariantChange,
    onEditProduct
}) => {
    const { showToast } = useContext(ToastContext);
    const [editingVariant, setEditingVariant] = useState(null);
    const [showCreateVariant, setShowCreateVariant] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');

    // Handle variant operations
    const handleVariantCreated = useCallback(() => {
        setShowCreateVariant(false);
        if (onVariantChange) {
            onVariantChange();
        }
    }, [onVariantChange]);

    const handleVariantUpdated = useCallback(() => {
        setEditingVariant(null);
        if (onVariantChange) {
            onVariantChange();
        }
    }, [onVariantChange]);

    const handleVariantDeleted = useCallback(() => {
        if (onVariantChange) {
            onVariantChange();
        }
    }, [onVariantChange]);

    const handleEditVariant = useCallback((variant) => {
        setEditingVariant(variant);
    }, []);

    const handleCloseCreateModal = useCallback(() => {
        setShowCreateVariant(false);
    }, []);

    const handleCloseEditModal = useCallback(() => {
        setEditingVariant(null);
    }, []);

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

    // Handle edit product
    const handleEditProduct = useCallback(() => {
        if (onEditProduct && product) {
            onEditProduct(product);
        }
    }, [onEditProduct, product]);

    if (!isOpen || !product) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-6xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900">Product Details</h2>
                        <div className="flex items-center space-x-2">
                            <button
                                onClick={handleEditProduct}
                                className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
                                title="Edit Product"
                            >
                                <FaEdit className="w-4 h-4" />
                                <span>Edit Product</span>
                            </button>
                            <button
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                onClick={onClose}
                                aria-label="Close modal"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="p-6 space-y-6">
                        {/* Product Basic Info */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Product Name</label>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                        <span className="text-gray-900 font-medium">{product.productName || 'N/A'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                            {getCategoryName(product.categoryId)}
                                        </span>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                    <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${product.productStatus === 'active'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-gray-100 text-gray-800'
                                            }`}>
                                            {product.productStatus || 'N/A'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg min-h-[120px]">
                                    <p className="text-gray-900">{product.description || 'No description available'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Product Images */}
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Product Images</h3>
                            {product.productImageIds && product.productImageIds.length > 0 ? (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {product.productImageIds.map((img, idx) => (
                                        <div key={idx} className="relative border-2 rounded-lg overflow-hidden border-gray-200">
                                            <img
                                                src={img.imageUrl}
                                                alt={`Product ${idx + 1}`}
                                                className="w-full h-32 object-cover cursor-pointer hover:opacity-80 transition-all duration-200 hover:scale-105"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleImageClick(img.imageUrl);
                                                }}
                                                title="Click to view larger image"
                                                onError={(e) => {
                                                    e.target.style.opacity = '0.5';
                                                    e.target.alt = 'Image not available';
                                                }}
                                            />
                                            {img.isMain && (
                                                <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                                                    Main
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <p className="text-gray-500">No images available</p>
                                </div>
                            )}
                        </div>

                        {/* Product Variants */}
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Product Variants</h3>
                                <button
                                    onClick={() => setShowCreateVariant(true)}
                                    className="flex items-center space-x-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
                                >
                                    <FaPlus className="w-4 h-4" />
                                    <span>Add Variant</span>
                                </button>
                            </div>
                            {product?._id && productVariants[product._id] ? (
                                <ProductVariantList
                                    variants={productVariants[product._id]}
                                    onVariantUpdated={handleVariantUpdated}
                                    onVariantDeleted={handleVariantDeleted}
                                    onEditVariant={handleEditVariant}
                                />
                            ) : (
                                <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-gray-500">Loading variants...</p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="flex items-center justify-end space-x-4 p-6 border-t border-gray-200">
                        <button
                            onClick={onClose}
                            className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Variant Modal */}
            <CreateVariantModal
                isOpen={showCreateVariant}
                onClose={handleCloseCreateModal}
                product={product}
                colors={colors}
                sizes={sizes}
                onVariantCreated={handleVariantCreated}
            />

            {/* Edit Variant Modal */}
            <EditVariantModal
                isOpen={!!editingVariant}
                onClose={handleCloseEditModal}
                variant={editingVariant}
                product={product}
                colors={colors}
                sizes={sizes}
                onVariantUpdated={handleVariantUpdated}
            />

            {/* Image Modal */}
            <ImageModal
                isOpen={showImageModal}
                onClose={handleCloseImageModal}
                imageUrl={selectedImage}
                alt="Product Image"
            />
        </>
    );
};

export default ProductDetailsModal;
