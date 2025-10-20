import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import '../../styles/Products.css';
import Api from '../../common/SummaryAPI';
import CreateProductModal from './CreateProductModal';
import EditProductModal from './EditProductModal';
import ProductDetailsModal from './ProductDetailsModal';
import CreateVariantModal from '../ProductVariant/CreateVariantModal';
import ImageModal from '../../components/ImageModal';
import axiosClient from '../../common/axiosClient';

// Using SummaryAPI for all API calls

const Products = () => {
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
  const [showFilters, setShowFilters] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(20);

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

  // Status options based on model
  const statusOptions = ['active', 'discontinued'];

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
      if (filterSettings.categoryFilter && product.categoryId?._id !== filterSettings.categoryFilter) {
        return false;
      }

      // Status filter
      if (filterSettings.statusFilter && product.productStatus !== filterSettings.statusFilter) {
        return false;
      }

      return true;
    });
  }, []);

  // Update filtered products when products or filters change
  useEffect(() => {
    setFilteredProducts(applyFilters(products, filters));
    setCurrentPage(1);
  }, [products, filters, applyFilters]);

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
      console.log('Fetched categories:', response);
      setCategories(Array.isArray(response) ? response : []);
    } catch (err) {
      console.error('Fetch categories error:', err);
    }
  }, []);

  // Fetch colors
  const fetchColors = useCallback(async () => {
    try {
      const response = await Api.colors.getAll();
      console.log('Colors API response:', response);
      setColors(Array.isArray(response) ? response : []);
    } catch (err) {
      console.warn('Colors API not available, using mock data:', err.message);
      // Fallback to mock data
      setColors([
        { _id: '507f1f77bcf86cd799439011', color_name: 'Red' },
        { _id: '507f1f77bcf86cd799439012', color_name: 'Blue' },
        { _id: '507f1f77bcf86cd799439013', color_name: 'Green' },
        { _id: '507f1f77bcf86cd799439014', color_name: 'Black' },
        { _id: '507f1f77bcf86cd799439015', color_name: 'White' },
        { _id: '507f1f77bcf86cd799439016', color_name: 'Yellow' },
        { _id: '507f1f77bcf86cd799439017', color_name: 'Purple' },
        { _id: '507f1f77bcf86cd799439018', color_name: 'Orange' }
      ]);
    }
  }, []);

  // Fetch sizes
  const fetchSizes = useCallback(async () => {
    try {
      const response = await Api.sizes.getAll();
      console.log('Sizes API response:', response);
      setSizes(Array.isArray(response) ? response : []);
    } catch (err) {
      console.warn('Sizes API not available, using mock data:', err.message);
      // Fallback to mock data
      setSizes([
        { _id: '507f1f77bcf86cd799439021', size_name: 'XS' },
        { _id: '507f1f77bcf86cd799439022', size_name: 'S' },
        { _id: '507f1f77bcf86cd799439023', size_name: 'M' },
        { _id: '507f1f77bcf86cd799439024', size_name: 'L' },
        { _id: '507f1f77bcf86cd799439025', size_name: 'XL' },
        { _id: '507f1f77bcf86cd799439026', size_name: 'XXL' },
        { _id: '507f1f77bcf86cd799439027', size_name: 'XXXL' }
      ]);
    }
  }, []);

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
      console.log('Fetched new products:', response.data);
      // Response structure: { success: true, data: [...], message: "..." }
      const productsData = response.data || response;
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err) {
      setError(err.message || 'Failed to load products');
      console.error('Fetch products error:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Fetch variants for a specific product
  const fetchProductVariants = useCallback(async (productId) => {
    console.log(`Fetching variants for product ${productId}...`);
    try {
      const response = await Api.newVariants.getByProduct(productId);
      console.log(`Fetched variants for product ${productId}:`, response);

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

      console.log(`Processed variants data for product ${productId}:`, variantsData);
      setProductVariants(prev => {
        const newState = {
          ...prev,
          [productId]: variantsData
        };
        console.log('Updated productVariants state:', newState);
        return newState;
      });
    } catch (err) {
      console.error('Fetch variants error:', err);
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
      console.error('Upload error:', err);
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

      console.log('Product created:', response.data);
      const newProduct = response.data?.data || response.data;
      setProducts(prev => [...prev, newProduct]);
      showToast('Product created successfully. Add variants to activate it.', 'success');
      setShowCreateModal(false);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to create product';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('Create product error:', err);
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

      console.log('Product updated:', response.data);
      const updatedProduct = response.data?.data || response.data;
      setProducts(prev =>
        prev.map(product =>
          product._id === editingProductId ? updatedProduct : product
        )
      );
      // Update selectedProductForDetails with new data
      setSelectedProductForDetails(updatedProduct);
      showToast('Product updated successfully', 'success');
      setEditingProductId(null);
      setEditingProduct(null);
      setShowEditModal(false);
      // Return to ProductDetailsModal after successful update
      setShowDetailsModal(true);
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message || 'Failed to update product';
      setError(errorMessage);
      showToast(errorMessage, 'error');
      console.error('Update product error:', err);
    } finally {
      setLoading(false);
    }
  }, [editingProductId, showToast]);

  // Delete product (soft delete) using NEW API
  const deleteProduct = useCallback(async (productId) => {
    if (!window.confirm('Are you sure you want to discontinue this product? This action will mark it as discontinued.')) return;

    setLoading(true);
    setError('');

    try {
      await Api.newProducts.delete(productId);

      console.log('Product discontinued:', productId);

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
      console.error('Delete product error:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedProductId, editingProductId, showToast]);

  // Handle authentication state and fetch data
  useEffect(() => {
    console.log('Products useEffect: user=', user, 'isAuthLoading=', isAuthLoading);
    if (isAuthLoading) {
      return;
    }
    if (!user && !localStorage.getItem('token')) {
      console.log('No user and no token, redirecting to login');
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

  // Get category name by ID
  const getCategoryName = useCallback((catId) => {
    if (!catId) return 'N/A';
    const catIdString = typeof catId === 'object' ? catId._id : catId;
    const category = categories.find(cat => cat._id === catIdString);
    return category?.cat_name || 'N/A';
  }, [categories]);

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
      <div className="products-container">
        <div className="products-loading" role="status" aria-live="polite">
          <div className="products-progress-bar"></div>
          <p>Verifying authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">

      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Product Management</h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Create and manage products with variants</p>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
            <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
              <span className="text-xs lg:text-sm font-medium text-gray-700">
                {filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}
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
            <button
              className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
              onClick={handleCreateProduct}
            >
              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="font-medium">Add Product</span>
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
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search Products</label>
              <input
                type="text"
                placeholder="Search by name, description..."
                value={filters.searchQuery}
                onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
              />
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filters.categoryFilter}
                onChange={(e) => handleFilterChange('categoryFilter', e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
              >
                <option value="">All Categories</option>
                {categories.map(category => (
                  <option key={category._id} value={category._id}>
                    {category.cat_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={filters.statusFilter}
                onChange={(e) => handleFilterChange('statusFilter', e.target.value)}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
              >
                <option value="">All Statuses</option>
                {statusOptions.map(status => (
                  <option key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters()}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Clear all filters"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 lg:mb-6" role="alert" aria-live="assertive">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0 w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <span className="text-red-800 font-medium">{error}</span>
            </div>
            <button
              className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 text-sm font-medium"
              onClick={handleRetry}
              aria-label="Retry loading products"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-4 lg:mb-6" role="status" aria-live="polite">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-8 h-8 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <p className="text-gray-600 font-medium">Loading products...</p>
          </div>
        </div>
      )}

      {/* Products Table */}
      {!loading && filteredProducts.length === 0 && !error ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8" role="status">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="text-center">
              <h3 className="text-lg font-medium text-gray-900 mb-2">No products found</h3>
              <p className="text-gray-500 text-sm">
                {products.length === 0
                  ? "Get started by creating your first product"
                  : "Try adjusting your search or filter criteria"
                }
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px]">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Product Name</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Main Image</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Description</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentProducts.map((product, index) => {
                  const discontinued = isProductDiscontinued(product);
                  return (
                    <React.Fragment key={product._id}>
                      <tr className={`hover:bg-gray-50 transition-colors duration-150 ${discontinued ? 'opacity-60' : ''}`}>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                          {startIndex + index + 1}
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <div className="text-xs lg:text-sm font-medium text-gray-900">
                            {product.productName || 'N/A'}
                          </div>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getCategoryName(product.categoryId)}
                          </span>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          {product.productImageIds && product.productImageIds.length > 0 ? (
                            <img
                              src={product.productImageIds.find(img => img.isMain)?.imageUrl || product.productImageIds[0]?.imageUrl}
                              alt={product.productName || 'Product'}
                              className="w-12 h-12 lg:w-16 lg:h-16 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-80 transition-all duration-200 hover:scale-110"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleImageClick(product.productImageIds.find(img => img.isMain)?.imageUrl || product.productImageIds[0]?.imageUrl);
                              }}
                              title="Click to view larger image"
                              onError={(e) => {
                                e.target.alt = 'Image not available';
                                e.target.style.opacity = '0.5';
                              }}
                            />
                          ) : (
                            <div className="w-12 h-12 lg:w-16 lg:h-16 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                              <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke Capstone="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </td>
                        <td className="px-2 lg:px-4 py-3 text-xs lg:text-sm text-gray-900 max-w-xs">
                          <div className="truncate">
                            {product.description ? `${product.description.substring(0, 50)}${product.description.length > 50 ? '...' : ''}` : 'N/A'}
                          </div>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${discontinued
                            ? 'bg-red-100 text-red-800'
                            : product.productStatus === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                            }`}>
                            {discontinued ? 'Discontinued' : product.productStatus || 'N/A'}
                          </span>
                        </td>
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm font-medium">
                          <div className="flex items-center space-x-1">
                            <button
                              onClick={() => handleShowDetails(product)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                              aria-label={`View details for product ${product._id}`}
                              disabled={discontinued}
                              title="View Details"
                            >
                              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleEditProduct(product)}
                              className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                              aria-label={`Edit product ${product._id}`}
                              disabled={discontinued}
                              title="Edit Product"
                            >
                              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteProduct(product._id)}
                              className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 border border-red-200 hover:border-red-300"
                              aria-label={`Discontinue product ${product._id}`}
                              disabled={discontinued}
                              title="Discontinue Product"
                            >
                              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleOpenAddVariantModal(product)}
                              className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-100 rounded-lg transition-all duration-200 border border-green-200 hover:border-green-300"
                              aria-label={`Add variant for product ${product._id}`}
                              disabled={discontinued}
                              title="Add Variant"
                            >
                              <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {filteredProducts.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 lg:p-6 mt-4 lg:mt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredProducts.length)}</span> of <span className="font-medium">{filteredProducts.length}</span> products
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={handlePreviousPage}
                disabled={currentPage === 1}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Previous page"
              >
                Previous
              </button>

              <div className="flex items-center space-x-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${currentPage === page
                      ? 'bg-blue-600 text-white border border-blue-600'
                      : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50 hover:text-gray-700'
                      }`}
                    onClick={() => handlePageChange(page)}
                    aria-label={`Page ${page}`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                aria-label="Next page"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Variant Modal */}
      <CreateVariantModal
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
      <CreateProductModal
        isOpen={showCreateModal}
        onClose={handleCloseCreateModal}
        onSubmit={createProduct}
        categories={categories}
        loading={loading}
        error={error}
      />

      {/* Edit Product Modal */}
      <EditProductModal
        isOpen={showEditModal}
        onClose={handleCloseEditModal}
        onSubmit={updateProduct}
        product={editingProduct}
        categories={categories}
        loading={loading}
        error={error}
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