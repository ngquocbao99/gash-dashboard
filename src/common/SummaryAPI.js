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
        getProfile: (userId) => axiosClient.get(`/accounts/${userId}`).then(response => response.data),
        updateProfile: (userId, data) =>
            axiosClient.put(`/accounts/change-profile/${userId}`, data).then(response => response.data),
        changePassword: (userId, data) =>
            axiosClient.put(`/accounts/change-password/${userId}`, data).then(response => response.data),
        deleteAccount: (userId) => axiosClient.delete(`/accounts/${userId}`).then(response => response.data),
        softDeleteAccount: (userId) =>
            axiosClient.delete(`/accounts/soft/${userId}`).then(response => response.data),
        disableAccount: (userId) =>
            axiosClient.put(`/accounts/disable/${userId}`).then(response => response.data),
        getAllAccounts: (params = {}) => axiosClient.get("/accounts", { params }).then(response => response.data),
        createAccount: (data) => axiosClient.post("/accounts", data).then(response => response.data),
        updateAccount: (userId, data) => axiosClient.put(`/accounts/${userId}`, data).then(response => response.data),
    },

    // ==== Products ====
    products: {
        // Get single product (old API - deprecated)
        getProduct: (productId) => axiosClient.get(`/products/${productId}`),
        // Get product variants (old API - deprecated)
        getVariants: (productId) => axiosClient.get(`/variants?pro_id=${productId}`),
        // Get product images (old API - deprecated)
        getImages: (productId) => axiosClient.get(`/specifications/image/product/${productId}`),
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
        // Get all variants (with optional filters)
        getAll: (filters = {}) => axiosClient.get('/new-variants', { params: filters }).then(response => response.data),
        // Get single variant by ID
        getById: (variantId) => axiosClient.get(`/new-variants/${variantId}`).then(response => response.data),
        // Create variant (admin/manager only)
        create: (data) => axiosClient.post('/new-variants', data).then(response => response.data),
        // Update variant (admin/manager only)
        update: (variantId, data) => axiosClient.put(`/new-variants/${variantId}`, data).then(response => response.data),
        // Delete variant (admin/manager only)
        delete: (variantId) => axiosClient.delete(`/new-variants/${variantId}`).then(response => response.data),
    },

    // ==== Product Specifications ====
    specifications: {
        getAll: (filters = {}) => axiosClient.get('/specifications', { params: filters }),
        getById: (specId) => axiosClient.get(`/specifications/${specId}`),
        create: (data) => axiosClient.post('/specifications', data),
        update: (specId, data) => axiosClient.put(`/specifications/${specId}`, data),
        delete: (specId) => axiosClient.delete(`/specifications/${specId}`),
        getByProduct: (productId) => axiosClient.get(`/specifications/product/${productId}`),
    },

    // ==== Categories ====
    categories: {
        getAll: (filters = {}) => axiosClient.get('/categories', { params: filters }),
        getById: (categoryId) => axiosClient.get(`/categories/${categoryId}`),
        create: (data) => axiosClient.post('/categories', data),
        update: (categoryId, data) => axiosClient.put(`/categories/${categoryId}`, data),
        delete: (categoryId) => axiosClient.delete(`/categories/${categoryId}`),
    },

    // ==== Orders ====
    orders: {
        // Get all orders
        getAll: (params = {}) => axiosClient.get("/orders", { params }).then(response => response.data),
        // Get single order details
        getOrder: (orderId) => axiosClient.get(`/orders/get-order-by-id/${orderId}`).then(response => response.data),
        // Get orders by user
        getOrdersByUser: (userId) => axiosClient.get(`/orders?acc_id=${userId}`).then(response => response.data),
        // Update order status
        updateStatus: (orderId, data) => axiosClient.patch(`/orders/${orderId}/status`, data).then(response => response.data),
        // Cancel order
        cancel: (orderId) => axiosClient.patch(`/orders/${orderId}/cancel`, {}).then(response => response.data),
        // VNPay return handler
        vnpayReturn: (params) => axiosClient.get(`/orders/vnpay-return${params}`).then(response => response.data),
        // VNPay payment URL
        getPaymentUrl: (data) => axiosClient.post("/orders/payment-url", data).then(response => response.data),
        // Get order statistics
        getStatistics: (params = {}) => axiosClient.get("/orders/statistics", { params }).then(response => response.data),
    },

    // ==== Order Details ====
    orderDetails: {
        // Create new order detail
        create: (data) => axiosClient.post('/order-detail/create-order-detail', data).then(response => response.data),
        // Update order detail
        update: (orderDetailId, data) => axiosClient.put(`/order-detail/update-order-detail/${orderDetailId}`, data).then(response => response.data),
        // Delete order detail
        delete: (orderDetailId) => axiosClient.delete(`/order-detail/delete-order-detail/${orderDetailId}`).then(response => response.data),
        // Search order details
        search: (queryParams) => axiosClient.get('/order-detail/search', { params: queryParams }).then(response => response.data),
        // Get order details by product
        getByProduct: (productId) => axiosClient.get(`/order-detail/get-order-details-by-product/${productId}`).then(response => response.data),
    },

    // ==== Cart ====
    cart: {
        fetch: (userId) => axiosClient.get(`/carts?acc_id=${userId}`),
        addItem: (cartItem) => axiosClient.post("/carts", cartItem),
        updateItem: (itemId, data) => axiosClient.put(`/carts/${itemId}`, data),
        removeItem: (itemId) => axiosClient.delete(`/carts/${itemId}`),
        batchRemove: (ids) => axiosClient.delete(`/carts/batch`, { data: { ids } }),
        clearCart: async (userId) => {
            const res = await axiosClient.get(`/carts?acc_id=${userId}`);
            const items = Array.isArray(res.data) ? res.data : [];
            await Promise.all(
                items.map((item) => axiosClient.delete(`/carts/${item._id}`))
            );
            return true;
        },
    },

    // ==== New Cart ====
    newCart: {
        // Create cart item
        create: (data) => axiosClient.post('/new-carts', data),
        // Get cart by account
        getByAccount: (accountId) => axiosClient.get(`/new-carts/account/${accountId}`),
        // Get cart item by ID
        getById: (cartId) => axiosClient.get(`/new-carts/${cartId}`),
        // Update cart item
        update: (cartId, data) => axiosClient.put(`/new-carts/${cartId}`, data),
        // Delete cart item
        delete: (cartId) => axiosClient.delete(`/new-carts/${cartId}`),
    },

    // ==== Feedback ====
    feedback: {
        // Get all feedbacks with new structure
        getAllFeedbacks: (params = {}) => axiosClient.get("/feedback/get-all-feedbacks", { params }).then(response => response.data),
        // Get feedback by ID
        getFeedbackById: (feedbackId) => axiosClient.get(`/feedback/get-feedback-by-id/${feedbackId}`).then(response => response.data),

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
        // Get dashboard statistics
        getDashboard: (params = {}) => axiosClient.get("/statistics/dashboard", { params }),
        // Get sales statistics
        getSales: (params = {}) => axiosClient.get("/statistics/sales", { params }),
        // Get product statistics
        getProducts: (params = {}) => axiosClient.get("/statistics/products", { params }),
        // Get user statistics
        getUsers: (params = {}) => axiosClient.get("/statistics/users", { params }),

        // ==== Revenue Statistics ====
        // Get total revenue statistics
        getRevenue: () => axiosClient.get("/statistics/revenue").then(response => response.data),
        // Get revenue by week (new API structure)
        getRevenueByWeek: () => axiosClient.get("/statistics/revenue/revenue-by-week").then(response => response.data),
        // Get revenue by month
        getRevenueByMonth: () => axiosClient.get("/statistics/revenue/revenue-by-month").then(response => response.data),
        // Get revenue by year
        getRevenueByYear: () => axiosClient.get("/statistics/revenue/revenue-by-year").then(response => response.data),

        // ==== Customer Statistics ====
        // Get customer statistics
        getCustomers: () => axiosClient.get("/statistics/customers").then(response => response.data),

        // ==== Order Statistics ====
        // Get order statistics
        getOrders: () => axiosClient.get("/statistics/orders").then(response => response.data),
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
