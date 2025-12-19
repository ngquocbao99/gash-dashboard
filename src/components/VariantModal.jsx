// VariantModal.jsx - Combined Create and Edit Variant Modal
import React, { useState, useCallback, useEffect, useContext } from 'react';
import { ToastContext } from '../context/ToastContext';
import Api from '../common/SummaryAPI';

const VariantModal = ({
    isOpen,
    onClose,
    variant, // Optional: if provided, it's edit mode
    product,
    colors,
    sizes,
    onVariantCreated, // For create mode
    onVariantUpdated // For edit mode
}) => {
    const { showToast } = useContext(ToastContext);
    const isEditMode = !!variant;

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
            // For create mode, use fallback; for edit mode, return empty
            if (!isEditMode && file) {
                try {
                    // Create a data URL as fallback
                    return new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onload = (e) => resolve(e.target.result);
                        reader.readAsDataURL(file);
                    });
                } catch (fallbackErr) {
                    console.error('Fallback image creation failed:', fallbackErr);
                    return '';
                }
            }
            return '';
        }
    }, [isEditMode]);

    // Initialize form when variant changes (edit mode)
    useEffect(() => {
        if (isEditMode && variant && isOpen) {
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
            setValidationErrors({});
        } else if (!isEditMode && isOpen) {
            // Reset form for create mode
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
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [variant, isOpen, isEditMode]);

    // Validation functions
    const validateForm = useCallback(() => {
        const errors = {};

        if (!variantForm.productColorId) {
            errors.productColorId = 'Please fill in all required fields';
        }

        if (!variantForm.productSizeId) {
            errors.productSizeId = 'Please fill in all required fields';
        }

        if (!variantForm.variantPrice || variantForm.variantPrice === '') {
            errors.variantPrice = 'Please fill in all required fields';
        } else {
            const price = parseFloat(variantForm.variantPrice);
            if (isNaN(price) || price < 1000 || price > 1000000000) {
                errors.variantPrice = 'Price must be between 1.000 and 1.000.000.000';
            }
        }

        if (variantForm.stockQuantity === '' || variantForm.stockQuantity === null || variantForm.stockQuantity === undefined) {
            errors.stockQuantity = 'Please fill in all required fields';
        } else {
            const stock = parseInt(variantForm.stockQuantity);
            if (isNaN(stock) || stock < 0) {
                errors.stockQuantity = 'Stock quantity must be 0 or greater';
            } else if (stock > 1000) {
                errors.stockQuantity = 'The stock quantity must not exceed 1000';
            }
        }

        // Image validation: Create mode requires image, Edit mode allows existing image
        if (isEditMode) {
            // For edit, we allow no new image if existing image exists
            const hasExistingImage = variantImagePreview && variantImagePreview !== '';
            const hasNewImage = variantImageFile !== null;
            if (!hasExistingImage && !hasNewImage) {
                errors.variantImage = 'Please select an image for this variant';
            }
        } else {
            // Create mode: image is required
            if (!variantImageFile) {
                errors.variantImage = 'Please select an image for this variant';
            }
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [variantForm, variantImageFile, variantImagePreview, isEditMode]);

    // Handle field change with validation
    const handleFieldChange = useCallback((field, value) => {
        setVariantForm(prev => ({ ...prev, [field]: value }));

        // Real-time validation for stockQuantity
        if (field === 'stockQuantity') {
            if (value === '' || value === null || value === undefined) {
                setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[field];
                    return newErrors;
                });
            } else {
                const stock = parseInt(value);
                if (isNaN(stock) || stock < 0) {
                    setValidationErrors(prev => ({ ...prev, [field]: 'Stock quantity must be 0 or greater' }));
                } else if (stock > 1000) {
                    setValidationErrors(prev => ({ ...prev, [field]: 'The stock quantity must not exceed 1000' }));
                } else {
                    // Clear error if valid
                    setValidationErrors(prev => {
                        const newErrors = { ...prev };
                        delete newErrors[field];
                        return newErrors;
                    });
                }
            }
        } else {
            // Clear validation error for other fields
            if (validationErrors[field]) {
                setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[field];
                    return newErrors;
                });
            }
        }
    }, [validationErrors]);

    // Handle variant form changes (for status field)
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
            // In edit mode, don't clear preview if we have existing image
            if (!isEditMode || !variant?.variantImage) {
                setVariantImagePreview('');
            }
        }
    }, [showToast, isEditMode, variant]);

    // Handle submit (create or update)
    const handleSubmit = useCallback(async () => {
        setLoading(true);
        setError('');

        // Validate product exists
        if (!product?._id) {
            setError("Product not found");
            setLoading(false);
            return;
        }

        // Validate form
        if (!validateForm()) {
            showToast('Please check the input fields again', 'error');
            setLoading(false);
            return;
        }

        // Validate numeric values
        const price = parseFloat(variantForm.variantPrice);
        const stock = parseInt(variantForm.stockQuantity);

        if (isNaN(price) || price < 1000 || price > 1000000000) {
            setValidationErrors(prev => ({ ...prev, variantPrice: 'Price must be between 1.000 and 1.000.000.000' }));
            showToast('Please check the input fields again', 'error');
            setLoading(false);
            return;
        }

        if (isNaN(stock) || stock < 0) {
            setValidationErrors(prev => ({ ...prev, stockQuantity: 'Stock quantity must be 0 or greater' }));
            showToast('Please check the input fields again', 'error');
            setLoading(false);
            return;
        }
        if (stock > 1000) {
            setValidationErrors(prev => ({ ...prev, stockQuantity: 'The stock quantity must not exceed 1000' }));
            showToast('Please check the input fields again', 'error');
            setLoading(false);
            return;
        }

        try {
            if (isEditMode) {
                // Edit mode: Update variant
                if (!variant?._id) {
                    setError("Variant not found");
                    setLoading(false);
                    return;
                }

                let variantImageUrl = variant.variantImage;

                // Upload new image if selected
                if (variantImageFile) {
                    variantImageUrl = await uploadSingleImage(variantImageFile);
                    if (!variantImageUrl) {
                        throw new Error('Image upload failed');
                    }
                }

                // Backend expects this exact data structure
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

                showToast("Product variant edited successfully", "success");

                // Notify parent
                if (onVariantUpdated) {
                    onVariantUpdated();
                }

                // Close modal after a short delay
                setTimeout(() => {
                    onClose();
                }, 1500);
            } else {
                // Create mode: Create new variant
                // Upload variant image
                const variantImageUrl = await uploadSingleImage(variantImageFile);
                if (!variantImageUrl) {
                    throw new Error('Image upload failed');
                }

                // Backend expects this exact data structure
                const variantData = {
                    productId: product._id,
                    productColorId: variantForm.productColorId,
                    productSizeId: variantForm.productSizeId,
                    variantImage: variantImageUrl,
                    variantPrice: parseFloat(variantForm.variantPrice),
                    stockQuantity: parseInt(variantForm.stockQuantity),
                    variantStatus: variantForm.variantStatus,
                };

                console.log('Creating variant with backend-compatible data:', variantData);
                console.log('Colors available:', colors);
                console.log('Sizes available:', sizes);
                console.log('Selected color ID:', variantForm.productColorId);
                console.log('Selected size ID:', variantForm.productSizeId);
                console.log('Product ID:', product._id);

                const response = await Api.newVariants.create(variantData);
                console.log('Variant creation response:', response);

                // Check if variant was updated (duplicate) or created (new)
                const message = response.data?.message || response.message || "Product variant added successfully";
                showToast(message, "success");

                // Reset form
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

                // Notify parent
                if (onVariantCreated) {
                    onVariantCreated();
                }

                // Close modal after a short delay
                setTimeout(() => {
                    onClose();
                }, 1500);
            }
        } catch (err) {
            console.error(`${isEditMode ? 'Update' : 'Create'} variant error:`, err);
            console.error("Error response:", err.response);
            console.error("Error response data:", err.response?.data);

            let errorMessage = `Failed to ${isEditMode ? 'update' : 'create'} variant`;

            if (err.response?.data?.message) {
                errorMessage = err.response.data.message;
            } else if (err.response?.data?.error) {
                errorMessage = err.response.data.error;
            } else if (err.message) {
                errorMessage = err.message;
            } else if (!err.response) {
                errorMessage = `Failed to ${isEditMode ? 'update' : 'create'} variant. Please try again later.`;
            }

            // Extract the actual error message if wrapped
            if (errorMessage.includes('Failed to create product variant:') ||
                errorMessage.includes('Failed to update product variant:')) {
                errorMessage = errorMessage.replace(/^Failed to (create|update) product variant: /, '');
            }

            // Note: Backend now automatically updates existing variant instead of throwing error
            // This error handling is kept for backward compatibility or other edge cases
            if (errorMessage.includes('Variant with this product, color, and size already exists') ||
                errorMessage.includes('Variant with this product, color or size already exists') ||
                errorMessage.includes('already exists')) {
                // This should not happen anymore as backend updates existing variant
                // But keep for safety
                setValidationErrors(prev => ({
                    ...prev,
                    productColorId: 'Variant with this product, color or size already exists',
                    productSizeId: 'Variant with this product, color or size already exists'
                }));
                errorMessage = 'Variant with this product, color or size already exists';
            }

            setError(errorMessage);
            showToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    }, [variantForm, variantImageFile, product, variant, uploadSingleImage, validateForm, showToast, isEditMode, onVariantCreated, onVariantUpdated, onClose, colors, sizes]);

    // Reset variant form
    const resetVariantForm = useCallback(() => {
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
    }, []);

    // Handle close modal
    const handleClose = useCallback(() => {
        resetVariantForm();
        onClose();
    }, [resetVariantForm, onClose]);

    if (!isOpen) return null;
    if (isEditMode && !variant) return null;

    return (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
            <div
                className="bg-white rounded-2xl shadow-2xl border-2 w-full max-w-2xl max-h-[90vh] flex flex-col transform transition-all duration-300"
                style={{ borderColor: '#A86523' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b shrink-0"
                    style={{ borderColor: '#A86523' }}
                >
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
                        {isEditMode ? 'Edit Variant' : 'Add New Variant'}
                    </h2>
                    <button
                        type="button"
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': '#A86523' }}
                        aria-label="Close"
                        disabled={loading}
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
                    {product && (
                        <div className="mb-5 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                                {isEditMode ? 'Editing' : 'Adding'} variant for: <span className="font-semibold">{product.productName}</span>
                            </p>
                        </div>
                    )}

                    <div className="space-y-5 lg:space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                            <div>
                                <label htmlFor="productColorId" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Color <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="productColorId"
                                    value={variantForm.productColorId}
                                    onChange={(e) => handleFieldChange("productColorId", e.target.value)}
                                    disabled={isEditMode}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 text-sm lg:text-base ${isEditMode
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300'
                                        : validationErrors.productColorId
                                            ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                            : 'border-gray-300 bg-white hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                        }`}
                                    required
                                >
                                    <option value="">Select Color</option>
                                    {colors?.filter(color => color.isDeleted !== true).map((color) => (
                                        <option key={color._id} value={color._id}>
                                            {color.color_name}
                                        </option>
                                    ))}
                                </select>
                                {validationErrors.productColorId && (
                                    <p className="mt-1.5 text-sm text-red-600">{validationErrors.productColorId}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="productSizeId" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Size <span className="text-red-500">*</span>
                                </label>
                                <select
                                    id="productSizeId"
                                    value={variantForm.productSizeId}
                                    onChange={(e) => handleFieldChange("productSizeId", e.target.value)}
                                    disabled={isEditMode}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 text-sm lg:text-base ${isEditMode
                                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-300'
                                        : validationErrors.productSizeId
                                            ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                            : 'border-gray-300 bg-white hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                        }`}
                                    required
                                >
                                    <option value="">Select Size</option>
                                    {sizes?.filter(size => size.isDeleted !== true).map((size) => (
                                        <option key={size._id} value={size._id}>
                                            {size.size_name}
                                        </option>
                                    ))}
                                </select>
                                {validationErrors.productSizeId && (
                                    <p className="mt-1.5 text-sm text-red-600">{validationErrors.productSizeId}</p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                            <div>
                                <label htmlFor="variantPrice" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Price <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="variantPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={variantForm.variantPrice}
                                    onChange={(e) => handleFieldChange("variantPrice", e.target.value)}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base ${validationErrors.variantPrice
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 bg-white hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                        }`}
                                    placeholder="Enter price"
                                    required
                                />
                                {validationErrors.variantPrice && (
                                    <p className="mt-1.5 text-sm text-red-600">{validationErrors.variantPrice}</p>
                                )}
                            </div>

                            <div>
                                <label htmlFor="stockQuantity" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Stock Quantity <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="stockQuantity"
                                    type="number"
                                    min="0"
                                    value={variantForm.stockQuantity}
                                    onChange={(e) => handleFieldChange("stockQuantity", e.target.value)}
                                    className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base ${validationErrors.stockQuantity
                                        ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                                        : 'border-gray-300 bg-white hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                                        }`}
                                    placeholder="Enter stock quantity"
                                    required
                                />
                                {validationErrors.stockQuantity && (
                                    <p className="mt-1.5 text-sm text-red-600">{validationErrors.stockQuantity}</p>
                                )}
                            </div>
                        </div>

                        <div>
                            <label htmlFor="variant-image" className="block text-sm font-semibold text-gray-700 mb-2">
                                Variant Image {!isEditMode && <span className="text-red-500">*</span>}
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleVariantImageChange}
                                    className="hidden"
                                    id="variant-image"
                                />
                                <label
                                    htmlFor="variant-image"
                                    className={`flex flex-col items-center justify-center w-full aspect-square border-2 border-dashed rounded-lg cursor-pointer transition-all duration-200 bg-white hover:bg-gray-50 ${validationErrors.variantImage
                                        ? 'border-red-400 bg-red-50'
                                        : 'border-gray-300'
                                        }`}
                                >
                                    <svg
                                        className={`w-7 h-7 mb-1 ${validationErrors.variantImage ? 'text-red-500' : 'text-gray-400'}`}
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
                                    <p className={`text-xs font-medium ${validationErrors.variantImage ? 'text-red-600' : 'text-gray-600'}`}>
                                        Upload
                                    </p>
                                </label>
                                {variantImagePreview && (
                                    <div className="relative border-2 rounded-lg overflow-hidden aspect-square border-gray-200">
                                        <img
                                            src={variantImagePreview}
                                            alt="Variant preview"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}
                            </div>
                            {validationErrors.variantImage && (
                                <p className="mt-1.5 text-sm text-red-600">{validationErrors.variantImage}</p>
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

                {/* Footer */}
                <div
                    className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5 border-t shrink-0"
                    style={{ borderColor: '#A86523' }}
                >
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 font-medium text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2"
                        style={{ '--tw-ring-color': '#A86523' }}
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="px-6 py-2.5 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:hover:shadow-md bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] disabled:hover:from-[#E9A319] disabled:hover:to-[#A86523]"
                        style={{
                            '--tw-ring-color': '#A86523'
                        }}
                    >
                        {loading ? (
                            <div className="flex items-center justify-center space-x-2">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                <span>Processing...</span>
                            </div>
                        ) : (
                            isEditMode ? 'Edit' : 'Add'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default VariantModal;

