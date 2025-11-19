import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import { ToastContext } from '../context/ToastContext';
import Api from '../common/SummaryAPI';
import Loading from '../components/Loading';
import DeleteConfirmModal from '../components/DeleteConfirmModal';

const ProductSpecifications = () => {
  const { user, isAuthLoading } = useContext(AuthContext);
  const { showToast } = useContext(ToastContext);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('specifcations');
  const navigate = useNavigate();

  // Data states
  const [categories, setCategories] = useState([]);
  const [sizes, setSizes] = useState([]);
  const [colors, setColors] = useState([]);

  // Filter states
  const [filters, setFilters] = useState({
    searchQuery: '',
  });
  const [statusFilter, setStatusFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [newForm, setNewForm] = useState({ name: '', type: 'color' });
  const [editForm, setEditForm] = useState({ name: '' });
  const [loading, setLoading] = useState(false);
  const [createFieldErrors, setCreateFieldErrors] = useState({});
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);

  // Handle URL parameter for tab selection
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['specifcations', 'colors', 'sizes', 'categories'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Handle authentication state
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user && !localStorage.getItem('token')) {
      navigate('/login', { replace: true });
    }
  }, [user, isAuthLoading, navigate]);

  // Helper function to extract error message
  const getErrorMessage = (err, defaultMessage) => {
    if (err.response?.data?.message) {
      return err.response.data.message;
    } else if (err.response?.status === 403) {
      return "Access denied. Only admin and manager can perform this action";
    } else if (err.response?.status === 401) {
      return "You are not authorized to perform this action";
    } else if (err.response?.status === 404) {
      return "Resource not found";
    } else if (err.response?.status === 409) {
      return err.response?.data?.message || "Cannot perform this action because the item is still in use";
    } else if (err.response?.status >= 500) {
      return "Server error. Please try again later";
    } else if (!err.response) {
      // Network error - no response from server
      return defaultMessage.includes("Failed to") ? defaultMessage + ". Please try again later." : `Failed to perform action. Please try again later.`;
    } else if (err.message) {
      return err.message;
    }
    return defaultMessage;
  };

  // Fetch functions
  const fetchColors = useCallback(async () => {
    try {
      const response = await Api.colors.getAll();
      // Backend returns: { success: true, message: "...", data: [...] }
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : [];
        setColors(data.map(item => ({
          ...item,
          _id: item._id || item.id,
          id: item.id || item._id,
          name: item.color_name,
          type: 'color',
          isDeleted: item.isDeleted || false
        })));
      } else {
        throw new Error(response.message || "Failed to fetch colors");
      }
    } catch (err) {
      console.error('Fetch colors error:', err);
      const errorMessage = getErrorMessage(err, "Failed to fetch colors");
      showToast(errorMessage, 'error');
    }
  }, [showToast]);

  const fetchSizes = useCallback(async () => {
    try {
      const response = await Api.sizes.getAll();
      // Backend returns: { success: true, message: "...", data: [...] }
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : [];
        setSizes(data.map(item => ({
          ...item,
          _id: item._id || item.id,
          id: item.id || item._id,
          name: item.size_name,
          type: 'size',
          isDeleted: item.isDeleted || false
        })));
      } else {
        throw new Error(response.message || "Failed to fetch sizes");
      }
    } catch (err) {
      console.error('Fetch sizes error:', err);
      const errorMessage = getErrorMessage(err, "Failed to fetch sizes");
      showToast(errorMessage, 'error');
    }
  }, [showToast]);

  const fetchCategories = useCallback(async () => {
    try {
      const response = await Api.categories.getAll();
      // Backend returns: { success: true, message: "...", data: [...] }
      if (response.success && response.data) {
        const data = Array.isArray(response.data) ? response.data : [];
        setCategories(data.map(item => ({
          ...item,
          _id: item._id || item.id,
          id: item.id || item._id,
          name: item.cat_name,
          type: 'category',
          isDeleted: item.isDeleted || false
        })));
      } else {
        throw new Error(response.message || "Failed to fetch categories");
      }
    } catch (err) {
      console.error('Fetch categories error:', err);
      const errorMessage = getErrorMessage(err, "Failed to fetch categories");
      showToast(errorMessage, 'error');
    }
  }, [showToast]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchColors(), fetchSizes(), fetchCategories()]);
    setLoading(false);
  }, [fetchColors, fetchSizes, fetchCategories]);

  useEffect(() => {
    if (user) {
      fetchAll();
    }
    setCurrentPage(1);
  }, [user, fetchAll]);

  // Helper functions - useMemo to prevent unnecessary re-renders
  const tabToLabel = useMemo(() => ({
    'specifcations': 'Specification',
    'colors': 'Color',
    'sizes': 'Size',
    'categories': 'Category'
  }), []);

  const tabToType = useMemo(() => ({
    'colors': 'color',
    'sizes': 'size',
    'categories': 'category'
  }), []);

  const getLabel = () => tabToLabel[activeTab];

  const getApiForType = (type) => {
    switch (type) {
      case 'color': return Api.colors;
      case 'size': return Api.sizes;
      case 'category': return Api.categories;
      default: return null;
    }
  };

  const getNameFieldForType = (type) => {
    switch (type) {
      case 'color': return 'color_name';
      case 'size': return 'size_name';
      case 'category': return 'cat_name';
      default: return '';
    }
  };

  // Helper: Get items to check for duplicate based on type
  const getItemsToCheck = useCallback((type, activeTabParam) => {
    let items = [];
    if (activeTabParam === 'specifcations') {
      items = [...colors, ...sizes, ...categories];
    } else if (activeTabParam === 'colors' || type === 'color') {
      items = colors;
    } else if (activeTabParam === 'sizes' || type === 'size') {
      items = sizes;
    } else if (activeTabParam === 'categories' || type === 'category') {
      items = categories;
    }
    // Filter to only check with items that are NOT deleted (isDeleted !== true)
    return items.filter(item => item.isDeleted !== true);
  }, [colors, sizes, categories]);

  // Helper: Check for duplicate name
  const checkDuplicate = useCallback((itemsToCheck, trimmedName, type, excludeId = null) => {
    return itemsToCheck.find(item => {
      if (item.type !== type) return false;
      if (excludeId) {
        const currentItemId = item._id || item.id;
        if (currentItemId === excludeId) return false;
      }
      const itemName = (item.name || '').trim();
      return itemName === trimmedName;
    });
  }, []);

  const getCurrentItems = () => {
    let items = [];
    if (activeTab === 'specifcations') {
      items = [...colors, ...sizes, ...categories];
    } else if (activeTab === 'colors') {
      items = [...colors];
    } else if (activeTab === 'sizes') {
      items = [...sizes];
    } else if (activeTab === 'categories') {
      items = [...categories];
    }

    // Sort: status first (active items first, deleted items last), then by name (ABC)
    return items.sort((a, b) => {
      // First, sort by status (isDeleted: false first, true last)
      const aDeleted = a.isDeleted === true;
      const bDeleted = b.isDeleted === true;

      if (aDeleted !== bDeleted) {
        return aDeleted ? 1 : -1; // false (active) comes before true (deleted)
      }

      // If status is the same, sort by name (ABC)
      const aName = (a.name || '').toLowerCase();
      const bName = (b.name || '').toLowerCase();
      return aName.localeCompare(bName);
    });
  };

  // Get item status
  const getItemStatus = (item) => {
    return item.isDeleted === true ? 'deleted' : 'active';
  };

  // Apply filters
  const applyFilters = useCallback((itemsList) => {
    return itemsList.filter((item) => {
      // Filter by search query
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const name = item.name?.toLowerCase() || '';
        if (!name.includes(query)) return false;
      }

      // Filter by status
      if (statusFilter !== 'all') {
        const itemStatus = getItemStatus(item);
        if (itemStatus !== statusFilter) return false;
      }

      return true;
    });
  }, [filters, statusFilter]);

  const filteredItems = applyFilters(getCurrentItems());

  // Pagination calculations
  const totalPages = Math.ceil(filteredItems.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentItems = filteredItems.slice(startIndex, endIndex);

  // Handle page change
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
  }, []);

  // Handle previous page
  const handlePreviousPage = useCallback(() => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  }, []);

  // Handle next page
  const handleNextPage = useCallback(() => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
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

  // Handle filter changes
  const handleFilterChange = useCallback((field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    setCurrentPage(1);
  }, []);

  // Check if any filters are active
  const hasActiveFilters = filters.searchQuery !== '' || statusFilter !== 'all';

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
    });
    setStatusFilter('all');
    setCurrentPage(1);
  }, []);

  // Toggle filters
  const toggleFilters = useCallback(() => {
    setShowFilters(prev => !prev);
  }, []);

  // Create item
  const createItem = useCallback(async () => {
    setLoading(true);
    setCreateFieldErrors({});

    // Trim input value before processing
    // Note: Backend pattern validation does NOT allow spaces for color/size, only hyphen for category
    const trimmedName = (newForm.name || '').trim();
    const type = activeTab === 'specifcations' ? newForm.type : tabToType[activeTab];

    if (!type) {
      showToast('Invalid type', 'error');
      setLoading(false);
      return;
    }

    // Check for duplicate before sending to API
    // Only check with items that are not deleted (isDeleted=false), matching backend logic
    const itemsToCheck = getItemsToCheck(type, activeTab);
    const duplicate = checkDuplicate(itemsToCheck, trimmedName, type);

    if (duplicate) {
      // Duplicate is not an input validation error - only show toast, no field error
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      showToast(`${typeLabel} with this name already exists`, "error");
      setLoading(false);
      return;
    }

    const nameError = validateNameField('name', trimmedName, type);

    if (nameError) {
      setCreateFieldErrors({ name: nameError });
      showToast("Please check the input fields again", "error");
      setLoading(false);
      return;
    }

    try {
      // Ensure all payload values are trimmed and normalized before sending
      const payload = {
        [getNameFieldForType(type)]: trimmedName.trim()
      };
      const api = getApiForType(type);
      const response = await api.create(payload);

      // Backend returns: { success: true, message: "...", data: {...} }
      if (!response.success || !response.data) {
        console.error('Create error: No data in response', response);
        showToast(response.message || "Failed to create item: No data in response", "error");
        setLoading(false);
        return;
      }

      // Extract item from response.data
      const actualItem = response.data;

      // Extract ID
      const itemId = actualItem._id || actualItem.id;

      if (!itemId) {
        console.error('Create error: No ID found in response', actualItem);
        showToast("Failed to create item: ID not found in response", "error");
        setLoading(false);
        return;
      }

      // Ensure ID is preserved
      const newItem = {
        ...actualItem,
        _id: itemId,
        id: itemId,
        name: trimmedName,
        type,
        isDeleted: actualItem.isDeleted || false
      };

      const setFunc = {
        color: setColors,
        size: setSizes,
        category: setCategories
      }[type];
      setFunc((prev) => [...prev, newItem]);
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      showToast(response.message || `${typeLabel} created successfully`, 'success');
      setNewForm({ name: '', type: 'color' });
      setCreateFieldErrors({});
      setShowCreateModal(false);
    } catch (err) {
      console.error('Add item error:', err);

      const typeLabel = tabToLabel[activeTab === 'specifcations' ? type + 's' : activeTab] || 'item';
      let errorMessage = getErrorMessage(err, `Failed to create ${typeLabel.toLowerCase()}`);
      const fieldErrors = {};
      let hasFieldErrors = false;

      // Handle API response errors - only set field errors for input validation errors
      if (err.response?.data) {
        const backendResponse = err.response.data;
        errorMessage = backendResponse.message || errorMessage;

        // Check if it's a validation error by error code or message content
        // Validation errors: VALIDATION_ERROR, INVALID_COLOR_NAME_FORMAT, INVALID_SIZE_NAME_FORMAT, INVALID_CATEGORY_NAME_FORMAT
        // NOT for business logic errors like "already exists" (DUPLICATE_COLOR_NAME), "still contains products" (COLOR_IN_USE), etc.
        if (backendResponse.message) {
          const backendMessage = backendResponse.message.toLowerCase();
          const backendError = backendResponse.error;

          // Check error codes for validation errors
          if (backendError === 'VALIDATION_ERROR' ||
            backendError === 'INVALID_COLOR_NAME_FORMAT' ||
            backendError === 'INVALID_SIZE_NAME_FORMAT' ||
            backendError === 'INVALID_CATEGORY_NAME_FORMAT' ||
            backendMessage.includes('required') ||
            backendMessage.includes('fill in') ||
            backendMessage.includes('length must be') ||
            backendMessage.includes('must not exceed') ||
            backendMessage.includes('must contain only') ||
            backendMessage.includes('cannot be empty')) {
            fieldErrors.name = backendResponse.message;
            hasFieldErrors = true;
          }
        }
      }

      // Handle specific HTTP status codes - these are NOT validation errors
      if (err.response?.status === 401) {
        errorMessage = "You are not authorized to perform this action";
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can perform this action";
      } else if (err.response?.status === 404) {
        errorMessage = "Resource not found";
      } else if (err.response?.status === 409) {
        errorMessage = err.response?.data?.message || "Cannot perform this action because the item is still in use";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (!err.response) {
        errorMessage = `Failed to create ${typeLabel.toLowerCase()}. Please try again later.`;
      }

      // Set field errors only if we have input validation errors
      if (hasFieldErrors && Object.keys(fieldErrors).length > 0) {
        setCreateFieldErrors(fieldErrors);
        showToast("Please check the input fields again", "error");
      } else {
        // All other errors (already exists, network, server, conflict, etc.) - show toast only
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [newForm, activeTab, showToast, tabToType, tabToLabel, getItemsToCheck, checkDuplicate]);

  // Update item
  const updateItem = useCallback(async () => {
    if (!editingItem || loading) return;

    const itemId = editingItem._id || editingItem.id;
    if (!itemId) {
      console.error('Update error: editingItem missing ID', editingItem);
      showToast("Item ID not found! Please refresh the page.", "error");
      setShowEditModal(false);
      setEditingItem(null);
      return;
    }

    setLoading(true);
    setEditFieldErrors({});

    // Trim input value before processing
    // Note: Backend pattern validation does NOT allow spaces for color/size, only hyphen for category
    const trimmedName = (editForm.name || '').trim();
    const type = editingItem.type;

    // Check for duplicate before sending to API (exclude current item)
    // Only check with items that are not deleted (isDeleted=false), matching backend logic
    const itemsToCheck = getItemsToCheck(type);
    const editingItemId = editingItem._id || editingItem.id;
    const duplicate = checkDuplicate(itemsToCheck, trimmedName, type, editingItemId);

    if (duplicate) {
      // Duplicate is not an input validation error - only show toast, no field error
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      showToast(`${typeLabel} with this name already exists`, "error");
      setLoading(false);
      return;
    }

    const nameError = validateNameField('name', trimmedName, type);

    if (nameError) {
      setEditFieldErrors({ name: nameError });
      showToast("Please check the input fields again", "error");
      setLoading(false);
      return;
    }
    try {
      // Ensure all payload values are trimmed and normalized before sending
      const payload = {
        [getNameFieldForType(type)]: trimmedName.trim()
      };
      const api = getApiForType(type);
      const response = await api.update(itemId, payload);

      // Backend returns: { success: true, message: "...", data: {...} }
      if (!response.success || !response.data) {
        console.error('Update error: No data in response', response);
        showToast(response.message || "Failed to update item: No data in response", "error");
        setLoading(false);
        return;
      }

      // Extract item from response.data
      const actualItem = response.data;

      // Extract ID, fallback to original itemId
      const updatedItemId = (actualItem._id || actualItem.id) || itemId;

      if (!updatedItemId) {
        console.error('Update error: No ID found in response', actualItem);
        showToast("Failed to update item: ID not found in response", "error");
        setLoading(false);
        return;
      }

      // Preserve the original ID to ensure it's not lost after update
      const updatedItem = {
        ...actualItem,
        _id: updatedItemId,
        id: updatedItemId,
        name: trimmedName,
        type,
        isDeleted: actualItem.isDeleted || false
      };
      const setFunc = {
        color: setColors,
        size: setSizes,
        category: setCategories
      }[type];
      // Use functional update to ensure we're working with latest state
      setFunc((prev) => prev.map((item) => {
        const currentId = item._id || item.id;
        const editingId = editingItem._id || editingItem.id;
        if (currentId === editingId) {
          // Ensure the updated item always has both _id and id
          return {
            ...updatedItem,
            _id: updatedItem._id || currentId,
            id: updatedItem.id || currentId
          };
        }
        return item;
      }));
      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      showToast(`${typeLabel} updated successfully`, 'success');
      setShowEditModal(false);
      setEditingItem(null);
      setEditForm({ name: '' });
      setEditFieldErrors({});
    } catch (err) {
      console.error('Edit item error:', err);

      const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
      let errorMessage = getErrorMessage(err, `Failed to update ${typeLabel.toLowerCase()}`);
      const fieldErrors = {};
      let hasFieldErrors = false;

      // Handle API response errors - only set field errors for input validation errors
      if (err.response?.data) {
        const backendResponse = err.response.data;
        errorMessage = backendResponse.message || errorMessage;

        // Check if it's a validation error by error code or message content
        // Validation errors: VALIDATION_ERROR, INVALID_COLOR_NAME_FORMAT, INVALID_SIZE_NAME_FORMAT, INVALID_CATEGORY_NAME_FORMAT
        // NOT for business logic errors like "already exists" (DUPLICATE_COLOR_NAME), "still contains products" (COLOR_IN_USE), etc.
        if (backendResponse.message) {
          const backendMessage = backendResponse.message.toLowerCase();
          const backendError = backendResponse.error;

          // Check error codes for validation errors
          if (backendError === 'VALIDATION_ERROR' ||
            backendError === 'INVALID_COLOR_NAME_FORMAT' ||
            backendError === 'INVALID_SIZE_NAME_FORMAT' ||
            backendError === 'INVALID_CATEGORY_NAME_FORMAT' ||
            backendMessage.includes('required') ||
            backendMessage.includes('fill in') ||
            backendMessage.includes('length must be') ||
            backendMessage.includes('must not exceed') ||
            backendMessage.includes('must contain only') ||
            backendMessage.includes('cannot be empty')) {
            fieldErrors.name = backendResponse.message;
            hasFieldErrors = true;
          }
        }
      }

      // Handle specific HTTP status codes
      if (err.response?.status === 400) {
        // Status 400 can be:
        // - "Please fill in all required fields" (validation error - already handled above)
        // - "Color name already exists" / "Size name already exists" (business logic - show toast)
        // - "Invalid color/size ID" (error - show toast)
        if (!hasFieldErrors) {
          // If not a validation error, use backend message or default
          errorMessage = err.response?.data?.message || errorMessage;
        }
      } else if (err.response?.status === 401) {
        errorMessage = "You are not authorized to perform this action";
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can perform this action";
      } else if (err.response?.status === 404) {
        errorMessage = err.response?.data?.message || "Resource not found";
      } else if (err.response?.status === 409) {
        // Status 409: "Cannot update color/size because it still contains products"
        errorMessage = err.response?.data?.message || "Cannot update because the item is still in use";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (!err.response) {
        errorMessage = `Failed to update ${typeLabel.toLowerCase()}. Please try again later.`;
      }

      // Set field errors only if we have input validation errors
      if (hasFieldErrors && Object.keys(fieldErrors).length > 0) {
        setEditFieldErrors(fieldErrors);
        showToast("Please check the input fields again", "error");
      } else {
        // All other errors (already exists, still contains products, network, server, conflict, etc.) - show toast only
        showToast(errorMessage, 'error');
      }
    } finally {
      setLoading(false);
    }
  }, [editingItem, editForm, loading, showToast, getItemsToCheck, checkDuplicate]);

  // Show delete confirmation
  const handleDeleteClick = useCallback((item) => {
    // Prevent deleting already deleted items
    if (item.isDeleted) return;

    // Ensure item has ID before deleting
    const itemId = item._id || item.id;
    if (!itemId) {
      console.error('Delete error: item missing ID', item);
      showToast("Cannot delete item: ID not found!", "error");
      return;
    }
    // Create a copy with guaranteed ID
    const itemWithId = {
      ...item,
      _id: item._id || item.id,
      id: item.id || item._id
    };
    setItemToDelete(itemWithId);
    setShowDeleteConfirm(true);
  }, [showToast]);

  // Delete item
  const handleDelete = useCallback(async () => {
    if (!itemToDelete || loading) return;

    const id = itemToDelete._id || itemToDelete.id;
    const type = itemToDelete.type;

    if (!id) {
      console.error('Delete error: itemToDelete missing ID', itemToDelete);
      showToast("Item ID not found! Please refresh the page.", "error");
      setShowDeleteConfirm(false);
      setItemToDelete(null);
      return;
    }

    setLoading(true);

    try {
      const api = getApiForType(type);
      const response = await api.delete(id);

      // Backend returns: { success: true, message: "...", data: {...} }
      if (!response.success) {
        const errorMessage = response.message || `Failed to delete ${type}`;
        showToast(errorMessage, 'error');
        setLoading(false);
        return;
      }

      const setFunc = {
        color: setColors,
        size: setSizes,
        category: setCategories
      }[type];
      // Use functional update to mark item as deleted (soft delete)
      setFunc((prev) => prev.map((item) => {
        const currentId = item._id || item.id;
        if (currentId && currentId === id) {
          return { ...item, isDeleted: true };
        }
        return item;
      }));
      showToast(response.message || `${type.charAt(0).toUpperCase() + type.slice(1)} deleted successfully!`, 'success');
      if (editingItem) {
        const editingId = editingItem._id || editingItem.id;
        if (editingId === id) {
          setEditingItem(null);
          setShowEditModal(false);
        }
      }
      setShowDeleteConfirm(false);
      setItemToDelete(null);
    } catch (err) {
      console.error('Delete item error:', err);

      let errorMessage = getErrorMessage(err, `Failed to delete ${type}`);

      // Handle specific HTTP status codes from backend
      if (err.response?.status === 400) {
        // Status 400: "Invalid color/size ID"
        errorMessage = err.response?.data?.message || errorMessage;
      } else if (err.response?.status === 401) {
        errorMessage = "You are not authorized to perform this action";
      } else if (err.response?.status === 403) {
        errorMessage = "Access denied. Only admin and manager can perform this action";
      } else if (err.response?.status === 404) {
        // Status 404: "Product color/size not found"
        errorMessage = err.response?.data?.message || "Resource not found";
      } else if (err.response?.status === 409) {
        // Status 409: "Cannot delete color/size because it still contains products"
        errorMessage = err.response?.data?.message || "Cannot delete because the item is still in use";
      } else if (err.response?.status >= 500) {
        errorMessage = "Server error. Please try again later";
      } else if (!err.response) {
        errorMessage = `Failed to delete ${type}. Please try again later.`;
      }

      showToast(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  }, [itemToDelete, editingItem, loading, showToast]);

  // Cancel delete
  const handleCancelDelete = useCallback(() => {
    setShowDeleteConfirm(false);
    setItemToDelete(null);
  }, []);

  // Start editing
  const handleEdit = useCallback((item) => {
    // Prevent editing deleted items
    if (item.isDeleted) return;

    // Ensure item has ID before editing
    const itemId = item._id || item.id;
    if (!itemId) {
      console.error('Edit error: item missing ID', item);
      showToast("Cannot edit item: ID not found!", "error");
      return;
    }
    // Create a copy with guaranteed ID
    const itemWithId = {
      ...item,
      _id: item._id || item.id,
      id: item.id || item._id
    };
    setEditingItem(itemWithId);
    setEditForm({
      name: item.name || '',
    });
    setShowEditModal(true);
  }, [showToast]);

  // Validate name field based on type (matching backend validation)
  const validateNameField = (name, value, type) => {
    if (!value || !value.trim()) {
      return 'Please fill in all required fields';
    }
    const trimmed = value.trim();

    // Type-specific validation matching backend rules
    // Backend validates both length and pattern together, returning a single message
    if (type === 'color') {
      // Color: pattern validation (only letters, numbers, Vietnamese characters - NO spaces)
      const colorNamePattern = /^[a-zA-ZÀ-Ỵà-ỹ0-9]+$/;
      if (trimmed.length < 2 || trimmed.length > 30 || !colorNamePattern.test(trimmed)) {
        return 'Color name must be 2-30 characters and contain only letters and numbers';
      }
    } else if (type === 'size') {
      // Size: chỉ chữ (có dấu), số, không khoảng trắng
      const sizeNamePattern = /^[a-zA-ZÀ-Ỵà-ỹ0-9]+$/;

      if (trimmed.length < 1 || trimmed.length > 12 || !sizeNamePattern.test(trimmed)) {
        return 'Size name must be 1-12 characters and contain only letters and numbers';
      }

      // Nếu chỉ là số → kiểm tra giới hạn an toàn
      if (/^[0-9]+$/.test(trimmed)) {
        const numericValue = parseInt(trimmed, 10);
        if (numericValue < 20 || numericValue > 60) {
          return 'Numeric size must be between 20 and 60';
        }
      }
    }
    else if (type === 'category') {
      // Category: pattern validation (letters, numbers, Vietnamese characters, hyphen - NO spaces except hyphen)
      // Must contain at least one letter (cannot be only numbers)
      const categoryNamePattern = /^[a-zA-ZÀ-Ỵà-ỹ0-9\-]+$/;
      const hasLetter = /[a-zA-ZÀ-Ỵà-ỹ]/.test(trimmed);
      if (trimmed.length < 3 || trimmed.length > 30 || !categoryNamePattern.test(trimmed) || !hasLetter) {
        return 'Category name must be 3–30 characters and contain only letters, numbers, and hyphens';
      }
    } else {
      // Default validation for unknown types
      if (trimmed.length < 1) {
        return 'Name cannot be empty';
      }
      if (trimmed.length > 100) {
        return 'Name must be less than 100 characters';
      }
    }

    return null;
  };

  // Handle field change for new form with validation
  const handleNewFieldChange = useCallback((field, value) => {
    setNewForm((prev) => {
      const updated = { ...prev, [field]: value };

      // Validate the field
      if (field === 'name') {
        // Determine type for validation
        const type = activeTab === 'specifcations' ? updated.type : tabToType[activeTab];
        const error = validateNameField(field, value, type);
        setCreateFieldErrors(prevErrors => {
          const newErrors = { ...prevErrors };
          if (error) {
            newErrors[field] = error;
          } else {
            delete newErrors[field];
          }
          return newErrors;
        });
      }

      return updated;
    });
  }, [activeTab, tabToType]);

  // Handle field change for edit form with validation
  const handleEditFieldChange = useCallback((field, value) => {
    setEditForm((prev) => {
      const updated = { ...prev, [field]: value };

      // Validate the field
      if (field === 'name' && editingItem) {
        const type = editingItem.type;
        const error = validateNameField(field, value, type);
        setEditFieldErrors(prevErrors => {
          const newErrors = { ...prevErrors };
          if (error) {
            newErrors[field] = error;
          } else {
            delete newErrors[field];
          }
          return newErrors;
        });
      }

      return updated;
    });
  }, [editingItem]);

  // Close create modal
  const handleCloseCreateModal = useCallback(() => {
    setShowCreateModal(false);
    setNewForm({ name: '', type: 'color' });
    setCreateFieldErrors({});
  }, []);

  // Close edit modal
  const handleCloseEditModal = useCallback(() => {
    setShowEditModal(false);
    setEditingItem(null);
    setEditForm({ name: '' });
    setEditFieldErrors({});
  }, []);

  // Show loading state while auth is being verified
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8" role="status" aria-live="polite">
          <Loading
            type="page"
            size="medium"
            message="Verifying authentication..."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">Product Specifications</h1>
          {/* <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage colors, sizes, and categories</p> */}
        </div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
          <div className="bg-gradient-to-r from-yellow-400/20 via-amber-400/20 to-orange-400/20 backdrop-blur-md px-2 lg:px-4 py-1 lg:py-2 rounded-xl border-2 border-yellow-400/50 shadow-md">
            <span className="text-xs lg:text-sm font-semibold text-gray-700">
              {filteredItems.length} {activeTab === 'specifcations' ? 'items' : activeTab}
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 transform hover:scale-105"
            aria-label={`Add new ${getLabel().toLowerCase()}`}
          >
            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className='font-medium'>Add {getLabel()}</span>
          </button>
        </div>
      </div>

      {/* Search Section */}
      {showFilters && (
        <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h2 className="text-base lg:text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Search & Filter</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={clearFilters}
                disabled={!hasActiveFilters}
                className="px-2 py-1.5 lg:px-3 lg:py-2 text-gray-600 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:via-pink-500 hover:to-rose-500 rounded-xl transition-all duration-300 border-2 border-gray-300/60 hover:border-transparent font-medium text-xs lg:text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 shadow-md hover:shadow-lg"
                aria-label="Clear all filters"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="mb-3 lg:mb-4">
            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Search by Name</label>
            <input
              type="text"
              placeholder="Enter name..."
              value={filters.searchQuery}
              onChange={(e) => handleFilterChange('searchQuery', e.target.value)}
              className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 lg:gap-4">
            <div>
              <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 lg:px-4 lg:py-3 border-2 border-gray-300/60 rounded-xl focus:ring-2 focus:ring-offset-2 transition-all duration-300 backdrop-blur-sm text-sm lg:text-base focus:border-amber-500 focus:ring-amber-500/30 shadow-md hover:shadow-lg hover:border-yellow-400/60"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="deleted">Deleted</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="backdrop-blur-xl rounded-xl border mb-4 lg:mb-6 overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
        <div className="flex border-b" style={{ borderColor: '#A86523' }}>
          <button
            className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${activeTab === 'specifcations'
              ? 'text-[#A86523] border-b-2'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            style={activeTab === 'specifcations' ? { borderBottomColor: '#A86523', backgroundColor: '#FCEFCB' } : {}}
            onClick={() => setActiveTab('specifcations')}
            aria-selected={activeTab === 'specifcations'}
            role="tab"
          >
            All
          </button>
          <button
            className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${activeTab === 'colors'
              ? 'text-[#A86523] border-b-2'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            style={activeTab === 'colors' ? { borderBottomColor: '#A86523', backgroundColor: '#FCEFCB' } : {}}
            onClick={() => setActiveTab('colors')}
            aria-selected={activeTab === 'colors'}
            role="tab"
          >
            Colors
          </button>
          <button
            className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${activeTab === 'sizes'
              ? 'text-[#A86523] border-b-2'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            style={activeTab === 'sizes' ? { borderBottomColor: '#A86523', backgroundColor: '#FCEFCB' } : {}}
            onClick={() => setActiveTab('sizes')}
            aria-selected={activeTab === 'sizes'}
            role="tab"
          >
            Sizes
          </button>
          <button
            className={`flex-1 px-4 py-3.5 text-sm font-semibold transition-all duration-200 ${activeTab === 'categories'
              ? 'text-[#A86523] border-b-2'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
              }`}
            style={activeTab === 'categories' ? { borderBottomColor: '#A86523', backgroundColor: '#FCEFCB' } : {}}
            onClick={() => setActiveTab('categories')}
            aria-selected={activeTab === 'categories'}
            role="tab"
          >
            Categories
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="backdrop-blur-xl rounded-xl border overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
        {loading || filteredItems.length === 0 ? (
          <div className="p-6" role="status">
            <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
              {/* ── LOADING ── */}
              {loading ? (
                <Loading
                  type="page"
                  size="medium"
                  message={`Loading ${activeTab}...`}
                />
              ) : (
                /* ── NO ITEMS ── */
                <>
                  <div className="w-14 h-14 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <h3 className="text-base font-medium text-gray-900">No {activeTab} found</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {filters.searchQuery
                        ? "Try adjusting your search criteria"
                        : `Get started by adding a new ${getLabel().toLowerCase()}`}
                    </p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[600px]">
              <thead className="backdrop-blur-sm border-b" style={{ borderColor: '#A86523' }}>
                <tr>
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">#</th>
                  {activeTab === 'specifcations' && (
                    <th className="px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Type</th>
                  )}
                  <th className="px-2 lg:px-4 py-3 text-left text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Name</th>
                  <th className="px-2 lg:px-4 py-3 text-center text-xs font-bold text-gray-800 uppercase tracking-wider whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentItems.map((item, index) => {
                  const itemId = item._id || item.id || `item-${index}`;
                  const isDeleted = item.isDeleted === true;
                  return (
                    <tr
                      key={itemId}
                      className={`hover:bg-gradient-to-r hover:from-yellow-50/50 hover:via-amber-50/50 hover:to-orange-50/50 transition-all duration-300 border-b-2 border-gray-200/40 ${isDeleted ? 'opacity-60' : ''}`}
                    >
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap text-xs lg:text-sm text-gray-900">
                        {startIndex + index + 1}
                      </td>
                      {activeTab === 'specifcations' && (
                        <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                          <span className="text-xs lg:text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-lg capitalize">
                            {item.type}
                          </span>
                        </td>
                      )}
                      <td className="px-2 lg:px-4 py-3 whitespace-nowrap">
                        <span className="text-xs lg:text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                          {item.name || 'N/A'}
                        </span>
                      </td>
                      <td className="px-2 lg:px-4 py-3">
                        <div className="flex justify-center items-center space-x-1">
                          <button
                            className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${isDeleted
                              ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                              : 'border-yellow-400/60 bg-gradient-to-br from-yellow-100/80 via-amber-100/80 to-orange-100/80 hover:from-yellow-200 hover:via-amber-200 hover:to-orange-200 text-amber-700 hover:text-amber-800 backdrop-blur-sm'
                              }`}
                            onClick={() => handleEdit(item)}
                            disabled={loading || isDeleted}
                            aria-label={`Edit ${item.type} ${item._id || item.id}`}
                            title="Edit"
                          >
                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                          <button
                            className={`p-1.5 rounded-xl transition-all duration-300 border-2 shadow-md hover:shadow-lg transform hover:scale-110 ${isDeleted
                              ? 'text-gray-400 bg-gray-50 border-gray-200 cursor-not-allowed'
                              : 'text-white bg-red-600 hover:bg-red-700 border-red-600 hover:border-red-700'
                              }`}
                            onClick={() => handleDeleteClick(item)}
                            disabled={loading || isDeleted}
                            aria-label={`Delete ${item.type} ${item._id || item.id}`}
                            title="Delete"
                          >
                            <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                              />
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
        )}
      </div>

      {/* Pagination */}
      {filteredItems.length > 0 && (
        <div className="backdrop-blur-xl rounded-xl border p-4 lg:p-6 mt-4 lg:mt-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredItems.length)}</span> of <span className="font-medium">{filteredItems.length}</span> items
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ borderColor: '#A86523' }}>
            <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b" style={{ borderColor: '#A86523' }}>
              <h2 className="text-xl font-semibold text-gray-900">Add New {getLabel()}</h2>
              <button
                onClick={handleCloseCreateModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ '--tw-ring-color': '#A86523' }}
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 lg:p-6">
              <div className="space-y-4">
                {activeTab === 'specifcations' && (
                  <div>
                    <label htmlFor="create-type" className="block text-sm font-medium text-gray-700 mb-2">
                      Type *
                    </label>
                    <select
                      id="create-type"
                      value={newForm.type}
                      onChange={(e) => handleNewFieldChange('type', e.target.value)}
                      className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base focus:border-[#A86523] focus:ring-[#A86523]"
                    >
                      <option value="color">Color</option>
                      <option value="size">Size</option>
                      <option value="category">Category</option>
                    </select>
                  </div>
                )}
                <div>
                  <label htmlFor="create-name" className="block text-sm font-semibold text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="create-name"
                    type="text"
                    value={newForm.name}
                    onChange={(e) => handleNewFieldChange('name', e.target.value)}
                    className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base ${createFieldErrors.name
                      ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                      }`}
                    placeholder="Enter name..."
                    required
                  />
                  {createFieldErrors.name && (
                    <p className="mt-1.5 text-sm text-red-600">{createFieldErrors.name}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 lg:p-6 border-t" style={{ borderColor: '#A86523' }}>
              <button
                onClick={handleCloseCreateModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={createItem}
                className="px-6 py-2.5 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:hover:shadow-lg bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] disabled:hover:from-[#E9A319] disabled:hover:to-[#A86523] transform hover:scale-105"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loading type="inline" size="small" message="" className="mr-1" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  `Add`
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl border-2 max-w-md w-full max-h-[90vh] overflow-y-auto" style={{ borderColor: '#A86523' }}>
            <div className="flex items-center justify-between p-3 sm:p-4 lg:p-5 border-b" style={{ borderColor: '#A86523' }}>
              <h2 className="text-xl font-semibold text-gray-900">Edit {editingItem.type.charAt(0).toUpperCase() + editingItem.type.slice(1)}</h2>
              <button
                onClick={handleCloseEditModal}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2"
                style={{ '--tw-ring-color': '#A86523' }}
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 lg:p-6">
              <div className="space-y-4">
                <div>
                  <label htmlFor="edit-name" className="block text-sm font-semibold text-gray-700 mb-2">
                    Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="edit-name"
                    type="text"
                    value={editForm.name}
                    onChange={(e) => handleEditFieldChange('name', e.target.value)}
                    className={`w-full px-3 py-2 lg:px-4 lg:py-3 border rounded-lg focus:ring-2 transition-all duration-200 bg-white text-sm lg:text-base ${editFieldErrors.name
                      ? 'border-red-400 bg-white focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 hover:border-gray-400 focus:border-[#A86523] focus:ring-[#A86523]'
                      }`}
                    placeholder="Enter name..."
                    required
                  />
                  {editFieldErrors.name && (
                    <p className="mt-1.5 text-sm text-red-600">{editFieldErrors.name}</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 p-4 lg:p-6 border-t" style={{ borderColor: '#A86523' }}>
              <button
                onClick={handleCloseEditModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 font-medium"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={updateItem}
                className="px-6 py-2.5 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed text-sm lg:text-base focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:hover:shadow-lg bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] disabled:hover:from-[#E9A319] disabled:hover:to-[#A86523] transform hover:scale-105"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loading type="inline" size="small" message="" className="mr-1" />
                    <span>Processing...</span>
                  </div>
                ) : (
                  'Edit'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        isOpen={showDeleteConfirm && itemToDelete !== null}
        title={`Delete ${itemToDelete?.type ? itemToDelete.type.charAt(0).toUpperCase() + itemToDelete.type.slice(1) : 'Item'}`}
        itemName={itemToDelete?.name}
        message={
          itemToDelete ? (
            <>
              Are you sure you want to delete <span className="font-semibold text-gray-900">{itemToDelete.name}</span>?
              <br />
              <span className="text-sm text-gray-500">This action cannot be undone.</span>
            </>
          ) : null
        }
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={handleDelete}
        onCancel={handleCancelDelete}
        isLoading={loading}
      />
    </div>
  );
};

export default ProductSpecifications;