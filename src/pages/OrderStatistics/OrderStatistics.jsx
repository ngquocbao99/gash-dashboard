import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../../context/AuthContext';
import Loading from '../../components/Loading';
import Api from '../../common/SummaryAPI';
import { FaShoppingCart, FaCheckCircle, FaClock, FaTimesCircle, FaDollarSign, FaHourglassHalf, FaUndo } from 'react-icons/fa';
import { Chart as ChartJS, ArcElement, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Pie, Doughnut } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, Title, Tooltip, Legend);

const OrderStatistics = () => {
    const { user, isAuthLoading } = useContext(AuthContext);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [stats, setStats] = useState({
        totalOrders: 0,
        ordersPerDay: [],
        ordersPerMonth: [],
        ordersPerYear: [],
        pendingOrders: 0,
        completedOrders: 0,
        cancelledOrders: 0,
        averageOrderValue: 0,
        averageProcessingTime: 0,
        refundRate: 0,
        topPaymentMethods: [],
        topShippingRegions: [],
        cartAbandonmentRate: 0,
    });
    const [trendPeriod, setTrendPeriod] = useState('day'); // Default to 'day'

    useEffect(() => {
        const fetchStats = async () => {
            try {
                setLoading(true);
                const response = await Api.statistics.getOrderStatistics();
                setStats(response);
                setLoading(false);
            } catch (err) {
                setError('Failed to fetch order statistics');
                setLoading(false);
            }
        };
        if (!isAuthLoading && user) {
            fetchStats();
        }
    }, [isAuthLoading, user]);

    if (isAuthLoading || loading) {
        return (
            <Loading
                type="auth"
                size="large"
                message={loading ? "Fetching statistics..." : "Verifying authentication..."}
                fullScreen={true}
            />
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 p-6 flex items-center justify-center">
                <div className="bg-red-100 text-red-700 p-4 rounded-lg">
                    <p>{error}</p>
                </div>
            </div>
        );
    }

    // Chart Data Configurations
    const getOrdersTrendData = () => {
        let labels, data;
        switch (trendPeriod) {
            case 'day':
                labels = stats.ordersPerDay.map(item => item._id).slice(-7); // Last 7 days
                data = stats.ordersPerDay.map(item => item.count).slice(-7);
                break;
            case 'month':
                labels = stats.ordersPerMonth.map(item => item._id).slice(-12); // Last 12 months
                data = stats.ordersPerMonth.map(item => item.count).slice(-12);
                break;
            case 'year':
                labels = stats.ordersPerYear.map(item => item._id).slice(-5); // Last 5 years
                data = stats.ordersPerYear.map(item => item.count).slice(-5);
                break;
            default:
                labels = [];
                data = [];
        }
        return {
            labels,
            datasets: [
                {
                    label: `Orders per ${trendPeriod.charAt(0).toUpperCase() + trendPeriod.slice(1)}`,
                    data,
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1,
                },
            ],
        };
    };

    const orderStatusData = {
        labels: ['Pending', 'Completed', 'Cancelled'],
        datasets: [
            {
                data: [stats.pendingOrders, stats.completedOrders, stats.cancelledOrders],
                backgroundColor: ['rgba(54, 162, 235, 0.6)', 'rgba(75, 192, 192, 0.6)', 'rgba(255, 99, 132, 0.6)'],
                borderColor: ['rgba(54, 162, 235, 1)', 'rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
                borderWidth: 0, // Remove border lines for pie chart
            },
        ],
    };

    const paymentMethodsData = {
        labels: stats.topPaymentMethods.map(method => method._id),
        datasets: [
            {
                label: 'Orders by Payment Method',
                data: stats.topPaymentMethods.map(method => method.count),
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1,
            },
        ],
    };

    const shippingRegionsData = {
        labels: stats.topShippingRegions.map(region => region._id || 'Unknown'),
        datasets: [
            {
                label: 'Orders by Region',
                data: stats.topShippingRegions.map(region => region.count),
                backgroundColor: 'rgba(255, 206, 86, 0.6)',
                borderColor: 'rgba(255, 206, 86, 1)',
                borderWidth: 1,
            },
        ],
    };

    const cartAbandonmentData = {
        labels: ['Abandoned Carts', 'Converted Carts'],
        datasets: [
            {
                data: [stats.cartAbandonmentRate, 100 - stats.cartAbandonmentRate],
                backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(75, 192, 192, 0.6)'],
                borderColor: ['rgba(255, 99, 132, 1)', 'rgba(75, 192, 192, 1)'],
                borderWidth: 0, // Remove border lines for doughnut chart
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false, // Allow charts to stretch vertically
        plugins: {
            legend: {
                position: 'bottom', // Move legend to bottom for bar charts
                labels: {
                    font: {
                        size: 12, // Smaller font for better fit
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
                        size: 10, // Smaller x-axis labels
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
    };

    const pieChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'left', // Move legend to left for pie charts
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
                display: false, // Hide x-axis for pie charts
            },
            y: {
                display: false, // Hide y-axis for pie charts
            },
        },
    };

    return (
        <div className="min-h-screen bg-gray-100 p-4 sm:p-6">
            {/* Header */}
            <div className="mb-6">
                <div className="bg-gradient-to-r from-orange-600 to-red-600 rounded-2xl p-6 text-white">
                    <h1 className="text-3xl font-bold mb-2">Order Statistics</h1>
                    <p className="text-orange-100 text-base">Comprehensive order analytics and fulfillment insights</p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                            <FaShoppingCart className="text-orange-600 text-lg" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{stats.totalOrders.toLocaleString()}</h3>
                    <p className="text-gray-600 text-sm">Total Orders</p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                            <FaCheckCircle className="text-green-600 text-lg" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{stats.completedOrders}</h3>
                    <p className="text-gray-600 text-sm">Completed Orders</p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FaClock className="text-blue-600 text-lg" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{stats.pendingOrders}</h3>
                    <p className="text-gray-600 text-sm">Pending Orders</p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <FaTimesCircle className="text-red-600 text-lg" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{stats.cancelledOrders}</h3>
                    <p className="text-gray-600 text-sm">Cancelled Orders</p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                            <FaDollarSign className="text-yellow-600 text-lg" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{stats.averageOrderValue.toLocaleString('vi-VN', { style: 'currency', currency: 'VND' })}</h3>
                    <p className="text-gray-600 text-sm">Average Order Value</p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <FaHourglassHalf className="text-purple-600 text-lg" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{stats.averageProcessingTime.toFixed(2)} hrs</h3>
                    <p className="text-gray-600 text-sm">Avg. Processing Time</p>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                            <FaUndo className="text-pink-600 text-lg" />
                        </div>
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-1">{stats.refundRate.toFixed(2)}%</h3>
                    <p className="text-gray-600 text-sm">Refund Rate</p>
                </div>
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-bold text-gray-900">Orders Trend</h3>
                        <select
                            value={trendPeriod}
                            onChange={(e) => setTrendPeriod(e.target.value)}
                            className="border rounded-lg p-2 text-sm"
                        >
                            <option value="day">Daily</option>
                            <option value="month">Monthly</option>
                            <option value="year">Yearly</option>
                        </select>
                    </div>
                    <div className="h-64">
                        <Bar data={getOrdersTrendData()} options={chartOptions} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Order Status Distribution</h3>
                    <div className="h-64">
                        <Pie data={orderStatusData} options={pieChartOptions} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Top Payment Methods</h3>
                    <div className="h-64">
                        <Bar data={paymentMethodsData} options={chartOptions} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Top Shipping Regions</h3>
                    <div className="h-64">
                        <Bar data={shippingRegionsData} options={chartOptions} />
                    </div>
                </div>

                <div className="bg-white rounded-xl p-4 shadow-md border border-gray-100">
                    <h3 className="text-lg font-bold text-gray-900 mb-4">Cart Abandonment Rate</h3>
                    <div className="h-64">
                        <Doughnut data={cartAbandonmentData} options={pieChartOptions} />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default OrderStatistics;