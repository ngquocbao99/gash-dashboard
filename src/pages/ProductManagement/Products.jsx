// Products.jsx
import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import '../../styles/Products.css';
import Api from '../../common/SummaryAPI';
import ProductModal from '../../components/ProductModal';
import ProductDetailsModal from './ProductDetailsModal';
import VariantModal from '../../components/VariantModal';
import ImageModal from '../../components/ImageModal';
import axiosClient from '../../common/axiosClient';
import Loading from '../../components/Loading';
import DeleteConfirmModal from '../../components/DeleteConfirmModal';

// Using SummaryAPI for all API calls

const Products = () => {
  const stripHtml = (html) => html.replace(/<[^>]*>/g, '');

  const { user, isAuthLoading } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [colors, setColors] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [selectedProductId, setSelectedProductId] = useState(null);
  const [productVariants, setProductVariants] = useState({});
  const [editingProductId, setEditingProductId] = useState(null);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isViewMode, setIsViewMode] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    searchQuery: '',
    categoryFilter: '',
    statusFilter: '',
  });
  const [showFilters, setShowFilters] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedProductForDetails, setSelectedProductForDetails] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState('');
  const navigate = useNavigate();

  // Add Variant Modal States
  const [showAddVariantModal, setShowAddVariantModal] = useState(false);
  const [selectedProductForVariant, setSelectedProductForVariant] = useState(null);
  const [showDiscontinueConfirm, setShowDiscontinueConfirm] = useState(false);
  const [productPendingDiscontinue, setProductPendingDiscontinue] = useState(null);

  // Status options based on model
  const statusOptions = ['active', 'discontinued'];

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

  const getStatusPriority = useCallback((status) => {
    const value = (status || '').toLowerCase();
    const priorityMap = {
      active: 1,
      inactive: 2,
      pending: 3,
      discontinued: 4,
      available: 2, // Alias for inactive
    };
    return priorityMap[value] ?? 99;
  }, []);

  // Apply filters to products
  const applyFilters = useCallback((productsList, filterSettings) => {
    return productsList.filter(product => {
      // Search query filter
      if (filterSettings.searchQuery) {
        const query = filterSettings.searchQuery.toLowerCase();
        const productName = product.productName?.toLowerCase() || '';
        const description = product.description?.toLowerCase() || '';
        const status = product.productStatus?.toLowerCase() || '';
        const productId = product._id?.toLowerCase() || '';

        if (!productName.includes(query) &&
          !description.includes(query) &&
          !status.includes(query) &&
          !productId.includes(query)) {
          return false;
        }
      }

      // Category filter
      if (filterSettings.categoryFilter) {
        const productCategoryId = toIdString(product.categoryId);
        if (productCategoryId !== filterSettings.categoryFilter) {
          return false;
        }
      }

      // Status filter
      if (filterSettings.statusFilter && product.productStatus !== filterSettings.statusFilter) {
        return false;
      }

      return true;
    });
  }, [toIdString]);

  // Update filtered products when products or filters change
  useEffect(() => {
    const filtered = applyFilters(products, filters);
    const sorted = [...filtered].sort((a, b) => {
      const statusPriorityDiff = getStatusPriority(a.productStatus) - getStatusPriority(b.productStatus);
      if (statusPriorityDiff !== 0) {
        return statusPriorityDiff;
      }
      const nameA = (a.productName || '').toLowerCase();
      const nameB = (b.productName || '').toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    });
    setFilteredProducts(sorted);
    setCurrentPage(1);
  }, [products, filters, applyFilters, getStatusPriority]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredProducts.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Handle previous page
  const handlePreviousPage = useCallback(() => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  }, []);

  // Handle next page
  const handleNextPage = useCallback(() => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  }, [totalPages]);

  // Handle first/last page
  const handleFirstPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const handleLastPage = useCallback(() => {
    setCurrentPage(totalPages);
  }, [totalPages]);

  // Calculate which pages to show (max 5 pages)
  const getVisiblePages = () => {
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }

    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  };

  const visiblePages = getVisiblePages();

  // Check if any filters are active
  const hasActiveFilters = useCallback(() => {
    return filters.searchQuery ||
      filters.categoryFilter ||
      filters.statusFilter;
  }, [filters]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await Api.categories.getAll();
      const rawCategories = extractDataArray(response);
      const normalized = rawCategories
        .map((category) => ({
          ...category,
          cat_name: (category.cat_name || '').trim(),
        }))
        .filter((category) => category.cat_name);

      const uniqueMap = new Map();
      normalized.forEach((category) => {
        const key = toIdString(category._id || category.id);
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, category);
        }
      });

      const sorted = Array.from(uniqueMap.values()).sort((a, b) => {
        if (Boolean(a.isDeleted) !== Boolean(b.isDeleted)) {
          return a.isDeleted ? 1 : -1;
        }
        return (a.cat_name || '').localeCompare(b.cat_name || '');
      });

      setCategories(sorted);
    } catch (err) {
      setCategories([]);
    }
  }, [extractDataArray, toIdString]);

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

  // Fetch products using NEW API
  const fetchProducts = useCallback(async () => {
    if (!user?._id) {
      setError('User not authenticated');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await Api.newProducts.getAll();
      // Response structure: { success: true, data: [...], message: "..." }
      const productsData = response.data || response;
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err) {
      setError(err.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch variants for a specific product
  const fetchProductVariants = useCallback(async (productId) => {
    try {
      const response = await Api.newVariants.getByProduct(productId);

      // Handle different response structures
      let variantsData = [];
      if (response) {
        if (Array.isArray(response)) {
          variantsData = response;
        } else if (response.data) {
          if (Array.isArray(response.data)) {
            variantsData = response.data;
          } else if (response.data.data && Array.isArray(response.data.data)) {
            variantsData = response.data.data;
          } else if (response.data.success && response.data.data && Array.isArray(response.data.data)) {
            variantsData = response.data.data;
          }
        }
      }

      setProductVariants(prev => {
        const newState = {
          ...prev,
          [productId]: variantsData
        };
        return newState;
      });
    } catch (err) {
      setProductVariants(prev => ({
        ...prev,
        [productId]: []
      }));
    }
  }, []);

  const fetchData = useCallback(async () => {
    await fetchCategories();
    await fetchColors();
    await fetchSizes();
    await fetchProducts();
  }, [fetchCategories, fetchColors, fetchSizes, fetchProducts]);

  // Handle filter changes
  const handleFilterChange = useCallback((field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      categoryFilter: '',
      statusFilter: '',
    });
  }, []);

  // Toggle filter visibility
  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  // Upload helper (single image)
  const uploadSingleImage = useCallback(async (file) => {
    if (!file) return '';
    try {
      const response = await Api.upload.image(file);
      return response.data?.url || response.data?.data?.url || '';
    } catch (err) {
      return '';
    }
  }, []);

  // Create product using NEW API
  const createProduct = useCallback(async (formData) => {
    setLoading(true);
    setError('');

    try {
      const response = await Api.newProducts.create({
        ...formData,
        productStatus: 'active' // Set to active by default
      });

      const newProduct = response.data?.data || response.data;
      setProducts(prev => [...prev, newProduct]);
      showToast('Product added successfully', 'success');
      setShowCreateModal(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create product';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Update product using NEW API
  const updateProduct = useCallback(async (formData) => {
    setLoading(true);
    setError('');

    try {
      const response = await Api.newProducts.update(editingProductId, formData);

      const updatedProduct = response.data?.data || response.data;
      setProducts(prev =>
        prev.map(product =>
          product._id === editingProductId ? updatedProduct : product
        )
      );
      // Update selectedProductForDetails with new data
      setSelectedProductForDetails(updatedProduct);
      showToast('Product edited successfully', 'success');
      setEditingProductId(null);
      setEditingProduct(null);
      setShowEditModal(false);
      // Return to ProductDetailsModal after successful update
      setShowDetailsModal(true);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update product';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [editingProductId, showToast]);

  // Delete product (soft delete) using NEW API
  const deleteProduct = useCallback(async (productId) => {
    if (!productId) return;
    setLoading(true);
    setError('');

    try {
      await Api.newProducts.delete(productId);

      // Update the product status to discontinued instead of removing it
      setProducts(prev =>
        prev.map(product =>
          product._id === productId
            ? { ...product, productStatus: 'discontinued' }
            : product
        )
      );

      showToast('Product marked as discontinued successfully', 'success');
      if (selectedProductId === productId) setSelectedProductId(null);
      if (editingProductId === productId) setEditingProductId(null);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to discontinue product';
      setError(errorMessage);
      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
      setProductPendingDiscontinue(null);
      setShowDiscontinueConfirm(false);
    }
  }, [selectedProductId, editingProductId, showToast]);

  const handleRequestDiscontinue = useCallback((product) => {
    if (!product) return;
    setProductPendingDiscontinue(product);
    setShowDiscontinueConfirm(true);
  }, []);

  const handleCancelDiscontinue = useCallback(() => {
    if (loading) return;
    setShowDiscontinueConfirm(false);
    setProductPendingDiscontinue(null);
  }, [loading]);

  const handleConfirmDiscontinue = useCallback(() => {
    if (!productPendingDiscontinue) return;
    deleteProduct(productPendingDiscontinue._id);
  }, [productPendingDiscontinue, deleteProduct]);

  // Handle authentication state and fetch data
  useEffect(() => {
    if (isAuthLoading) {
      return;
    }
    if (!user && !localStorage.getItem('token')) {
      navigate('/login', { replace: true });
    } else if (user) {
      fetchData();
    }
  }, [user, isAuthLoading, navigate, fetchData]);

  // Handle URL query parameter for productId
  useEffect(() => {
    if (products.length > 0) {
      const urlParams = new URLSearchParams(location.search);
      const productId = urlParams.get('productId');
      if (productId) {
        const product = products.find(p => p._id === productId);
        if (product) {
          setSelectedProductForDetails(product);
          setShowDetailsModal(true);
          setIsViewMode(true);
          // Always fetch variants when opening from URL
          fetchProductVariants(product._id);
          // Clear the URL parameter
          const newUrl = window.location.pathname;
          window.history.replaceState({}, '', newUrl);
        }
      }
    }
  }, [products, location.search, fetchProductVariants]);

  // Show product details in popup
  const handleShowDetails = useCallback((product) => {
    setSelectedProductForDetails(product);
    setShowDetailsModal(true);
    // Fetch variants if not already loaded
    if (!productVariants[product._id]) {
      fetchProductVariants(product._id);
    }
  }, [productVariants, fetchProductVariants]);

  // Close details modal
  const handleCloseDetailsModal = useCallback(() => {
    setShowDetailsModal(false);
    setSelectedProductForDetails(null);
    setIsViewMode(false);
  }, []);

  // Start editing product
  const handleEditProduct = useCallback((product) => {
    setEditingProductId(product._id);
    setEditingProduct(product);
    setShowEditModal(true);
  }, []);

  // Handle create product modal
  const handleCreateProduct = useCallback(() => {
    setShowCreateModal(true);
  }, []);

  // Handle close modals
  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingProductId(null);
    setEditingProduct(null);
    // Return to ProductDetailsModal
    setShowDetailsModal(true);
  }, []);

  // Retry fetching data
  const handleRetry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  // Handle image click
  const handleImageClick = useCallback((imageUrl) => {
    setSelectedImage(imageUrl);
    setShowImageModal(true);
  }, []);

  // Close image modal
  const handleCloseImageModal = useCallback(() => {
    setShowImageModal(false);
    setSelectedImage('');
  }, []);

  // Handle opening Add Variant modal
  const handleOpenAddVariantModal = useCallback((product) => {
    setSelectedProductForVariant(product);
    setShowAddVariantModal(true);
  }, []);

  // Handle closing Add Variant modal
  const handleCloseAddVariantModal = useCallback(() => {
    setShowAddVariantModal(false);
    setSelectedProductForVariant(null);
  }, []);

  // Get category info by ID
  const getCategoryInfo = useCallback((catId) => {
    const defaultInfo = { name: 'N/A', isDeleted: false };
    if (!catId) return defaultInfo;
    const catIdString = toIdString(catId);
    const category = categories.find(cat => toIdString(cat._id || cat.id) === catIdString);
    if (category) {
      return {
        name: (category.cat_name || 'N/A').trim() || 'N/A',
        isDeleted: category.isDeleted === true,
      };
    }
    if (typeof catId === 'object') {
      return {
        name: (catId.cat_name || 'N/A').trim() || 'N/A',
        isDeleted: catId.isDeleted === true,
      };
    }
    return defaultInfo;
  }, [categories, toIdString]);

  // Get category name by ID
  const getCategoryName = useCallback((catId) => getCategoryInfo(catId).name, [getCategoryInfo]);

  // Get status badge class
  const getStatusBadgeClass = useCallback((status) => {
    switch (status) {
      case 'active': return 'products-status-active';
      case 'discontinued': return 'products-status-discontinued';
      default: return 'products-status-unknown';
    }
  }, []);

  // Check if product is discontinued
  const isProductDiscontinued = useCallback((product) => {
    return product.productStatus === 'discontinued';
  }, []);

  // Show loading state while auth is being verified
  if (isAuthLoading) {
    return (
      <Loading
        type="page"
        size="medium"
        message="Verifying authentication..."
      />
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6">

      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">Product Management</h1>
          {/* <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Create and manage products with variants</p> */}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
          <div className="bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 backdrop-blur-md px-2 lg:px-4 py-1 lg:py-2 rounded-xl border-2 border-yellow-400/50 shadow-md">
            <span className="text-xs lg:text-sm font-semibold text-gray-700">
              {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 transform hover:scale-105"
            onClick={toggleFilters}
            aria-label="Toggle filters"
          >
            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
            </svg>
            <span className="font-medium hidden sm:inline">{showFilters ? 'Hide Filters' : 'Show Filters'}</span>
            <span className="font-medium sm:hidden">Filters</span>
          </button>
          <button
            className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
            onClick={handleCreateProduct}
          >
            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-medium">Add Product</span>
          </button>
        </div>
      </div>

      {/* Filter Section */}
      {showFilters && (
        <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h2 className="text-base lg:text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Search & Filter</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters()}
                className="px-2 py-1.5 lg:px-3 lg:py-2 text-gray-600 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:via-pink-500 hover:to-rose-500 rounded-xl transition-all duration-300 border-2 border-gray-300/60 hover:border-transparent font-medium text-xs lg:text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 shadow-md hover:shadow-lg"
                aria-label="Clear all filters"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="mb-3 lg:mb-4">
            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search Products</label>
            <input
              type="text"
              placeholder="Search by name, description..."
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filters.categoryFilter}
                onChange={(e) => handleFilterChange('categoryFilter', e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              >
                <option value="">All Categories</option>
                {categories.filter(category => category.isDeleted !== true).map(category => {
                  const optionValue = toIdString(category._id || category.id);
                  return (
                    <option key={optionValue} value={optionValue}>
                      {category.cat_name}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.statusFilter}
                onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              >
                <option value="">All Statuses</option>
                {['active', 'inactive', 'pending', 'discontinued'].map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Unified State: Loading / Empty / Error */}
      {loading || filteredProducts.length === 0 || error ? (
        <div className="backdrop-blur-xl rounded-xl border p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }} role="status">
          <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">

            {/* ── LOADING ── */}
            {loading ? (
              <Loading
                type="page"
                size="medium"
                message="Loading products..."
              />
            ) : error ? (

              /* ── NETWORK ERROR ── */
              <div className="flex flex-col items-center space-y-3">
                <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center shadow-lg">
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
                  <h3 className="text-base font-semibold text-gray-900">Network Error</h3>
                  <p className="text-sm text-gray-500 mt-1">{error}</p>
                </div>

                <button
                  onClick={handleRetry}
                  className="px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                >
                  Retry
                </button>
              </div>
            ) : (

              /* ── NO PRODUCTS ── */
              <>
                <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
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
                  <h3 className="text-base font-medium text-gray-900">No products found</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {products.length === 0
                      ? "Get started by creating your first product"
                      : "Try adjusting your search or filter criteria"}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        /* Products Table - Only when data exists */
        <div className="backdrop-blur-xl rounded-xl border overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[900px]">
              {/* ---------- HEADER ---------- */}
              <thead className="backdrop-blur-sm border-b" style={{ borderColor: '#A86523' }}>
                <tr>
                  <th className="w-[5%]  px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                    #
                  </th>
                  <th className="w-[20%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                    Product Name
                  </th>
                  <th className="w-[12%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                    Category
                  </th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                    Main Image
                  </th>
                  <th className="w-[30%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                    Description
                  </th>
                  <th className="w-[10%] px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                    Status
                  </th>
                  <th className="w-[13%] px-2 lg:px-4 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {currentProducts.map((product, index) => {
                  const discontinued = isProductDiscontinued(product);
                  const categoryInfo = getCategoryInfo(product.categoryId);
                  const categoryBadgeStyle = categoryInfo.isDeleted
                    ? { backgroundColor: '#F3F4F6', color: '#9CA3AF', borderColor: '#D1D5DB' }
                    : { backgroundColor: '#FCEFCB', color: '#A86523', borderColor: '#A86523' };

                  return (
                    <tr
                      key={product._id}
                      className={`hover:bg-gradient-to-r hover:from-yellow-50/50 hover:via-amber-50/50 hover:to-orange-50/50 transition-all duration-300 border-b-2 border-gray-200/40 ${discontinued ? 'opacity-60' : ''}`}
                    >
                      {/* # */}
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                        {startIndex + index + 1}
                      </td>

                      {/* Product Name */}
                      <td className="px-2 lg:px-4 py-3">
                        <div className="text-xs lg:text-sm font-medium text-gray-900 truncate">
                          {product.productName || 'N/A'}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                        <span className={categoryInfo.isDeleted ? 'line-through text-gray-400' : ''}>
                          {categoryInfo.name || 'N/A'}
                        </span>
                        {categoryInfo.isDeleted && (
                          <span className="ml-1 text-xs text-red-500" title="This category has been deleted">
                            (Deleted)
                          </span>
                        )}
                      </td>

                      {/* Main Image */}
                      <td className="px-2 lg:px-4 py-3">
                        {product.productImageIds && product.productImageIds.length > 0 ? (
                          <img
                            src={
                              product.productImageIds.find(img => img.isMain)?.imageUrl ||
                              product.productImageIds[0]?.imageUrl
                            }
                            alt={product.productName || 'Product'}
                            className="mx-auto w-12 h-12 lg:w-14 lg:h-14 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-all duration-200 hover:scale-105"
                            onClick={e => {
                              e.stopPropagation();
                              handleImageClick(
                                product.productImageIds.find(img => img.isMain)?.imageUrl ||
                                product.productImageIds[0]?.imageUrl
                              );
                            }}
                            title="Click to view larger image"
                            onError={e => {
                              e.target.alt = 'Image not available';
                              e.target.style.opacity = '0.5';
                            }}
                          />
                        ) : (
                          <div className="mx-auto w-12 h-12 lg:w-14 lg:h-14 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                            <svg
                              className="w-6 h-6 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                          </div>
                        )}
                      </td>

                      {/* Description */}
                      <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900">
                        <div className="truncate">
                          {product.description
                            ? `${stripHtml(product.description).substring(0, 80)}${stripHtml(product.description).length > 80 ? '...' : ''}`
                            : 'N/A'}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm ${discontinued
                            ? 'bg-red-600 text-white'
                            : product.productStatus === 'active'
                              ? 'bg-gradient-to-r from-green-400 to-emerald-500 text-white'
                              : product.productStatus === 'inactive'
                                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                                : 'bg-gradient-to-r from-blue-400 to-cyan-500 text-white'
                            }`}
                        >
                          {discontinued ? 'discontinued' : product.productStatus || 'unknown'}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-2 lg:px-4 py-3">
                        <div className="flex justify-center items-center space-x-1">
                          {/* View Button */}
                          <button
                            onClick={() => handleShowDetails(product)}
                            className="p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm"
                            aria-label={`View details for product ${product._id}`}
                            title="View Details"
                          >
                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleEditProduct(product)}
                            disabled={discontinued}
                            className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${discontinued
                              ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                              : 'border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm'
                              }`}
                            aria-label={`Edit product ${product._id}`}
                            title="Edit Product"
                          >
                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>

                          {/* Delete (Discontinue) Button */}
                          <button
                            onClick={() => handleRequestDiscontinue(product)}
                            disabled={discontinued}
                            className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${discontinued
                              ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                              : 'text-white bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700'
                              }`}
                            aria-label={`Discontinue product ${product._id}`}
                            title="Discontinue Product"
                          >
                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>

                          {/* Add Variant Button */}
                          <button
                            onClick={() => handleOpenAddVariantModal(product)}
                            disabled={discontinued}
                            className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${discontinued
                              ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                              : 'border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm'
                              }`}
                            aria-label={`Add variant for product ${product._id}`}
                            title="Add Variant"
                          >
                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filteredProducts.length > 0 && (
        <div className="backdrop-blur-xl rounded-xl border p-4 lg:p-6 mt-4 lg:mt-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm font-medium text-gray-700">
              Showing <span className="font-bold text-gray-900">{startIndex + 1}</span> to <span className="font-bold text-gray-900">{Math.min(endIndex, filteredProducts.length)}</span> of <span className="font-bold text-gray-900">{filteredProducts.length}</span> products
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handleFirstPage}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200"
                aria-label="First page"
                title="First page"
              >
                First
              </button>
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200"
                aria-label="Previous page"
              >
                Previous
              </button>

              <div className="flex items-center space-x-1">
                {totalPages > 5 && visiblePages[0] > 1 && (
                  <>
                    <button
                      className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 transition-all duration-200"
                      onClick={() => handlePageChange(1)}
                      aria-label="Page 1"
                    >
                      1
                    </button>
                    {visiblePages[0] > 2 && (
                      <span className="px-2 text-gray-500">...</span>
                    )}
                  </>
                )}
                {visiblePages.map(page => (
                  <button
                    key={page}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${currentPage === page
                      ? 'text-white border-transparent bg-gradient-to-r from-[#E9A319] via-[#A86523] to-[#8B4E1A] hover:from-[#A86523] hover:via-[#8B4E1A] hover:to-[#6B3D14]'
                      : 'text-gray-600 bg-white border border-gray-300 hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300'
                      }`}
                    onClick={() => handlePageChange(page)}
                    aria-label={`Page ${page}`}
                  >
                    {page}
                  </button>
                ))}
                {totalPages > 5 && visiblePages[visiblePages.length - 1] < totalPages && (
                  <>
                    {visiblePages[visiblePages.length - 1] < totalPages - 1 && (
                      <span className="px-2 text-gray-500">...</span>
                    )}
                    <button
                      className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 transition-all duration-200"
                      onClick={() => handlePageChange(totalPages)}
                      aria-label={`Page ${totalPages}`}
                    >
                      {totalPages}
                    </button>
                  </>
                )}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200"
                aria-label="Next page"
              >
                Next
              </button>
              <button
                onClick={handleLastPage}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-amber-50 hover:text-gray-800 hover:border-amber-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white disabled:hover:text-gray-600 disabled:hover:border-gray-300 transition-all duration-200"
                aria-label="Last page"
                title="Last page"
              >
                Last
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Variant Modal */}
      <VariantModal
        isOpen={showAddVariantModal}
        onClose={handleCloseAddVariantModal}
        product={selectedProductForVariant}
        colors={colors}
        sizes={sizes}
        onVariantCreated={() => {
          handleCloseAddVariantModal();
          if (selectedProductForVariant) {
            fetchProductVariants(selectedProductForVariant._id);
          }
        }}
      />

      {/* Product Details Modal */}
      <ProductDetailsModal
        isOpen={showDetailsModal}
        onClose={handleCloseDetailsModal}
        product={selectedProductForDetails}
        productVariants={productVariants}
        getCategoryName={getCategoryName}
        getCategoryInfo={getCategoryInfo}
        colors={colors}
        sizes={sizes}
        onVariantChange={() => {
          if (selectedProductForDetails) {
            fetchProductVariants(selectedProductForDetails._id);
          }
        }}
        onEditProduct={(product) => {
          setEditingProductId(product._id);
          setEditingProduct(product);
          setShowDetailsModal(false);
          setShowEditModal(true);
        }}
        viewOnly={isViewMode}
      />

      {/* Create Product Modal */}
      <ProductModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        onSubmit={createProduct}
        categories={categories}
        loading={loading}
        error={error}
      />

      {/* Edit Product Modal */}
      <ProductModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onSubmit={updateProduct}
        product={editingProduct}
        categories={categories}
        loading={loading}
        error={error}
      />

      <DeleteConfirmModal
        isOpen={showDiscontinueConfirm}
        title="Discontinue Product"
        message={
          <>
            Are you sure you want to discontinue{' '}
            <span className="font-semibold text-gray-900">
              {productPendingDiscontinue?.productName || productPendingDiscontinue?.name || 'this product'}
            </span>
            ?
            <br />
            <span className="text-sm text-gray-500">This action will mark the product as discontinued.</span>
          </>
        }
        onConfirm={handleConfirmDiscontinue}
        onCancel={handleCancelDiscontinue}
        confirmText="Discontinue"
        isLoading={loading}
      />

      {/* Image Modal */}
      <ImageModal
        isOpen={showImageModal}
        onClose={handleCloseImageModal}
        imageUrl={selectedImage}
        alt="Product Image"
      />
    </div>
  );
};

export default Products;