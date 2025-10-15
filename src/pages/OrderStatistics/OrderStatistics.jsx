import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import { FaShoppingCart, FaCheckCircle, FaClock, FaTimesCircle } from 'react-icons/fa';

const OrderStatistics = () => {
    const { user, isAuthLoading } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Mock data - replace with real API calls
    const orderStats = {
        totalOrders: 1247,
        completedOrders: 892,
        pendingOrders: 266,
        cancelledOrders: 89
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
                <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-8 text-white">
                    <h1 className="text-4xl font-bold mb-3">Order Statistics</h1>
                    <p className="text-orange-100 text-lg">Comprehensive order analytics and fulfillment insights</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                            <FaShoppingCart className="text-orange-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-green-100 text-green-600">
                            +18%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{orderStats.totalOrders.toLocaleString()}</h3>
                    <p className="text-gray-600 font-medium">Total Orders</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <FaCheckCircle className="text-green-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-green-100 text-green-600">
                            +12%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{orderStats.completedOrders}</h3>
                    <p className="text-gray-600 font-medium">Completed Orders</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <FaClock className="text-blue-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-blue-100 text-blue-600">
                            +5%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{orderStats.pendingOrders}</h3>
                    <p className="text-gray-600 font-medium">Pending Orders</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                            <FaTimesCircle className="text-red-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-red-100 text-red-600">
                            -3%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{orderStats.cancelledOrders}</h3>
                    <p className="text-gray-600 font-medium">Cancelled Orders</p>
                </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 text-center">
                <div className="w-20 h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaShoppingCart className="text-orange-600 text-3xl" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Order Analytics</h3>
                <p className="text-gray-600 text-lg">Detailed order analytics and fulfillment insights coming soon...</p>
            </div>
        </div>
    );
};

export default OrderStatistics;
