import React, { useRef, useState, useCallback, useContext } from "react";
import { motion } from "framer-motion";
import { ToastContext } from "../context/ToastContext";

const EditProfileModal = ({
  formData,
  setFormData,
  previewUrl,
  handleFileChange,
  handleSubmit,
  handleCancel,
  selectedFile,
  profile,
  loading,
}) => {
  const { showToast } = useContext(ToastContext);
  const fileInputRef = useRef(null);
  const [validationErrors, setValidationErrors] = useState({});

  // Validate individual field
  const validateField = useCallback((name, value, currentFormData = formData) => {
    switch (name) {
      case 'name': {
        if (!value || value.trim() === '') return 'Please fill in all required fields';
        const trimmedName = value.trim();
        if (trimmedName.length > 50) {
          return 'Name must be at most 50 characters';
        }
        if (!/^[\p{L}\s]+$/u.test(trimmedName)) {
          return 'Name must contain only letters and spaces';
        }
        return null;
      }
      case 'phone': {
        if (!value || value.trim() === '') return 'Please fill in all required fields';
        if (!/^\d{10}$/.test(value.trim())) {
          return 'Phone must be exactly 10 digits';
        }
        return null;
      }
      case 'address': {
        if (!value || value.trim() === '') return 'Please fill in all required fields';
        const trimmedAddress = value.trim();
        if (trimmedAddress.length > 200) {
          return 'Address must be at most 200 characters';
        }
        return null;
      }
      case 'dob': {
        if (!value || value.trim() === '') return 'Please fill in all required fields';
        return null;
      }
      case 'image': {
        const hasImage = Boolean(currentFormData.image?.trim() || selectedFile || profile?.image);
        if (!hasImage) return 'Please fill in all required fields';
        // Check if image is a valid image format when it's a URL
        if (currentFormData.image?.trim() && !selectedFile) {
          const imageUrl = currentFormData.image.trim().toLowerCase();
          if (!imageUrl.match(/\.(png|jpg|jpeg)$/i) && !imageUrl.startsWith('data:image/')) {
            return 'Please select a valid image type';
          }
        }
        // Check file type when a file is selected - allow all image types
        if (selectedFile) {
          const validTypes = [
            'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
            'image/webp', 'image/svg+xml', 'image/bmp',
            'image/x-icon', 'image/tiff', 'image/x-tiff'
          ];
          if (!validTypes.includes(selectedFile.type.toLowerCase())) {
            return 'Please select a valid image type';
          }
        }
        return null;
      }
      default:
        return null;
    }
  }, [formData, selectedFile, profile]);

  // Validate form
  const validateForm = useCallback(() => {
    const errors = {};

    // Validate name
    const nameError = validateField('name', formData.name);
    if (nameError) errors.name = nameError;

    // Validate phone
    const phoneError = validateField('phone', formData.phone);
    if (phoneError) errors.phone = phoneError;

    // Validate address
    const addressError = validateField('address', formData.address);
    if (addressError) errors.address = addressError;

    // Validate dob
    const dobError = validateField('dob', formData.dob);
    if (dobError) errors.dob = dobError;

    // Validate image
    const imageError = validateField('image', formData.image);
    if (imageError) errors.image = imageError;

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData, validateField]);

  // Handle field change with real-time validation
  const handleFieldChange = useCallback((field, value) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };

      // Validate the current field with updated formData
      const error = validateField(field, value, updated);

      // Update errors
      setValidationErrors(prevErrors => {
        const newErrors = { ...prevErrors };
        if (error) {
          newErrors[field] = error;
        } else {
          delete newErrors[field];
        }
        return newErrors;
      });

      return updated;
    });
  }, [validateField, setFormData]);

  // Wrapper for handleSubmit with validation
  const handleSubmitWithValidation = useCallback((e) => {
    e.preventDefault();

    // Validate form - this will set validationErrors
    if (!validateForm()) {
      // Show generic message since error messages are already displayed under each field
      showToast('Please check the input fields again', 'error');
      return;
    }

    // Call parent handleSubmit if validation passes
    handleSubmit(e);
  }, [validateForm, handleSubmit, showToast]);

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-white rounded-2xl shadow-2xl border-2 w-full max-w-lg max-h-[90vh] flex flex-col"
        style={{ borderColor: '#A86523' }}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b shrink-0" style={{ borderColor: '#A86523' }}>
          <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">
            Edit Profile
          </h2>
          <button
            type="button"
            onClick={handleCancel}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ '--tw-ring-color': '#A86523' }}
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">

          {/* Profile Picture */}
          <div className="flex flex-col items-center mb-6">
            <div className={`w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr from-[#E9A319] via-[#A86523] to-[#8B4E1A] ${validationErrors.image ? 'ring-2 ring-red-500' : ''}`}>
              <img
                src={previewUrl || formData.image || "https://via.placeholder.com/96x96?text=No+Image"}
                alt="Preview"
                className="w-full h-full rounded-full object-cover border-2 border-white"
                onError={(e) => {
                  e.target.src = "https://via.placeholder.com/96x96?text=No+Image";
                }}
              />
            </div>
            <button
              type="button"
              className="mt-3 px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition-all duration-200 border border-gray-300 hover:border-gray-400"
              onClick={() => fileInputRef.current?.click()}
            >
              Change Profile Picture
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                handleFileChange(e);
                // Revalidate image after file change
                if (e.target.files && e.target.files.length > 0) {
                  const file = e.target.files[0];
                  const validTypes = [
                    'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
                    'image/webp', 'image/svg+xml', 'image/bmp',
                    'image/x-icon', 'image/tiff', 'image/x-tiff'
                  ];
                  if (validTypes.includes(file.type.toLowerCase())) {
                    setValidationErrors(prevErrors => {
                      const newErrors = { ...prevErrors };
                      delete newErrors.image;
                      return newErrors;
                    });
                  } else {
                    setValidationErrors(prevErrors => ({
                      ...prevErrors,
                      image: 'Please select a valid image type'
                    }));
                  }
                }
              }}
            />
            {validationErrors.image && (
              <p className="mt-1.5 text-sm text-red-600">{validationErrors.image}</p>
            )}
          </div>

          {/* Form */}
          <form onSubmit={handleSubmitWithValidation} className="space-y-4">
            {/* Fields theo model ERD */}
            {[
              { label: "Email", type: "email", key: "email", disabled: true, required: false },
              { label: "Username", type: "text", key: "username", disabled: true, required: false },
              { label: "Name", type: "text", key: "name", required: true },
              { label: "Phone", type: "text", key: "phone", required: true },
              { label: "Address", type: "text", key: "address", required: true },
              { label: "Gender", type: "select", key: "gender", options: ["Male", "Female", "Other"], required: false },
              { label: "Date of Birth", type: "date", key: "dob", required: true },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  {field.label} {field.required && <span className="text-red-500">*</span>}
                </label>
                {field.type === "select" ? (
                  <>
                    <select
                      value={formData[field.key] ?? ""}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      className={`w-full px-3 py-2 lg:px-4 lg:py-3 border-2 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base shadow-md hover:shadow-lg ${validationErrors[field.key]
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500'
                        : 'border-gray-300/60 focus:border-amber-500 focus:ring-amber-500/30 hover:border-yellow-400/60'
                        }`}
                    >
                      {field.options.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                    {validationErrors[field.key] && (
                      <p className="mt-1.5 text-sm text-red-600">{validationErrors[field.key]}</p>
                    )}
                  </>
                ) : (
                  <>
                    <input
                      type={field.type}
                      value={formData[field.key] ?? ""}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                      placeholder={`Enter your ${field.label.toLowerCase()}`}
                      disabled={field.disabled}
                      className={`w-full px-3 py-2 lg:px-4 lg:py-3 border-2 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base shadow-md hover:shadow-lg ${field.disabled
                        ? "bg-gray-100 text-gray-500 border-gray-300/60"
                        : validationErrors[field.key]
                          ? "border-red-400 focus:border-red-500 focus:ring-red-500"
                          : "border-gray-300/60 focus:border-amber-500 focus:ring-amber-500/30 hover:border-yellow-400/60"
                        }`}
                    />
                    {validationErrors[field.key] && (
                      <p className="mt-1.5 text-sm text-red-600">{validationErrors[field.key]}</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </form>
        </div>

        {/* Footer */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 sm:gap-4 p-3 sm:p-4 lg:p-5 border-t shrink-0" style={{ borderColor: '#A86523' }}>
          <button
            type="button"
            onClick={handleCancel}
            className="px-5 py-2.5 text-gray-700 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-all duration-200 font-medium text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2"
            style={{ '--tw-ring-color': '#A86523' }}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            onClick={handleSubmitWithValidation}
            disabled={loading}
            className="px-6 py-2.5 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:hover:shadow-md bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] disabled:hover:from-[#E9A319] disabled:hover:to-[#A86523]"
            style={{
              '--tw-ring-color': '#A86523'
            }}
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                <span>Editing...</span>
              </div>
            ) : (
              'Edit'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default EditProfileModal;
