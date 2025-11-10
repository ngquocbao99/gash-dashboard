// EditProductModal.jsx
import React, { useState, useCallback, useEffect, useContext, useRef } from 'react';
import { FaTimes, FaImage, FaStar } from 'react-icons/fa';
import { MdFormatBold, MdFormatItalic, MdFormatListBulleted, MdFormatListNumbered, MdLink, MdFormatUnderlined, MdLooksOne, MdLooksTwo, MdLooks3 } from 'react-icons/md';
import { ToastContext } from '../../context/ToastContext';
import Api from '../../common/SummaryAPI';

const EditProductModal = ({
    isOpen,
    onClose,
    onSubmit,
    product,
    categories,
    loading,
    error
}) => {
    const { showToast } = useContext(ToastContext);
    const [formData, setFormData] = useState({
        productName: '',
        categoryId: '',
        description: '',
        productStatus: 'active',
        productImageIds: []
    });
    const [newImages, setNewImages] = useState([]);
    const [newImagePreviews, setNewImagePreviews] = useState([]);
    const [mainImageIndex, setMainImageIndex] = useState(0);
    const [validationErrors, setValidationErrors] = useState({});
    const descriptionRef = useRef(null);
    const [activeFormats, setActiveFormats] = useState({
        bold: false,
        italic: false,
        underline: false,
        bullet: false,
        numbered: false,
        h1: false,
        h2: false,
        h3: false,
    });

    const updateActiveFormats = () => {
        if (!descriptionRef.current) return;
        const formatBlock = document.queryCommandValue('formatBlock').toLowerCase();
        setActiveFormats({
            bold: document.queryCommandState('bold'),
            italic: document.queryCommandState('italic'),
            underline: document.queryCommandState('underline'),
            bullet: document.queryCommandState('insertUnorderedList'),
            numbered: document.queryCommandState('insertOrderedList'),
            h1: formatBlock === 'h1',
            h2: formatBlock === 'h2',
            h3: formatBlock === 'h3',
        });
    };

    useEffect(() => {
        const editor = descriptionRef.current;
        if (editor) {
            editor.addEventListener('input', updateActiveFormats);
            editor.addEventListener('keyup', updateActiveFormats);
            editor.addEventListener('mouseup', updateActiveFormats);
            editor.addEventListener('focus', updateActiveFormats);
            return () => {
                editor.removeEventListener('input', updateActiveFormats);
                editor.removeEventListener('keyup', updateActiveFormats);
                editor.removeEventListener('mouseup', updateActiveFormats);
                editor.removeEventListener('focus', updateActiveFormats);
            };
        }
    }, []);

    // Initialize form data when product changes
    useEffect(() => {
        if (product && isOpen) {
            const initialData = {
                productName: product.productName || '',
                categoryId: product.categoryId?._id || product.categoryId || '',
                description: product.description || '',
                productStatus: product.productStatus || 'active',
                productImageIds: product.productImageIds || []
            };
            setFormData(initialData);
            setNewImages([]);
            setNewImagePreviews([]);
            // Find the main image index
            const mainIndex = product.productImageIds?.findIndex(img => img.isMain) || 0;
            setMainImageIndex(mainIndex >= 0 ? mainIndex : 0);

            // Set description HTML
            if (descriptionRef.current) {
                descriptionRef.current.innerHTML = initialData.description;
            }
        }
    }, [product, isOpen]);

    // Validation functions
    const validateForm = useCallback(() => {
        const errors = {};

        if (!formData.productName.trim()) {
            errors.productName = 'Product name is required';
        } else if (formData.productName.trim().length < 2) {
            errors.productName = 'Product name must be at least 2 characters';
        } else if (formData.productName.trim().length > 100) {
            errors.productName = 'Product name must be less than 100 characters';
        }

        if (!formData.categoryId) {
            errors.categoryId = 'Please select a category';
        }

        if (!formData.description.trim()) {
            errors.description = 'Description is required';
        } else if (formData.description.trim().length < 10) {
            errors.description = 'Description must be at least 10 characters';
        } else if (formData.description.trim().length > 500) {
            errors.description = 'Description must be less than 500 characters';
        }

        // For edit, we allow no new images if existing images exist
        const hasExistingImages = formData.productImageIds && formData.productImageIds.length > 0;
        const hasNewImages = newImages.length > 0;
        if (!hasExistingImages && !hasNewImages) {
            errors.images = 'At least one image is required';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData, newImages]);

    // Handle field change with validation
    const handleFieldChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));

        // Clear validation error for this field
        if (validationErrors[field]) {
            setValidationErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    }, [validationErrors]);

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
            return '';
        }
    }, []);

    // Handle new image file selection
    const handleNewImageFilesChange = useCallback((e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Validate all files are images
        const allImagesValid = files.every(file => file.type.startsWith('image/'));
        if (!allImagesValid) {
            alert('All files must be images');
            e.target.value = '';
            return;
        }

        setNewImages(prev => [...prev, ...files]);

        // Create previews
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setNewImagePreviews(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    }, []);

    // Remove an existing image
    const removeExistingImage = useCallback((index) => {
        setFormData(prev => ({
            ...prev,
            productImageIds: prev.productImageIds.filter((_, i) => i !== index)
        }));
        // Adjust main image index if needed
        if (mainImageIndex === index) {
            setMainImageIndex(0);
        } else if (mainImageIndex > index) {
            setMainImageIndex(prev => prev - 1);
        }
    }, [mainImageIndex]);

    // Remove a new image
    const removeNewImage = useCallback((index) => {
        setNewImages(prev => prev.filter((_, i) => i !== index));
        setNewImagePreviews(prev => prev.filter((_, i) => i !== index));
        // Adjust main image index if needed
        const adjustedIndex = index + (formData.productImageIds?.length || 0);
        if (mainImageIndex === adjustedIndex) {
            setMainImageIndex(0);
        } else if (mainImageIndex > adjustedIndex) {
            setMainImageIndex(prev => prev - 1);
        }
    }, [formData.productImageIds, mainImageIndex]);

    // Handle form submit
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        // Validate form
        if (!validateForm()) {
            showToast('Please fix the validation errors before submitting', 'error');
            return;
        }

        try {
            // Upload new images if any
            let updatedImageData = [...(formData.productImageIds || [])];

            if (newImages.length > 0) {
                const uploadedImageUrls = await Promise.all(
                    newImages.map(file => uploadSingleImage(file))
                );

                // Validate that all images were uploaded successfully
                const failedUploads = uploadedImageUrls.filter(url => !url || url === '');
                if (failedUploads.length > 0) {
                    showToast('Some images failed to upload. Please try again.', 'error');
                    return;
                }

                // Add new images to the array
                const newImageData = uploadedImageUrls.map(url => ({
                    imageUrl: url,
                    isMain: false
                }));
                updatedImageData = [...updatedImageData, ...newImageData];
            }

            // Set the main image
            updatedImageData = updatedImageData.map((img, index) => ({
                ...img,
                isMain: index === mainImageIndex
            }));

            // Call parent onSubmit with updated data
            await onSubmit({
                ...formData,
                productImageIds: updatedImageData,
            });

            // Reset form
            setFormData({
                productName: '',
                categoryId: '',
                description: '',
                productStatus: 'active',
                productImageIds: []
            });
            setNewImages([]);
            setNewImagePreviews([]);
            setMainImageIndex(0);
            setValidationErrors({});
        } catch (err) {
            showToast('Failed to update product. Please try again.', 'error');
        }
    }, [formData, newImages, mainImageIndex, uploadSingleImage, onSubmit, validateForm, showToast]);

    // Reset form when modal closes
    const handleClose = useCallback(() => {
        setFormData({
            productName: '',
            categoryId: '',
            description: '',
            productStatus: 'active',
            productImageIds: []
        });
        setNewImages([]);
        setNewImagePreviews([]);
        setMainImageIndex(0);
        setValidationErrors({});
        onClose();
    }, [onClose]);

    if (!isOpen || !product) return null;

    const allImages = [
        ...(formData.productImageIds || []),
        ...newImagePreviews.map((preview, index) => ({
            imageUrl: preview,
            isMain: false,
            isNew: true,
            newIndex: index
        }))
    ];

    const hasNoVariants = product.productVariantIds?.length === 0;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Edit Product</h2>
                    <button
                        onClick={handleClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                    >
                        <FaTimes className="text-xl" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label htmlFor="edit-productName" className="block text-sm font-medium text-gray-700 mb-2">
                                Product Name *
                            </label>
                            <input
                                id="edit-productName"
                                type="text"
                                value={formData.productName}
                                onChange={(e) => handleFieldChange('productName', e.target.value)}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.productName ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                placeholder="Enter product name"
                                required
                            />
                            {validationErrors.productName && (
                                <p className="mt-1 text-sm text-red-600">{validationErrors.productName}</p>
                            )}
                        </div>

                        <div>
                            <label htmlFor="edit-categoryId" className="block text-sm font-medium text-gray-700 mb-2">
                                Category *
                            </label>
                            <select
                                id="edit-categoryId"
                                value={formData.categoryId}
                                onChange={(e) => handleFieldChange('categoryId', e.target.value)}
                                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${validationErrors.categoryId ? 'border-red-500' : 'border-gray-300'
                                    }`}
                                required
                            >
                                <option value="">Select Category</option>
                                {categories.map(category => (
                                    <option key={category._id} value={category._id}>
                                        {category.cat_name}
                                    </option>
                                ))}
                            </select>
                            {validationErrors.categoryId && (
                                <p className="mt-1 text-sm text-red-600">{validationErrors.categoryId}</p>
                            )}
                        </div>
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description *
                        </label>
                        <div className="border rounded-lg overflow-hidden shadow-sm">
                            <div className="flex items-center gap-1 bg-gray-100 p-2 border-b flex-wrap">
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { descriptionRef.current.focus(); document.execCommand('bold', false); updateActiveFormats(); }} 
                                    className={`p-2 rounded ${activeFormats.bold ? 'bg-gray-300' : 'hover:bg-gray-300'}`}><MdFormatBold /></button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { descriptionRef.current.focus(); document.execCommand('italic', false); updateActiveFormats(); }} 
                                    className={`p-2 rounded ${activeFormats.italic ? 'bg-gray-300' : 'hover:bg-gray-300'}`}><MdFormatItalic /></button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { descriptionRef.current.focus(); document.execCommand('underline', false); updateActiveFormats(); }} 
                                    className={`p-2 rounded ${activeFormats.underline ? 'bg-gray-300' : 'hover:bg-gray-300'}`}><MdFormatUnderlined /></button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { 
                                        descriptionRef.current.focus(); 
                                        const url = prompt('Enter URL:'); 
                                        if (url) document.execCommand('createLink', false, url); 
                                        updateActiveFormats();
                                    }} 
                                    className="p-2 hover:bg-gray-300 rounded"><MdLink /></button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { descriptionRef.current.focus(); document.execCommand('insertUnorderedList', false); updateActiveFormats(); }} 
                                    className={`p-2 rounded ${activeFormats.bullet ? 'bg-gray-300' : 'hover:bg-gray-300'}`}><MdFormatListBulleted /></button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { descriptionRef.current.focus(); document.execCommand('insertOrderedList', false); updateActiveFormats(); }} 
                                    className={`p-2 rounded ${activeFormats.numbered ? 'bg-gray-300' : 'hover:bg-gray-300'}`}><MdFormatListNumbered /></button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { descriptionRef.current.focus(); document.execCommand('formatBlock', false, 'h1'); updateActiveFormats(); }} 
                                    className={`p-2 rounded ${activeFormats.h1 ? 'bg-gray-300' : 'hover:bg-gray-300'}`}><MdLooksOne /></button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { descriptionRef.current.focus(); document.execCommand('formatBlock', false, 'h2'); updateActiveFormats(); }} 
                                    className={`p-2 rounded ${activeFormats.h2 ? 'bg-gray-300' : 'hover:bg-gray-300'}`}><MdLooksTwo /></button>
                                <button type="button" onMouseDown={(e) => e.preventDefault()} 
                                    onClick={() => { descriptionRef.current.focus(); document.execCommand('formatBlock', false, 'h3'); updateActiveFormats(); }} 
                                    className={`p-2 rounded ${activeFormats.h3 ? 'bg-gray-300' : 'hover:bg-gray-300'}`}><MdLooks3 /></button>
                            </div>

                            <div
                                ref={descriptionRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={(e) => handleFieldChange('description', e.currentTarget.innerHTML)}
                                className={`min-h-48 px-4 py-3 prose prose-sm max-w-none focus:outline-none bg-white ${
                                    validationErrors.description ? 'border-red-500' : ''
                                }`}
                                style={{ minHeight: '24em' }}
                            />
                        </div>
                        {validationErrors.description && (
                            <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
                        )}
                    </div>

                    {/* Status */}
                    <div>
                        <label htmlFor="edit-status" className="block text-sm font-medium text-gray-700 mb-2">
                            Status
                        </label>
                        <select
                            id="edit-status"
                            value={formData.productStatus}
                            onChange={(e) => handleFieldChange('productStatus', e.target.value)}
                            className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${hasNoVariants ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'border-gray-300'
                                }`}
                            disabled={hasNoVariants}
                            title={hasNoVariants ? 'Status is disabled because the product has no variants' : ''}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                        {hasNoVariants && (
                            <p className="mt-1 text-sm text-gray-500">Add a variant to enable status changes</p>
                        )}
                    </div>

                    {/* Image Management */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Images
                        </label>
                        <div className="space-y-4">
                            {/* Add New Images */}
                            <div className="flex items-center space-x-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleNewImageFilesChange}
                                    className="hidden"
                                    id="edit-image-files"
                                />
                                <label
                                    htmlFor="edit-image-files"
                                    className="flex items-center space-x-2 px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 cursor-pointer transition-colors duration-200"
                                >
                                    <FaImage className="text-lg" />
                                    <span>Add More Images</span>
                                </label>
                                <span className="text-sm text-gray-500">
                                    {newImages.length} new image(s) selected
                                </span>
                            </div>

                            {/* All Images Grid */}
                            {allImages.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {allImages.map((img, index) => (
                                        <div
                                            key={index}
                                            className={`relative border-2 rounded-lg overflow-hidden ${mainImageIndex === index ? 'border-blue-500' : 'border-gray-200'
                                                }`}
                                        >
                                            <img
                                                src={img.imageUrl}
                                                alt={`Image ${index + 1}`}
                                                className="w-full h-32 object-cover"
                                            />
                                            <div className="absolute top-2 right-2 flex space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (img.isNew) {
                                                            removeNewImage(img.newIndex);
                                                        } else {
                                                            removeExistingImage(index);
                                                        }
                                                    }}
                                                    className="w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                                                >
                                                    ×
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setMainImageIndex(index)}
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${mainImageIndex === index
                                                        ? 'bg-yellow-500 text-white'
                                                        : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                                                        }`}
                                                >
                                                    <FaStar />
                                                </button>
                                            </div>
                                            {mainImageIndex === index && (
                                                <div className="absolute bottom-2 left-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded">
                                                    Main
                                                </div>
                                            )}
                                            {img.isNew && (
                                                <div className="absolute bottom-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded">
                                                    New
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={handleClose}
                            className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors duration-200"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            disabled={loading || !formData.productName || !formData.categoryId}
                        >
                            {loading ? 'Updating...' : 'Update Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EditProductModal;