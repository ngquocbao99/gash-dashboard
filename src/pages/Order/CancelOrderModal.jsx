import React, { useState, useContext } from "react";
import { ToastContext } from "../../context/ToastContext"; // Adjust path as needed

const CancelOrderModal = ({ isOpen, onClose, orderId, onConfirm }) => {
  const { showToast } = useContext(ToastContext);
  const [cancelFormData, setCancelFormData] = useState({
    cancelReason: "",
    customReason: ""
  });
  const [error, setError] = useState("");

  const handleSubmit = () => {
    if (!cancelFormData.cancelReason) {
      setError("Please select a cancel reason");
      showToast("Please select a cancel reason", "error");
      return;
    }

    if (cancelFormData.cancelReason === "other" && !cancelFormData.customReason.trim()) {
      setError("Please provide a custom reason");
      showToast("Please provide a custom reason", "error");
      return;
    }

    const reason = cancelFormData.cancelReason === "other" ? cancelFormData.customReason : cancelFormData.cancelReason;
    onConfirm(reason);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl border-2 max-w-md w-full max-h-[95vh] overflow-hidden" style={{ borderColor: '#A86523' }}>
        {/* Header */}
        <div className="px-6 py-5 border-b" style={{ borderColor: '#A86523' }}>
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Cancel Order</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-2 hover:bg-gray-100 rounded-full"
              aria-label="Close cancel modal"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div className="bg-white rounded-lg p-6 border" style={{ borderColor: '#A86523' }}>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="h-5 w-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            )}
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-600">Select a reason for cancelling order {orderId}:</p>
              {['address', 'voucher', 'product', 'demand'].map((reason) => (
                <div key={reason} className="flex items-center">
                  <input
                    type="radio"
                    id={reason}
                    name="cancelReason"
                    value={reason}
                    checked={cancelFormData.cancelReason === reason}
                    onChange={(e) => setCancelFormData({ ...cancelFormData, cancelReason: e.target.value })}
                    className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                  />
                  <label htmlFor={reason} className="ml-2 text-sm text-gray-900">
                    {reason.charAt(0).toUpperCase() + reason.slice(1)}
                  </label>
                </div>
              ))}
              <div className="flex items-center">
                <input
                  type="radio"
                  id="other"
                  name="cancelReason"
                  value="other"
                  checked={cancelFormData.cancelReason === "other"}
                  onChange={(e) => setCancelFormData({ ...cancelFormData, cancelReason: e.target.value, customReason: "" })}
                  className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300"
                />
                <label htmlFor="other" className="ml-2 text-sm text-gray-900">Other</label>
              </div>
              {cancelFormData.cancelReason === "other" && (
                <textarea
                  value={cancelFormData.customReason}
                  onChange={(e) => setCancelFormData({ ...cancelFormData, customReason: e.target.value })}
                  placeholder="Enter custom reason"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200 text-sm"
                  rows={3}
                />
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t" style={{ borderColor: '#A86523' }}>
          <div className="flex justify-end items-center space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 font-medium border border-gray-300 hover:border-gray-400"
            >
              Close
            </button>
            <button
              onClick={handleSubmit}
              disabled={!cancelFormData.cancelReason || (cancelFormData.cancelReason === "other" && !cancelFormData.customReason.trim())}
              className="px-6 py-2 text-white rounded-lg transition-all duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm hover:shadow-md"
              style={{ backgroundColor: '#E9A319' }}
              onMouseEnter={(e) => !(!cancelFormData.cancelReason || (cancelFormData.cancelReason === "other" && !cancelFormData.customReason.trim())) && (e.currentTarget.style.backgroundColor = '#A86523')}
              onMouseLeave={(e) => !(!cancelFormData.cancelReason || (cancelFormData.cancelReason === "other" && !cancelFormData.customReason.trim())) && (e.currentTarget.style.backgroundColor = '#E9A319')}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Confirm Cancel</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancelOrderModal;