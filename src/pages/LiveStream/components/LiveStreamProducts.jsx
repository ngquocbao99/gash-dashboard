import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Api from '../../../common/SummaryAPI';
import Loading from '../../../components/Loading';
import { useToast } from '../../../hooks/useToast';
import io from 'socket.io-client';

// Normalize socket URL
const getSocketURL = () => {
    const url = import.meta.env.VITE_API_URL || 'http://localhost:5000';
    return url.replace(/\/$/, '');
};
const SOCKET_URL = getSocketURL();

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
    const [showAllProducts, setShowAllProducts] = useState(false);
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
    // Handles multiple data structures from backend
    const getMainImageUrl = (product) => {
        if (!product) return null;

        // Try multiple possible paths for images array
        let images = [];

        // Path 1: productImageIds (most common) - check if it's an array
        if (product.productImageIds) {
            if (Array.isArray(product.productImageIds)) {
                images = product.productImageIds;
            }
            // If it's an object (nested), try to extract array
            else if (typeof product.productImageIds === 'object' && product.productImageIds !== null) {
                if (Array.isArray(product.productImageIds.data)) {
                    images = product.productImageIds.data;
                } else if (Array.isArray(product.productImageIds.images)) {
                    images = product.productImageIds.images;
                }
            }
        }

        // Path 2: images (alternative) - only if we haven't found images yet
        if (images.length === 0 && product.images) {
            if (Array.isArray(product.images)) {
                images = product.images;
            } else if (typeof product.images === 'object' && product.images !== null) {
                if (Array.isArray(product.images.data)) {
                    images = product.images.data;
                }
            }
        }

        // Path 3: Check if product has a populated productId with images
        if (images.length === 0 && product.productId && typeof product.productId === 'object' && product.productId !== null) {
            // Try productImageIds first
            if (Array.isArray(product.productId.productImageIds)) {
                images = product.productId.productImageIds;
            }
            // Try productIdImageIds (alternative field name)
            else if (Array.isArray(product.productId.productIdImageIds)) {
                images = product.productId.productIdImageIds;
            }
            // Try images
            else if (Array.isArray(product.productId.images)) {
                images = product.productId.images;
            }
            // Try nested structure
            else if (product.productId.productImageIds && typeof product.productId.productImageIds === 'object') {
                if (Array.isArray(product.productId.productImageIds.data)) {
                    images = product.productId.productImageIds.data;
                }
            }
            else if (product.productId.productIdImageIds && typeof product.productId.productIdImageIds === 'object') {
                if (Array.isArray(product.productId.productIdImageIds.data)) {
                    images = product.productId.productIdImageIds.data;
                }
            }
        }

        if (images.length === 0) return null;

        // Filter out invalid images (null, undefined, empty strings)
        const validImages = images.filter(img => {
            if (!img || typeof img !== 'object') return false;
            const url = img.imageUrl || img.url;
            return url && typeof url === 'string' && url.trim().length > 0;
        });

        if (validImages.length === 0) return null;

        // Find main image or use first image
        const mainImage = validImages.find(img => {
            const isMain = img.isMain === true || img.isMain === 'true' || img.isMain === 1;
            return isMain;
        });

        const imageUrl = mainImage?.imageUrl || mainImage?.url || validImages[0]?.imageUrl || validImages[0]?.url;

        // Ensure it's a valid URL string
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.trim().length > 0) {
            return imageUrl.trim();
        }

        return null;
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
                // Filter to ensure only active products are shown
                // Backend getActiveLiveProducts already filters isActive: true, but add extra safety check
                const activeProducts = productsArray.filter(product => {
                    // STRICT CHECK: Only show products where isActive === true
                    return product.isActive === true;
                });

                setLiveProducts(activeProducts);
                // Show success toast only when manually refreshed
                if (showSuccessToast && activeProducts.length > 0) {
                    showToast(`Refreshed: ${activeProducts.length} product(s)`, 'success');
                }
            } else if (productsArray.length === 0 && resp && !Array.isArray(resp) && resp.success !== false) {
                // If backend returns empty array or no products, clear the list
                setLiveProducts([]);
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

    // Setup Socket.IO for realtime product updates
    useEffect(() => {
        if (!liveId || !hasLiveId) return;

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
        });

        socket.on('connect', () => {
            socket.emit('joinLivestreamRoom', liveId);
        });

        socket.on('disconnect', () => {
            // Socket will auto-reconnect
        });

        // Listen for product events
        socket.on('product:added', (data) => {
            if (data?.liveId === liveId) {
                loadLiveProducts();
            }
        });

        socket.on('product:removed', (data) => {
            if (data?.liveId === liveId) {
                loadLiveProducts();
            }
        });

        socket.on('product:pinned', (data) => {
            if (data?.liveId === liveId) {
                loadLiveProducts();
            }
        });

        socket.on('product:unpinned', (data) => {
            if (data?.liveId === liveId) {
                loadLiveProducts();
            }
        });

        // Cleanup
        return () => {
            if (socket.connected) {
                socket.emit('leaveLivestreamRoom', liveId);
            }
            socket.off('connect');
            socket.off('disconnect');
            socket.off('product:added');
            socket.off('product:removed');
            socket.off('product:pinned');
            socket.off('product:unpinned');
            socket.close();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [liveId, hasLiveId]);

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
    // Backend allows adding same product multiple times (creates new record each time)
    // Backend checks if product is already active and returns error if so
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

            const response = await Api.livestream.addProduct({ liveId: liveIdStr, productId: productIdStr });

            // Backend returns: { success: true/false, message: string, data?: object }
            if (response?.success === true) {
                const productName = allProducts.find(p => (p?._id || p?.id) === selectedProductId)?.productName || 'Unknown';
                showToast(`Product added successfully`, 'success');
                setSelectedProductId('');
                // Reload products to show the newly added product
                await loadLiveProducts();
            } else {
                // Backend returns error if product is already active
                const errorMsg = response?.message || 'Unable to add product to live';
                setError(errorMsg);
                showToast(errorMsg, 'error');
            }
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
    // Backend finds the ACTIVE product with { liveId, productId, isActive: true }
    // This ensures we remove the correct record even if there are multiple records (from previous add/remove cycles)
    const handleRemoveFromLive = async (liveProduct) => {
        if (!liveProduct) return;
        try {
            setIsSubmitting(true);
            setError('');

            // Backend expects: { liveId, productId } in body
            // Extract productId from liveProduct (can be populated object or string/ObjectId)
            let productId = null;
            if (liveProduct.productId) {
                // If productId is populated object, get _id
                if (typeof liveProduct.productId === 'object' && liveProduct.productId._id) {
                    productId = liveProduct.productId._id;
                }
                // If productId is string/ObjectId
                else if (typeof liveProduct.productId === 'string') {
                    productId = liveProduct.productId;
                }
                // If productId is ObjectId object, convert to string
                else if (liveProduct.productId && typeof liveProduct.productId.toString === 'function') {
                    productId = liveProduct.productId.toString();
                }
            } else if (liveProduct.product?.productId) {
                productId = liveProduct.product.productId;
            }

            if (!productId) {
                setError('Product ID not found');
                showToast('Product ID not found', 'error');
                return;
            }

            // Ensure productId is a string
            if (typeof productId !== 'string') {
                productId = String(productId);
            }

            const productName = getProductName(liveProduct.productId || liveProduct.product || {});

            // Call API to remove product
            // Backend will find the ACTIVE product (isActive: true) and set isActive: false
            const response = await Api.livestream.removeProduct({ liveId, productId });

            // Backend returns: { success: true/false, message: string, data?: object }
            if (response?.success === true) {
                const message = response?.message || 'Product removed successfully';
                showToast(message, 'success');
                // Reload products to reflect the removal (getActiveLiveProducts only returns isActive: true)
                await loadLiveProducts();
            } else {
                // Backend returns error if product not found or not active
                const errorMsg = response?.message || 'Unable to remove product from live';
                setError(errorMsg);
                showToast(errorMsg, 'error');
            }
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
            showToast(`Product pinned successfully`, 'success');
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
            showToast(`Product unpinned successfully`, 'success');
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
        <div className="bg-transparent rounded-lg p-0 flex flex-col h-full">
            {/* Header with stats and refresh */}
            <div className="flex items-center justify-between mb-4 pb-3 pt-2 border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-3">
                    <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Products</h3>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 border border-blue-300 shadow-sm">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                        {liveProducts?.length || 0} Active
                    </span>
                </div>
                <button
                    onClick={() => loadLiveProducts(true)}
                    disabled={isLoading}
                    className="text-xs px-2.5 py-1.5 rounded-md border border-gray-300 bg-gradient-to-r from-white to-gray-50 hover:from-gray-50 hover:to-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md flex items-center gap-1.5"
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
            <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm shrink-0">
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
                            className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white rounded-lg hover:from-emerald-600 hover:to-emerald-800 disabled:bg-gray-300 disabled:cursor-not-allowed font-semibold text-sm shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 whitespace-nowrap transform hover:scale-105 disabled:transform-none"
                            title="Add to livestream"
                        >
                        {isSubmitting ? (
                                <Loading type="inline" size="small" message="" className="mr-1" />
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

            {/* Pinned Products Section - Fixed, no scroll */}
            {!isLoading && liveProducts.some(lp => lp.isPinned === true) && (
                <div className="bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 border border-yellow-300 rounded-lg p-3 mb-4 shrink-0">
                    <div className="flex items-center gap-2 mb-2">
                        <svg className="w-4 h-4 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
                        </svg>
                        <span className="text-yellow-700 text-xs font-bold uppercase tracking-wide">
                            Pinned Products
                        </span>
                    </div>
                    <div className="space-y-2">
                        {liveProducts
                            .filter(lp => lp.isPinned === true)
                            .map((lp, index) => {
                                // Try multiple paths to get product data
                                let product = null;

                                // Path 1: productId is populated object
                                if (lp.productId && typeof lp.productId === 'object' && lp.productId !== null && !Array.isArray(lp.productId)) {
                                    product = lp.productId;
                                }
                                // Path 2: product (alternative field)
                                else if (lp.product && typeof lp.product === 'object' && lp.product !== null) {
                                    product = lp.product;
                                }
                                // Path 3: productId is string, need to find from allProducts
                                else if (lp.productId && typeof lp.productId === 'string') {
                                    product = allProducts.find(p => {
                                        const pId = p?._id || p?.id;
                                        return pId && String(pId) === String(lp.productId);
                                    }) || {};
                                }
                                // Path 4: Fallback to empty object
                                else {
                                    product = {};
                                }

                                const productName = getProductName(product);
                                const productId = product._id || product.id || lp.productId?._id || (typeof lp.productId === 'string' ? lp.productId : '') || '';
                                const uniqueKey = lp._id || `${productId}_${index}` || `product_${index}`;
                                let productImageUrl = getMainImageUrl(product);

                                // Image handling logic (same as below)
                                if (!productImageUrl && lp.productId) {
                                    if (typeof lp.productId === 'object' && lp.productId !== null) {
                                        let directImages = lp.productId.productImageIds;
                                        if (!Array.isArray(directImages) || directImages.length === 0) {
                                            directImages = lp.productId.productIdImageIds;
                                        }
                                        if (Array.isArray(directImages) && directImages.length > 0) {
                                            let validImg = directImages.find(img => {
                                                const isMain = img?.isMain === true || img?.isMain === 'true' || img?.isMain === 1;
                                                if (!isMain) return false;
                                                const url = img?.imageUrl || img?.url;
                                                return url && typeof url === 'string' && url.trim().length > 0;
                                            });
                                            if (!validImg) {
                                                validImg = directImages.find(img => {
                                                    const url = img?.imageUrl || img?.url;
                                                    return url && typeof url === 'string' && url.trim().length > 0;
                                                });
                                            }
                                            if (validImg) {
                                                productImageUrl = validImg.imageUrl || validImg.url;
                                            }
                                        }
                                    }
                                }

                                if (!productImageUrl && lp.productId) {
                                    let searchId = null;
                                    if (typeof lp.productId === 'string') {
                                        searchId = lp.productId;
                                    } else if (typeof lp.productId === 'object' && lp.productId?._id) {
                                        searchId = lp.productId._id;
                                    }
                                    if (searchId) {
                                        const fullProduct = allProducts.find(p => {
                                            const pId = p?._id || p?.id;
                                            return pId && String(pId) === String(searchId);
                                        });
                                        if (fullProduct) {
                                            productImageUrl = getMainImageUrl(fullProduct);
                                        }
                                    }
                                }

                                if (!productImageUrl && lp.productImageIds) {
                                    if (Array.isArray(lp.productImageIds) && lp.productImageIds.length > 0) {
                                        const validImg = lp.productImageIds.find(img => {
                                            if (typeof img === 'string') return img.trim().length > 0;
                                            const url = img?.imageUrl || img?.url;
                                            return url && typeof url === 'string' && url.trim().length > 0;
                                        });
                                        if (validImg) {
                                            productImageUrl = typeof validImg === 'string'
                                                ? validImg
                                                : (validImg.imageUrl || validImg.url);
                                        }
                                    }
                                }

                                return (
                                    <div
                                        key={uniqueKey}
                                        className="group p-3 rounded-lg border transition-all flex items-center gap-3 min-h-[80px] bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md"
                                    >
                                        {/* Product Image */}
                                        <div className="flex-shrink-0 relative">
                                            {productImageUrl ? (
                                                <img
                                                    key={`img-${uniqueKey}-${productImageUrl}`}
                                                    src={productImageUrl}
                                                    alt={productName || 'Product image'}
                                                    className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                                                    loading="lazy"
                                                    onError={(e) => {
                                                        const imgElement = e.target;
                                                        imgElement.style.display = 'none';
                                                        const placeholder = imgElement.nextElementSibling;
                                                        if (placeholder) {
                                                            placeholder.style.display = 'flex';
                                                        }
                                                    }}
                                                    onLoad={(e) => {
                                                        const placeholder = e.target.nextElementSibling;
                                                        if (placeholder) {
                                                            placeholder.style.display = 'none';
                                                        }
                                                    }}
                                                />
                                            ) : null}
                                            <div
                                                className={`w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 items-center justify-center ${productImageUrl ? 'hidden' : 'flex'}`}
                                                style={{ display: productImageUrl ? 'none' : 'flex' }}
                                            >
                                                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                            </div>
                                        </div>

                                        {/* Product Info */}
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-sm font-medium text-gray-900 truncate">{productName}</span>
                                                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-yellow-200 text-yellow-800 border border-yellow-400">
                                                    <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                                                        <path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" />
                                                    </svg>
                                                    PINNED
                                                </span>
                                            </div>
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

                                        {/* Actions */}
                                        <div className="flex items-center gap-1.5 flex-shrink-0">
                                            <button
                                                onClick={() => handleUnpin(lp)}
                                                disabled={isSubmitting}
                                                className="p-1.5 text-yellow-700 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-amber-50 rounded-md disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                                                title="Unpin product"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7l4-4m0 0l4 4m-4-4v18" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleRemoveFromLive(lp)}
                                                disabled={isSubmitting}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-md disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                                                title="Remove product"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                </div>
            )}

            {/* List live products - Compact - Only unpinned products scroll */}
            {isLoading ? (
                <div className="grid gap-2 overflow-y-auto pr-1" style={{ maxHeight: 'calc(5 * 80px)' }}>
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="p-3 rounded-lg border border-gray-200 bg-gray-50 animate-pulse h-16" />
                    ))}
                </div>
            ) : liveProducts.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center">
                    <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p className="text-sm text-gray-600 font-medium">No products in livestream</p>
                    <p className="text-xs text-gray-500 mt-1">Add products using the form above</p>
                </div>
            ) : (
                <div className="overflow-y-auto pr-1" style={{ maxHeight: 'calc(5 * 80px)' }}>
                    <div className="space-y-2">
                        {liveProducts.filter(lp => !lp.isPinned).map((lp, index) => {
                            // Try multiple paths to get product data
                            let product = null;

                            // Path 1: productId is populated object
                            if (lp.productId && typeof lp.productId === 'object' && lp.productId !== null && !Array.isArray(lp.productId)) {
                                product = lp.productId;
                            }
                            // Path 2: product (alternative field)
                            else if (lp.product && typeof lp.product === 'object' && lp.product !== null) {
                                product = lp.product;
                            }
                            // Path 3: productId is string, need to find from allProducts
                            else if (lp.productId && typeof lp.productId === 'string') {
                                product = allProducts.find(p => {
                                    const pId = p?._id || p?.id;
                                    return pId && String(pId) === String(lp.productId);
                                }) || {};
                            }
                            // Path 4: Fallback to empty object
                            else {
                                product = {};
                            }

                            const productName = getProductName(product);
                            // Ensure unique key for each product
                            const productId = product._id || product.id || lp.productId?._id || (typeof lp.productId === 'string' ? lp.productId : '') || '';
                            const uniqueKey = lp._id || `${productId}_${index}` || `product_${index}`;

                            // Try to get image from multiple sources
                            let productImageUrl = getMainImageUrl(product);

                            // If no image found, try direct access to productImageIds in liveProduct.productId
                            if (!productImageUrl && lp.productId) {
                                // Try if productId is an object with productImageIds
                                if (typeof lp.productId === 'object' && lp.productId !== null) {
                                    // Try productImageIds first
                                    let directImages = lp.productId.productImageIds;
                                    // Try productIdImageIds (alternative field name)
                                    if (!Array.isArray(directImages) || directImages.length === 0) {
                                        directImages = lp.productId.productIdImageIds;
                                    }

                                    if (Array.isArray(directImages) && directImages.length > 0) {
                                        // Find main image first
                                        let validImg = directImages.find(img => {
                                            const isMain = img?.isMain === true || img?.isMain === 'true' || img?.isMain === 1;
                                            if (!isMain) return false;
                                            const url = img?.imageUrl || img?.url;
                                            return url && typeof url === 'string' && url.trim().length > 0;
                                        });

                                        // If no main image, use first valid image
                                        if (!validImg) {
                                            validImg = directImages.find(img => {
                                                const url = img?.imageUrl || img?.url;
                                                return url && typeof url === 'string' && url.trim().length > 0;
                                            });
                                        }

                                        if (validImg) {
                                            productImageUrl = validImg.imageUrl || validImg.url;
                                        }
                                    }
                                }
                            }

                            // If no image found, try getting from allProducts if productId is a string
                            if (!productImageUrl && lp.productId) {
                                let searchId = null;
                                if (typeof lp.productId === 'string') {
                                    searchId = lp.productId;
                                } else if (typeof lp.productId === 'object' && lp.productId?._id) {
                                    searchId = lp.productId._id;
                                }

                                if (searchId) {
                                    const fullProduct = allProducts.find(p => {
                                        const pId = p?._id || p?.id;
                                        return pId && String(pId) === String(searchId);
                                    });
                                    if (fullProduct) {
                                        productImageUrl = getMainImageUrl(fullProduct);
                                    }
                                }
                            }

                            // Last resort: try to get image from liveProduct directly (if backend structure is different)
                            if (!productImageUrl && lp.productImageIds) {
                                if (Array.isArray(lp.productImageIds) && lp.productImageIds.length > 0) {
                                    const validImg = lp.productImageIds.find(img => {
                                        if (typeof img === 'string') return img.trim().length > 0;
                                        const url = img?.imageUrl || img?.url;
                                        return url && typeof url === 'string' && url.trim().length > 0;
                                    });
                                    if (validImg) {
                                        productImageUrl = typeof validImg === 'string'
                                            ? validImg
                                            : (validImg.imageUrl || validImg.url);
                                    }
                                }
                            }

                            return (
                                <div
                                    key={uniqueKey}
                                    className={`group p-3 rounded-lg border transition-all flex items-center gap-3 min-h-[80px] ${lp.isPinned
                                        ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md'
                                        : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
                                        }`}
                                >
                                    {/* Product Image */}
                                    <div className="flex-shrink-0 relative">
                                        {productImageUrl ? (
                                            <img
                                                key={`img-${uniqueKey}-${productImageUrl}`}
                                                src={productImageUrl}
                                                alt={productName || 'Product image'}
                                                className="w-12 h-12 object-cover rounded-lg border border-gray-200"
                                                loading="lazy"
                                                onError={(e) => {
                                                    console.warn('❌ Image failed to load:', productImageUrl, 'for product:', productName);
                                                    // Hide the broken image
                                                    const imgElement = e.target;
                                                    imgElement.style.display = 'none';
                                                    // Show placeholder
                                                    const placeholder = imgElement.nextElementSibling;
                                                    if (placeholder) {
                                                        placeholder.style.display = 'flex';
                                                    }
                                                }}
                                                onLoad={(e) => {
                                                    // Ensure placeholder is hidden when image loads successfully
                                                    const placeholder = e.target.nextElementSibling;
                                                    if (placeholder) {
                                                        placeholder.style.display = 'none';
                                                    }
                                                }}
                                            />
                                        ) : null}
                                        <div
                                            className={`w-12 h-12 bg-gray-100 rounded-lg border border-gray-200 items-center justify-center ${productImageUrl ? 'hidden' : 'flex'}`}
                                            style={{ display: productImageUrl ? 'none' : 'flex' }}
                                        >
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
                                                className="p-1.5 text-yellow-700 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-amber-50 rounded-md disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
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
                                                className="p-1.5 text-yellow-600 hover:bg-gradient-to-r hover:from-yellow-50 hover:to-amber-50 rounded-md disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
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
                                            className="p-1.5 text-red-600 hover:bg-gradient-to-r hover:from-red-50 hover:to-rose-50 rounded-md disabled:opacity-50 transition-all duration-200 shadow-sm hover:shadow-md"
                                            title="Remove product from live"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
};

export default LiveStreamProducts;
