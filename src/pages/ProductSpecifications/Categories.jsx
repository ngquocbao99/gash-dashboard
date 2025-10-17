import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import '../../styles/ProductSpecifications.css';
import Api from '../../common/SummaryAPI';

const Categories = () => {
    const { user, isAuthLoading } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [categories, setCategories] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [newCategoryForm, setNewCategoryForm] = useState({ cat_name: '' });
    const [editFormData, setEditFormData] = useState({ cat_name: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Fetch categories
    const fetchCategories = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            console.log('Fetching categories...');
            const response = await Api.categories.getAll();
            console.log('Categories API response:', response);
            setCategories(Array.isArray(response) ? response : []);
        } catch (err) {
            console.error('Fetch categories error:', err);
            setError(err.message || 'Failed to load categories');
        } finally {
            setLoading(false);
        }
    }, []);

    // Create category
    const createCategory = useCallback(async () => {
        setLoading(true);
        setError('');

        if (!newCategoryForm.cat_name) {
            setError('Category name is required');
            setLoading(false);
            return;
        }

        try {
            const payload = { cat_name: newCategoryForm.cat_name };
            const response = await Api.categories.create(payload);
            setCategories(prev => [...prev, response]);
            showToast('Category created successfully', 'success');
            setNewCategoryForm({ cat_name: '' });
            setShowCreateModal(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create category');
            showToast(err.response?.data?.message || 'Failed to create category', 'error');
            console.error('Create category error:', err);
        } finally {
            setLoading(false);
        }
    }, [newCategoryForm, showToast]);

    // Update category
    const updateCategory = useCallback(async () => {
        if (!editingCategory) return;

        setLoading(true);
        setError('');

        if (!editFormData.cat_name) {
            setError('Category name is required');
            setLoading(false);
            return;
        }

        try {
            const payload = { cat_name: editFormData.cat_name };
            const response = await Api.categories.update(editingCategory._id, payload);
            setCategories(prev => prev.map(item => item._id === editingCategory._id ? response : item));
            showToast('Category updated successfully', 'success');
            setShowEditModal(false);
            setEditingCategory(null);
            setEditFormData({ cat_name: '' });
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to update category');
            showToast(err.response?.data?.message || err.message || 'Failed to update category', 'error');
            console.error('Update category error:', err);
        } finally {
            setLoading(false);
        }
    }, [editingCategory, editFormData, showToast]);

    // Delete category
    const deleteCategory = useCallback(async (id) => {
        if (!window.confirm('Are you sure you want to delete this category?')) return;

        setLoading(true);
        setError('');

        try {
            await Api.categories.delete(id);
            setCategories(prev => prev.filter(item => item._id !== id));
            showToast('Category deleted successfully', 'success');
            if (editingCategory && editingCategory._id === id) {
                setEditingCategory(null);
                setShowEditModal(false);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete category');
            showToast(err.response?.data?.message || 'Failed to delete category', 'error');
            console.error('Delete category error:', err);
        } finally {
            setLoading(false);
        }
    }, [editingCategory, showToast]);

    // Handle authentication state
    useEffect(() => {
        if (isAuthLoading) return;
        if (!user && !localStorage.getItem('token')) {
            navigate('/login', { replace: true });
        } else if (user) {
            fetchCategories();
        }
    }, [user, isAuthLoading, navigate, fetchCategories]);

    // Start editing
    const handleEdit = useCallback((category) => {
        setEditingCategory(category);
        setEditFormData({
            cat_name: category.cat_name || '',
        });
        setShowEditModal(true);
    }, []);

    // Handle field change for edit form
    const handleEditFieldChange = useCallback((field, value) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Handle field change for new form
    const handleNewFieldChange = useCallback((field, value) => {
        setNewCategoryForm(prev => ({ ...prev, [field]: value }));
    }, []);

    // Close create modal
    const handleCloseCreateModal = useCallback(() => {
        setShowCreateModal(false);
        setNewCategoryForm({ cat_name: '' });
        setError('');
    }, []);

    // Close edit modal
    const handleCloseEditModal = useCallback(() => {
        setShowEditModal(false);
        setEditingCategory(null);
        setEditFormData({ cat_name: '' });
        setError('');
    }, []);

    // Retry fetching data
    const handleRetry = useCallback(() => {
        fetchCategories();
    }, [fetchCategories]);

    // Show loading state while auth is being verified
    if (isAuthLoading) {
        return (
            <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8" role="status" aria-live="polite">
                    <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600 font-medium">Verifying authentication...</p>
                    </div>
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
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Categories Management</h1>
                        <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage product categories</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
                        <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
                            <span className="text-xs lg:text-sm font-medium text-gray-700">
                                {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 lg:mb-6" role="alert" aria-live="assertive">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center">
                            <svg className="w-5 h-5 text-red-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                            </svg>
                            <span className="text-red-800 font-medium">{error}</span>
                        </div>
                        <button
                            className="px-3 py-1 text-sm bg-red-100 hover:bg-red-200 text-red-800 rounded-lg transition-all duration-200 font-medium"
                            onClick={handleRetry}
                            aria-label="Retry loading categories"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {loading && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 mb-4 lg:mb-6" role="status" aria-live="polite">
                    <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
                        <p className="text-gray-600 font-medium">Loading categories...</p>
                    </div>
                </div>
            )}

            {/* Categories Section */}
            {!loading && (
                <div className="space-y-4 lg:space-y-6">
                    {/* Add Category Button */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Categories Management</h2>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium"
                                aria-label="Add new category"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Add Category</span>
                            </button>
                        </div>
                    </div>

                    {/* Categories Table */}
                    {categories.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8" role="status">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No categories found</h3>
                                    <p className="text-gray-500 text-sm">Get started by adding your first category</p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[600px]">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">#</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Category Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {categories.map((category, index) => (
                                            <tr key={category._id} className="hover:bg-gray-50 transition-colors duration-150">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                                                        {category.cat_name || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => handleEdit(category)}
                                                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                                                            aria-label={`Edit category ${category._id}`}
                                                            title="Edit category"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => deleteCategory(category._id)}
                                                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 border border-red-200 hover:border-red-300"
                                                            aria-label={`Delete category ${category._id}`}
                                                            title="Delete category"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create Category Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">Add New Category</h2>
                            <button
                                onClick={handleCloseCreateModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                aria-label="Close modal"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="create-category-name" className="block text-sm font-medium text-gray-700 mb-2">
                                        Category Name *
                                    </label>
                                    <input
                                        id="create-category-name"
                                        type="text"
                                        value={newCategoryForm.cat_name}
                                        onChange={(e) => handleNewFieldChange('cat_name', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Enter category name..."
                                        required
                                    />
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="text-red-800 text-sm">{error}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                            <button
                                onClick={handleCloseCreateModal}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 font-medium"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createCategory}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading || !newCategoryForm.cat_name}
                            >
                                {loading ? 'Creating...' : 'Create Category'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Category Modal */}
            {showEditModal && editingCategory && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">Edit Category</h2>
                            <button
                                onClick={handleCloseEditModal}
                                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors duration-200"
                                aria-label="Close modal"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="edit-category-name" className="block text-sm font-medium text-gray-700 mb-2">
                                        Category Name *
                                    </label>
                                    <input
                                        id="edit-category-name"
                                        type="text"
                                        value={editFormData.cat_name}
                                        onChange={(e) => handleEditFieldChange('cat_name', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Enter category name..."
                                        required
                                    />
                                </div>

                                {error && (
                                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                                        <p className="text-red-800 text-sm">{error}</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
                            <button
                                onClick={handleCloseEditModal}
                                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200 font-medium"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={updateCategory}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading || !editFormData.cat_name}
                            >
                                {loading ? 'Updating...' : 'Update Category'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Categories;
