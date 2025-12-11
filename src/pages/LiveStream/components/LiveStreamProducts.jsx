import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import Api from '../../../common/SummaryAPI';
import Loading from '../../../components/Loading';
import { useToast } from '../../../hooks/useToast';
import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

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

    // Filter to show only active products in dropdown
    const activeProducts = useMemo(() => {
        return allProducts.filter(p => {
            const status = p?.productStatus || p?.status;
            return status === 'active';
        });
    }, [allProducts]);

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

    // Helper: Get main product image URL - Always prioritize isMain=true
    const getMainImageUrl = (product) => {
        if (!product) return null;

        // Try to get images from multiple possible locations
        let images = [];

        // 1. Check productImageIds (most common from populated data)
        if (product.productImageIds && Array.isArray(product.productImageIds)) {
            images = product.productImageIds;
        }
        // 2. Check images array (alternative structure)
        else if (product.images && Array.isArray(product.images)) {
            images = product.images;
        }
        // 3. Check if product has a nested product object with images
        else if (product.product?.productImageIds && Array.isArray(product.product.productImageIds)) {
            images = product.product.productImageIds;
        }
        else if (product.product?.images && Array.isArray(product.product.images)) {
            images = product.product.images;
        }

        if (images.length > 0) {
            // PRIORITY 1: Find image with isMain === true (strict check)
            const mainImage = images.find(img => img && img.isMain === true && img.imageUrl);
            if (mainImage?.imageUrl) {
                return mainImage.imageUrl;
            }

            // PRIORITY 2: If no main image, use first image with valid imageUrl
            const firstImage = images.find(img => img && img.imageUrl);
            if (firstImage?.imageUrl) {
                return firstImage.imageUrl;
            }
        }

        // PRIORITY 3: Check if there's a direct image URL (from WebSocket/realtime data)
        if (product.image && typeof product.image === 'string') {
            return product.image;
        }

        // PRIORITY 4: Try to get image from product variants (variantImage)
        if (product.productVariantIds && Array.isArray(product.productVariantIds)) {
            for (const variant of product.productVariantIds) {
                if (variant?.variantImage && typeof variant.variantImage === 'string') {
                    return variant.variantImage;
                }
            }
        }

        // PRIORITY 5: Check nested product.product for variants
        if (product.product?.productVariantIds && Array.isArray(product.product.productVariantIds)) {
            for (const variant of product.product.productVariantIds) {
                if (variant?.variantImage && typeof variant.variantImage === 'string') {
                    return variant.variantImage;
                }
            }
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
                const activeProducts = productsArray
                    .filter(product => {
                        // STRICT CHECK: Only show products where isActive === true
                        return product.isActive === true;
                    })
                    .map(product => ({
                        ...product,
                        // Ensure isPinned is always a boolean
                        isPinned: Boolean(product.isPinned === true || product.isPinned === 'true' || product.isPinned === 1)
                    }))
                    .sort((a, b) => {
                        // Pinned products first
                        if (a.isPinned !== b.isPinned) {
                            return b.isPinned - a.isPinned; // true (1) comes before false (0)
                        }
                        // Then sort by addedAt (newest first)
                        const aDate = a.addedAt ? new Date(a.addedAt) : new Date(0);
                        const bDate = b.addedAt ? new Date(b.addedAt) : new Date(0);
                        return bDate - aDate;
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

    // Realtime socket handlers
    const handleProductAdded = useCallback((data) => {
        const dataLiveId = data?.liveId?.toString?.() || data?.liveId;
        const currentLiveId = liveId?.toString?.() || liveId;

        if (dataLiveId === currentLiveId && data?.liveProduct) {
            const hasImages = (data.liveProduct.productId?.productImageIds?.length > 0) ||
                (data.liveProduct.product?.image);

            // If socket data doesn't have images, try to merge from allProducts (which has full data)
            let productToAdd = data.liveProduct;

            if (!hasImages) {
                // Find the product in allProducts by productId
                const productIdToFind = data.liveProduct.productId?._id || data.liveProduct.productId;
                const fullProductData = allProducts.find(p =>
                    (p._id?.toString?.() || p._id) === (productIdToFind?.toString?.() || productIdToFind)
                );

                if (fullProductData) {
                    // Create NEW object with merged data (don't mutate!)
                    productToAdd = {
                        ...data.liveProduct,
                        productId: {
                            _id: fullProductData._id,
                            productName: fullProductData.productName,
                            productImageIds: fullProductData.productImageIds || fullProductData.images || [],
                            ...fullProductData
                        }
                    };
                } else {
                    // Fallback: reload from API to get full data
                    loadLiveProducts();
                    return;
                }
            }

            setLiveProducts(prev => {
                // Check if product already exists
                const exists = prev.some(p =>
                    (p._id?.toString?.() || p._id) === (productToAdd._id?.toString?.() || productToAdd._id)
                );
                if (exists) return prev;

                // Ensure isPinned is boolean
                const newProduct = {
                    ...productToAdd,
                    isPinned: Boolean(productToAdd.isPinned),
                    isActive: true
                };
                const updated = [...prev, newProduct].sort((a, b) => {
                    // Pinned products first
                    if (a.isPinned !== b.isPinned) {
                        return b.isPinned - a.isPinned; // true (1) comes before false (0)
                    }
                    // Then sort by addedAt (newest first)
                    const aDate = a.addedAt ? new Date(a.addedAt) : new Date(0);
                    const bDate = b.addedAt ? new Date(b.addedAt) : new Date(0);
                    return bDate - aDate;
                });
                return updated;
            });
        }
    }, [liveId, loadLiveProducts, allProducts]);

    const handleProductRemoved = useCallback((data) => {
        const dataLiveId = data?.liveId?.toString?.() || data?.liveId;
        const currentLiveId = liveId?.toString?.() || liveId;

        if (dataLiveId === currentLiveId) {
            setLiveProducts(prev => {
                if (data?.liveProductId) {
                    const productIdStr = data.liveProductId?.toString?.() || data.liveProductId;
                    return prev.filter(p => {
                        const pId = p._id?.toString?.() || p._id;
                        return pId !== productIdStr;
                    });
                } else if (data?.productId) {
                    const productIdStr = data.productId?.toString?.() || data.productId;
                    return prev.filter(p => {
                        const pProductId = p.productId?._id?.toString?.() || p.productId?._id || p.productId;
                        return pProductId !== productIdStr;
                    });
                }
                return prev;
            });
        }
    }, [liveId]);

    const handleProductPinned = useCallback((data) => {
        const dataLiveId = data?.liveId?.toString?.() || data?.liveId;
        const currentLiveId = liveId?.toString?.() || liveId;

        if (dataLiveId === currentLiveId && data?.liveProduct) {
            setLiveProducts(prev => {
                const productId = data.liveProduct._id?.toString?.() || data.liveProduct._id;
                const updated = prev.map(p => {
                    const pId = p._id?.toString?.() || p._id;
                    if (pId === productId) {
                        return { ...p, isPinned: true };
                    }
                    return p;
                });
                // Sort: pinned products first, then by addedAt (newest first)
                return updated.sort((a, b) => {
                    if (a.isPinned !== b.isPinned) {
                        return b.isPinned - a.isPinned; // true (1) comes before false (0)
                    }
                    const aDate = a.addedAt ? new Date(a.addedAt) : new Date(0);
                    const bDate = b.addedAt ? new Date(b.addedAt) : new Date(0);
                    return bDate - aDate;
                });
            });
        }
    }, [liveId]);

    const handleProductUnpinned = useCallback((data) => {
        const dataLiveId = data?.liveId?.toString?.() || data?.liveId;
        const currentLiveId = liveId?.toString?.() || liveId;

        if (dataLiveId === currentLiveId) {
            setLiveProducts(prev => {
                let updated = prev;
                if (data?.liveProductId) {
                    const productIdStr = data.liveProductId?.toString?.() || data.liveProductId;
                    updated = prev.map(p => {
                        const pId = p._id?.toString?.() || p._id;
                        if (pId === productIdStr) {
                            return { ...p, isPinned: false };
                        }
                        return p;
                    });
                } else if (data?.productId) {
                    const productIdStr = data.productId?.toString?.() || data.productId;
                    updated = prev.map(p => {
                        const pProductId = p.productId?._id?.toString?.() || p.productId?._id || p.productId;
                        if (pProductId === productIdStr) {
                            return { ...p, isPinned: false };
                        }
                        return p;
                    });
                }
                // Sort: pinned products first, then by addedAt (newest first)
                return updated.sort((a, b) => {
                    if (a.isPinned !== b.isPinned) {
                        return b.isPinned - a.isPinned; // true (1) comes before false (0)
                    }
                    const aDate = a.addedAt ? new Date(a.addedAt) : new Date(0);
                    const bDate = b.addedAt ? new Date(b.addedAt) : new Date(0);
                    return bDate - aDate;
                });
            });
        }
    }, [liveId]);

    // Setup Socket.IO for realtime updates
    useEffect(() => {
        if (!liveId) return;

        // Ensure liveId is a string (handle ObjectId objects)
        const liveIdStr = typeof liveId === 'string' ? liveId : (liveId?.toString?.() || String(liveId));

        const socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling'],
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000,
            forceNew: false,
            autoConnect: true,
        });

        let isJoined = false;

        const joinRoom = () => {
            if (socket.connected && !isJoined) {
                isJoined = true;
                socket.emit('joinLivestreamRoom', liveIdStr);
            }
        };

        socket.on('connect', () => {
            joinRoom();
        });

        socket.on('disconnect', () => {
            isJoined = false;
        });

        socket.on('connect_error', () => {
            isJoined = false;
        });

        socket.on('reconnect', () => {
            isJoined = false;
            joinRoom();
        });

        // Setup event listeners
        socket.on('product:added', (data) => {
            handleProductAdded(data);
        });

        socket.on('product:removed', (data) => {
            handleProductRemoved(data);
        });

        socket.on('product:pinned', (data) => {
            handleProductPinned(data);
        });

        socket.on('product:unpinned', (data) => {
            handleProductUnpinned(data);
        });

        // Join room immediately if already connected
        if (socket.connected) {
            joinRoom();
        }

        return () => {
            if (socket.connected && isJoined) {
                socket.emit('leaveLivestreamRoom', liveIdStr);
            }
            socket.off('connect');
            socket.off('disconnect');
            socket.off('connect_error');
            socket.off('reconnect');
            socket.off('product:added');
            socket.off('product:removed');
            socket.off('product:pinned');
            socket.off('product:unpinned');
            socket.close();
        };
    }, [liveId, handleProductAdded, handleProductRemoved, handleProductPinned, handleProductUnpinned]);

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
                const productName = activeProducts.find(p => (p?._id || p?.id) === selectedProductId)?.productName || 'Unknown';
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
        if (!liveProduct?._id) {
            showToast('Product ID is missing', 'error');
            return;
        }
        if (!liveId) {
            showToast('Live ID is missing', 'error');
            return;
        }
        try {
            setIsSubmitting(true);
            setError('');
            // Ensure liveProductId is a string (handle ObjectId objects)
            const liveProductId = typeof liveProduct._id === 'string'
                ? liveProduct._id
                : (liveProduct._id?.toString?.() || String(liveProduct._id));
            // Ensure liveId is a string
            const liveIdStr = typeof liveId === 'string'
                ? liveId
                : (liveId?.toString?.() || String(liveId));

            // Validate ObjectId format
            const isObjectId = (v) => /^[a-fA-F0-9]{24}$/.test(v);
            if (!isObjectId(liveProductId) || !isObjectId(liveIdStr)) {
                setError('Invalid product ID or live ID format');
                showToast('Invalid product ID or live ID format', 'error');
                return;
            }

            await Api.livestream.pinProduct(liveProductId, { liveId: liveIdStr });
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
        if (!liveProduct?._id) {
            showToast('Product ID is missing', 'error');
            return;
        }
        if (!liveId) {
            showToast('Live ID is missing', 'error');
            return;
        }
        try {
            setIsSubmitting(true);
            setError('');
            // Ensure liveProductId is a string (handle ObjectId objects)
            const liveProductId = typeof liveProduct._id === 'string'
                ? liveProduct._id
                : (liveProduct._id?.toString?.() || String(liveProduct._id));
            // Ensure liveId is a string
            const liveIdStr = typeof liveId === 'string'
                ? liveId
                : (liveId?.toString?.() || String(liveId));

            // Validate ObjectId format
            const isObjectId = (v) => /^[a-fA-F0-9]{24}$/.test(v);
            if (!isObjectId(liveProductId) || !isObjectId(liveIdStr)) {
                setError('Invalid product ID or live ID format');
                showToast('Invalid product ID or live ID format', 'error');
                return;
            }

            await Api.livestream.unpinProduct(liveProductId, { liveId: liveIdStr });
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
            <div className="flex items-center justify-between mb-4 pb-3 pt-2 border-b border-gray-200 flex-shrink-0">
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
            <div className="mb-3 p-3 bg-white rounded-lg border border-gray-200 shadow-sm flex-shrink-0">
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
                            <p className="mt-1 text-xs text-gray-500">
                                {activeProducts.length} active result{activeProducts.length !== 1 ? 's' : ''}
                            </p>
                        )
                        }
                    </div>

                    {/* Product selector and add button - Row layout */}
                    <div className="flex gap-2 items-end">
                        <div className="flex-1 min-w-0 relative" ref={dropdownRef}>
                            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Select Product</label>
                            <button
                                type="button"
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                disabled={!hasLiveId || isSubmitting || activeProducts.length === 0}
                                className="w-full bg-white border border-gray-300 rounded-lg px-3 py-2 text-left focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-h-[38px] hover:border-gray-400 transition-colors text-sm"
                            >
                                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-hidden">
                                    {selectedProductId ? (
                                        (() => {
                                            const selected = activeProducts.find(p => (p?._id || p?.id) === selectedProductId);
                                            const imageUrl = selected ? getMainImageUrl(selected) : null;
                                            const name = selected ? getProductName(selected) : 'Select a product';
                                            return (
                                                <>
                                                    {imageUrl && (
                                                        <img src={imageUrl} alt={name} className="w-7 h-7 object-cover rounded border border-gray-200 flex-shrink-0" onError={(e) => { e.target.style.display = 'none'; }} />
                                                    )}
                                                    <span className="flex-1 truncate text-gray-900 text-sm min-w-0" title={name}>{name}</span>
                                                </>
                                            );
                                        })()
                                    ) : (
                                        <span className="text-gray-500 text-sm truncate">Select a product</span>
                                    )}
                                </div>
                                <svg className={`w-4 h-4 text-gray-400 transition-transform flex-shrink-0 ${isDropdownOpen ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                </svg>
                            </button>
                            {isDropdownOpen && activeProducts.length > 0 && (
                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                                    {activeProducts.map((p) => {
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
                                                <span className="flex-1 text-left text-sm font-medium text-gray-900 truncate" title={name}>{name}</span>
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

            {/* List live products - Compact */}
            <div className="flex-1 min-h-0 flex flex-col">
                {isLoading ? (
                    <div className="grid gap-2 flex-1">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="p-3 rounded-lg border border-gray-200 bg-gray-50 animate-pulse h-16" />
                        ))}
                    </div>
                ) : liveProducts.length === 0 ? (
                    <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300 flex-1 flex flex-col items-center justify-center">
                        <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <p className="text-sm text-gray-600 font-medium">No products in livestream</p>
                        <p className="text-xs text-gray-500 mt-1">Add products using the form above</p>
                    </div>
                ) : (
                    <>
                        {liveProducts.length > 20 && (
                            <div className="flex justify-end mb-2 flex-shrink-0">
                                <button
                                    onClick={() => setShowAllProducts(!showAllProducts)}
                                    className="text-xs font-medium text-blue-600 hover:text-blue-700 transition-colors"
                                >
                                    {showAllProducts ? 'Show Less' : `View All (${liveProducts.length})`}
                                </button>
                            </div>
                        )}
                        <div className={`flex-1 overflow-y-auto space-y-2 pr-1 ${showAllProducts ? '' : ''}`}>
                            {(showAllProducts ? liveProducts : liveProducts.slice(0, 20)).map((lp) => {
                                // Handle both populated and unpopulated productId
                                let product = (typeof lp.productId === 'object' ? lp.productId : null) || lp.product || {};
                                const productId = product._id || lp.productId?._id || lp.productId || '';

                                // CRITICAL FIX: If productId is just a string (not populated), find in allProducts
                                if (typeof lp.productId === 'string' && allProducts.length > 0) {
                                    const fullProduct = allProducts.find(p =>
                                        (p._id?.toString?.() || p._id) === (lp.productId?.toString?.() || lp.productId)
                                    );
                                    if (fullProduct) {
                                        product = fullProduct;
                                    }
                                }

                                const productName = getProductName(product);

                                // Try multiple ways to get image URL
                                let productImageUrl = getMainImageUrl(product);
                                // If product is not populated, try to get image from liveProduct itself
                                if (!productImageUrl && lp.image) {
                                    productImageUrl = lp.image;
                                }
                                // Try getting from nested product object
                                if (!productImageUrl && lp.product) {
                                    productImageUrl = getMainImageUrl(lp.product);
                                }

                                return (
                                    <div
                                        key={lp._id || productId}
                                        className={`group p-3 rounded-lg border transition-all flex items-center gap-3 ${lp.isPinned
                                            ? 'bg-gradient-to-r from-yellow-50 to-amber-50 border-yellow-300 shadow-md'
                                            : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-md'
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
                                                <span className="text-sm font-medium text-gray-900 truncate" title={productName}>{productName}</span>
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
                        {!showAllProducts && liveProducts.length > 20 && (
                            <p className="text-xs text-gray-500 mt-2 text-center">
                                Showing 20 of {liveProducts.length} products
                            </p>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default LiveStreamProducts;