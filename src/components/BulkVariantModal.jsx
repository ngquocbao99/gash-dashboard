// BulkVariantModal.jsx - Bulk Create Variants Modal
import React, { useState, useCallback, useContext, useEffect } from 'react';
import { ToastContext } from '../context/ToastContext';
import Api from '../common/SummaryAPI';

const BulkVariantModal = ({
    isOpen,
    onClose,
    product,
    colors,
    sizes,
    onVariantsCreated,
}) => {
    const { showToast } = useContext(ToastContext);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form states
    const [bulkForm, setBulkForm] = useState({
        productColorId: '',
        variantPrice: '',
        stockQuantity: '',
        selectedSizeIds: [], // Array of selected size IDs
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

    // Reset form when modal opens/closes
    useEffect(() => {
        if (isOpen) {
            setBulkForm({
                productColorId: '',
                variantPrice: '',
                stockQuantity: '',
                selectedSizeIds: [],
            });
            setVariantImageFile(null);
            setVariantImagePreview('');
            setError('');
            setValidationErrors({});
        }
    }, [isOpen]);

    // Validation functions
    const validateForm = useCallback(() => {
        const errors = {};

        if (!bulkForm.productColorId) {
            errors.productColorId = 'Please select a color';
        }

        if (!bulkForm.selectedSizeIds || bulkForm.selectedSizeIds.length === 0) {
            errors.selectedSizeIds = 'Please select at least one size';
        }

        if (!bulkForm.variantPrice || bulkForm.variantPrice <= 0) {
            errors.variantPrice = 'Price must be greater than 0';
        } else if (bulkForm.variantPrice > 100000000) {
            errors.variantPrice = 'Price must be less than 100,000,000 VND';
        }

        if (bulkForm.stockQuantity === '' || bulkForm.stockQuantity < 0) {
            errors.stockQuantity = 'Stock quantity must be 0 or greater';
        } else if (bulkForm.stockQuantity > 1000) {
            errors.stockQuantity = 'The stock quantity must not exceed 1000';
        }

        // Image validation
        if (!variantImageFile) {
            errors.variantImage = 'Please select an image for the variants';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [bulkForm, variantImageFile]);

    // Handle field change with validation
    const handleFieldChange = useCallback((field, value) => {
        setBulkForm(prev => ({ ...prev, [field]: value }));

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

    // Handle size selection (toggle)
    const handleSizeToggle = useCallback((sizeId) => {
        setBulkForm(prev => {
            const currentSizes = prev.selectedSizeIds || [];
            const isSelected = currentSizes.includes(sizeId);

            if (isSelected) {
                // Remove size
                return {
                    ...prev,
                    selectedSizeIds: currentSizes.filter(id => id !== sizeId),
                };
            } else {
                // Add size
                return {
                    ...prev,
                    selectedSizeIds: [...currentSizes, sizeId],
                };
            }
        });

        // Clear validation error
        if (validationErrors.selectedSizeIds) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors.selectedSizeIds;
                return newErrors;
            });
        }
    }, [validationErrors]);

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

            // Clear validation error
            if (validationErrors.variantImage) {
                setValidationErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors.variantImage;
                    return newErrors;
                });
            }
        } else {
            setVariantImageFile(null);
            setVariantImagePreview('');
        }
    }, [showToast, validationErrors]);

    // Handle submit (bulk create)
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
        const price = parseFloat(bulkForm.variantPrice);
        const stock = parseInt(bulkForm.stockQuantity);

        if (isNaN(price) || price <= 0) {
            showToast("Price must be a positive number", 'error');
            setLoading(false);
            return;
        }

        if (isNaN(stock) || stock < 0) {
            showToast("Stock quantity must be a non-negative number", 'error');
            setLoading(false);
            return;
        }
        if (stock > 1000) {
            showToast("The stock quantity must not exceed 1000", 'error');
            setLoading(false);
            return;
        }

        if (!bulkForm.selectedSizeIds || bulkForm.selectedSizeIds.length === 0) {
            showToast("Please select at least one size", 'error');
            setLoading(false);
            return;
        }

        try {
            // Upload variant image
            const variantImageUrl = await uploadSingleImage(variantImageFile);
            if (!variantImageUrl) {
                throw new Error('Image upload failed');
            }

            // Prepare bulk data
            const bulkData = {
                productId: product._id,
                productColorId: bulkForm.productColorId,
                variantImage: variantImageUrl,
                variantPrice: price,
                stockQuantity: stock,
                sizeIds: bulkForm.selectedSizeIds,
            };

            console.log('Creating bulk variants with data:', bulkData);

            const response = await Api.newVariants.bulkCreate(bulkData);
            console.log('Bulk variant creation response:', response);

            const message = response.data?.message || response.message || `${bulkForm.selectedSizeIds.length} variant(s) added successfully`;
            showToast(message, "success");

            // Reset form
            setBulkForm({
                productColorId: '',
                variantPrice: '',
                stockQuantity: '',
                selectedSizeIds: [],
            });
            setVariantImageFile(null);
            setVariantImagePreview('');
            setError('');
            setValidationErrors({});

            // Notify parent
            if (onVariantsCreated) {
                onVariantsCreated();
            }

            // Close modal after a short delay
            setTimeout(() => {
                onClose();
            }, 1500);
        } catch (err) {
            console.error('Bulk create variant error:', err);
            console.error("Error response:", err.response);
            console.error("Error response data:", err.response?.data);

            let errorMessage = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Failed to create variants';

            setError(errorMessage);
            showToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    }, [bulkForm, variantImageFile, product, uploadSingleImage, validateForm, showToast, onVariantsCreated, onClose]);

    // Reset form
    const resetForm = useCallback(() => {
        setBulkForm({
            productColorId: '',
            variantPrice: '',
            stockQuantity: '',
            selectedSizeIds: [],
        });
        setVariantImageFile(null);
        setVariantImagePreview('');
        setError('');
        setValidationErrors({});
    }, []);

    // Handle close modal
    const handleClose = useCallback(() => {
        resetForm();
        onClose();
    }, [resetForm, onClose]);

    if (!isOpen) return null;

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
                        Bulk Add Variants
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
                                Adding variants for: <span className="font-semibold">{product.productName}</span>
                            </p>
                            <p className="text-xs text-blue-600 mt-1">
                                You can select multiple sizes. Each size will be created as a separate variant with the same color, image, price, and stock.
                            </p>
                        </div>
                    )}

                    <div className="space-y-5 lg:space-y-6">
                        {/* Color Selection */}
                        <div>
                            <label htmlFor="productColorId" className="block text-sm font-semibold text-gray-700 mb-2">
                                Color <span className="text-red-500">*</span>
                            </label>
                            <select
                                id="productColorId"
                                value={bulkForm.productColorId}
                                onChange={(e) => handleFieldChange("productColorId", e.target.value)}
                                className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 transition-all duration-200 text-sm lg:text-base ${validationErrors.productColorId
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

                        {/* Size Selection (Multiple Checkboxes) */}
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Sizes <span className="text-red-500">*</span>
                                <span className="text-xs font-normal text-gray-500 ml-2">
                                    ({bulkForm.selectedSizeIds?.length || 0} selected)
                                </span>
                            </label>
                            <div className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-4 border rounded-lg ${validationErrors.selectedSizeIds
                                ? 'border-red-400 bg-red-50'
                                : 'border-gray-300 bg-gray-50'
                                }`}>
                                {sizes?.filter(size => size.isDeleted !== true).map((size) => {
                                    const isSelected = bulkForm.selectedSizeIds?.includes(size._id);
                                    return (
                                        <label
                                            key={size._id}
                                            className={`flex items-center space-x-2 p-3 rounded-lg cursor-pointer transition-all duration-200 border-2 ${isSelected
                                                ? 'bg-[#A86523] text-white border-[#A86523] shadow-md'
                                                : 'bg-white text-gray-700 border-gray-300 hover:border-[#A86523] hover:bg-yellow-50'
                                                }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleSizeToggle(size._id)}
                                                className="w-4 h-4 text-[#A86523] border-gray-300 rounded focus:ring-[#A86523] focus:ring-2"
                                            />
                                            <span className="text-sm font-medium">{size.size_name}</span>
                                        </label>
                                    );
                                })}
                            </div>
                            {validationErrors.selectedSizeIds && (
                                <p className="mt-1.5 text-sm text-red-600">{validationErrors.selectedSizeIds}</p>
                            )}
                            {(!sizes || sizes.filter(s => s.isDeleted !== true).length === 0) && (
                                <p className="mt-1.5 text-sm text-gray-500">No sizes available</p>
                            )}
                        </div>

                        {/* Price and Stock */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 lg:gap-6">
                            <div>
                                <label htmlFor="variantPrice" className="block text-sm font-semibold text-gray-700 mb-2">
                                    Price (VND) <span className="text-red-500">*</span>
                                </label>
                                <input
                                    id="variantPrice"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={bulkForm.variantPrice}
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
                                    value={bulkForm.stockQuantity}
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

                        {/* Image Upload */}
                        <div>
                            <label htmlFor="variant-image" className="block text-sm font-semibold text-gray-700 mb-2">
                                Variant Image <span className="text-red-500">*</span>
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

                        {/* Preview Info */}
                        {bulkForm.selectedSizeIds && bulkForm.selectedSizeIds.length > 0 && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm font-semibold text-green-800 mb-2">
                                    Preview: {bulkForm.selectedSizeIds.length} variant(s) will be created
                                </p>
                                <ul className="text-xs text-green-700 space-y-1">
                                    {bulkForm.selectedSizeIds.map(sizeId => {
                                        const size = sizes?.find(s => s._id === sizeId);
                                        const color = colors?.find(c => c._id === bulkForm.productColorId);
                                        return (
                                            <li key={sizeId}>
                                                • {color?.color_name || 'Selected color'} - {size?.size_name || 'Size'}
                                            </li>
                                        );
                                    })}
                                </ul>
                                <p className="text-xs text-green-600 mt-2">
                                    All variants will have: Price: {bulkForm.variantPrice ? new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(bulkForm.variantPrice) : 'N/A'}, Stock: {bulkForm.stockQuantity || 0}
                                </p>
                            </div>
                        )}
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
                                <span>Creating {bulkForm.selectedSizeIds?.length || 0} variant(s)...</span>
                            </div>
                        ) : (
                            `Create ${bulkForm.selectedSizeIds?.length || 0} Variant(s)`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BulkVariantModal;

