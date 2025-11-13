// Helper to determine which order status options should be enabled for update
export const getOrderStatusOptionDisabled = (currentStatus, optionValue) => {
    // Define allowed transitions based on workflow
    const allowedTransitions = {
        pending: ["confirmed", "cancelled"],
        confirmed: ["shipping", "cancelled"],
        shipping: ["delivered", "cancelled"],
        delivered: [], // No transitions from delivered
        cancelled: [], // No transitions from cancelled
    };

    // Handle undefined or null currentStatus
    if (!currentStatus || typeof currentStatus !== 'string') {
        return true; // Disable all options if status is invalid
    }

    // If current status is delivered or cancelled, disable all options
    if (currentStatus === "delivered" || currentStatus === "cancelled") {
        return true;
    }

    // If option value is the same as current status, don't disable
    if (optionValue === currentStatus) {
        return false;
    }

    // Check if the transition is allowed
    const allowedOptions = allowedTransitions[currentStatus];
    if (!allowedOptions || !Array.isArray(allowedOptions)) {
        return true; // Disable if no valid transitions found
    }

    return !allowedOptions.includes(optionValue);
};

