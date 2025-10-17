import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import { ToastContext } from '../../context/ToastContext';
import '../../styles/ProductSpecifications.css';
import Api from '../../common/SummaryAPI';

const Sizes = () => {
    const { user, isAuthLoading } = useContext(AuthContext);
    const { showToast } = useContext(ToastContext);
    const [sizes, setSizes] = useState([]);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingSize, setEditingSize] = useState(null);
    const [newSizeForm, setNewSizeForm] = useState({ content: '' });
    const [editFormData, setEditFormData] = useState({ content: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    // Fetch sizes
    const fetchSizes = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const response = await Api.sizes.getAll();
            setSizes(Array.isArray(response) ? response : []);
        } catch (err) {
            setError(err.message || 'Failed to load sizes');
            console.error('Fetch sizes error:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    // Create size
    const createSize = useCallback(async () => {
        setLoading(true);
        setError('');

        if (!newSizeForm.content) {
            setError('Size name is required');
            setLoading(false);
            return;
        }

        try {
            const payload = { size_name: newSizeForm.content };
            const response = await Api.sizes.create(payload);
            setSizes(prev => [...prev, response]);
            showToast('Size created successfully', 'success');
            setNewSizeForm({ content: '' });
            setShowCreateModal(false);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create size');
            showToast(err.response?.data?.message || 'Failed to create size', 'error');
            console.error('Create size error:', err);
        } finally {
            setLoading(false);
        }
    }, [newSizeForm, showToast]);

    // Update size
    const updateSize = useCallback(async () => {
        if (!editingSize) return;

        setLoading(true);
        setError('');

        if (!editFormData.content) {
            setError('Size name is required');
            setLoading(false);
            return;
        }

        try {
            const payload = { size_name: editFormData.content };
            const response = await Api.sizes.update(editingSize._id, payload);
            setSizes(prev => prev.map(item => item._id === editingSize._id ? response : item));
            showToast('Size updated successfully', 'success');
            setShowEditModal(false);
            setEditingSize(null);
            setEditFormData({ content: '' });
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to update size');
            showToast(err.response?.data?.message || err.message || 'Failed to update size', 'error');
            console.error('Update size error:', err);
        } finally {
            setLoading(false);
        }
    }, [editingSize, editFormData, showToast]);

    // Delete size
    const deleteSize = useCallback(async (id) => {
        if (!window.confirm('Are you sure you want to delete this size?')) return;

        setLoading(true);
        setError('');

        try {
            await Api.sizes.delete(id);
            setSizes(prev => prev.filter(item => item._id !== id));
            showToast('Size deleted successfully', 'success');
            if (editingSize && editingSize._id === id) {
                setEditingSize(null);
                setShowEditModal(false);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete size');
            showToast(err.response?.data?.message || 'Failed to delete size', 'error');
            console.error('Delete size error:', err);
        } finally {
            setLoading(false);
        }
    }, [editingSize, showToast]);

    // Handle authentication state
    useEffect(() => {
        if (isAuthLoading) return;
        if (!user && !localStorage.getItem('token')) {
            navigate('/login', { replace: true });
        } else if (user) {
            fetchSizes();
        }
    }, [user, isAuthLoading, navigate, fetchSizes]);

    // Start editing
    const handleEdit = useCallback((size) => {
        setEditingSize(size);
        setEditFormData({
            content: size.size_name || '',
        });
        setShowEditModal(true);
    }, []);

    // Handle field change for edit form
    const handleEditFieldChange = useCallback((field, value) => {
        setEditFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Handle field change for new form
    const handleNewFieldChange = useCallback((field, value) => {
        setNewSizeForm(prev => ({ ...prev, [field]: value }));
    }, []);

    // Close create modal
    const handleCloseCreateModal = useCallback(() => {
        setShowCreateModal(false);
        setNewSizeForm({ content: '' });
        setError('');
    }, []);

    // Close edit modal
    const handleCloseEditModal = useCallback(() => {
        setShowEditModal(false);
        setEditingSize(null);
        setEditFormData({ content: '' });
        setError('');
    }, []);

    // Retry fetching data
    const handleRetry = useCallback(() => {
        fetchSizes();
    }, [fetchSizes]);

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
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Sizes Management</h1>
                        <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage product sizes</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 flex-shrink-0">
                        <div className="bg-gray-50 px-2 lg:px-4 py-1 lg:py-2 rounded-lg border border-gray-200">
                            <span className="text-xs lg:text-sm font-medium text-gray-700">
                                {sizes.length} size{sizes.length !== 1 ? 's' : ''}
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
                            aria-label="Retry loading sizes"
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
                        <p className="text-gray-600 font-medium">Loading sizes...</p>
                    </div>
                </div>
            )}

            {/* Sizes Section */}
            {!loading && (
                <div className="space-y-4 lg:space-y-6">
                    {/* Add Size Button */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-semibold text-gray-900">Sizes Management</h2>
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-sm font-medium"
                                aria-label="Add new size"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Add Size</span>
                            </button>
                        </div>
                    </div>

                    {/* Sizes Table */}
                    {sizes.length === 0 ? (
                        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8" role="status">
                            <div className="flex flex-col items-center justify-center space-y-4">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
                                    <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z" />
                                    </svg>
                                </div>
                                <div className="text-center">
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No sizes found</h3>
                                    <p className="text-gray-500 text-sm">Get started by adding your first size</p>
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
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Size Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {sizes.map((size, index) => (
                                            <tr key={size._id} className="hover:bg-gray-50 transition-colors duration-150">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                                                    {index + 1}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span className="text-sm font-medium text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">
                                                        {size.size_name || 'N/A'}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                                    <div className="flex items-center space-x-2">
                                                        <button
                                                            onClick={() => handleEdit(size)}
                                                            className="p-1.5 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-all duration-200 border border-blue-200 hover:border-blue-300"
                                                            aria-label={`Edit size ${size._id}`}
                                                            title="Edit size"
                                                        >
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                            </svg>
                                                        </button>
                                                        <button
                                                            onClick={() => deleteSize(size._id)}
                                                            className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-100 rounded-lg transition-all duration-200 border border-red-200 hover:border-red-300"
                                                            aria-label={`Delete size ${size._id}`}
                                                            title="Delete size"
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

            {/* Create Size Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">Add New Size</h2>
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
                                    <label htmlFor="create-size-name" className="block text-sm font-medium text-gray-700 mb-2">
                                        Size Name *
                                    </label>
                                    <input
                                        id="create-size-name"
                                        type="text"
                                        value={newSizeForm.content}
                                        onChange={(e) => handleNewFieldChange('content', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Enter size name..."
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
                                onClick={createSize}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading || !newSizeForm.content}
                            >
                                {loading ? 'Creating...' : 'Create Size'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Size Modal */}
            {showEditModal && editingSize && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-900">Edit Size</h2>
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
                                    <label htmlFor="edit-size-name" className="block text-sm font-medium text-gray-700 mb-2">
                                        Size Name *
                                    </label>
                                    <input
                                        id="edit-size-name"
                                        type="text"
                                        value={editFormData.content}
                                        onChange={(e) => handleEditFieldChange('content', e.target.value)}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                                        placeholder="Enter size name..."
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
                                onClick={updateSize}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={loading || !editFormData.content}
                            >
                                {loading ? 'Updating...' : 'Update Size'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Sizes;
