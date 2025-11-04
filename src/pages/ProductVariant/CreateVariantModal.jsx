import React, { useState, useCallback, useContext } from 'react';
import { ToastContext } from '../../context/ToastContext';
import Api from '../../common/SummaryAPI';

const CreateVariantModal = ({
    isOpen,
    onClose,
    product,
    colors,
    sizes,
    onVariantCreated
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
            console.warn('Upload failed, using fallback image URL');

            // Fallback: Use a placeholder image URL or create a data URL
            if (file) {
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
    }, []);

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

        if (!variantImageFile) {
            errors.variantImage = 'Please select an image for this variant';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [variantForm, variantImageFile]);

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

    // Create variant
    const handleCreateVariant = useCallback(async () => {
        setLoading(true);
        setError('');
        // Clear any previous errors

        // Validate product exists
        if (!product?._id) {
            setError("Product not found");
            setLoading(false);
            return;
        }

        // Validate form
        if (!validateForm()) {
            showToast('Please fix the validation errors before submitting', 'error');
            setLoading(false);
            return;
        }

        // Validate product ID
        if (!product?._id) {
            showToast("Product ID is missing", 'error');
            setLoading(false);
            return;
        }

        // Validate numeric values
        const price = parseFloat(variantForm.variantPrice);
        const stock = parseInt(variantForm.stockQuantity);

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

        try {
            // Upload variant image
            const variantImageUrl = await uploadSingleImage(variantImageFile);
            if (!variantImageUrl) {
                throw new Error('Image upload failed');
            }

            // Backend expects this exact data structure based on the service code
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

            showToast("Variant created successfully!", "success");

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
        } catch (err) {
            console.error("Create variant error:", err);
            console.error("Error response:", err.response);
            console.error("Error response data:", err.response?.data);

            const errorMessage = err.response?.data?.message ||
                err.response?.data?.error ||
                err.message ||
                'Failed to create variant';

            setError(errorMessage);
            showToast(errorMessage, "error");
        } finally {
            setLoading(false);
        }
    }, [variantForm, variantImageFile, product?._id, uploadSingleImage, onVariantCreated, onClose, colors, sizes, validateForm, showToast]);

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

    return (
        <>

            <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={handleClose}>
                <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-between p-5 border-b border-gray-200">
                        <h2 className="text-xl font-bold text-gray-900">Add New Variant</h2>
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
                                    Adding variant for: <span className="font-semibold">{product.productName}</span>
                                </p>
                            </div>
                        )}

                        <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Color *</label>
                                    <select
                                        value={variantForm.productColorId}
                                        onChange={(e) => handleFieldChange("productColorId", e.target.value)}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.productColorId ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        required
                                    >
                                        <option value="">Select Color</option>
                                        {colors?.map((color) => (
                                            <option key={color._id} value={color._id}>
                                                {color.color_name}
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.productColorId && (
                                        <p className="mt-1 text-sm text-red-600">{validationErrors.productColorId}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Size *</label>
                                    <select
                                        value={variantForm.productSizeId}
                                        onChange={(e) => handleFieldChange("productSizeId", e.target.value)}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.productSizeId ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        required
                                    >
                                        <option value="">Select Size</option>
                                        {sizes?.map((size) => (
                                            <option key={size._id} value={size._id}>
                                                {size.size_name}
                                            </option>
                                        ))}
                                    </select>
                                    {validationErrors.productSizeId && (
                                        <p className="mt-1 text-sm text-red-600">{validationErrors.productSizeId}</p>
                                    )}
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
                                        onChange={(e) => handleFieldChange("variantPrice", e.target.value)}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.variantPrice ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        placeholder="Enter price"
                                        required
                                    />
                                    {validationErrors.variantPrice && (
                                        <p className="mt-1 text-sm text-red-600">{validationErrors.variantPrice}</p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity *</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={variantForm.stockQuantity}
                                        onChange={(e) => handleFieldChange("stockQuantity", e.target.value)}
                                        className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.stockQuantity ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                        placeholder="Enter stock quantity"
                                        required
                                    />
                                    {validationErrors.stockQuantity && (
                                        <p className="mt-1 text-sm text-red-600">{validationErrors.stockQuantity}</p>
                                    )}
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">Variant Image *</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleVariantImageChange}
                                    className="hidden"
                                    id="variant-image"
                                />
                                <button
                                    type="button"
                                    className={`w-full px-4 py-3 border-2 border-dashed rounded-lg transition-all duration-200 ${validationErrors.variantImage
                                        ? 'border-red-300 bg-red-50 text-red-600 hover:border-red-500 hover:bg-red-100'
                                        : 'border-gray-300 hover:border-blue-500 hover:bg-blue-50 text-gray-600 hover:text-blue-600'
                                        }`}
                                    onClick={() => document.getElementById('variant-image').click()}
                                >
                                    <div className="flex flex-col items-center space-y-2">
                                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                        </svg>
                                        <span className="text-sm font-medium">Click to upload image</span>
                                    </div>
                                </button>
                                {validationErrors.variantImage && (
                                    <p className="mt-1 text-sm text-red-600">{validationErrors.variantImage}</p>
                                )}
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
                                onClick={handleCreateVariant}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading}
                            >
                                {loading ? 'Creating...' : 'Create Variant'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default CreateVariantModal;
