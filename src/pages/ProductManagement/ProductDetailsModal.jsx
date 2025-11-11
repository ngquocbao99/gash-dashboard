// ProductDetailsModal.jsx
import React, { useState, useCallback, useContext, useEffect, useMemo } from 'react';
import { FaPlus, FaEdit } from 'react-icons/fa';
import { ToastContext } from '../../context/ToastContext';
import VariantModal from '../../components/VariantModal';
import ProductVariantList from '../ProductVariant/ProductVariantList';
import ImageModal from '../../components/ImageModal';

const ProductDetailsModal = ({
    isOpen,
    onClose,
    product,
    productVariants,
    getCategoryName,
    getCategoryInfo = () => ({ name: 'N/A', isDeleted: false }),
    colors,
    sizes,
    onVariantChange,
    onEditProduct,
    viewOnly = false
}) => {
    const { showToast } = useContext(ToastContext);
    const [editingVariant, setEditingVariant] = useState(null);
    const [showCreateVariant, setShowCreateVariant] = useState(false);
    const [showImageModal, setShowImageModal] = useState(false);
    const [selectedImage, setSelectedImage] = useState('');

    // Fetch variants when modal opens and product is available
    useEffect(() => {
        if (isOpen && product?._id && onVariantChange) {
            onVariantChange();
        }
    }, [isOpen, product?._id, onVariantChange]);

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
        if (variant.status === 'discontinued') {
            showToast('Cannot edit discontinued variant', 'error');
            return;
        }
        setEditingVariant(variant);
    }, [showToast]);

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

    const getVariantStatusPriority = useCallback((status) => {
        const normalized = (status || '').toLowerCase();
        switch (normalized) {
            case 'active':
                return 0;
            case 'available':
                return 1;
            case 'inactive':
                return 2;
            case 'pending':
                return 3;
            case 'discontinued':
                return 4;
            default:
                return 5;
        }
    }, []);

    const getVariantLabel = useCallback((variant) => {
        if (!variant) return '';
        const name = variant.variantName || '';
        if (name) {
            return name;
        }

        const colorName = variant.productColorId?.color_name || '';
        const sizeName = variant.productSizeId?.size_name || '';
        const combined = `${colorName} ${sizeName}`.trim();
        if (combined) {
            return combined;
        }

        return variant._id || variant.id || '';
    }, []);

    const sortedVariants = useMemo(() => {
        if (!product?._id) return [];
        const variants = productVariants[product._id];
        if (!Array.isArray(variants)) return [];

        return [...variants].sort((a, b) => {
            const statusDiff = getVariantStatusPriority(a?.variantStatus) - getVariantStatusPriority(b?.variantStatus);
            if (statusDiff !== 0) {
                return statusDiff;
            }

            const labelA = getVariantLabel(a);
            const labelB = getVariantLabel(b);
            return labelA.localeCompare(labelB, undefined, { sensitivity: 'base' });
        });
    }, [product?._id, productVariants, getVariantLabel, getVariantStatusPriority]);

    const categoryInfo = getCategoryInfo ? getCategoryInfo(product?.categoryId) : { name: getCategoryName ? getCategoryName(product?.categoryId) : 'N/A', isDeleted: false };
    const categoryLabel = categoryInfo.name || (getCategoryName ? getCategoryName(product?.categoryId) : 'N/A');

    if (!isOpen || !product) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div
                    className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-6xl max-h-[90vh] flex flex-col transform transition-all duration-300"
                    style={{ borderColor: '#A86523' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div
                        className="flex items-center justify-between p-4 sm:p-5 border-b shrink-0"
                        style={{ borderColor: '#A86523' }}
                    >
                        <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                            Product Details
                        </h2>
                        <div className="flex items-center gap-2">
                            {!viewOnly && (
                                <button
                                    onClick={handleEditProduct}
                                    className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                                    style={{ backgroundColor: '#E9A319', '--tw-ring-color': '#A86523' }}
                                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
                                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
                                    title="Edit Product"
                                >
                                    <FaEdit className="w-4 h-4" />
                                    <span>Edit Product</span>
                                </button>
                            )}
                            <button
                                className="p-2 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                                style={{ '--tw-ring-color': '#A86523' }}
                                onClick={onClose}
                                aria-label="Close modal"
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 min-h-0">
                        {/* Overview + Images */}
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Overview</h3>
                                <dl className="space-y-3 text-sm text-gray-700">
                                    <div>
                                        <dt className="text-xs uppercase tracking-wide text-gray-500">Product Name</dt>
                                        <dd className="mt-1 font-medium text-gray-900">{product.productName || 'N/A'}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs uppercase tracking-wide text-gray-500">Category</dt>
                                        <dd className="mt-1 flex items-center gap-2">
                                            <span className={categoryInfo.isDeleted ? 'line-through opacity-60 text-gray-500' : 'font-medium text-gray-900'}>
                                                {categoryLabel}
                                            </span>
                                            {categoryInfo.isDeleted && (
                                                <span className="text-xs text-red-500 font-medium">(Deleted)</span>
                                            )}
                                        </dd>
                                        {categoryInfo.isDeleted && (
                                            <p className="mt-1 text-xs text-red-500">
                                                This category is marked as deleted. Consider updating the product to use an active category.
                                            </p>
                                        )}
                                    </div>
                                    <div>
                                        <dt className="text-xs uppercase tracking-wide text-gray-500">Status</dt>
                                        <dd className="mt-1">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${product.productStatus === 'discontinued'
                                                    ? 'bg-red-100 text-red-800'
                                                    : product.productStatus === 'active'
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-800 border border-gray-200'
                                                    }`}
                                            >
                                                {product.productStatus || 'N/A'}
                                            </span>
                                        </dd>
                                    </div>
                                </dl>
                            </div>

                            <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-gray-700">Product Images</h3>
                                    <span className="text-xs text-gray-500">{product.productImageIds?.length || 0} image(s)</span>
                                </div>
                                {product.productImageIds && product.productImageIds.length > 0 ? (
                                    <div className="grid grid-cols-2 gap-4">
                                        {product.productImageIds.map((img, idx) => (
                                            <div
                                                key={idx}
                                                className="relative border border-gray-200 rounded-lg overflow-hidden bg-gray-50 shadow-sm hover:shadow-md transition-all duration-200"
                                            >
                                                <img
                                                    src={img.imageUrl}
                                                    alt={`Product ${idx + 1}`}
                                                    className="w-full h-32 object-cover cursor-pointer hover:scale-105 transition-transform duration-200"
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
                                                    <div className="absolute top-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded shadow">
                                                        Main
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-lg">
                                        <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <p className="text-sm text-gray-500">No images available</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                            <h3 className="text-sm font-semibold text-gray-700 mb-3">Description</h3>
                            <div
                                className="prose prose-sm max-w-none text-gray-700"
                                dangerouslySetInnerHTML={{ __html: product.description || 'No description available' }}
                            />
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-700">Product Variants</h3>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {productVariants[product?._id]?.length || 0} variant(s) available
                                    </p>
                                </div>
                                {!viewOnly && (
                                    <button
                                        onClick={() => setShowCreateVariant(true)}
                                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg shadow-sm transition-all duration-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2"
                                        style={{ backgroundColor: '#E9A319', '--tw-ring-color': '#A86523' }}
                                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
                                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
                                    >
                                        <FaPlus className="w-4 h-4" />
                                        <span>Add Variant</span>
                                    </button>
                                )}
                            </div>
                            {product?._id && sortedVariants.length > 0 ? (
                                <ProductVariantList
                                    variants={sortedVariants}
                                    onVariantUpdated={handleVariantUpdated}
                                    onVariantDeleted={handleVariantDeleted}
                                    onEditVariant={handleEditVariant}
                                    viewOnly={viewOnly}
                                />
                            ) : product?._id && productVariants[product._id] && productVariants[product._id].length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5 a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                                    </svg>
                                    <p className="text-gray-500">No variants available for this product</p>
                                </div>
                            ) : (
                                <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                                    <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                                    <p className="text-gray-500">Loading variants...</p>
                                    <div className="mt-4 text-xs text-gray-400">
                                        <p>Product ID: {product?._id}</p>
                                        <p>Variants loaded: {productVariants[product?._id] ? 'Yes' : 'No'}</p>
                                        <p>Variants count: {productVariants[product?._id]?.length || 0}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 p-4 border-t shrink-0"
                        style={{ borderColor: '#A86523' }}
                    >
                        <button
                            onClick={onClose}
                            className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium focus:outline-none focus:ring-2 focus:ring-offset-2"
                            style={{ '--tw-ring-color': '#A86523' }}
                        >
                            Close
                        </button>
                    </div>
                </div>
            </div>

            {/* Create Variant Modal */}
            <VariantModal
                isOpen={showCreateVariant}
                onClose={handleCloseCreateModal}
                product={product}
                colors={colors}
                sizes={sizes}
                onVariantCreated={handleVariantCreated}
            />

            {/* Edit Variant Modal */}
            <VariantModal
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