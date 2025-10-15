import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import { FaBox, FaBoxOpen, FaShoppingCart, FaStar } from 'react-icons/fa';

const ProductStatistics = () => {
    const { user, isAuthLoading } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Mock data - replace with real API calls
    const productStats = {
        totalProducts: 156,
        inStock: 89,
        outOfStock: 12,
        lowStock: 55
    };

    if (isAuthLoading) {
        return (
            <Loading
                type="auth"
                size="large"
                message="Verifying authentication..."
                fullScreen={true}
            />
        );
    }

    return (
        <div className="min-h-screen bg-gray-100 p-6">
            {/* Header */}
            <div className="mb-8">
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-2xl p-8 text-white">
                    <h1 className="text-4xl font-bold mb-3">Product Statistics</h1>
                    <p className="text-purple-100 text-lg">Comprehensive product analytics and inventory insights</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <FaBox className="text-purple-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-green-100 text-green-600">
                            +15%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{productStats.totalProducts}</h3>
                    <p className="text-gray-600 font-medium">Total Products</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <FaBoxOpen className="text-green-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-green-100 text-green-600">
                            +8%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{productStats.inStock}</h3>
                    <p className="text-gray-600 font-medium">In Stock</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                            <FaShoppingCart className="text-orange-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-orange-100 text-orange-600">
                            +3%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{productStats.lowStock}</h3>
                    <p className="text-gray-600 font-medium">Low Stock</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                            <FaStar className="text-red-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-red-100 text-red-600">
                            -5%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{productStats.outOfStock}</h3>
                    <p className="text-gray-600 font-medium">Out of Stock</p>
                </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 text-center">
                <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaBox className="text-purple-600 text-3xl" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Product Analytics</h3>
                <p className="text-gray-600 text-lg">Detailed product analytics and inventory insights coming soon...</p>
            </div>
        </div>
    );
};

export default ProductStatistics;
