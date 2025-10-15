import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import { FaUsers, FaUserPlus, FaUserCheck, FaUserTimes } from 'react-icons/fa';

const CustomerStatistics = () => {
    const { user, isAuthLoading } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Mock data - replace with real API calls
    const customerStats = {
        totalCustomers: 1247,
        newCustomers: 89,
        activeCustomers: 892,
        inactiveCustomers: 266
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
                <div className="bg-gradient-to-r from-green-600 to-emerald-600 rounded-2xl p-8 text-white">
                    <h1 className="text-4xl font-bold mb-3">Customer Statistics</h1>
                    <p className="text-green-100 text-lg">Comprehensive customer analytics and insights</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                            <FaUsers className="text-blue-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-green-100 text-green-600">
                            +12%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{customerStats.totalCustomers.toLocaleString()}</h3>
                    <p className="text-gray-600 font-medium">Total Customers</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                            <FaUserPlus className="text-green-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-green-100 text-green-600">
                            +8%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{customerStats.newCustomers}</h3>
                    <p className="text-gray-600 font-medium">New This Month</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                            <FaUserCheck className="text-purple-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-green-100 text-green-600">
                            +5%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{customerStats.activeCustomers}</h3>
                    <p className="text-gray-600 font-medium">Active Customers</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                            <FaUserTimes className="text-red-600 text-xl" />
                        </div>
                        <span className="text-sm font-semibold px-2 py-1 rounded-full bg-red-100 text-red-600">
                            -2%
                        </span>
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-1">{customerStats.inactiveCustomers}</h3>
                    <p className="text-gray-600 font-medium">Inactive Customers</p>
                </div>
            </div>

            {/* Coming Soon */}
            <div className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100 text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FaUsers className="text-green-600 text-3xl" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Customer Analytics</h3>
                <p className="text-gray-600 text-lg">Detailed customer analytics and insights coming soon...</p>
            </div>
        </div>
    );
};

export default CustomerStatistics;
