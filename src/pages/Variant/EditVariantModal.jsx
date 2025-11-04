import React, { useState, useEffect } from "react";
import { ToastContext } from "../../context/ToastContext";
import Api from "../../common/SummaryAPI";

const EditVariantModal = ({ isOpen, onClose, variant, onSuccess }) => {
  const { showToast } = React.useContext(ToastContext);
  const [form, setForm] = useState({
    variantPrice: '',
    stockQuantity: '',
  });
  const [loading, setLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Initialize form with variant data when modal opens
  useEffect(() => {
    if (variant) {
      setForm({
        variantPrice: variant.variantPrice || '',
        stockQuantity: variant.stockQuantity || '',
      });
      setValidationErrors({});
    }
  }, [variant]);

  const validateForm = () => {
    const errors = {};
    if (!form.variantPrice || form.variantPrice <= 0) {
      errors.variantPrice = 'Price must be greater than 0';
    } else if (form.variantPrice > 100000000) {
      errors.variantPrice = 'Price must be less than 100,000,000 VND';
    }
    if (form.stockQuantity === '' || form.stockQuantity < 0) {
      errors.stockQuantity = 'Stock quantity must be 0 or greater';
    } else if (form.stockQuantity > 10000) {
      errors.stockQuantity = 'Stock quantity must be less than 10,000';
    }
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleUpdateVariant = async () => {
    if (!validateForm()) {
      showToast('Please fix validation errors', 'error');
      return;
    }

    setLoading(true);
    try {
      const updateData = {
        variantPrice: parseFloat(form.variantPrice),
        stockQuantity: parseInt(form.stockQuantity),
      };
      await Api.newVariants.update(variant._id, updateData);
      showToast("Variant updated successfully!", "success");
      onSuccess();
    } catch (err) {
      const errorMessage = err.response?.data?.message || 'Failed to update variant';
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !variant) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Edit Variant</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.variantPrice}
                onChange={(e) => handleFieldChange("variantPrice", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter price"
              />
              {validationErrors.variantPrice && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.variantPrice}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Stock Quantity *</label>
              <input
                type="number"
                min="0"
                value={form.stockQuantity}
                onChange={(e) => handleFieldChange("stockQuantity", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter stock quantity"
              />
              {validationErrors.stockQuantity && (
                <p className="mt-1 text-xs text-red-600">{validationErrors.stockQuantity}</p>
              )}
            </div>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 font-medium rounded-lg hover:bg-gray-100 transition-all duration-200"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              onClick={handleUpdateVariant}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-all duration-200 disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Update Variant'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditVariantModal;