import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Line, Pie, Doughnut, Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ArcElement,
    BarElement,
} from 'chart.js';
import { FaShoppingCart, FaCheckCircle, FaClock, FaTimesCircle, FaDollarSign, FaHourglassHalf, FaUndo } from 'react-icons/fa';
import Api from '../../common/SummaryAPI';
import Loading from '../../components/Loading';

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
    ArcElement,
    BarElement
);

const OrdersByDay = ({ user }) => {
    const [stats, setStats] = useState({
        totalOrders: 0,
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0,
        averageProcessingTime: 0,
        refundRate: 0,
        ordersPerDay: [],
        topPaymentMethods: [],
        cartAbandonmentRate: 0,
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const fetchStats = useCallback(async () => {
        if (!user?._id) {
            setError('User not authenticated');
            return;
        }
        try {
            setLoading(true);
            const response = await Api.statistics.getOrderStatistics({ period: 'day' });
            setStats({
                ...response,
                ordersPerDay: response.ordersPerDay || [],
                topPaymentMethods: response.topPaymentMethods || [],
            });
            setLoading(false);
        } catch (err) {
            setError('Failed to fetch daily order statistics');
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        if (user?._id) {
            fetchStats();
        }
    }, [user, fetchStats]);

    const orderStatusData = useMemo(() => ({
        labels: ['Pending', 'Completed', 'Cancelled'],
        datasets: [
            {
                data: [stats.pendingOrders, stats.completedOrders, stats.cancelledOrders],
                backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
                borderColor: ['rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
                borderWidth: 0,
            },
        ],
    }), [stats]);

    const ordersTrendData = useMemo(() => ({
        labels: Array.isArray(stats.ordersPerDay) ? stats.ordersPerDay.map(item => item._id || 'Unknown').slice(-7) : [],
        datasets: [
            {
                label: 'Orders per Day',
                data: Array.isArray(stats.ordersPerDay) ? stats.ordersPerDay.map(item => item.count || 0).slice(-7) : [],
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            },
        ],
    }), [stats]);

    const paymentMethodsData = useMemo(() => ({
        labels: Array.isArray(stats.topPaymentMethods) ? stats.topPaymentMethods.map(method => method._id || 'Unknown') : [],
        datasets: [
            {
                label: 'Orders by Payment Method',
                data: Array.isArray(stats.topPaymentMethods) ? stats.topPaymentMethods.map(method => method.count || 0) : [],
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
            },
        ],
    }), [stats]);

    const cartAbandonmentData = useMemo(() => ({
        labels: ['Abandoned Carts', 'Converted Carts'],
        datasets: [
            {
                data: [stats.cartAbandonmentRate, 100 - stats.cartAbandonmentRate],
                backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(75, 192, 192, 0.6)'],
                borderColor: ['rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)'],
                borderWidth: 0,
            },
        ],
    }), [stats]);

    const chartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    font: {
                        size: 12,
                    },
                },
            },
            tooltip: {
                bodyFont: {
                    size: 12,
                },
            },
        },
        scales: {
            x: {
                ticks: {
                    font: {
                        size: 10,
                    },
                    maxRotation: 45,
                    minRotation: 45,
                },
            },
            y: {
                ticks: {
                    font: {
                        size: 10,
                    },
                },
            },
        },
    }), []);

    const pieChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'left',
                labels: {
                    font: {
                        size: 12,
                    },
                },
            },
            tooltip: {
                bodyFont: {
                    size: 12,
                },
            },
        },
        scales: {
            x: {
                display: false,
            },
            y: {
                display: false,
            },
        },
    }), []);

    // Format currency - memoized for performance
    const formatCurrency = useCallback((value) => {
        if (!value || value === 0) return '0 đ';
        return new Intl.NumberFormat('vi-VN').format(value) + ' đ';
    }, []);

    // Replace VND with đ in formatted strings
    const replaceVND = useCallback((str) => {
        if (!str || typeof str !== 'string') return str || '';
        return str.replace(/VND/gi, 'đ').replace(/ ₫/g, ' đ').trim();
    }, []);

    if (loading) {
        return (
            <div className="backdrop-blur-xl rounded-xl border p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }} role="status" aria-live="polite">
                <Loading
                    type="page"
                    size="medium"
                    message="Loading Order Statistics by Day..."
                />
            </div>
        );
    }

    if (error) {
        return (
            <div className="backdrop-blur-xl rounded-xl border p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }} role="status">
                <div className="flex flex-col items-center justify-center space-y-4 min-h-[180px]">
                    <div className="flex flex-col items-center space-y-3">
                        <div className="w-14 h-14 bg-gradient-to-br from-red-100 to-pink-100 rounded-full flex items-center justify-center shadow-lg">
                            <svg className="w-7 h-7 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                />
                            </svg>
                        </div>
                        <div className="text-center">
                            <h3 className="text-base font-semibold text-gray-900">Network Error</h3>
                            <p className="text-sm text-gray-500 mt-1">{error}</p>
                        </div>
                        <button
                            onClick={fetchStats}
                            className="px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl bg-gradient-to-r from-[#E9A319] to-[#A86523] hover:from-[#A86523] hover:to-[#8B4E1A] transform hover:scale-105"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4 mb-4 lg:mb-6 pt-2 lg:pt-3 pb-2 lg:pb-3">
                <div className="flex-1 min-w-0">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">Orders by Day</h1>
                    <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Daily order performance overview</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
                    <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                <FaShoppingCart className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Total Orders</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{stats.totalOrders.toLocaleString()}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                <FaCheckCircle className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Completed</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{stats.completedOrders}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <FaClock className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Pending</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{stats.pendingOrders}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                                <FaTimesCircle className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Cancelled</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{stats.cancelledOrders}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-yellow-500 rounded-lg flex items-center justify-center">
                                <FaDollarSign className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Avg. Order Value</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{replaceVND(formatCurrency(stats.averageOrderValue))}</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                                <FaHourglassHalf className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Avg. Processing</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{stats.averageProcessingTime.toFixed(2)} hrs</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-pink-500 rounded-lg flex items-center justify-center">
                                <FaUndo className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Refund Rate</p>
                                <p className="text-sm font-bold text-gray-800 truncate">{stats.refundRate.toFixed(2)}%</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900">Chart & Data</h3>
                    <p className="text-gray-600 text-sm lg:text-base">Visual representation and detailed data</p>
                </div>
                <div className="p-3 sm:p-4 lg:p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-xl p-4 lg:p-6 shadow-inner border border-gray-200">
                            <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-4">Daily Orders Trend</h3>
                            <div className="h-64">
                                <Line data={ordersTrendData} options={chartOptions} />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-xl p-4 lg:p-6 shadow-inner border border-gray-200">
                            <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-4">Order Status Distribution</h3>
                            <div className="h-64">
                                <Pie data={orderStatusData} options={pieChartOptions} />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-xl p-4 lg:p-6 shadow-inner border border-gray-200">
                            <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-4">Top Payment Methods</h3>
                            <div className="h-64">
                                <Bar data={paymentMethodsData} options={chartOptions} />
                            </div>
                        </div>

                        <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-xl p-4 lg:p-6 shadow-inner border border-gray-200">
                            <h3 className="text-base lg:text-lg font-semibold text-gray-900 mb-4">Cart Abandonment Rate</h3>
                            <div className="h-64">
                                <Doughnut data={cartAbandonmentData} options={pieChartOptions} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrdersByDay;