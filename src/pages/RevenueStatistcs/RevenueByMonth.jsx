import React, { useState, useEffect, useCallback } from "react";
import { Bar } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { FaChartLine, FaArrowUp, FaTrophy } from 'react-icons/fa';
import SummaryAPI from "../../common/SummaryAPI";
import Loading from "../../components/Loading";
import Filter from "../../components/FilterStatistics";

// Register Chart.js components
ChartJS.register(
    BarElement,
    CategoryScale,
    LinearScale,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const RevenueByMonth = ({ user }) => {
    // Data states
    const [revenueByMonth, setRevenueByMonth] = useState([]);
    const [filteredRevenueByMonth, setFilteredRevenueByMonth] = useState([]);
    const [monthSummary, setMonthSummary] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Filter states
    const [showFilter, setShowFilter] = useState(false);
    const [defaultMonthsToShow, setDefaultMonthsToShow] = useState(6);
    const [showAllMonths, setShowAllMonths] = useState(false);

    // Update filtered data when revenueByMonth or filter settings change
    useEffect(() => {
        if (showAllMonths) {
            setFilteredRevenueByMonth(revenueByMonth);
        } else {
            setFilteredRevenueByMonth(revenueByMonth.slice(0, defaultMonthsToShow));
        }
    }, [revenueByMonth, defaultMonthsToShow, showAllMonths]);

    // Fetch revenue by month data
    const fetchRevenueByMonth = useCallback(async () => {
        if (!user?._id) {
            setError("User not authenticated");
            return;
        }
        setLoading(true);
        setError("");

        try {
            console.log("Fetching revenue by month data using SummaryAPI...");

            // Fetch revenue by month using SummaryAPI
            const monthResponse = await SummaryAPI.statistics.getRevenueByMonth();

            console.log("Month response:", monthResponse);

            // Handle new API structure for revenue by month
            if (monthResponse) {
                const monthData = monthResponse;
                if (monthData?.data?.monthlyData) {
                    console.log("Using nested data structure");
                    setRevenueByMonth(Array.isArray(monthData.data.monthlyData) ? monthData.data.monthlyData : []);
                    setMonthSummary(monthData.data.summary || null);
                } else if (monthData?.monthlyData) {
                    console.log("Using direct data structure");
                    setRevenueByMonth(Array.isArray(monthData.monthlyData) ? monthData.monthlyData : []);
                    setMonthSummary(monthData.summary || null);
                } else if (Array.isArray(monthData)) {
                    console.log("Using array structure");
                    setRevenueByMonth(monthData);
                    setMonthSummary(null);
                } else {
                    console.log("No valid data found");
                    setRevenueByMonth([]);
                    setMonthSummary(null);
                }
            } else {
                console.log("Month response failed");
                setRevenueByMonth([]);
                setMonthSummary(null);
            }
        } catch (err) {
            setError(err.message || "Failed to load revenue by month statistics");
            console.error("Fetch revenue by month error:", err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Fetch data on mount
    useEffect(() => {
        if (user?._id) {
            fetchRevenueByMonth();
        }
    }, [user, fetchRevenueByMonth]);

    // Filter functions
    const handleChangeDefaultMonths = (months) => {
        setDefaultMonthsToShow(months);
        setShowAllMonths(false);
    };

    const handleShowAllMonths = () => {
        setShowAllMonths(true);
    };

    // Format currency
    const formatCurrency = (value) => {
        if (!value || value === 0) return '0 ₫';
        return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
    };

    // Generate colors for filtered data
    const generateColors = (dataLength) => {
        const colors = [
            { bg: 'rgba(59, 130, 246, 0.8)', border: '#3b82f6', hover: 'rgba(59, 130, 246, 1)' },   // Blue
            { bg: 'rgba(34, 197, 94, 0.8)', border: '#22c55e', hover: 'rgba(34, 197, 94, 1)' },    // Green
            { bg: 'rgba(239, 68, 68, 0.8)', border: '#ef4444', hover: 'rgba(239, 68, 68, 1)' },    // Red
            { bg: 'rgba(168, 85, 247, 0.8)', border: '#a855f7', hover: 'rgba(168, 85, 247, 1)' },   // Purple
            { bg: 'rgba(245, 158, 11, 0.8)', border: '#f59e0b', hover: 'rgba(245, 158, 11, 1)' },   // Yellow/Orange
            { bg: 'rgba(236, 72, 153, 0.8)', border: '#ec4899', hover: 'rgba(236, 72, 153, 1)' },   // Pink
            { bg: 'rgba(20, 184, 166, 0.8)', border: '#14b8a6', hover: 'rgba(20, 184, 166, 1)' }    // Teal
        ];

        return {
            backgroundColor: colors.slice(0, dataLength).map(c => c.bg),
            borderColor: colors.slice(0, dataLength).map(c => c.border),
            hoverBackgroundColor: colors.slice(0, dataLength).map(c => c.hover)
        };
    };

    // Chart data
    const monthChartData = {
        labels: filteredRevenueByMonth.map(item => item.month),
        datasets: [{
            label: 'Revenue (Month)',
            data: filteredRevenueByMonth.map(item => item.totalRevenue),
            ...generateColors(filteredRevenueByMonth.length),
            borderWidth: 0,
            borderRadius: {
                topLeft: 12,
                topRight: 12,
                bottomLeft: 0,
                bottomRight: 0
            },
            borderSkipped: false,
            hoverBorderWidth: 2,
            hoverBorderColor: '#ffffff',
            shadowOffsetX: 0,
            shadowOffsetY: 4,
            shadowBlur: 8,
            shadowColor: 'rgba(0, 0, 0, 0.1)'
        }]
    };

    // Chart options
    const revenueOverTimeChartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#1f2937',
                    font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
                    padding: 25,
                    usePointStyle: true,
                    pointStyle: 'rect',
                    boxWidth: 12,
                    boxHeight: 12
                }
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                titleColor: '#f8fafc',
                bodyColor: '#f1f5f9',
                borderColor: 'rgba(99, 102, 241, 0.3)',
                borderWidth: 1,
                cornerRadius: 16,
                displayColors: true,
                titleFont: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
                bodyFont: { size: 12, weight: '500', family: 'Inter, system-ui, sans-serif' },
                padding: 16,
                titleSpacing: 8,
                bodySpacing: 6,
                callbacks: {
                    title: function (context) {
                        return context[0].label;
                    },
                    label: function (context) {
                        return `💰 Revenue: ${formatCurrency(context.parsed.y)}`;
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                title: {
                    display: true,
                    text: 'Revenue (₫)',
                    color: '#374151',
                    font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
                    padding: { top: 25, bottom: 25 }
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.15)',
                    drawBorder: false,
                    lineWidth: 1,
                    drawTicks: false
                },
                ticks: {
                    color: '#64748b',
                    font: { size: 11, weight: '500', family: 'Inter, system-ui, sans-serif' },
                    padding: 12,
                    callback: function (value) {
                        if (value >= 1000000) {
                            return (value / 1000000).toFixed(1) + 'M ₫';
                        } else if (value >= 1000) {
                            return (value / 1000).toFixed(0) + 'K ₫';
                        }
                        return value + ' ₫';
                    }
                }
            },
            x: {
                title: {
                    display: true,
                    text: 'Month',
                    color: '#374151',
                    font: { size: 13, weight: '600', family: 'Inter, system-ui, sans-serif' },
                    padding: { top: 25, bottom: 25 }
                },
                grid: {
                    display: false
                },
                ticks: {
                    color: '#64748b',
                    font: { size: 11, weight: '500', family: 'Inter, system-ui, sans-serif' },
                    padding: 12
                }
            }
        },
        elements: {
            bar: {
                borderRadius: {
                    topLeft: 12,
                    topRight: 12,
                    bottomLeft: 0,
                    bottomRight: 0
                },
                borderSkipped: false
            }
        },
        interaction: {
            intersect: false,
            mode: 'index'
        },
        animation: {
            duration: 1000,
            easing: 'easeInOutQuart'
        }
    };

    // Loading state
    if (loading) {
        return (
            <Loading
                type="page"
                size="large"
                message="Loading Revenue by Month"
                subMessage="Please wait while we fetch your data..."
                className="min-h-96"
            />
        );
    }

    // Error state
    if (error) {
        return (
            <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-2xl p-8 shadow-lg" role="alert" aria-live="true">
                <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
                        <span className="text-white text-2xl">⚠</span>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Revenue by Month</h3>
                        <p className="text-red-700 font-medium">{error}</p>
                    </div>
                    <button
                        className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={fetchRevenueByMonth}
                        aria-label="Retry loading revenue by month"
                    >
                        🔄 Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Summary Cards */}
            {monthSummary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {/* Total Revenue This Month */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center">
                                <FaArrowUp className="text-2xl text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-sm font-medium">This Month Revenue</p>
                                <p className="text-3xl font-bold text-gray-800">
                                    {monthSummary.totalRevenueThisMonthFormatted ? monthSummary.totalRevenueThisMonthFormatted + ' ₫' : formatCurrency(monthSummary.totalRevenueThisMonth)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Change vs Last Month */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-green-500 rounded-2xl flex items-center justify-center">
                                <FaArrowUp className="text-2xl text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-sm font-medium">vs Last Month</p>
                                <p className={`text-3xl font-bold ${monthSummary.changeVsLastMonth?.startsWith('+')
                                    ? 'text-green-600'
                                    : monthSummary.changeVsLastMonth?.startsWith('-')
                                        ? 'text-red-600'
                                        : 'text-gray-800'
                                    }`}>
                                    {monthSummary.changeVsLastMonth || '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Best Month */}
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center space-x-4">
                            <div className="w-16 h-16 bg-red-500 rounded-2xl flex items-center justify-center">
                                <FaTrophy className="text-2xl text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-sm font-medium">Best Month</p>
                                <p className="text-lg font-bold text-gray-800">
                                    {monthSummary.bestMonthInPeriod || '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Revenue by Month Content */}
            <div className="bg-white rounded-2xl shadow-lg p-8 border border-gray-100">
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-3xl font-bold text-gray-900">Revenue by Month</h3>
                            <p className="text-gray-500 text-lg">Monthly revenue performance overview</p>
                        </div>
                        <Filter
                            data={revenueByMonth}
                            filteredData={filteredRevenueByMonth}
                            showFilter={showFilter}
                            defaultItemsToShow={defaultMonthsToShow}
                            showAllItems={showAllMonths}
                            defaultOptions={[3, 6, 9, 12, 18, 24]}
                            itemType="months"
                            itemTypeCapitalized="Months"
                            onToggleFilter={() => setShowFilter(!showFilter)}
                            onChangeDefaultItems={handleChangeDefaultMonths}
                            onShowAllItems={handleShowAllMonths}
                        />
                    </div>

                </div>

                {/* Chart */}
                <div className="mb-8">
                    <div className="h-96 bg-white rounded-2xl p-8 border border-gray-200 shadow-lg">
                        <div className="h-full">
                            {monthChartData.labels.length > 0 ? (
                                <Bar data={monthChartData} options={{
                                    ...revenueOverTimeChartOptions,
                                    plugins: {
                                        ...revenueOverTimeChartOptions.plugins,
                                        title: {
                                            ...revenueOverTimeChartOptions.plugins.title,
                                            text: 'Revenue by Month'
                                        }
                                    },
                                    scales: {
                                        ...revenueOverTimeChartOptions.scales,
                                        x: {
                                            ...revenueOverTimeChartOptions.scales.x,
                                            title: {
                                                ...revenueOverTimeChartOptions.scales.x.title,
                                                text: 'Month'
                                            }
                                        }
                                    }
                                }} />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <FaChartLine className="text-3xl text-gray-500" />
                                        </div>
                                        <p className="text-gray-600 font-semibold text-lg">
                                            {showAllMonths
                                                ? "No revenue data available for all months"
                                                : `No revenue data available for ${defaultMonthsToShow} months`
                                            }
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th className="px-8 py-6 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Month</th>
                                    <th className="px-8 py-6 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Time Range</th>
                                    <th className="px-8 py-6 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Total Revenue</th>
                                    <th className="px-8 py-6 text-left text-sm font-bold text-gray-800 uppercase tracking-wider">Change</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {filteredRevenueByMonth.length > 0 ? (
                                    filteredRevenueByMonth.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50 transition-all duration-300">
                                            <td className="px-8 py-6 text-sm font-semibold text-gray-900">{item.month}</td>
                                            <td className="px-8 py-6 text-sm text-gray-600">{item.timeRange}</td>
                                            <td className="px-8 py-6 text-sm font-bold text-gray-800">{item.totalRevenueFormatted ? item.totalRevenueFormatted + ' ₫' : formatCurrency(item.totalRevenue)}</td>
                                            <td className="px-8 py-6 text-sm">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${item.comparedToPreviousMonth === '-'
                                                    ? 'bg-gray-100 text-gray-600'
                                                    : item.comparedToPreviousMonth.startsWith('+')
                                                        ? 'bg-green-100 text-green-600'
                                                        : 'bg-red-100 text-red-600'
                                                    }`}>
                                                    {item.comparedToPreviousMonth}
                                                </span>
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="4" className="px-8 py-12 text-center text-gray-500 font-medium">
                                            {showAllMonths
                                                ? "No data available for all months"
                                                : `No data available for ${defaultMonthsToShow} months`
                                            }
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevenueByMonth;
