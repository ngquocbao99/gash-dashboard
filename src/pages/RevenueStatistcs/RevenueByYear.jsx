import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import { FaChartLine, FaArrowUp, FaArrowDown, FaTrophy } from 'react-icons/fa';
import SummaryAPI from "../../common/SummaryAPI";
import Loading from "../../components/Loading";

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

const RevenueByYear = ({ user }) => {
    // Data states
    const [revenueByYear, setRevenueByYear] = useState([]);
    const [yearSummary, setYearSummary] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Fetch revenue by year data
    const fetchRevenueByYear = useCallback(async () => {
        if (!user?._id) {
            setError("User not authenticated");
            return;
        }
        setLoading(true);
        setError("");

        try {
            // Fetch revenue by year using SummaryAPI
            const yearResponse = await SummaryAPI.statistics.getRevenueByYear(10);

            // Handle API response structure for revenue by year
            if (yearResponse && yearResponse.success) {
                const yearData = yearResponse;
                let yearlyData = [];
                let summary = null;

                if (yearData?.data?.yearlyData) {
                    yearlyData = Array.isArray(yearData.data.yearlyData) ? yearData.data.yearlyData : [];
                    summary = yearData.data.summary || null;
                } else if (yearData?.yearlyData) {
                    yearlyData = Array.isArray(yearData.yearlyData) ? yearData.yearlyData : [];
                    summary = yearData.summary || null;
                } else if (Array.isArray(yearData)) {
                    yearlyData = yearData;
                    summary = null;
                } else {
                    yearlyData = [];
                    summary = null;
                }

                setRevenueByYear(yearlyData);
                setYearSummary(summary);
            } else {
                setRevenueByYear([]);
                setYearSummary(null);
            }
        } catch (err) {
            setError(err.message || "Failed to load revenue by year statistics");
        } finally {
            setLoading(false);
        }
    }, [user]);

    // Fetch data on mount
    useEffect(() => {
        if (user?._id) {
            fetchRevenueByYear();
        }
    }, [user, fetchRevenueByYear]);

    // Format currency - memoized for performance
    const formatCurrency = useCallback((value) => {
        if (!value || value === 0) return '0 ₫';
        return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
    }, []);

    // Pre-defined gradient colors - memoized for performance
    const GRADIENT_COLORS = useMemo(() => [
        {
            bg: 'linear-gradient(135deg, rgba(59, 130, 246, 0.9) 0%, rgba(147, 197, 253, 0.9) 100%)',
            border: '#3b82f6',
            hover: 'linear-gradient(135deg, rgba(59, 130, 246, 1) 0%, rgba(147, 197, 253, 1) 100%)',
            shadow: 'rgba(59, 130, 246, 0.3)'
        },
        {
            bg: 'linear-gradient(135deg, rgba(34, 197, 94, 0.9) 0%, rgba(134, 239, 172, 0.9) 100%)',
            border: '#22c55e',
            hover: 'linear-gradient(135deg, rgba(34, 197, 94, 1) 0%, rgba(134, 239, 172, 1) 100%)',
            shadow: 'rgba(34, 197, 94, 0.3)'
        },
        {
            bg: 'linear-gradient(135deg, rgba(239, 68, 68, 0.9) 0%, rgba(252, 165, 165, 0.9) 100%)',
            border: '#ef4444',
            hover: 'linear-gradient(135deg, rgba(239, 68, 68, 1) 0%, rgba(252, 165, 165, 1) 100%)',
            shadow: 'rgba(239, 68, 68, 0.3)'
        },
        {
            bg: 'linear-gradient(135deg, rgba(168, 85, 247, 0.9) 0%, rgba(196, 181, 253, 0.9) 100%)',
            border: '#a855f7',
            hover: 'linear-gradient(135deg, rgba(168, 85, 247, 1) 0%, rgba(196, 181, 253, 1) 100%)',
            shadow: 'rgba(168, 85, 247, 0.3)'
        },
        {
            bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.9) 0%, rgba(251, 191, 36, 0.9) 100%)',
            border: '#f59e0b',
            hover: 'linear-gradient(135deg, rgba(245, 158, 11, 1) 0%, rgba(251, 191, 36, 1) 100%)',
            shadow: 'rgba(245, 158, 11, 0.3)'
        },
        {
            bg: 'linear-gradient(135deg, rgba(236, 72, 153, 0.9) 0%, rgba(251, 113, 133, 0.9) 100%)',
            border: '#ec4899',
            hover: 'linear-gradient(135deg, rgba(236, 72, 153, 1) 0%, rgba(251, 113, 133, 1) 100%)',
            shadow: 'rgba(236, 72, 153, 0.3)'
        },
        {
            bg: 'linear-gradient(135deg, rgba(20, 184, 166, 0.9) 0%, rgba(94, 234, 212, 0.9) 100%)',
            border: '#14b8a6',
            hover: 'linear-gradient(135deg, rgba(20, 184, 166, 1) 0%, rgba(94, 234, 212, 1) 100%)',
            shadow: 'rgba(20, 184, 166, 0.3)'
        }
    ], []);

    // Generate colors - optimized
    const generateColors = useCallback((dataLength) => {
        return {
            backgroundColor: GRADIENT_COLORS.slice(0, dataLength).map(c => c.bg),
            borderColor: GRADIENT_COLORS.slice(0, dataLength).map(c => c.border),
            hoverBackgroundColor: GRADIENT_COLORS.slice(0, dataLength).map(c => c.hover),
            shadowColor: GRADIENT_COLORS.slice(0, dataLength).map(c => c.shadow)
        };
    }, [GRADIENT_COLORS]);

    // Chart data - optimized with stable dependencies
    const yearChartData = useMemo(() => {
        if (revenueByYear.length === 0) {
            return {
                labels: [],
                datasets: [{
                    label: 'Revenue (Year)',
                    data: [],
                    backgroundColor: [],
                    borderColor: [],
                    hoverBackgroundColor: []
                }]
            };
        }

        const labels = revenueByYear.map(item => item.year);
        const data = revenueByYear.map(item => item.totalRevenue);
        const colors = generateColors(revenueByYear.length);

        return {
            labels,
            datasets: [{
                label: 'Revenue (Year)',
                data,
                backgroundColor: colors.backgroundColor,
                borderColor: colors.borderColor,
                hoverBackgroundColor: colors.hoverBackgroundColor,
                borderWidth: 2,
                borderRadius: {
                    topLeft: 16,
                    topRight: 16,
                    bottomLeft: 0,
                    bottomRight: 0
                },
                borderSkipped: false,
                hoverBorderWidth: 3,
                hoverBorderColor: '#ffffff',
                shadowOffsetX: 0,
                shadowOffsetY: 8,
                shadowBlur: 16,
                shadowColor: colors.shadowColor,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 8,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: colors.borderColor,
                pointHoverBorderWidth: 3
            }]
        };
    }, [revenueByYear, generateColors]);

    // Chart options - Beautiful and modern - memoized for performance
    const revenueOverTimeChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: '#374151',
                    font: { size: 14, weight: '600', family: 'Inter, system-ui, sans-serif' },
                    padding: 30,
                    usePointStyle: true,
                    pointStyle: 'rectRounded',
                    boxWidth: 16,
                    boxHeight: 16,
                    generateLabels: function (chart) {
                        return [{
                            text: 'Yearly Revenue',
                            fillStyle: '#3b82f6',
                            strokeStyle: '#3b82f6',
                            lineWidth: 2,
                            pointStyle: 'rectRounded',
                            hidden: false,
                            index: 0
                        }];
                    }
                }
            },
            title: {
                display: false
            },
            tooltip: {
                backgroundColor: 'rgba(15, 23, 42, 0.98)',
                titleColor: '#ffffff',
                bodyColor: '#f1f5f9',
                borderColor: 'rgba(59, 130, 246, 0.4)',
                borderWidth: 2,
                cornerRadius: 20,
                displayColors: true,
                titleFont: { size: 14, weight: '700', family: 'Inter, system-ui, sans-serif' },
                bodyFont: { size: 13, weight: '500', family: 'Inter, system-ui, sans-serif' },
                padding: 20,
                titleSpacing: 10,
                bodySpacing: 8,
                caretSize: 8,
                caretPadding: 10,
                callbacks: {
                    title: function (context) {
                        return `${context[0].label}`;
                    },
                    label: function (context) {
                        const dataIndex = context.dataIndex;
                        const item = revenueByYear[dataIndex];
                        const change = item?.comparedToPreviousYear || '-';

                        return [
                            `Revenue: ${formatCurrency(context.parsed.y)}`,
                            `Change: ${change}`,
                            `Year: ${item?.year || 'N/A'}`
                        ];
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
                    font: { size: 14, weight: '700', family: 'Inter, system-ui, sans-serif' },
                    padding: { top: 30, bottom: 30 }
                },
                grid: {
                    color: 'rgba(148, 163, 184, 0.1)',
                    drawBorder: false,
                    lineWidth: 1,
                    drawTicks: false,
                    borderDash: [5, 5]
                },
                ticks: {
                    color: '#64748b',
                    font: { size: 12, weight: '600', family: 'Inter, system-ui, sans-serif' },
                    padding: 15,
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
                    text: 'Year',
                    color: '#374151',
                    font: { size: 14, weight: '700', family: 'Inter, system-ui, sans-serif' },
                    padding: { top: 30, bottom: 30 }
                },
                grid: {
                    display: false
                },
                ticks: {
                    color: '#64748b',
                    font: { size: 12, weight: '600', family: 'Inter, system-ui, sans-serif' },
                    padding: 15,
                    maxRotation: 0,
                    minRotation: 0
                }
            }
        },
        elements: {
            bar: {
                borderRadius: {
                    topLeft: 16,
                    topRight: 16,
                    bottomLeft: 0,
                    bottomRight: 0
                },
                borderSkipped: false,
                inflateAmount: 'auto'
            }
        },
        interaction: {
            intersect: false,
            mode: 'index',
            axis: 'x'
        },
        animation: {
            duration: 1500,
            easing: 'easeInOutCubic',
            delay: (context) => {
                let delay = 0;
                if (context.type === 'data' && context.mode === 'default') {
                    delay = context.dataIndex * 100 + context.datasetIndex * 100;
                }
                return delay;
            }
        },
        hover: {
            animationDuration: 200
        },
        responsiveAnimationDuration: 0
    }), [formatCurrency, revenueByYear]);

    // Loading state
    if (loading) {
        return (
            <Loading
                type="page"
                size="large"
                message="Loading Revenue by Year"
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
                        <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Revenue by Year</h3>
                        <p className="text-red-700 font-medium">{error}</p>
                    </div>
                    <button
                        className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={fetchRevenueByYear}
                        aria-label="Retry loading revenue by year"
                    >
                        🔄 Retry
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 mb-4">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-2 lg:gap-3">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-lg font-semibold text-gray-900 mb-1">Revenue by Year</h1>
                        <p className="text-gray-600 text-sm">Yearly revenue performance overview</p>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            {yearSummary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                    {/* Current Year Revenue */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <FaChartLine className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Current Year</p>
                                <p className="text-sm font-bold text-gray-800 truncate">
                                    {yearSummary.currentYearRevenueFormatted || '0'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Average Yearly Revenue */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                                <FaChartLine className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Average Yearly</p>
                                <p className="text-sm font-bold text-gray-800 truncate">
                                    {yearSummary.averageYearlyRevenueFormatted || '0'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Best Year */}
                    {yearSummary.bestYear && (
                        <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <FaTrophy className="text-sm text-white" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">Best Year</p>
                                    <p className="text-xs font-bold text-gray-800 truncate">
                                        {yearSummary.bestYear}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* vs Last Year */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                <FaArrowUp className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">vs Last Year</p>
                                <p className={`text-sm font-bold ${yearSummary.changeVsLastYear?.startsWith('+')
                                    ? 'text-green-600'
                                    : yearSummary.changeVsLastYear?.startsWith('-')
                                        ? 'text-red-600'
                                        : 'text-gray-800'
                                    } truncate`}>
                                    {yearSummary.changeVsLastYear || '-'}
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* Trend Status */}
                    {yearSummary.trend && (
                        <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                            <div className="flex flex-col items-center text-center space-y-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${yearSummary.trend.status === 'increasing' ? 'bg-green-500' :
                                    yearSummary.trend.status === 'decreasing' ? 'bg-red-500' : 'bg-gray-500'
                                    }`}>
                                    {yearSummary.trend.status === 'increasing' ? (
                                        <FaArrowUp className="text-sm text-white" />
                                    ) : yearSummary.trend.status === 'decreasing' ? (
                                        <FaArrowDown className="text-sm text-white" />
                                    ) : (
                                        <FaChartLine className="text-sm text-white" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">Trend</p>
                                    <p className="text-xs font-bold text-gray-800 truncate">
                                        {yearSummary.trend.description}
                                    </p>
                                    <p className={`text-xs ${yearSummary.trend.changePercentage?.startsWith('+')
                                        ? 'text-green-600'
                                        : yearSummary.trend.changePercentage?.startsWith('-')
                                            ? 'text-red-600'
                                            : 'text-gray-500'
                                        } truncate`}>
                                        {yearSummary.trend.changePercentage || '-'} vs {yearSummary.trend.comparedTo || 'previous period'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Revenue by Year Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900">Chart & Data</h3>
                    <p className="text-gray-600 text-sm lg:text-base">Visual representation and detailed data</p>
                </div>

                {/* Chart */}
                <div className="p-3 sm:p-4 lg:p-6">
                    <div className="h-[28rem] bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-xl p-4 lg:p-6 shadow-inner border border-gray-200">
                        <div className="h-full">
                            {yearChartData.labels.length > 0 ? (
                                <Bar
                                    data={yearChartData}
                                    options={{
                                        ...revenueOverTimeChartOptions,
                                        plugins: {
                                            ...revenueOverTimeChartOptions.plugins,
                                            title: {
                                                ...revenueOverTimeChartOptions.plugins.title,
                                                text: 'Revenue by Year'
                                            }
                                        },
                                        scales: {
                                            ...revenueOverTimeChartOptions.scales,
                                            x: {
                                                ...revenueOverTimeChartOptions.scales.x,
                                                title: {
                                                    ...revenueOverTimeChartOptions.scales.x.title,
                                                    text: 'Year'
                                                }
                                            }
                                        }
                                    }}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <FaChartLine className="text-3xl text-gray-500" />
                                        </div>
                                        <p className="text-gray-600 font-semibold text-lg">
                                            No revenue data available
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RevenueByYear;
