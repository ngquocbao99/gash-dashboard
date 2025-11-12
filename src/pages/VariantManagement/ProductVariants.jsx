import React, { useEffect, useState, useContext, useCallback } from "react";
import { ToastContext } from "../../context/ToastContext";
import Api from "../../common/SummaryAPI";
import { FaEdit, FaTrash } from 'react-icons/fa';
import VariantModal from "../../components/VariantModal";

const ProductVariants = () => {
  const { showToast } = useContext(ToastContext);
  const [variants, setVariants] = useState([]);
  const [showFilters, setShowFilters] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [productFilter, setProductFilter] = useState("");
  const [sortBy, setSortBy] = useState("color");
  const [sortOrder, setSortOrder] = useState("asc");
  const [showModal, setShowModal] = useState(false);
  const [editingVariant, setEditingVariant] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [variantToDelete, setVariantToDelete] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(5); // Number of products per page
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);

  // Fetch variants
  const fetchVariants = useCallback(async () => {
    setLoading(true);
    setError('');
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
      setError(errorMessage);
      showToast(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Helper functions for data extraction
  const toIdString = useCallback((value) => {
    if (!value) return '';
    if (typeof value === 'object') {
      if (value._id) return String(value._id);
      if (value.id) return String(value.id);
    }
    return String(value);
  }, []);

  const extractDataArray = useCallback((response) => {
    if (!response) return [];
    if (Array.isArray(response)) return response;
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response?.data?.data)) return response.data.data;
    if (response.success && Array.isArray(response.data)) return response.data;
    return [];
  }, []);

  // Fetch colors
  const fetchColors = useCallback(async () => {
    try {
      const response = await Api.colors.getAll();
      const rawColors = extractDataArray(response);
      const normalized = rawColors
        .map((color) => ({
          ...color,
          color_name: (color.color_name || '').trim(),
        }))
        .filter((color) => color.color_name);

      const uniqueMap = new Map();
      normalized.forEach((color) => {
        const key = toIdString(color._id || color.id);
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, color);
        }
      });

      const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
        if (Boolean(a.isDeleted) !== Boolean(b.isDeleted)) {
          return a.isDeleted ? 1 : -1;
        }
        return (a.color_name || '').localeCompare(b.color_name || '');
      });

      setColors(sorted);
    } catch (err) {
      setColors([]);
    }
  }, [extractDataArray, toIdString]);

  // Fetch sizes
  const fetchSizes = useCallback(async () => {
    try {
      const response = await Api.sizes.getAll();
      const rawSizes = extractDataArray(response);
      const normalized = rawSizes
        .map((size) => ({
          ...size,
          size_name: (size.size_name || '').trim(),
        }))
        .filter((size) => size.size_name);

      const uniqueMap = new Map();
      normalized.forEach((size) => {
        const key = toIdString(size._id || size.id);
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, size);
        }
      });

      const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
        if (Boolean(a.isDeleted) !== Boolean(b.isDeleted)) {
          return a.isDeleted ? 1 : -1;
        }
        return (a.size_name || '').localeCompare(b.size_name || '');
      });

      setSizes(sorted);
    } catch (err) {
      setSizes([]);
    }
  }, [extractDataArray, toIdString]);

  useEffect(() => {
    fetchVariants();
    fetchColors();
    fetchSizes();
  }, [fetchVariants, fetchColors, fetchSizes]);

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

  // Handle variant updated
  const handleVariantUpdated = useCallback(() => {
    fetchVariants();
    setShowModal(false);
    setEditingVariant(null);
  }, [fetchVariants]);

  // Toggle filters
  const toggleFilters = () => {
    setShowFilters(!showFilters);
  };

  // Show delete confirmation
  const handleDeleteClick = (variant) => {
    setVariantToDelete(variant);
    setShowDeleteConfirm(true);
  };

  // Deactivate variant (soft delete)
  const handleDelete = async () => {
    if (!variantToDelete) return;

    try {
      await Api.newVariants.update(variantToDelete._id, { variantStatus: 'inactive' });
      showToast("Variant deactivated successfully!", "success");
      fetchVariants();
    } catch (err) {
      console.error(err);
      let errorMessage = "Failed to deactivate variant";
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can deactivate variants";
      } else if (err.response?.status === 404) {
        errorMessage = "Variant not found";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (err.message) {
        errorMessage = `Failed to deactivate variant: ${err.message}`;
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

  // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return searchTerm ||
      statusFilter !== "all" ||
      productFilter !== "" ||
      sortBy !== "color" ||
      sortOrder !== "asc";
  }, [searchTerm, statusFilter, productFilter, sortBy, sortOrder]);

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

  // Get unique products from variants for filter dropdown (only active products)
  const uniqueProducts = React.useMemo(() => {
    const productMap = new Map();
    variants.forEach((variant) => {
      const productId = variant.productId?._id || variant.productId?.id || variant.productId;
      const productName = variant.productId?.productName || 'Unknown Product';
      const productStatus = variant.productId?.productStatus || variant.product?.productStatus;
      // Only include active products
      if (productId && productStatus === 'active' && !productMap.has(toIdString(productId))) {
        productMap.set(toIdString(productId), {
          id: toIdString(productId),
          name: productName
        });
      }
    });
    return Array.from(productMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [variants, toIdString]);

  // Filter variants
  const filteredVariants = sortedVariants.filter((v) => {
    const matchesStatus = statusFilter === "all" || v.variantStatus === statusFilter;
    const matchesProduct = productFilter === "" || toIdString(v.productId?._id || v.productId?.id || v.productId) === productFilter;
    const matchesSearch =
      searchTerm === "" ||
      v.productColorId?.color_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.productSizeId?.size_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.productId?.productName?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesProduct && matchesSearch;
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

  // Handle previous page
  const handlePreviousPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  // Handle next page
  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };

  // Handle retry
  const handleRetry = () => {
    fetchVariants();
  };

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("");
    setStatusFilter("all");
    setProductFilter("");
    setSortBy("color");
    setSortOrder("asc");
    setCurrentPage(1);
  };

  // Check if variant is inactive
  const isVariantDiscontinued = (variant) => {
    return variant.variantStatus === 'discontinued';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Edit Variant Modal */}
      {editingVariant && (
        <VariantModal
          isOpen={showModal}
          onClose={closeModal}
          variant={editingVariant}
          product={editingVariant.productId || editingVariant.product}
          colors={colors}
          sizes={sizes}
          onVariantUpdated={handleVariantUpdated}
        />
      )}

      {/* Main Variant Management UI */}
      <div>
        {/* Header Section */}
        <div className="bg-white rounded-xl shadow-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523' }}>
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Product Variant Management</h1>
              <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage product variants</p>
            </div>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
              <div className="bg-[#FCEFCB]/60 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border" style={{ borderColor: '#A86523' }}>
                <span className="text-xs lg:text-sm font-medium text-[#A86523]">
                  {filteredVariants.length} variant{filteredVariants.length !== 1 ? 's' : ''} in {totalProducts} product{totalProducts !== 1 ? 's' : ''}
                </span>
              </div>
              <button
                className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
                style={{ backgroundColor: '#E9A319' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
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
          <div className="bg-white rounded-xl shadow-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523' }}>
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <h2 className="text-base lg:text-lg font-semibold text-gray-900">Search & Filter</h2>
              <div className="flex items-center gap-2">
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters()}
                  className="px-2 py-1.5 lg:px-3 lg:py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-xs lg:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Clear all filters"
                >
                  Clear
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search by Color/Size/Product</label>
                <input
                  type="text"
                  placeholder="Enter color, size, or product..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                />
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Product</label>
                <select
                  value={productFilter}
                  onChange={(e) => setProductFilter(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                >
                  <option value="">All Products</option>
                  {uniqueProducts.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
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
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
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
                  className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                >
                  <option value="asc">Ascending</option>
                  <option value="desc">Descending</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Unified State: Loading / Empty / Error */}
        {loading || error || paginatedProductNames.length === 0 ? (
          <div className="bg-white rounded-xl shadow-xl border p-6" style={{ borderColor: '#A86523' }} role="status">
            <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">

              {/* ── LOADING ── */}
              {loading ? (
                <>
                  <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: '#FCEFCB', borderTopColor: '#A86523' }}></div>
                  <p className="text-gray-600 font-medium">Loading variants...</p>
                </>
              ) : error ? (

                /* ── NETWORK ERROR ── */
                <div className="flex flex-col items-center space-y-3">
                  <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-medium text-gray-900">Network Error</h3>
                    <p className="text-sm text-gray-500 mt-1">{error}</p>
                  </div>

                  <button
                    onClick={handleRetry}
                    className="px-4 py-2 text-white text-sm font-medium rounded-lg transition-all duration-200 shadow-sm hover:shadow"
                    style={{ backgroundColor: '#E9A319' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#A86523'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#E9A319'}
                  >
                    Retry
                  </button>
                </div>
              ) : (

                /* ── NO VARIANTS ── */
                <>
                  <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                      />
                    </svg>
                  </div>

                  <div className="text-center">
                    <h3 className="text-base font-medium text-gray-900">No variants found</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {searchTerm || statusFilter !== "all" ? "Try adjusting your search or filter criteria" : "No variants available"}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Variants Table */}
            <div className="bg-white rounded-xl shadow-xl border overflow-hidden" style={{ borderColor: '#A86523' }}>
              <div className="overflow-x-auto">
                <table className="w-full table-fixed min-w-[900px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="w-[5%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                      <th className="w-[20%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Color</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Size</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Price</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Stock</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Image</th>
                      <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                      <th className="w-[15%] px-2 lg:px-4 py-3 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {paginatedProductNames.map((productName, index) => (
                      <React.Fragment key={productName}>
                        <tr className="bg-gray-100">
                          <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm font-medium text-gray-900" colSpan="9">
                            {productName} ({groupedVariants[productName].length} variant{groupedVariants[productName].length !== 1 ? 's' : ''})
                          </td>
                        </tr>
                        {groupedVariants[productName].map((variant, vIdx) => {
                          const inactive = isVariantDiscontinued(variant);
                          return (
                            <tr
                              key={variant._id}
                              className={`hover:bg-gray-50 transition-colors duration-150 ${inactive ? 'opacity-60' : ''}`}
                            >
                              <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">{startIndex + index + 1}.{vIdx + 1}</td>
                              <td className="px-2 lg:px-4 py-3">
                                <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                                  {variant.productId?.productName || 'N/A'}
                                </div>
                              </td>
                              <td className="px-2 lg:px-4 py-3">
                                <div className="text-xs lg:text-sm text-gray-900 truncate">
                                  {variant.productColorId?.color_name || 'N/A'}
                                </div>
                              </td>
                              <td className="px-2 lg:px-4 py-3">
                                <div className="text-xs lg:text-sm text-gray-900 truncate">
                                  {variant.productSizeId?.size_name || 'N/A'}
                                </div>
                              </td>
                              <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 font-medium">
                                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(variant.variantPrice || 0)}
                              </td>
                              <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">{variant.stockQuantity || 0}</td>
                              <td className="px-2 lg:px-4 py-3">
                                {variant.variantImage ? (
                                  <img
                                    src={variant.variantImage}
                                    alt="Variant"
                                    className="mx-auto w-12 h-12 lg:w-14 lg:h-14 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-all duration-200 hover:scale-105"
                                    title="Variant image"
                                    onError={(e) => {
                                      e.target.style.opacity = '0.5';
                                      e.target.alt = 'Image not available';
                                    }}
                                  />
                                ) : (
                                  <div className="mx-auto w-12 h-12 lg:w-14 lg:h-14 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                                    <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                              </td>
                              <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium capitalize ${variant.variantStatus === 'active' ? 'bg-green-100 text-green-800' :
                                    variant.variantStatus === 'inactive' ? 'bg-red-100 text-red-800' :
                                      'bg-gray-100 text-gray-800'
                                    }`}
                                >
                                  {variant.variantStatus || 'unknown'}
                                </span>
                              </td>
                              <td className="px-2 lg:px-4 py-3">
                                <div className="flex justify-center items-center space-x-1">
                                  <button
                                    onClick={() => handleEdit(variant)}
                                    disabled={inactive}
                                    className={`p-1.5 rounded-lg transition-all duration-200 border ${inactive
                                      ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                      : 'border-[#A86523]'
                                      }`}
                                    style={!inactive ? { color: '#A86523' } : {}}
                                    onMouseEnter={(e) => !inactive && (e.currentTarget.style.backgroundColor = '#FCEFCB')}
                                    onMouseLeave={(e) => !inactive && (e.currentTarget.style.backgroundColor = 'transparent')}
                                    title="Edit Variant"
                                  >
                                    <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(variant)}
                                    disabled={inactive}
                                    className={`p-1.5 rounded-lg transition-all duration-200 border ${inactive
                                      ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                                      : 'text-red-600 hover:text-red-800 hover:bg-red-100 border-red-200 hover:border-red-300'
                                      }`}
                                    title="Deactivate Variant"
                                  >
                                    <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="bg-white rounded-xl shadow-xl border p-4 lg:p-6 mt-4 lg:mt-6" style={{ borderColor: '#A86523' }}>
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-sm text-gray-700">
                    Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, totalProducts)}</span> of <span className="font-medium">{totalProducts}</span> products
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={handlePreviousPage}
                      disabled={currentPage === 1}
                      className="px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: '#A86523', color: '#A86523' }}
                      onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#FCEFCB')}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#A86523';
                      }}
                      aria-label="Previous page"
                    >
                      Previous
                    </button>

                    <div className="flex items-center space-x-1">
                      {[...Array(totalPages)].map((_, idx) => (
                        <button
                          key={idx + 1}
                          onClick={() => handlePageChange(idx + 1)}
                          className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 border ${currentPage === idx + 1
                            ? 'text-white'
                            : ''
                            }`}
                          style={
                            currentPage === idx + 1
                              ? { backgroundColor: '#E9A319', borderColor: '#A86523' }
                              : { borderColor: '#A86523', color: '#A86523' }
                          }
                          onMouseEnter={(e) => {
                            if (currentPage !== idx + 1) {
                              e.currentTarget.style.backgroundColor = '#FCEFCB';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (currentPage !== idx + 1) {
                              e.currentTarget.style.backgroundColor = 'transparent';
                              e.currentTarget.style.color = '#A86523';
                            }
                          }}
                          aria-label={`Page ${idx + 1}`}
                        >
                          {idx + 1}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={handleNextPage}
                      disabled={currentPage === totalPages}
                      className="px-3 py-2 text-sm font-medium rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ borderColor: '#A86523', color: '#A86523' }}
                      onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.backgroundColor = '#FCEFCB')}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#A86523';
                      }}
                      aria-label="Next page"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Deactivate Confirmation Modal */}
        {showDeleteConfirm && variantToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 w-full max-w-md transform transition-all duration-300 scale-100 animate-in fade-in-0 zoom-in-95">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="shrink-0 w-10 h-10 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                </div>
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Deactivate Variant</h3>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to deactivate variant{" "}
                    <span className="font-semibold text-gray-900">
                      {variantToDelete.productColorId?.color_name} - {variantToDelete.productSizeId?.size_name}
                    </span>{" "}
                    for <span className="font-semibold text-gray-900">{variantToDelete.productId?.productName}</span>?
                    <br />
                    <span className="text-sm text-gray-500">This action can be undone by editing the variant.</span>
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
                      Deactivate Variant
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