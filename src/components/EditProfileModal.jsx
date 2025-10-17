import React, { useRef } from "react";
import { motion } from "framer-motion";

const EditProfileModal = ({
  formData,
  setFormData,
  previewUrl,
  handleFileChange,
  handleSubmit,
  handleCancel,
}) => {
  const fileInputRef = useRef(null);

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={handleCancel}
      ></div>

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.18 }}
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 border border-gray-100 max-h-[80vh] overflow-y-auto"
      >
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
          Edit Profile
        </h2>

        {/* Avatar */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-tr from-yellow-400 to-pink-500">
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
            className="mt-3 px-4 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition"
            onClick={() => fileInputRef.current?.click()}
          >
            Change Avatar
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fields theo model ERD */}
          {[
            { label: "Email", type: "email", key: "email", disabled: true },
            { label: "Username", type: "text", key: "username", disabled: true },
            { label: "Name", type: "text", key: "name" },
            { label: "Phone", type: "text", key: "phone" },
            { label: "Address", type: "text", key: "address" },
            { label: "Gender", type: "select", key: "gender", options: ["Male", "Female", "Other"] },
            { label: "Date of Birth", type: "date", key: "dob" },
          ].map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  value={formData[field.key] ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  className="w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition"
                >
                  <option value="">Select {field.label}</option>
                  {field.options.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={field.type}
                  value={formData[field.key] ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      [field.key]: e.target.value,
                    }))
                  }
                  placeholder={`Enter your ${field.label.toLowerCase()}`}
                  disabled={field.disabled}
                  className={`w-full border border-gray-300 rounded-xl p-2.5 text-sm focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 transition ${field.disabled ? "bg-gray-100 text-gray-500" : ""
                    }`}
                />
              )}
            </div>
          ))}

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-6 sticky bottom-0 bg-white pt-4">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium text-sm transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-orange-400 hover:opacity-90 text-white font-semibold text-sm shadow"
            >
              Save
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default EditProfileModal;
