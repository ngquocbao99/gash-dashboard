import React, { useState, useCallback, useEffect, useContext } from 'react';
import { ToastContext } from '../../context/ToastContext';
import Api from '../../common/SummaryAPI';

const EditVariantModal = ({
    isOpen,
    onClose,
    variant,
    product,
    colors,
    sizes,
    onVariantUpdated
}) => {
    const { showToast } = useContext(ToastContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form states
    const [variantForm, setVariantForm] = useState({
        productColorId: '',
        productSizeId: '',
        variantPrice: '',
        stockQuantity: '',
        variantStatus: 'active',
    });
    const [variantImageFile, setVariantImageFile] = useState(null);
    const [variantImagePreview, setVariantImagePreview] = useState('');
    const [validationErrors, setValidationErrors] = useState({});

    // Upload helper
    const uploadSingleImage = useCallback(async (file) => {
        if (!file) return '';
        try {
            const response = await Api.upload.image(file);
            console.log('Upload response:', response);

            // Try different possible response structures
            const imageUrl = response.data?.url ||
                response.data?.data?.url ||
                response.data?.imageUrl ||
                response.data?.data?.imageUrl ||
                response.data;

            if (!imageUrl) {
                console.error('No image URL found in response:', response);
                return '';
            }

            return imageUrl;
        } catch (err) {
            console.error('Upload error:', err);
            return '';
        }
    }, []);

    // Initialize form when variant changes
    useEffect(() => {
        if (variant) {
            console.log('=== INITIALIZING EDIT VARIANT ===');
            console.log('Variant data:', variant);
            console.log('Variant productColorId:', variant.productColorId);
            console.log('Variant productSizeId:', variant.productSizeId);
            console.log('Colors available:', colors);
            console.log('Sizes available:', sizes);

            const colorId = variant.productColorId?._id || variant.productColorId || '';
            const sizeId = variant.productSizeId?._id || variant.productSizeId || '';

            console.log('Extracted color ID:', colorId);
            console.log('Extracted size ID:', sizeId);

            setVariantForm({
                productColorId: colorId,
                productSizeId: sizeId,
                variantPrice: variant.variantPrice || '',
                stockQuantity: variant.stockQuantity || '',
                variantStatus: variant.variantStatus || 'active',
            });
            setVariantImagePreview(variant.variantImage || '');
            setVariantImageFile(null);
            setError('');
        }
    }, [variant, colors, sizes]);

    // Validation functions
    const validateForm = useCallback(() => {
        const errors = {};

        if (!variantForm.productColorId) {
            errors.productColorId = 'Please select a color';
        }

        if (!variantForm.productSizeId) {
            errors.productSizeId = 'Please select a size';
        }

        if (!variantForm.variantPrice || variantForm.variantPrice <= 0) {
            errors.variantPrice = 'Price must be greater than 0';
        } else if (variantForm.variantPrice > 100000000) {
            errors.variantPrice = 'Price must be less than 100,000,000 VND';
        }

        if (variantForm.stockQuantity === '' || variantForm.stockQuantity < 0) {
            errors.stockQuantity = 'Stock quantity must be 0 or greater';
        } else if (variantForm.stockQuantity > 10000) {
            errors.stockQuantity = 'Stock quantity must be less than 10,000';
        }

        // For edit, we allow no new image if existing image exists
        const hasExistingImage = variantImagePreview && variantImagePreview !== '';
        const hasNewImage = variantImageFile !== null;
        if (!hasExistingImage && !hasNewImage) {
            errors.variantImage = 'Please select an image for this variant';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [variantForm, variantImageFile, variantImagePreview]);

    // Handle field change with validation
    const handleFieldChange = useCallback((field, value) => {
        setVariantForm(prev => ({ ...prev, [field]: value }));

        // Clear validation error for this field
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    }, [validationErrors]);

    // Handle variant form changes
    const handleVariantFieldChange = useCallback((field, value) => {
        setVariantForm(prev => ({ ...prev, [field]: value }));
    }, []);

    // Handle variant image change
    const handleVariantImageChange = useCallback((e) => {
        const file = e.target.files && e.target.files[0];
        if (file) {
            if (!file.type.startsWith('image/')) {
                showToast('File must be an image', 'error');
                e.target.value = '';
                return;
            }
            setVariantImageFile(file);
            setVariantImagePreview(URL.createObjectURL(file));
        } else {
            setVariantImageFile(null);
            setVariantImagePreview('');
        }
    }, []);

    // Update variant
    const handleUpdateVariant = useCallback(async () => {
        if (!variant?._id) {
            setError("Variant not found");
            return;
        }

        // Validate form
        if (!variantForm.productColorId || !variantForm.productSizeId) {
            setError("Color and size are required");
            return;
        }
        if (!variantForm.variantPrice || parseFloat(variantForm.variantPrice) < 0) {
            setError("Valid price is required");
            return;
        }
        if (!variantForm.stockQuantity || parseInt(variantForm.stockQuantity) < 0) {
            setError("Valid stock quantity is required");
            return;
        }

        // Validate numeric values
        const price = parseFloat(variantForm.variantPrice);
        const stock = parseInt(variantForm.stockQuantity);

        // Validate form
        if (!validateForm()) {
            showToast('Please fix the validation errors before submitting', 'error');
            return;
        }

        if (isNaN(price) || price <= 0) {
            showToast("Price must be a positive number", 'error');
            return;
        }

        if (isNaN(stock) || stock < 0) {
            showToast("Stock quantity must be a non-negative number", 'error');
            return;
        }

        setLoading(true);
        setError('');

        try {
            let variantImageUrl = variant.variantImage;

            // Upload new image if selected
            if (variantImageFile) {
                variantImageUrl = await uploadSingleImage(variantImageFile);
                if (!variantImageUrl) {
                    throw new Error('Image upload failed');
                }
            }

            // Backend expects this exact data structure based on the service code
            const updateData = {
                productId: product?._id,
                productColorId: variantForm.productColorId,
                productSizeId: variantForm.productSizeId,
                variantImage: variantImageUrl,
                variantPrice: parseFloat(variantForm.variantPrice),
                stockQuantity: parseInt(variantForm.stockQuantity),
                variantStatus: variantForm.variantStatus,
            };

            console.log('Updating variant with backend-compatible data:', updateData);
            console.log('Colors available:', colors);
            console.log('Sizes available:', sizes);
            console.log('Selected color ID:', variantForm.productColorId);
            console.log('Selected size ID:', variantForm.productSizeId);
            console.log('Product ID:', product?._id);

            const response = await Api.newVariants.update(variant._id, updateData);
            console.log('Variant update response:', response);

            showToast("Variant updated successfully!", "success");

            // Notify parent
            if (onVariantUpdated) {
                onVariantUpdated();
            }

            // Close modal after a short delay
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            console.error("Update variant error:", err);
            console.error("Error response:", err.response);
            console.error("Error response data:", err.response?.data);

            const errorMessage = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Failed to update variant';

            setError(errorMessage);
            showToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    }, [variant, variantForm, variantImageFile, uploadSingleImage, onVariantUpdated, onClose, colors, sizes, product, validateForm, showToast]);

    // Handle close modal
    const handleClose = useCallback(() => {
        setVariantForm({
            productColorId: '',
            productSizeId: '',
            variantPrice: '',
            stockQuantity: '',
            variantStatus: 'active',
        });
        setVariantImageFile(null);
        setVariantImagePreview('');
        setError('');
        setValidationErrors({});
        onClose();
    }, [onClose]);

    if (!isOpen || !variant) return null;

    return (
        <>

            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
                <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-5 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900">Edit Variant</h2>
                        <button
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                            onClick={handleClose}
                            aria-label="Close modal"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="p-5">
                        {product && (
                            <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <p className="text-sm text-blue-800">
                                    Editing variant for: <span className="font-semibold">{product.productName}</span>
                                </p>
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Color *</label>
                                    <select
                                        value={variantForm.productColorId}
                                        onChange={(e) => handleVariantFieldChange("productColorId", e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="">Select Color</option>
                                        {colors?.map((color) => (
                                            <option key={color._id} value={color._id}>
                                                {color.color_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Size *</label>
                                    <select
                                        value={variantForm.productSizeId}
                                        onChange={(e) => handleVariantFieldChange("productSizeId", e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        required
                                    >
                                        <option value="">Select Size</option>
                                        {sizes?.map((size) => (
                                            <option key={size._id} value={size._id}>
                                                {size.size_name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Price *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={variantForm.variantPrice}
                                        onChange={(e) => handleVariantFieldChange("variantPrice", e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter price"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={variantForm.stockQuantity}
                                        onChange={(e) => handleVariantFieldChange("stockQuantity", e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Enter stock quantity"
                                        required
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                                <select
                                    value={variantForm.variantStatus}
                                    onChange={(e) => handleVariantFieldChange("variantStatus", e.target.value)}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                >
                                    <option value="active">Active</option>
                                    <option value="inactive">Inactive</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Variant Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleVariantImageChange}
                                    className="hidden"
                                    id="variant-image"
                                />
                                <button
                                    type="button"
                                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-gray-600 hover:text-blue-600"
                                    onClick={() => document.getElementById('variant-image').click()}
                                >
                                    <div className="flex flex-col items-center space-y-2">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="text-sm font-medium">Click to upload new image</span>
                                    </div>
                                </button>
                                {variantImagePreview && (
                                    <div className="mt-3">
                                        <img
                                            src={variantImagePreview}
                                            alt="Variant preview"
                                            className="w-32 h-32 object-cover rounded-lg border border-gray-200"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                                <p className="text-red-600 text-sm">{error}</p>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center justify-between p-5 border-t border-gray-200">
                        <div className="flex space-x-2">
                            <button
                                onClick={handleClose}
                                className="px-5 py-2.5 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdateVariant}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                            >
                                {loading ? 'Updating...' : 'Update Variant'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default EditVariantModal;
