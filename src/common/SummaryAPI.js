import axiosClient from "./axiosClient";

const Api = {
    // ==== Utils ====
    utils: {
        fetchWithRetry: async (url, options = {}, retries = 3, delay = 1000) => {
            for (let i = 0; i < retries; i++) {
                try {
                    const response = await axiosClient(url, options);
                    return response.data;
                } catch (error) {
                    if (i === retries - 1) throw error;
                    await new Promise((resolve) =>
                        setTimeout(resolve, delay * Math.pow(2, i))
                    );
                }
            }
        },
    },

    // ==== Upload ====
    upload: {
        image: (file) => {
            const formData = new FormData();
            formData.append("image", file);
            return axiosClient.post("/upload", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
        },
        multiple: (files) => {
            const formData = new FormData();
            files.forEach((file) => {
                formData.append("images", file);
            });
            return axiosClient.post("/upload/multiple", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });
        },
    },

    // ==== Auth ====
    auth: {
        login: (data) => axiosClient.post("/auth/login", data),
        signup: (data) => axiosClient.post("/auth/signup", data),
        logout: () => axiosClient.post("/auth/logout"),
        forgotPassword: (data) => axiosClient.post("/auth/forgot-password", data),
        resetPassword: (data) => axiosClient.post("/auth/reset-password", data),
        verifyOTP: (data) => axiosClient.post("/auth/verify-otp", data),
        resendOTP: (data) => axiosClient.post("/auth/resend-otp", data),
    },

    // ==== Accounts ====
    accounts: {
        // Get all accounts (Admin only)
        getAll: (params = {}) => axiosClient.get("/accounts", { params }).then(response => response.data),
        // Search accounts (Admin only)
        search: (params = {}) => axiosClient.get("/accounts/search", { params }).then(response => response.data),
        // Get single account by ID (Admin or self)
        getById: (userId) => axiosClient.get(`/accounts/${userId}`).then(response => response.data),
        // Create a new account (Admin only)
        create: (data) => axiosClient.post("/accounts", data).then(response => response.data),
        // Update an account (Admin or self)
        update: (userId, data) => axiosClient.put(`/accounts/${userId}`, data).then(response => response.data),
        // Update profile information (Admin or self)
        updateProfile: (userId, data) => axiosClient.put(`/accounts/change-profile/${userId}`, data).then(response => response.data),
        // Change password (Admin or self)
        changePassword: (userId, data) => axiosClient.put(`/accounts/change-password/${userId}`, data).then(response => response.data),
        // Soft delete an account (Admin or self)
        softDelete: (userId) => axiosClient.delete(`/accounts/soft/${userId}`).then(response => response.data),
        // Disable an account (Admin only)
        disable: (userId) => axiosClient.put(`/accounts/disable/${userId}`).then(response => response.data),
        // Delete an account permanently (Admin or self)
        delete: (userId) => axiosClient.delete(`/accounts/${userId}`).then(response => response.data),
        // Edit staff information (Admin only, for staff accounts)
        editStaff: (userId, data) => axiosClient.put(`/accounts/edit-staff/${userId}`, data).then(response => response.data),
    },

    // ==== Products ====
    products: {
        // Get single product (old API - deprecated)
        getProduct: (productId) => axiosClient.get(`/products/${productId}`),
        // Get product variants (old API - deprecated)
        getVariants: (productId) => axiosClient.get(`/variants?pro_id=${productId}`),
        // Get product feedbacks
        getFeedbacks: (productId) => axiosClient.get(`/order-details/product/${productId}`),
        search: (query) => {
            const sanitizedQuery = query.trim().replace(/[<>]/g, "");
            return axiosClient.get("/products/search", {
                params: { q: sanitizedQuery },
            });
        },
    },

    // ==== New Products ====
    newProducts: {
        // Get all products
        getAll: (filters = {}) => axiosClient.get('/new-products', { params: filters }).then(response => response.data),
        // Get single product by ID
        getById: (productId) => axiosClient.get(`/new-products/${productId}`).then(response => response.data),
        // Create product (admin/manager only)
        create: (data) => axiosClient.post('/new-products', data).then(response => response.data),
        // Update product (admin/manager only)
        update: (productId, data) => axiosClient.put(`/new-products/${productId}`, data).then(response => response.data),
        // Delete product (admin/manager only)
        delete: (productId) => axiosClient.delete(`/new-products/${productId}`).then(response => response.data),
        // Add product image (admin/manager only)
        addImage: (productId, data) => axiosClient.post(`/new-products/${productId}/images`, data).then(response => response.data),
        // Delete product image (admin/manager only)
        deleteImage: (productId, imageId) => axiosClient.delete(`/new-products/${productId}/images/${imageId}`).then(response => response.data),
        // Search products
        search: (params) => axiosClient.get('/new-products/search', { params }).then(response => response.data),
    },

    // ==== New Product Variants ====
    newVariants: {
        // Get all variants (accessible to public)
        getAll: (filters = {}) => axiosClient.get('/new-variants/get-all-variants', { params: filters }).then(response => response.data),
        // Get single variant by ID (accessible to public)
        getById: (variantId) => axiosClient.get(`/new-variants/get-variant-detail/${variantId}`).then(response => response.data),
        // Create variant (restricted to manager/admin)
        create: (data) => axiosClient.post('/new-variants/create-variant', data).then(response => response.data),
        // Update variant (restricted to manager/admin)
        update: (variantId, data) => axiosClient.put(`/new-variants/update-variant/${variantId}`, data).then(response => response.data),
        // Delete variant (restricted to manager/admin)
        delete: (variantId) => axiosClient.delete(`/new-variants/delete-variant/${variantId}`).then(response => response.data),
        // Get variants by product ID (using get-all-variants with productId filter)
        getByProduct: (productId) => axiosClient.get(`/new-variants/get-all-variants?productId=${productId}`).then(response => response.data),
    },

    // ==== Product Colors ====
    colors: {
        // Get all colors (accessible to public)
        getAll: () => axiosClient.get('/specifications/get-all-colors').then(response => response.data),
        // Get single color by ID (accessible to public)
        getById: (colorId) => axiosClient.get(`/specifications/get-color-detail/${colorId}`).then(response => response.data),
        // Create color (restricted to admin/manager)
        create: (data) => axiosClient.post('/specifications/create-color', data).then(response => response.data),
        // Update color (restricted to admin/manager)
        update: (colorId, data) => axiosClient.put(`/specifications/update-color/${colorId}`, data).then(response => response.data),
        // Delete color (restricted to admin/manager)
        delete: (colorId) => axiosClient.delete(`/specifications/delete-color/${colorId}`).then(response => response.data),
        // Search colors (accessible to public)
        search: (params = {}) => axiosClient.get('/specifications/search-specifications', { params: { ...params, type: 'color' } }).then(response => response.data),
    },

    // ==== Product Sizes ====
    sizes: {
        // Get all sizes (accessible to public)
        getAll: () => axiosClient.get('/specifications/get-all-sizes').then(response => response.data),
        // Get single size by ID (accessible to public)
        getById: (sizeId) => axiosClient.get(`/specifications/get-size-detail/${sizeId}`).then(response => response.data),
        // Create size (restricted to admin/manager)
        create: (data) => axiosClient.post('/specifications/create-size', data).then(response => response.data),
        // Update size (restricted to admin/manager)
        update: (sizeId, data) => axiosClient.put(`/specifications/update-size/${sizeId}`, data).then(response => response.data),
        // Delete size (restricted to admin/manager)
        delete: (sizeId) => axiosClient.delete(`/specifications/delete-size/${sizeId}`).then(response => response.data),
        // Search sizes (accessible to public)
        search: (params = {}) => axiosClient.get('/specifications/search-specifications', { params: { ...params, type: 'size' } }).then(response => response.data),
    },

    // ==== Product Specifications ====
    specifications: {
        // Search specifications
        search: (params = {}) => axiosClient.get('/specifications/search-specifications', { params }).then(response => response.data),
        // Legacy methods for backward compatibility
        getAll: (filters = {}) => axiosClient.get('/specifications', { params: filters }),
        getById: (specId) => axiosClient.get(`/specifications/${specId}`),
        create: (data) => axiosClient.post('/specifications', data).then(response => response.data),
    },

    // ==== Categories ====
    categories: {
        // Get all categories (accessible to public)
        getAll: (filters = {}) => axiosClient.get('/categories/get-all-categories', { params: filters }).then(response => response.data),
        // Get single category by ID (accessible to public)
        getById: (categoryId) => axiosClient.get(`/categories/get-category-detail/${categoryId}`).then(response => response.data),
        // Create category (restricted to admin/manager)
        create: (data) => axiosClient.post('/categories/create-category', data).then(response => response.data),
        // Update category (restricted to admin/manager)
        update: (categoryId, data) => axiosClient.put(`/categories/update-category/${categoryId}`, data).then(response => response.data),
        // Delete category (restricted to admin/manager)
        delete: (categoryId) => axiosClient.delete(`/categories/delete-category/${categoryId}`).then(response => response.data),
        // Search categories (accessible to public)
        search: (params = {}) => axiosClient.get('/categories/search-categories', { params }).then(response => response.data),
    },

    // ==== Orders ====
    orders: {
        // Get all orders for admin
        getAll: () => axiosClient.get("/orders/admin/get-all-order").then(response => response.data),
        // Search orders with filters
        search: (params = {}) => axiosClient.get("/orders/search", { params }).then(response => response.data),
        // Get order details by ID
        getDetails: (orderId) => axiosClient.get(`/orders/get-order-by-id/${orderId}`).then(response => response.data),
        // Update order (status, payment, refund) - Admin endpoint
        update: (orderId, data) => axiosClient.put(`/orders/admin/update/${orderId}`, data).then(response => response.data),
        // Cancel order
        cancel: (orderId) => axiosClient.patch(`/orders/${orderId}/cancel`, {}).then(response => response.data),
    },

    // ==== Feedback ====
    feedback: {
        // Get all feedbacks with pagination and filters (Admin/Staff only)
        getAll: (params = {}) => axiosClient.get("/feedback/get-all-feedbacks", { params }).then(response => response.data),
        // Get feedback by ID (Admin/Staff only)
        getById: (feedbackId) => axiosClient.get(`/feedback/get-feedback-by-id/${feedbackId}`).then(response => response.data),
        // Delete feedback (soft delete) (Admin/Staff only)
        delete: (feedbackId) => axiosClient.delete(`/feedback/delete-feedback/${feedbackId}`).then(response => response.data),
        // Restore deleted feedback (Admin/Staff only)
        restore: (feedbackId) => axiosClient.patch(`/feedback/restore-feedback/${feedbackId}`).then(response => response.data),
    },

    // ==== Vouchers ====
    vouchers: {
        // Get all vouchers
        getAll: (params = {}) => axiosClient.get("/vouchers/get-all-vouchers", { params }).then(response => response.data),
        // Get voucher by ID
        getById: (voucherId) => axiosClient.get(`/vouchers/${voucherId}`).then(response => response.data),
        // Create voucher (admin/manager only)
        create: (data) => axiosClient.post("/vouchers/create-voucher", data).then(response => response.data),
        // Update voucher (admin/manager only)
        update: (voucherId, data) => axiosClient.put(`/vouchers/update-voucher/${voucherId}`, data).then(response => response.data),
        // Delete/Disable voucher (admin/manager only)
        disable: (voucherId) => axiosClient.delete(`/vouchers/disable-voucher/${voucherId}`).then(response => response.data),
        // Apply voucher to order
        applyVoucher: (data) => axiosClient.post("/vouchers/apply-voucher", data).then(response => response.data),
    },

    // ==== Import Bills ====
    importBills: {
        // Get all import bills
        getAll: (params = {}) => axiosClient.get("/import-bills", { params }),
        // Get import bill by ID
        getById: (billId) => axiosClient.get(`/import-bills/${billId}`),
        // Create import bill
        create: (data) => axiosClient.post("/import-bills", data),
        // Update import bill
        update: (billId, data) => axiosClient.put(`/import-bills/${billId}`, data),
        // Delete import bill
        delete: (billId) => axiosClient.delete(`/import-bills/${billId}`),
    },

    // ==== Statistics ====
    statistics: {
        // ==== Revenue Statistics ====
        // Get revenue by day
        getRevenueByDay: (queryParams = '') => axiosClient.get(`/statistics/revenue/revenue-by-day?${queryParams}`).then(response => response.data),
        // Get revenue by week
        getRevenueByWeek: (weeks = 52) => axiosClient.get(`/statistics/revenue/revenue-by-week?weeks=${weeks}`).then(response => response.data),
        // Get revenue by month
        getRevenueByMonth: (years = 10) => axiosClient.get(`/statistics/revenue/revenue-by-month?years=${years}`).then(response => response.data),
        // Get revenue by year
        getRevenueByYear: (years = 3) => axiosClient.get(`/statistics/revenue/revenue-by-year?years=${years}`).then(response => response.data),
    },

    // ==== Bills ====
    bills: {
        export: (orderId) => axiosClient.get(`/bills/export-bill/${orderId}`),
    },

    // ==== Notifications ====
    notifications: {
        getAll: (params = {}) => axiosClient.get("/notifications", { params }),
        markAsRead: (notificationId) => axiosClient.patch(`/notifications/${notificationId}/read`),
        markAllAsRead: () => axiosClient.patch("/notifications/mark-all-read"),
        delete: (notificationId) => axiosClient.delete(`/notifications/${notificationId}`),
    },

    // ==== Chat ====
    chat: {
        getMessages: (params = {}) => axiosClient.get("/chat/messages", { params }),
        sendMessage: (data) => axiosClient.post("/chat/messages", data),
        getConversations: (params = {}) => axiosClient.get("/chat/conversations", { params }),
    },
};

export default Api;