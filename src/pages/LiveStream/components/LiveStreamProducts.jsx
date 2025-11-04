import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Api from '../../../common/SummaryAPI';
import { useToast } from '../../../hooks/useToast';

const LiveStreamProducts = ({ liveId }) => {
    const { showToast } = useToast();
    const [liveProducts, setLiveProducts] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [allProducts, setAllProducts] = useState([]);
    const [selectedProductId, setSelectedProductId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);
    const searchTimeoutRef = useRef(null);

    const hasLiveId = useMemo(() => !!liveId, [liveId]);

    // Helper: Extract array from API response
    const extractArray = (resp) => {
        if (!resp) return [];
        if (Array.isArray(resp)) return resp;
        if (Array.isArray(resp?.data)) return resp.data;
        if (Array.isArray(resp?.data?.data)) return resp.data.data;
        return [];
    };

    // Helper: Get product name - ALWAYS returns string, never object
    // Based on backend: productId.productName is String (not object)
    const getProductName = (product) => {
        if (!product) return 'Unnamed';

        // Backend uses productId with productName field (String type)
        const productName = product.productName || product.name || product.title;

        // Ensure it's always a string
        if (typeof productName === 'string') {
            return productName.trim() || 'Unnamed';
        }

        // If productName is an object (shouldn't happen, but safety check)
        if (typeof productName === 'object' && productName !== null) {
            return productName.vi || productName.en || Object.values(productName).find(v => typeof v === 'string') || 'Unnamed';
        }

        return 'Unnamed';
    };

    // Helper: Get main product image URL
    const getMainImageUrl = (product) => {
        if (!product) return null;
        const images = product.productImageIds || product.images || [];
        if (images.length === 0) return null;
        const mainImage = images.find(img => img.isMain === true);
        return mainImage?.imageUrl || images[0]?.imageUrl || null;
    };

    // Helper: Format date/time
    const formatDateTime = (dateString) => {
        if (!dateString) return '';
        try {
            const date = new Date(dateString);
            const day = String(date.getDate()).padStart(2, '0');
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const year = date.getFullYear();
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            return `${day}/${month}/${year} ${hours}:${minutes}`;
        } catch (error) {
            return '';
        }
    };

    // Load live products from API
    const loadLiveProducts = useCallback(async (showSuccessToast = false) => {
        if (!hasLiveId) return;
        try {
            setIsLoading(true);
            setError('');
            const resp = await Api.livestream.getLiveProducts(liveId);

            let productsArray = [];

            // Check standard structure: resp.success && resp.data
            if (resp?.success && Array.isArray(resp?.data)) {
                productsArray = resp.data;
            }
            // Check if data is directly in resp.data
            else if (Array.isArray(resp?.data)) {
                productsArray = resp.data;
            }
            // Check if resp is already an array
            else if (Array.isArray(resp)) {
                productsArray = resp;
            }
            // Check if resp.data.data exists
            else if (Array.isArray(resp?.data?.data)) {
                productsArray = resp.data.data;
            }

            // Only update if we got valid data (don't reset to empty array if no data found)
            if (productsArray.length > 0 || (resp && !Array.isArray(resp) && resp.success !== false)) {
                setLiveProducts(productsArray);
                // Show success toast only when manually refreshed
                if (showSuccessToast && productsArray.length > 0) {
                    showToast(`Refreshed: ${productsArray.length} product(s)`, 'success');
                }
            }
            // If no valid data structure found, keep existing products (don't reset to empty)
        } catch (e) {
            const errorMsg = e?.response?.data?.message || e?.message || 'Unable to load live products';
            setError(errorMsg);
            showToast(errorMsg, 'error');
            console.error('loadLiveProducts error:', e);
            // Don't reset products on error - keep existing state
        } finally {
            setIsLoading(false);
        }
    }, [hasLiveId, liveId, showToast]);

    useEffect(() => {
        loadLiveProducts();
    }, [loadLiveProducts]);

    // Load all products for dropdown
    const loadAllProducts = useCallback(async () => {
        try {
            setIsLoading(true);
            setError('');
            const resp = await Api.newProducts.getAll({ status: 'active' });
            const products = extractArray(resp);
            setAllProducts(products);
            // Show success toast if products loaded (only if not silent operation)
            if (products.length > 0) {
                // Silent success for initial load, only show if explicitly needed
            }
        } catch (e) {
            const errorMsg = e?.response?.data?.message || e?.message || 'Unable to load products';
            setError(errorMsg);
            showToast(errorMsg, 'error');
            console.error('loadAllProducts error:', e);
        } finally {
            setIsLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        loadAllProducts();
    }, [loadAllProducts]);

    // Real-time search with debounce
    const handleSearchProducts = useCallback(async (query) => {
        try {
            setIsSubmitting(true);
            setError('');
            if (!query || !query.trim()) {
                await loadAllProducts();
                return;
            }
            // Backend expects 'name' parameter, not 'q', and 'status' to filter only active products
            const resp = await Api.newProducts.search({ name: query.trim(), status: 'active' });
            const products = extractArray(resp);
            setAllProducts(products);
            // Auto-open dropdown when search results are loaded
            if (products && products.length > 0) {
                setIsDropdownOpen(true);
                showToast(`Found ${products.length} product(s)`, 'success');
            } else {
                showToast('No products found', 'info');
            }
        } catch (e) {
            const errorMsg = e?.response?.data?.message || e?.message || 'Unable to search products';
            setError(errorMsg);
            showToast(errorMsg, 'error');
            console.error('searchProducts error:', e);
        } finally {
            setIsSubmitting(false);
        }
    }, [loadAllProducts, showToast]);

    // Handle search input change with debounce
    const handleSearchChange = useCallback((value) => {
        setSearchQuery(value);
        if (searchTimeoutRef.current) {
            clearTimeout(searchTimeoutRef.current);
        }
        searchTimeoutRef.current = setTimeout(() => {
            handleSearchProducts(value);
        }, 500); // 500ms debounce
    }, [handleSearchProducts]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (searchTimeoutRef.current) {
                clearTimeout(searchTimeoutRef.current);
            }
        };
    }, []);

    // Add product to live
    const handleAddToLive = async () => {
        if (!hasLiveId || !selectedProductId) return;
        try {
            setIsSubmitting(true);
            setError('');
            const liveIdStr = String(liveId);
            const productIdStr = String(selectedProductId);
            const isObjectId = (v) => /^[a-fA-F0-9]{24}$/.test(v);
            if (!isObjectId(liveIdStr) || !isObjectId(productIdStr)) {
                setError('Invalid liveId or productId');
                showToast('Invalid product ID', 'error');
                return;
            }
            const productName = allProducts.find(p => (p?._id || p?.id) === selectedProductId)?.productName || 'Unknown';
            await Api.livestream.addProduct({ liveId: liveIdStr, productId: productIdStr });
            showToast(`Product added successfully!`, 'success');
            setSelectedProductId('');
            await loadLiveProducts();
        } catch (e) {
            const apiMsg = e?.response?.data?.message || e?.message || 'Unable to add product to live';
            setError(apiMsg);
            showToast(apiMsg, 'error');
            console.error('addProduct error:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Remove product from live
    const handleRemoveFromLive = async (liveProduct) => {
        if (!liveProduct) return;
        try {
            setIsSubmitting(true);
            setError('');
            // Backend expects: { liveId, productId } in body
            const productId = liveProduct.productId?._id || liveProduct.productId || liveProduct.product?.productId;
            if (!productId) {
                setError('Product ID not found');
                showToast('Product ID not found', 'error');
                return;
            }
            const productName = getProductName(liveProduct.productId || liveProduct.product || {});
            await Api.livestream.removeProduct({ liveId, productId });
            showToast(`Product removed successfully!`, 'success');
            await loadLiveProducts();
        } catch (e) {
            const apiMsg = e?.response?.data?.message || e?.message || 'Unable to remove product from live';
            setError(apiMsg);
            showToast(apiMsg, 'error');
            console.error('removeProduct error:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Pin product
    const handlePin = async (liveProduct) => {
        if (!liveProduct?._id) return;
        try {
            setIsSubmitting(true);
            setError('');
            await Api.livestream.pinProduct(liveProduct._id, { liveId });
            const productName = getProductName(liveProduct.productId || liveProduct.product || {});
            showToast(`Product pinned successfully!`, 'success');
            await loadLiveProducts();
        } catch (e) {
            const apiMsg = e?.response?.data?.message || e?.message || 'Unable to pin product';
            setError(apiMsg);
            showToast(apiMsg, 'error');
            console.error('pinProduct error:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Unpin product
    const handleUnpin = async (liveProduct) => {
        if (!liveProduct?._id) return;
        try {
            setIsSubmitting(true);
            setError('');
            await Api.livestream.unpinProduct(liveProduct._id, { liveId });
            const productName = getProductName(liveProduct.productId || liveProduct.product || {});
            showToast(`Product unpinned successfully!`, 'success');
            await loadLiveProducts();
        } catch (e) {
            const apiMsg = e?.response?.data?.message || e?.message || 'Unable to unpin product';
            setError(apiMsg);
            showToast(apiMsg, 'error');
            console.error('unpinProduct error:', e);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-transparent rounded-lg p-0">
            {/* Header with stats and refresh */}
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Products</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        {liveProducts?.length || 0} Active
                    </span>
                </div>
                <button
                    onClick={() => loadLiveProducts(true)}
                    disabled={isLoading}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                    aria-label="Refresh live products"
                    title="Refresh"
                >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                </button>
            </div>

            {/* Add product section - Compact */}
            <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="space-y-3">
                    {/* Search input - inline */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search products..."
                            value={searchQuery}
                            onChange={(e) => handleSearchChange(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 pl-9 pr-8 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            disabled={isSubmitting}
                        />
                        <svg className="absolute left-2.5 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery('');
                                    handleSearchChange('');
                                }}
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                                disabled={isSubmitting}
                                title="Clear search"
                            >
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        )}
                        {searchQuery && (
                            <p className="mt-1 text-xs text-gray-500">{allProducts.length} result{allProducts.length !== 1 ? 's' : ''}</p>
                        )
                        }
                    </div>

                    {/* Product selector and add button - Row layout */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 relative" ref={dropdownRef}>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Product</label>
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                disabled={!hasLiveId || isSubmitting || allProducts.length === 0}
                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-left focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[38px] hover:border-gray-400 transition-colors text-sm"
                            >
                                {selectedProductId ? (
                                    (() => {
                                        const selected = allProducts.find(p => (p?._id || p?.id) === selectedProductId);
                                        const imageUrl = selected ? getMainImageUrl(selected) : null;
                                        const name = selected ? getProductName(selected) : 'Select a product';
                                        return (
                                            <>
                                                {imageUrl && (
                                                    <img src={imageUrl} alt={name} className="w-7 h-7 object-cover rounded border border-gray-200 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                                )}
                                                <span className="flex-1 truncate text-gray-900 text-sm">{name}</span>
                                            </>
                                        );
                                    })()
                                ) : (
                                    <span className="text-gray-500 text-sm">Select a product</span>
                                )}
                                <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {isDropdownOpen && allProducts.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                    {allProducts.map((p) => {
                                        const id = p?._id || p?.id;
                                        const name = getProductName(p);
                                        const imageUrl = getMainImageUrl(p);
                                        const isSelected = selectedProductId === id;
                                        return (
                                            <button
                                                key={id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedProductId(id);
                                                    setIsDropdownOpen(false);
                                                }}
                                                className={`w-full px-3 py-2 flex items-center gap-2.5 hover:bg-blue-50 transition-colors text-sm ${isSelected ? 'bg-blue-50 border-l-2 border-blue-600' : ''}`}
                                            >
                                                {imageUrl ? (
                                                    <img src={imageUrl} alt={name} className="w-8 h-8 object-cover rounded border border-gray-200 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                                ) : (
                                                    <div className="w-8 h-8 bg-gray-100 rounded border border-gray-200 flex items-center justify-center flex-shrink-0">
                                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <span className="flex-1 text-left text-sm font-medium text-gray-900 truncate">{name}</span>
                                                {isSelected && (
                                                    <svg className="w-4 h-4 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                    </svg>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={handleAddToLive}
                            disabled={!selectedProductId || isSubmitting}
                            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-sm shadow-sm hover:shadow-md transition-all flex items-center gap-1.5 whitespace-nowrap"
                            title="Add to livestream"
                        >
                            {isSubmitting ? (
                                <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-white border-t-transparent"></div>
                            ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                            )}
                            Add
                        </button>
                    </div>
                </div>
            </div>

            {/* List live products - Compact */}
            <div className="space-y-2">
                {isLoading ? (
                    <div className="grid gap-2">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="p-3 rounded-lg border border-gray-200 bg-gray-50 animate-pulse h-16" />
                        ))}
                    </div>
                ) : liveProducts.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
                        <svg className="w-10 h-10 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p className="text-sm text-gray-600 font-medium">No products in livestream</p>
                        <p className="text-xs text-gray-500 mt-1">Add products using the form above</p>
                    </div>
                ) : (
                    liveProducts.map((lp) => {
                        const product = lp.productId || lp.product || {};
                        const productName = getProductName(product);
                        const productId = product._id || lp.productId?._id || lp.productId || '';
                        const productImageUrl = getMainImageUrl(product);

                        return (
                            <div
                                key={lp._id || productId}
                                className={`group p-3 rounded-lg border transition-all flex items-center gap-3 ${lp.isPinned
                                    ? 'bg-yellow-50 border-yellow-300 shadow-sm'
                                    : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
                                    }`}
                            >
                                {/* Product Image */}
                                <div className="flex-shrink-0">
                                    {productImageUrl ? (
                                        <img
                                            src={productImageUrl}
                                            alt={productName}
                                            className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                                e.target.nextSibling.style.display = 'flex';
                                            }}
                                        />
                                    ) : null}
                                    <div className={`w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 items-center justify-center ${productImageUrl ? 'hidden' : 'flex'}`}>
                                        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                </div>

                                {/* Product Info */}
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-gray-900 truncate">{productName}</span>
                                        {lp.isPinned && (
                                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-200 text-yellow-800 border border-yellow-400">
                                                <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                                    <path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
                                                </svg>
                                                PINNED
                                            </span>
                                        )}
                                    </div>
                                    {/* AddBy and time info */}
                                    {lp.addedAt && (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-500">
                                            {lp.addBy && (
                                                <>
                                                    <span>by {lp.addBy.name || lp.addBy.username || 'Unknown'}</span>
                                                    <span>•</span>
                                                </>
                                            )}
                                            <span>{formatDateTime(lp.addedAt)}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Actions - Compact */}
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                    {lp.isPinned ? (
                                        <button
                                            onClick={() => handleUnpin(lp)}
                                            disabled={isSubmitting}
                                            className="p-1.5 text-yellow-700 hover:bg-yellow-100 rounded-md disabled:opacity-50 transition-colors"
                                            title="Unpin product"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" />
                                            </svg>
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => handlePin(lp)}
                                            disabled={isSubmitting}
                                            className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-md disabled:opacity-50 transition-colors"
                                            title="Pin product"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                                            </svg>
                                        </button>
                                    )}
                                    <button
                                        onClick={() => handleRemoveFromLive(lp)}
                                        disabled={isSubmitting}
                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 transition-colors"
                                        title="Remove product from live"
                                    >
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default LiveStreamProducts;
