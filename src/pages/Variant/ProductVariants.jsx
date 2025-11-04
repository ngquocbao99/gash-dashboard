import React, { useEffect, useState, useContext, useCallback } from "react";
import { ToastContext } from "../../context/ToastContext";
import Api from "../../common/SummaryAPI";
import { FaEdit, FaTrash } from 'react-icons/fa';
import EditVariantModal from "./EditVariantModal";

const ProductVariants = () => {
  const { showToast } = useContext(ToastContext);
  const [variants, setVariants] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("color");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showModal, setShowModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5); // Number of products per page

  // Fetch variants
  const fetchVariants = useCallback(async () => {
    try {
      const data = await Api.newVariants.getAll();
      setVariants(data.data);
    } catch (err) {
      console.error(err);
      let errorMessage = "Failed to fetch variants";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can view variants";
      } else if (err.response?.status === 401) {
        errorMessage = "You are not authorized to view variants";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (err.message) {
        errorMessage = `Failed to fetch variants: ${err.message}`;
      }
      showToast(errorMessage, "error");
    }
  }, [showToast]);

  useEffect(() => {
    fetchVariants();
  }, [fetchVariants]);

  // Edit variant
  const handleEdit = (variant) => {
    setEditingVariant(variant);
    setShowModal(true);
  };

  // Close modal
  const closeModal = () => {
    setShowModal(false);
    setEditingVariant(null);
  };

  // Handle successful operation
  const handleSuccess = () => {
    fetchVariants();
    closeModal();
  };

  // Toggle filters
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Show delete confirmation
  const handleDeleteClick = (variant) => {
    setVariantToDelete(variant);
    setShowDeleteConfirm(true);
  };

  // Delete variant
  const handleDelete = async () => {
    if (!variantToDelete) return;

    try {
      await Api.newVariants.delete(variantToDelete._id);
      showToast("Variant deleted successfully!", "success");
      fetchVariants();
    } catch (err) {
      console.error(err);
      let errorMessage = "Failed to delete variant";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can delete variants";
      } else if (err.response?.status === 404) {
        errorMessage = "Variant not found";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (err.message) {
        errorMessage = `Failed to delete variant: ${err.message}`;
      }
      showToast(errorMessage, "error");
    } finally {
      setShowDeleteConfirm(false);
      setVariantToDelete(null);
    }
  };

  // Cancel delete
  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
    setVariantToDelete(null);
  };

  // Sort variants
  const sortedVariants = [...variants].sort((a, b) => {
    let aValue, bValue;
    switch (sortBy) {
      case 'color':
        aValue = a.productColorId?.color_name?.toLowerCase() || '';
        bValue = b.productColorId?.color_name?.toLowerCase() || '';
        break;
      case 'size':
        aValue = a.productSizeId?.size_name?.toLowerCase() || '';
        bValue = b.productSizeId?.size_name?.toLowerCase() || '';
        break;
      case 'price':
        aValue = a.variantPrice || 0;
        bValue = b.variantPrice || 0;
        break;
      case 'stock':
        aValue = a.stockQuantity || 0;
        bValue = b.stockQuantity || 0;
        break;
      case 'product':
        aValue = a.productId?.productName?.toLowerCase() || '';
        bValue = b.productId?.productName?.toLowerCase() || '';
        break;
      default:
        aValue = a.productColorId?.color_name?.toLowerCase() || '';
        bValue = b.productColorId?.color_name?.toLowerCase() || '';
    }

    if (sortBy === 'color' || sortBy === 'size' || sortBy === 'product') {
      return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
    } else {
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    }
  });

  // Filter variants
  const filteredVariants = sortedVariants.filter((v) => {
    const matchesStatus = statusFilter === "all" || v.variantStatus === statusFilter;
    const matchesSearch =
      searchTerm === "" ||
      v.productColorId?.color_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.productSizeId?.size_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.productId?.productName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  // Group variants by product
  const groupedVariants = filteredVariants.reduce((acc, variant) => {
    const productName = variant.productId?.productName || 'Unknown Product';
    if (!acc[productName]) {
      acc[productName] = [];
    }
    acc[productName].push(variant);
    return acc;
  }, {});

  // Sort products (keys) for consistent display
  const sortedProductNames = Object.keys(groupedVariants).sort((a, b) =>
    sortBy === 'product'
      ? sortOrder === 'asc'
        ? a.localeCompare(b)
        : b.localeCompare(a)
      : a.localeCompare(b)
  );

  // Pagination logic
  const totalProducts = sortedProductNames.length;
  const totalPages = Math.ceil(totalProducts / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProductNames = sortedProductNames.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Edit Variant Modal */}
      <EditVariantModal
        isOpen={showModal}
        onClose={closeModal}
        variant={editingVariant}
        onSuccess={handleSuccess}
      />

      {/* Main Variant Management UI */}
      <div>
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Product Variant Management</h1>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage product variants</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
              <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
                <span className="text-xs lg:text-sm font-medium text-gray-700">
                  {filteredVariants.length} variant{filteredVariants.length !== 1 ? 's' : ''} in {totalProducts} product{totalProducts !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
                onClick={toggleFilters}
                aria-label="Toggle filters"
              >
                <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                </svg>
                <span className="font-medium hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
                <span className="font-medium sm:hidden">Filters</span>
              </button>
            </div>
          </div>
        </div>

        {/* Filter Section */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
            <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Search & Filter</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search by Color/Size/Product</label>
                <input
                  type="text"
                  placeholder="Enter color, size, or product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                >
                  <option value="color">Color</option>
                  <option value="size">Size</option>
                  <option value="product">Product</option>
                  <option value="price">Price</option>
                  <option value="stock">Stock Quantity</option>
                </select>
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Order</label>
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm("");
                    setStatusFilter("all");
                    setSortBy("color");
                    setSortOrder("asc");
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base"
                >
                  Clear Filters
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Variants Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Color</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Size</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedProductNames.length > 0 ? (
                  paginatedProductNames.map((productName, index) => (
                    <React.Fragment key={productName}>
                      <tr className="bg-gray-100">
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900" colSpan="9">
                          {productName} ({groupedVariants[productName].length} variant{groupedVariants[productName].length !== 1 ? 's' : ''})
                        </td>
                      </tr>
                      {groupedVariants[productName].map((variant, vIdx) => (
                        <tr key={variant._id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-sm text-gray-900">{startIndex + index + 1}.{vIdx + 1}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{variant.productId?.productName || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{variant.productColorId?.color_name || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">{variant.productSizeId?.size_name || 'N/A'}</td>
                          <td className="px-4 py-3 text-sm text-gray-900 font-medium">
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(variant.variantPrice || 0)}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">{variant.stockQuantity || 0}</td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            {variant.variantImage ? (
                              <img
                                src={variant.variantImage}
                                alt="Variant"
                                className="w-12 h-12 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-all duration-200 hover:scale-110"
                                title="Variant image"
                                onError={(e) => {
                                  e.target.style.opacity = '0.5';
                                  e.target.alt = 'Image not available';
                                }}
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                variant.variantStatus === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {variant.variantStatus || 'N/A'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-900">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => handleEdit(variant)}
                                className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                                title="Edit Variant"
                              >
                                <FaEdit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(variant)}
                                className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 border border-red-200 hover:border-red-300"
                                title="Delete Variant"
                              >
                                <FaTrash className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="9" className="px-2 lg:px-4 py-8 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gray-100 rounded-full flex items-center justify-center">
                          <svg className="w-6 h-6 lg:w-8 lg:h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-base lg:text-lg font-medium text-gray-900 mb-1 lg:mb-2">No variants found</h3>
                          <p className="text-gray-500 text-xs lg:text-sm">
                            {searchTerm || statusFilter !== "all" ? "Try adjusting your search or filter criteria" : "No variants available"}
                          </p>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, totalProducts)} of {totalProducts} products
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Previous
              </button>
              {[...Array(totalPages)].map((_, idx) => (
                <button
                  key={idx + 1}
                  onClick={() => handlePageChange(idx + 1)}
                  className={`px-3 py-2 rounded-lg transition-all duration-200 ${
                    currentPage === idx + 1
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {idx + 1}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-3 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && variantToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Variant</h3>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to delete variant{" "}
                    <span className="font-semibold text-gray-900">
                      {variantToDelete.productColorId?.color_name} - {variantToDelete.productSizeId?.size_name}
                    </span>{" "}
                    for <span className="font-semibold text-gray-900">{variantToDelete.productId?.productName}</span>?
                    <br />
                    <span className="text-sm text-gray-500">This action cannot be undone.</span>
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button
                      onClick={handleCancelDelete}
                      className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-all duration-200 font-medium hover:shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-all duration-200 font-medium hover:shadow-lg transform hover:scale-105"
                    >
                      Delete Variant
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductVariants;