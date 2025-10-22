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

const RevenueByWeek = ({ user }) => {
    // Data states
    const [revenueByWeek, setRevenueByWeek] = useState([]);
    const [filteredRevenueByWeek, setFilteredRevenueByWeek] = useState([]);
    const [weekSummary, setWeekSummary] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Filter states
    const [showFilter, setShowFilter] = useState(false);
    const [weeksToShow, setWeeksToShow] = useState(52); // Default to 52 weeks (12 months)

    // Get available week options based on data with descriptive labels
    const getWeekOptions = useCallback(() => {
        const totalWeeks = revenueByWeek.length;
        const options = [];

        // Quick filter options
        const quickFilters = [
            { weeks: 4, label: '1 Month (4 weeks)' },
            { weeks: 6, label: '6 Weeks' },
            { weeks: 8, label: '2 Months (8 weeks)' },
            { weeks: 12, label: '3 Months (12 weeks)' },
            { weeks: 16, label: '4 Months (16 weeks)' },
            { weeks: 24, label: '6 Months (24 weeks)' },
            { weeks: 52, label: '12 Months (52 weeks)' }
        ];

        // Add quick filter options (always show all options)
        quickFilters.forEach(filter => {
            options.push({
                value: filter.weeks,
                label: filter.label
            });
        });

        // Add total weeks if it's not already in options and has data
        if (totalWeeks > 0 && !options.some(opt => opt.value === totalWeeks)) {
            let label = `${totalWeeks} weeks`;
            if (totalWeeks >= 52) {
                const years = Math.floor(totalWeeks / 52);
                const remainingWeeks = totalWeeks % 52;
                if (remainingWeeks === 0) {
                    label = `${years} year${years > 1 ? 's' : ''} (${totalWeeks} weeks)`;
                } else {
                    label = `${years} year${years > 1 ? 's' : ''} ${remainingWeeks} weeks (${totalWeeks} weeks)`;
                }
            } else if (totalWeeks >= 12) {
                const quarters = Math.floor(totalWeeks / 12);
                const remainingWeeks = totalWeeks % 12;
                if (remainingWeeks === 0) {
                    label = `${quarters} quarter${quarters > 1 ? 's' : ''} (${totalWeeks} weeks)`;
                } else {
                    label = `${quarters} quarter${quarters > 1 ? 's' : ''} ${remainingWeeks} weeks (${totalWeeks} weeks)`;
                }
            } else if (totalWeeks >= 4) {
                const months = Math.floor(totalWeeks / 4);
                const remainingWeeks = totalWeeks % 4;
                if (remainingWeeks === 0) {
                    label = `${months} month${months > 1 ? 's' : ''} (${totalWeeks} weeks)`;
                } else {
                    label = `${months} month${months > 1 ? 's' : ''} ${remainingWeeks} weeks (${totalWeeks} weeks)`;
                }
            }
            options.push({ value: totalWeeks, label });
        }

        // Sort options by value
        return options.sort((a, b) => a.value - b.value);
    }, [revenueByWeek.length]);

    // Update filtered data when revenueByWeek or filter settings change
    useEffect(() => {
        if (!revenueByWeek || revenueByWeek.length === 0) {
            setFilteredRevenueByWeek([]);
            return;
        }

        // If requesting more weeks than available, show all available data
        if (weeksToShow >= revenueByWeek.length) {
            setFilteredRevenueByWeek(revenueByWeek);
        } else {
            // Take the most recent N weeks from the end
            const startIndex = Math.max(0, revenueByWeek.length - weeksToShow);
            const filtered = revenueByWeek.slice(startIndex);
            setFilteredRevenueByWeek(filtered);
        }
    }, [revenueByWeek, weeksToShow]);


    // Fetch revenue by week data
    const fetchRevenueByWeek = useCallback(async (requestedWeeks = 52) => {
        if (!user?._id) {
            setError("User not authenticated");
            return;
        }
        setLoading(true);
        setError("");

        try {
            // Fetch revenue by week using SummaryAPI with weeks parameter
            const weekResponse = await SummaryAPI.statistics.getRevenueByWeek(requestedWeeks);

            // Handle new API structure for revenue by week
            if (weekResponse) {
                const weekData = weekResponse;
                let weeklyData = [];
                let summary = null;

                if (weekData?.data?.weeklyData) {
                    weeklyData = weekData.data.weeklyData;
                    summary = weekData.data.summary || null;
                } else if (weekData?.weeklyData) {
                    weeklyData = weekData.weeklyData;
                    summary = weekData.summary || null;
                } else if (Array.isArray(weekData)) {
                    weeklyData = weekData;
                    summary = null;
                } else {
                    weeklyData = [];
                    summary = null;
                }

                if (Array.isArray(weeklyData) && weeklyData.length > 0) {
                    // Normalize data structure to match test data
                    const normalizedData = weeklyData.map((item, index) => ({
                        week: item.week || item.weekNumber || `Week ${index + 1}`,
                        totalRevenue: item.totalRevenue || item.revenue || item.amount || 0,
                        timeRange: item.timeRange || item.period || `Week ${index + 1}`,
                        comparedToPreviousWeek: item.comparedToPreviousWeek || item.change || '-'
                    }));

                    setRevenueByWeek(normalizedData);
                    setWeekSummary(summary);
                } else {
                    setRevenueByWeek([]);
                    setWeekSummary(null);
                }
            } else {
                setRevenueByWeek([]);
                setWeekSummary(null);
            }
        } catch (err) {
            setError(err.message || "Failed to load revenue by week statistics");
            console.error("Fetch revenue by week error:", err);
        } finally {
            setLoading(false);
        }
    }, [user?._id]);

    // Fetch data on mount
    useEffect(() => {
        if (user?._id) {
            // Fetch with default 52 weeks to get maximum data
            fetchRevenueByWeek(52);
        }
    }, [user, fetchRevenueByWeek]);

    // Remove auto-refetch to prevent infinite loops and slow loading

    // Filter functions
    const handleChangeWeeksToShow = (weeks) => {
        setWeeksToShow(weeks);

        // Refetch data with new weeks parameter if needed
        if (weeks > revenueByWeek.length) {
            fetchRevenueByWeek(weeks);
        }
    };


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
    const weekChartData = useMemo(() => {
        if (filteredRevenueByWeek.length === 0) {
            return {
                labels: [],
                datasets: [{
                    label: 'Revenue (Week)',
                    data: [],
                    backgroundColor: [],
                    borderColor: [],
                    hoverBackgroundColor: []
                }]
            };
        }

        const labels = filteredRevenueByWeek.map((item, index) =>
            item.week || item.weekNumber || `Week ${index + 1}`
        );

        const data = filteredRevenueByWeek.map((item) =>
            item.totalRevenue || item.revenue || item.amount || 0
        );

        const colors = generateColors(filteredRevenueByWeek.length);

        return {
            labels,
            datasets: [{
                label: 'Revenue (Week)',
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
    }, [filteredRevenueByWeek, generateColors]);

    // Calculate summary data based on filtered data - optimized
    const summaryData = useMemo(() => {
        if (filteredRevenueByWeek.length === 0) {
            return {
                totalRevenue: 0,
                averageRevenue: 0,
                changeVsPrevious: '-',
                bestWeek: '-',
                totalRevenueFormatted: '0 ₫',
                averageRevenueFormatted: '0 ₫'
            };
        }

        const totalRevenue = filteredRevenueByWeek.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
        const averageRevenue = totalRevenue / filteredRevenueByWeek.length;

        // Calculate change vs previous period
        let changeVsPrevious = '-';
        if (filteredRevenueByWeek.length >= 2) {
            const currentPeriod = filteredRevenueByWeek[filteredRevenueByWeek.length - 1].totalRevenue || 0;
            const previousPeriod = filteredRevenueByWeek[filteredRevenueByWeek.length - 2].totalRevenue || 0;

            if (previousPeriod > 0) {
                const change = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
                changeVsPrevious = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
            }
        }

        // Find best week
        const bestWeek = filteredRevenueByWeek.reduce((max, item) =>
            (item.totalRevenue || 0) > (max.totalRevenue || 0) ? item : max
        );

        return {
            totalRevenue,
            averageRevenue,
            changeVsPrevious,
            bestWeek: bestWeek.week || '-',
            totalRevenueFormatted: formatCurrency(totalRevenue),
            averageRevenueFormatted: formatCurrency(averageRevenue)
        };
    }, [filteredRevenueByWeek, formatCurrency]);


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
                            text: 'Weekly Revenue',
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
                        const item = filteredRevenueByWeek[dataIndex];
                        const change = item?.comparedToPreviousWeek || '-';
                        // const changeColor = change.startsWith('+') ? '#10b981' : change.startsWith('-') ? '#ef4444' : '#6b7280';

                        return [
                            `Revenue: ${formatCurrency(context.parsed.y)}`,
                            `Change: ${change}`,
                            `Period: ${item?.timeRange || 'N/A'}`
                        ];
                    },
                    // labelColor: function (context) {
                    //     return {
                    //         borderColor: '#3b82f6',
                    //         backgroundColor: '#3b82f6',
                    //         borderWidth: 2,
                    //         borderRadius: 4
                    //     };
                    // }
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
                    text: 'Week',
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
    }), [formatCurrency, filteredRevenueByWeek]);

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96" role="status" aria-live="true">
                <div className="text-center">
                    <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6 shadow-lg"></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Loading Revenue by Week</h3>
                    <p className="text-gray-600 font-medium">Please wait while we fetch your data...</p>
                </div>
            </div>
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
                        <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Revenue by Week</h3>
                        <p className="text-red-700 font-medium">{error}</p>
                    </div>
                    <button
                        className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={fetchRevenueByWeek}
                        aria-label="Retry loading revenue by week"
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
                        <h1 className="text-lg font-semibold text-gray-900 mb-1">Revenue by Week</h1>
                        <p className="text-gray-600 text-sm">Weekly revenue performance overview</p>
                    </div>
                    <button
                        className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all duration-200 shadow-sm hover:shadow-md text-xs lg:text-sm"
                        onClick={() => setShowFilter(!showFilter)}
                        aria-label="Toggle filters"
                    >
                        <svg className="w-3 h-3 lg:w-4 lg:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.207A1 1 0 013 6.5V4z" />
                        </svg>
                        <span className="font-medium hidden sm:inline">{showFilter ? 'Hide Filters' : 'Show Filters'}</span>
                        <span className="font-medium sm:hidden">Filters</span>
                    </button>
                </div>
            </div>

            {/* Filter Section */}
            {showFilter && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
                    <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Filter Options</h2>
                    {weeksToShow === 52 && revenueByWeek.length < 52 && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-blue-800">
                                    <strong>Info:</strong> Requesting 52 weeks but only {revenueByWeek.length} weeks of data available.
                                    Chart will display all available data.
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                        <div>
                            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Time Period</label>
                            <select
                                value={weeksToShow}
                                onChange={(e) => handleChangeWeeksToShow(parseInt(e.target.value))}
                                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                            >
                                {getWeekOptions().map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setWeeksToShow(52);
                                }}
                                className="w-full px-3 py-2 lg:px-4 lg:py-3 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm lg:text-base"
                            >
                                Reset Filters
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            {weekSummary && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
                    {/* Current Week Revenue */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <FaChartLine className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Current Week</p>
                                <p className="text-sm font-bold text-gray-800 truncate">
                                    {weekSummary.currentWeekRevenueFormatted || '0'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Average Weekly Revenue */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                                <FaChartLine className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Average Weekly</p>
                                <p className="text-sm font-bold text-gray-800 truncate">
                                    {weekSummary.averageWeeklyRevenueFormatted || '0'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Best Week */}
                    {weekSummary.bestWeek && (
                        <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <FaTrophy className="text-sm text-white" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">Best Week</p>
                                    <p className="text-xs font-bold text-gray-800 truncate">
                                        {weekSummary.bestWeek}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* vs Last Week */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                <FaArrowUp className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">vs Last Week</p>
                                <p className={`text-sm font-bold ${weekSummary.changeVsLastWeek?.startsWith('+')
                                    ? 'text-green-600'
                                    : weekSummary.changeVsLastWeek?.startsWith('-')
                                        ? 'text-red-600'
                                        : 'text-gray-800'
                                    } truncate`}>
                                    {weekSummary.changeVsLastWeek || '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Trend Status */}
                    {weekSummary.trend && (
                        <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                            <div className="flex flex-col items-center text-center space-y-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${weekSummary.trend.status === 'increasing' ? 'bg-green-500' :
                                    weekSummary.trend.status === 'decreasing' ? 'bg-red-500' : 'bg-gray-500'
                                    }`}>
                                    {weekSummary.trend.status === 'increasing' ? (
                                        <FaArrowUp className="text-sm text-white" />
                                    ) : weekSummary.trend.status === 'decreasing' ? (
                                        <FaArrowDown className="text-sm text-white" />
                                    ) : (
                                        <FaChartLine className="text-sm text-white" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">Trend</p>
                                    <p className="text-xs font-bold text-gray-800 truncate">
                                        {weekSummary.trend.description}
                                    </p>
                                    <p className={`text-xs ${weekSummary.trend.changePercentage?.startsWith('+')
                                        ? 'text-green-600'
                                        : weekSummary.trend.changePercentage?.startsWith('-')
                                            ? 'text-red-600'
                                            : 'text-gray-500'
                                        } truncate`}>
                                        {weekSummary.trend.changePercentage || '-'} vs {weekSummary.trend.comparedTo || 'previous period'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Revenue by Week Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900">Chart & Data</h3>
                    <p className="text-gray-600 text-sm lg:text-base">Visual representation and detailed data</p>
                </div>

                {/* Chart */}
                <div className="p-3 sm:p-4 lg:p-6">
                    <div className="h-[28rem] bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-xl p-4 lg:p-6 shadow-inner border border-gray-200">
                        <div className="h-full">
                            {weekChartData.labels.length > 0 ? (
                                <Bar
                                    key={`chart-${filteredRevenueByWeek.length}-${weeksToShow}`}
                                    data={weekChartData}
                                    options={{
                                        ...revenueOverTimeChartOptions,
                                        plugins: {
                                            ...revenueOverTimeChartOptions.plugins,
                                            title: {
                                                ...revenueOverTimeChartOptions.plugins.title,
                                                text: 'Revenue by Week'
                                            }
                                        },
                                        scales: {
                                            ...revenueOverTimeChartOptions.scales,
                                            x: {
                                                ...revenueOverTimeChartOptions.scales.x,
                                                title: {
                                                    ...revenueOverTimeChartOptions.scales.x.title,
                                                    text: 'Week'
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
                                            No revenue data available for {weeksToShow} weeks
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

export default RevenueByWeek;
