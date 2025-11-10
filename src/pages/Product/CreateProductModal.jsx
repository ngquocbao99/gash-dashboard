// CreateProductModal.jsx
import React, { useState, useCallback, useContext, useRef, useEffect } from 'react';
import { FaTimes, FaImage, FaStar } from 'react-icons/fa';
import { MdFormatBold, MdFormatItalic, MdFormatListBulleted, MdFormatListNumbered, MdLink, MdFormatUnderlined, MdLooksOne, MdLooksTwo, MdLooks3 } from 'react-icons/md';
import { ToastContext } from '../../context/ToastContext';
import Api from '../../common/SummaryAPI';

const CreateProductModal = ({
    isOpen,
    onClose,
    onSubmit,
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
    });
    const [images, setImages] = useState([]);
    const [imagePreviews, setImagePreviews] = useState([]);
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

        if (images.length === 0) {
            errors.images = 'At least one image is required';
        }

        setValidationErrors(errors);
        return Object.keys(errors).length === 0;
    }, [formData, images]);

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

    // Handle multiple image file selection
    const handleImageFilesChange = useCallback((e) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        // Validate all files are images
        const allImagesValid = files.every(file => file.type.startsWith('image/'));
        if (!allImagesValid) {
            alert('All files must be images');
            e.target.value = '';
            return;
        }

        setImages(prev => [...prev, ...files]);

        // Create previews
        files.forEach(file => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreviews(prev => [...prev, reader.result]);
            };
            reader.readAsDataURL(file);
        });
    }, []);

    // Remove an image
    const removeImage = useCallback((index) => {
        setImages(prev => prev.filter((_, i) => i !== index));
        setImagePreviews(prev => prev.filter((_, i) => i !== index));
        // Adjust main image index if needed
        if (mainImageIndex === index) {
            setMainImageIndex(0);
        } else if (mainImageIndex > index) {
            setMainImageIndex(prev => prev - 1);
        }
    }, [mainImageIndex]);


    // Handle form submit
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        // Validate form
        if (!validateForm()) {
            showToast('Please fix the validation errors before submitting', 'error');
            return;
        }

        try {
            // Upload all images
            const uploadedImageUrls = await Promise.all(
                images.map(file => uploadSingleImage(file))
            );

            // Validate that all images were uploaded successfully
            const failedUploads = uploadedImageUrls.filter(url => !url || url === '');
            if (failedUploads.length > 0) {
                showToast('Some images failed to upload. Please try again.', 'error');
                return;
            }

            // Prepare image data with isMain flag
            const imageData = uploadedImageUrls.map((url, index) => ({
                imageUrl: url,
                isMain: index === mainImageIndex
            }));

            // Call parent onSubmit with form data and images
            await onSubmit({
                ...formData,
                productImageIds: imageData,
            });

            // Reset form
            setFormData({
                productName: '',
                categoryId: '',
                description: '',
                productStatus: 'active',
            });
            setImages([]);
            setImagePreviews([]);
            setMainImageIndex(0);
            setValidationErrors({});
        } catch (err) {
            showToast('Failed to create product. Please try again.', 'error');
        }
    }, [formData, images, mainImageIndex, uploadSingleImage, onSubmit, validateForm, showToast]);

    // Reset form when modal closes
    const handleClose = useCallback(() => {
        setFormData({
            productName: '',
            categoryId: '',
            description: '',
            productStatus: 'active',
        });
        setImages([]);
        setImagePreviews([]);
        setMainImageIndex(0);
        setValidationErrors({});
        onClose();
    }, [onClose]);

    // Set initial description HTML
    useEffect(() => {
        if (isOpen && descriptionRef.current) {
            descriptionRef.current.innerHTML = formData.description;
        }
    }, [isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-2xl font-bold text-gray-900">Add New Product</h2>
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
                            <label htmlFor="productName" className="block text-sm font-medium text-gray-700 mb-2">
                                Product Name *
                            </label>
                            <input
                                id="productName"
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
                            <label htmlFor="categoryId" className="block text-sm font-medium text-gray-700 mb-2">
                                Category *
                            </label>
                            <select
                                id="categoryId"
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
                            {/* Toolbar */}
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

                            {/* Rich editor – taller + cursor works */}
                            <div
                                ref={descriptionRef}
                                contentEditable
                                suppressContentEditableWarning
                                onInput={(e) => handleFieldChange('description', e.currentTarget.innerHTML)}
                                className={`min-h-48 px-4 py-3 prose prose-sm max-w-none focus:outline-none bg-white ${
                                    validationErrors.description ? 'border-red-500' : ''
                                }`}
                                style={{ minHeight: '320px' }}
                            />
                        </div>
                        {validationErrors.description && (
                            <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
                        )}
                    </div>

                    {/* Image Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Product Images *
                        </label>
                        <div className="space-y-4">
                            {/* File Input */}
                            <div className="flex items-center space-x-4">
                                <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageFilesChange}
                                    className="hidden"
                                    id="image-files"
                                />
                                <label
                                    htmlFor="image-files"
                                    className={`flex items-center space-x-2 px-4 py-3 rounded-lg cursor-pointer transition-colors duration-200 ${validationErrors.images
                                        ? 'bg-red-600 hover:bg-red-700 text-white'
                                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                >
                                    <FaImage className="text-lg" />
                                    <span>Choose Images</span>
                                </label>
                                <span className="text-sm text-gray-500">
                                    {images.length} image(s) selected
                                </span>
                            </div>
                            {validationErrors.images && (
                                <p className="text-sm text-red-600">{validationErrors.images}</p>
                            )}

                            {/* Image Previews */}
                            {imagePreviews.length > 0 && (
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                    {imagePreviews.map((preview, index) => (
                                        <div
                                            key={index}
                                            className={`relative border-2 rounded-lg overflow-hidden ${mainImageIndex === index ? 'border-blue-500' : 'border-gray-200'
                                                }`}
                                        >
                                            <img
                                                src={preview}
                                                alt={`Preview ${index + 1}`}
                                                className="w-full h-32 object-cover"
                                            />
                                            <div className="absolute top-2 right-2 flex space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => removeImage(index)}
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
                            disabled={loading || !formData.productName || !formData.categoryId || images.length === 0}
                        >
                            {loading ? 'Creating...' : 'Create Product'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateProductModal;