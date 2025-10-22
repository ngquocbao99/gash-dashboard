import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Line } from 'react-chartjs-2';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
} from 'chart.js';
import { FaChartLine, FaArrowUp, FaArrowDown, FaTrophy } from 'react-icons/fa';
import { debounce } from 'lodash';
import SummaryAPI from "../../common/SummaryAPI";

// Register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

const RevenueByDay = ({ user }) => {
    // Data states
    const [revenueByDay, setRevenueByDay] = useState([]);
    const [filteredRevenueByDay, setFilteredRevenueByDay] = useState([]);
    const [daySummary, setDaySummary] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Filter states
    const [showFilter, setShowFilter] = useState(false);
    const [filterType, setFilterType] = useState('currentMonth');
    const [selectedMonth, setSelectedMonth] = useState('');
    const [selectedYear, setSelectedYear] = useState('');
    const [filterLoading, setFilterLoading] = useState(false);

    // Cache for fetched data
    const [dataCache, setDataCache] = useState(new Map());

    // Get current month in YYYY-MM format
    const getCurrentMonth = () => {
        const now = new Date();
        const year = now.getFullYear();
        const month = (now.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    };

    // Get month options
    const getMonthOptions = useCallback(() => {
        const months = [
            { value: '01', label: 'January' },
            { value: '02', label: 'February' },
            { value: '03', label: 'March' },
            { value: '04', label: 'April' },
            { value: '05', label: 'May' },
            { value: '06', label: 'June' },
            { value: '07', label: 'July' },
            { value: '08', label: 'August' },
            { value: '09', label: 'September' },
            { value: '10', label: 'October' },
            { value: '11', label: 'November' },
            { value: '12', label: 'December' }
        ];
        return months;
    }, []);

    // Get year options (last 3 years)
    const getYearOptions = useCallback(() => {
        const options = [];
        const currentYear = new Date().getFullYear();

        for (let i = 0; i < 3; i++) {
            const year = currentYear - i;
            options.push({
                value: year.toString(),
                label: year.toString()
            });
        }

        return options;
    }, []);

    // Fetch revenue by day data
    const fetchRevenueByDay = useCallback(async (params = {}) => {
        if (!user?._id) {
            setError("User not authenticated");
            return;
        }

        setLoading(true);
        setError("");

        try {
            const response = await SummaryAPI.statistics.getRevenueByDay(params);

            if (response?.data) {
                const { dailyData, summary } = response.data;

                if (Array.isArray(dailyData) && dailyData.length > 0) {
                    setRevenueByDay(dailyData);
                    setDaySummary(summary);
                    setFilteredRevenueByDay(dailyData);

                    // Cache the data
                    const cacheKey = JSON.stringify(params);
                    setDataCache(prev => new Map(prev.set(cacheKey, {
                        revenueByDay: dailyData,
                        daySummary: summary
                    })));
                } else {
                    setRevenueByDay([]);
                    setDaySummary(null);
                    setFilteredRevenueByDay([]);
                }
            } else {
                setRevenueByDay([]);
                setDaySummary(null);
                setFilteredRevenueByDay([]);
            }
        } catch (err) {
            setError(err.message || "Failed to load revenue by day statistics");
        } finally {
            setLoading(false);
        }
    }, [user?._id]);

    // Fetch data on mount with current month
    useEffect(() => {
        if (user?._id) {
            const currentMonth = getCurrentMonth();
            const now = new Date();
            const currentMonthNum = (now.getMonth() + 1).toString().padStart(2, '0');
            const currentYear = now.getFullYear().toString();

            setSelectedMonth(currentMonthNum);
            setSelectedYear(currentYear);
            fetchRevenueByDay({ month: currentMonth });
        }
    }, [user, fetchRevenueByDay]);

    // Debounced fetch function (reduced delay for better UX)
    const debouncedFetch = useMemo(
        () => debounce((params) => {
            setFilterLoading(true);
            fetchRevenueByDay(params).finally(() => {
                setFilterLoading(false);
            });
        }, 150),
        [fetchRevenueByDay]
    );

    // Auto-fetch when filter type changes
    useEffect(() => {
        if (filterType === 'currentMonth') {
            const currentMonth = getCurrentMonth();
            const now = new Date();
            const currentMonthNum = (now.getMonth() + 1).toString().padStart(2, '0');
            const currentYear = now.getFullYear().toString();

            setSelectedMonth(currentMonthNum);
            setSelectedYear(currentYear);
            debouncedFetch({ month: currentMonth });
        }
    }, [filterType, debouncedFetch]);

    // Auto-fetch when both month and year are selected
    useEffect(() => {
        if (filterType === 'specificMonth' && selectedMonth && selectedYear) {
            // Validate that the selected month-year is not in the future
            const now = new Date();
            const currentYear = now.getFullYear();
            const currentMonth = now.getMonth() + 1;
            const yearNum = parseInt(selectedYear);
            const monthNum = parseInt(selectedMonth);

            if (yearNum > currentYear || (yearNum === currentYear && monthNum > currentMonth)) {
                setError('Cannot select a month in the future. Please select a valid month.');
                return;
            }

            const monthYear = `${selectedYear}-${selectedMonth}`;
            setError(''); // Clear any previous errors
            debouncedFetch({ month: monthYear });
        }
    }, [selectedMonth, selectedYear, filterType, debouncedFetch]);

    // Clear cache function
    const clearCache = useCallback(() => {
        setDataCache(new Map());
    }, []);


    // Format currency - memoized for performance
    const formatCurrency = useCallback((value) => {
        if (!value || value === 0) return '0 ₫';
        return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
    }, []);

    // Chart data - optimized with stable dependencies
    const dayChartData = useMemo(() => {
        if (filteredRevenueByDay.length === 0) {
            return {
                labels: [],
                datasets: [{
                    label: 'Revenue (Day)',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    fill: true
                }]
            };
        }

        const labels = filteredRevenueByDay.map((item, index) => {
            // Extract day number from date or use index + 1
            if (item.fullDate) {
                const date = new Date(item.fullDate);
                return date.getDate().toString();
            } else if (item.date) {
                // If date is in DD/MM/YYYY format, extract day
                const dayMatch = item.date.match(/^(\d+)\//);
                if (dayMatch) {
                    return dayMatch[1];
                }
            }
            return (index + 1).toString();
        });

        const data = filteredRevenueByDay.map((item) =>
            item.totalRevenue || item.revenue || item.amount || 0
        );

        return {
            labels,
            datasets: [{
                label: 'Revenue (Day)',
                data,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#3b82f6',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2
            }]
        };
    }, [filteredRevenueByDay]);

    // Calculate summary data based on filtered data - optimized
    const summaryData = useMemo(() => {
        if (filteredRevenueByDay.length === 0) {
            return {
                totalRevenue: 0,
                averageRevenue: 0,
                changeVsPrevious: '-',
                bestDay: '-',
                totalRevenueFormatted: '0 ₫',
                averageRevenueFormatted: '0 ₫',
                activeDays: 0,
                activityRate: '0.0%',
                growthRate: '-',
                dateRange: {
                    startDate: '-',
                    endDate: '-',
                    totalDays: 0
                }
            };
        }

        // Use API summary data if available, otherwise calculate from filtered data
        if (daySummary) {
            return {
                // Main summary data
                totalRevenue: daySummary.totalRevenueInPeriod || 0,
                averageRevenue: daySummary.averageDailyRevenue || 0,
                changeVsPrevious: daySummary.changeVsLastDay || '-',
                bestDay: daySummary.bestDayInPeriod || '-',
                totalRevenueFormatted: (daySummary.totalRevenueInPeriodFormatted || '0'),
                averageRevenueFormatted: (daySummary.averageDailyRevenueFormatted || '0'),
                activeDays: daySummary.activeDays || 0,
                activityRate: daySummary.activityRate || '0.0%',
                growthRate: daySummary.growthRate || '-',
                dateRange: daySummary.dateRange || {
                    startDate: '-',
                    endDate: '-',
                    totalDays: 0
                },
                // Additional API fields
                totalRevenueToday: daySummary.totalRevenueToday || 0,
                totalRevenueTodayFormatted: (daySummary.totalRevenueTodayFormatted || '0'),
                changeVsLastDay: daySummary.changeVsLastDay || '-',
                changeVsSameDayLastWeek: daySummary.changeVsSameDayLastWeek || '-',
                totalRevenueInPeriod: daySummary.totalRevenueInPeriod || 0,
                totalRevenueInPeriodFormatted: (daySummary.totalRevenueInPeriodFormatted || '0'),
                averageDailyRevenue: daySummary.averageDailyRevenue || 0,
                averageDailyRevenueFormatted: (daySummary.averageDailyRevenueFormatted || '0'),
                bestDayInPeriod: daySummary.bestDayInPeriod || 'No data',
                // New summary fields for monthly view
                monthlyRevenue: daySummary.totalRevenueInPeriod || 0,
                monthlyRevenueFormatted: (daySummary.totalRevenueInPeriodFormatted || '0'),
                changeVsPreviousMonth: daySummary.changeVsLastDay || '-',
                changeVsSamePeriodLastYear: daySummary.growthRate || '-',
                averageMonthlyRevenue: daySummary.averageDailyRevenue || 0,
                averageMonthlyRevenueFormatted: (daySummary.averageDailyRevenueFormatted || '0'),
                bestMonth: daySummary.bestDayInPeriod || 'No data'
            };
        }

        // Fallback calculation from filtered data
        const totalRevenue = filteredRevenueByDay.reduce((sum, item) => sum + (item.totalRevenue || 0), 0);
        const averageRevenue = totalRevenue / filteredRevenueByDay.length;
        const activeDays = filteredRevenueByDay.filter(item => (item.totalRevenue || 0) > 0).length;
        const activityRate = filteredRevenueByDay.length > 0 ? ((activeDays / filteredRevenueByDay.length) * 100).toFixed(1) + '%' : '0.0%';

        // Calculate change vs previous period
        let changeVsPrevious = '-';
        if (filteredRevenueByDay.length >= 2) {
            const currentPeriod = filteredRevenueByDay[filteredRevenueByDay.length - 1].totalRevenue || 0;
            const previousPeriod = filteredRevenueByDay[filteredRevenueByDay.length - 2].totalRevenue || 0;

            if (previousPeriod > 0) {
                const change = ((currentPeriod - previousPeriod) / previousPeriod) * 100;
                changeVsPrevious = change > 0 ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`;
            }
        }

        // Find best day
        const bestDay = filteredRevenueByDay.reduce((max, item) =>
            (item.totalRevenue || 0) > (max.totalRevenue || 0) ? item : max
        );

        return {
            totalRevenue,
            averageRevenue,
            changeVsPrevious,
            bestDay: bestDay.day || bestDay.date || '-',
            totalRevenueFormatted: formatCurrency(totalRevenue),
            averageRevenueFormatted: formatCurrency(averageRevenue),
            activeDays,
            activityRate,
            growthRate: changeVsPrevious,
            dateRange: {
                startDate: filteredRevenueByDay[0]?.fullDate || '-',
                endDate: filteredRevenueByDay[filteredRevenueByDay.length - 1]?.fullDate || '-',
                totalDays: filteredRevenueByDay.length
            }
        };
    }, [filteredRevenueByDay, formatCurrency, daySummary]);

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
                    boxHeight: 16
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
                        const dataIndex = context[0].dataIndex;
                        const item = filteredRevenueByDay[dataIndex];

                        // Try to get date from various possible fields
                        let date = null;
                        if (item?.fullDate) {
                            date = new Date(item.fullDate);
                        } else if (item?.date && typeof item.date === 'string' && item.date.includes('/')) {
                            // Handle DD/MM/YYYY format
                            const parts = item.date.split('/');
                            if (parts.length === 3) {
                                date = new Date(parts[2], parts[1] - 1, parts[0]);
                            }
                        }

                        // If we have a valid date, show weekday + date in DD/MM/YYYY format
                        if (date && !isNaN(date.getTime())) {
                            const weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
                            const day = date.getDate().toString().padStart(2, '0');
                            const month = (date.getMonth() + 1).toString().padStart(2, '0');
                            const year = date.getFullYear();
                            return `${weekday}, ${day}/${month}/${year}`;
                        }

                        // Fallback: use the date string if available
                        if (item?.date) {
                            return item.date;
                        }

                        return `Day ${context[0].label}`;
                    },
                    label: function (context) {
                        const dataIndex = context.dataIndex;
                        const item = filteredRevenueByDay[dataIndex];
                        const change = item?.comparedToPreviousDay || '-';

                        return [
                            `Revenue: ${formatCurrency(context.parsed.y)}`,
                            `Change: ${change}`
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
                    text: 'Day of Month',
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
                    maxRotation: 45,
                    minRotation: 0
                }
            }
        },
        elements: {
            line: {
                tension: 0.4
            },
            point: {
                radius: 6,
                hoverRadius: 8
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
                    delay = context.dataIndex * 50 + context.datasetIndex * 50;
                }
                return delay;
            }
        },
        hover: {
            animationDuration: 200
        },
        responsiveAnimationDuration: 0
    }), [formatCurrency, filteredRevenueByDay]);

    // Loading state
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-96" role="status" aria-live="true">
                <div className="text-center">
                    <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-6 shadow-lg"></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">Loading Revenue by Day</h3>
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
                        <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Revenue by Day</h3>
                        <p className="text-red-700 font-medium">{error}</p>
                    </div>
                    <button
                        className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
                        onClick={() => fetchRevenueByDay({ month: getCurrentMonth() })}
                        aria-label="Retry loading revenue by day"
                    >
                        Retry
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
                        <h1 className="text-lg font-semibold text-gray-900 mb-1">Revenue by Day</h1>
                        <p className="text-gray-600 text-sm">Daily revenue performance overview</p>
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                        <div>
                            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Filter Type</label>
                            <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                            >
                                <option value="currentMonth">Current Month</option>
                                <option value="specificMonth">Specific Month</option>
                            </select>
                        </div>

                        {/* Specific Month Filter */}
                        {filterType === 'specificMonth' && (
                            <>
                                <div>
                                    <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Month</label>
                                    <select
                                        value={selectedMonth}
                                        onChange={(e) => {
                                            setSelectedMonth(e.target.value);
                                            setSelectedYear(''); // Clear year when month changes
                                            setError(''); // Clear error when user changes selection
                                        }}
                                        disabled={filterLoading}
                                        className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                                    >
                                        <option value="">Select Month</option>
                                        {getMonthOptions().map((option) => (
                                            <option key={option.value} value={option.value}>
                                                {option.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">
                                        Year {!selectedMonth && <span className="text-red-500">(Select month first)</span>}
                                    </label>
                                    <select
                                        value={selectedYear}
                                        onChange={(e) => {
                                            setSelectedYear(e.target.value);
                                            setError(''); // Clear error when user changes selection
                                        }}
                                        disabled={filterLoading || !selectedMonth}
                                        className={`w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base ${filterLoading || !selectedMonth ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        <option value="">Select Year</option>
                                        {getYearOptions().map((option) => {
                                            const now = new Date();
                                            const currentYear = now.getFullYear();
                                            const currentMonth = now.getMonth() + 1;
                                            const yearNum = parseInt(option.value);
                                            const monthNum = parseInt(selectedMonth);

                                            // Disable if year is in the future OR if year is current year and selected month is in the future
                                            const isFutureYear = yearNum > currentYear;
                                            const isFutureMonth = yearNum === currentYear && monthNum > currentMonth;
                                            const isDisabled = isFutureYear || isFutureMonth;

                                            return (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                    disabled={isDisabled}
                                                >
                                                    {option.label}
                                                </option>
                                            );
                                        })}
                                    </select>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span className="text-sm text-red-800">{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Status Messages */}
                    {filterType === 'specificMonth' && !selectedMonth && (
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <span className="text-sm text-yellow-800">
                                    Step 1: Please select a month first
                                </span>
                            </div>
                        </div>
                    )}

                    {filterType === 'specificMonth' && selectedMonth && !selectedYear && (
                        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span className="text-sm text-blue-800">
                                    Step 2: Select a year to load data automatically
                                </span>
                            </div>
                        </div>
                    )}

                    {filterType === 'specificMonth' && selectedMonth && selectedYear && filterLoading && (
                        <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center">
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin mr-2"></div>
                                <span className="text-sm text-green-800">
                                    Loading data for {selectedMonth}/{selectedYear}...
                                </span>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Summary Cards */}
            {(filteredRevenueByDay.length > 0 || daySummary) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3 mb-6">
                    {/* Today's Revenue */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                <FaArrowUp className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Today's Revenue</p>
                                <p className="text-sm font-bold text-gray-800 truncate">
                                    {daySummary?.totalRevenueTodayFormatted || '0'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Average Daily Revenue */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                                <FaChartLine className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">Average Daily</p>
                                <p className="text-sm font-bold text-gray-800 truncate">
                                    {daySummary?.averageDailyRevenueFormatted || '0'}
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* Best Day in Period */}
                    {daySummary?.bestDayInPeriod && (
                        <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                                    <FaTrophy className="text-sm text-white" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">Best Day</p>
                                    <p className="text-xs font-bold text-gray-800 truncate">
                                        {daySummary.bestDayInPeriod}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* vs Last Day */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                <FaArrowUp className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">vs Last Day</p>
                                <p className={`text-sm font-bold ${daySummary?.changeVsLastDay?.startsWith('+')
                                    ? 'text-green-600'
                                    : daySummary?.changeVsLastDay?.startsWith('-')
                                        ? 'text-red-600'
                                        : 'text-gray-800'
                                    } truncate`}>
                                    {daySummary?.changeVsLastDay || '-'}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* vs Same Day Last Week */}
                    <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                        <div className="flex flex-col items-center text-center space-y-2">
                            <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                <FaChartLine className="text-sm text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium mb-1">vs Same Day Last Week</p>
                                <p className={`text-sm font-bold ${daySummary?.changeVsSameDayLastWeek?.startsWith('+')
                                    ? 'text-green-600'
                                    : daySummary?.changeVsSameDayLastWeek?.startsWith('-')
                                        ? 'text-red-600'
                                        : 'text-gray-800'
                                    } truncate`}>
                                    {daySummary?.changeVsSameDayLastWeek || '-'}
                                </p>
                            </div>
                        </div>
                    </div>


                    {/* Trend Status */}
                    {daySummary?.trend && (
                        <div className="bg-white rounded-xl p-3 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center">
                            <div className="flex flex-col items-center text-center space-y-1">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${daySummary.trend.status === 'increasing' ? 'bg-green-500' :
                                    daySummary.trend.status === 'decreasing' ? 'bg-red-500' : 'bg-gray-500'
                                    }`}>
                                    {daySummary.trend.status === 'increasing' ? (
                                        <FaArrowUp className="text-sm text-white" />
                                    ) : daySummary.trend.status === 'decreasing' ? (
                                        <FaArrowDown className="text-sm text-white" />
                                    ) : (
                                        <FaChartLine className="text-sm text-white" />
                                    )}
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">Trend</p>
                                    <p className="text-xs font-bold text-gray-800 truncate">
                                        {daySummary.trend.description}
                                    </p>
                                    <p className={`text-xs ${daySummary.trend.changePercentage?.startsWith('+')
                                        ? 'text-green-600'
                                        : daySummary.trend.changePercentage?.startsWith('-')
                                            ? 'text-red-600'
                                            : 'text-gray-500'
                                        } truncate`}>
                                        {daySummary.trend.changePercentage || '-'} vs {daySummary.trend.comparedTo === '7-day average' ? '7-day average' : daySummary.trend.comparedTo || 'previous period'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Revenue by Day Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900">Chart & Data</h3>
                    <p className="text-gray-600 text-sm lg:text-base">Visual representation and detailed data</p>
                </div>

                {/* Chart */}
                <div className="p-3 sm:p-4 lg:p-6">
                    <div className="h-[28rem] bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-xl p-4 lg:p-6 shadow-inner border border-gray-200">
                        <div className="h-full">
                            {dayChartData.labels.length > 0 ? (
                                <Line
                                    key={`chart-${filteredRevenueByDay.length}`}
                                    data={dayChartData}
                                    options={{
                                        ...revenueOverTimeChartOptions,
                                        plugins: {
                                            ...revenueOverTimeChartOptions.plugins,
                                            title: {
                                                ...revenueOverTimeChartOptions.plugins.title,
                                                text: 'Revenue by Day'
                                            }
                                        },
                                        scales: {
                                            ...revenueOverTimeChartOptions.scales,
                                            x: {
                                                ...revenueOverTimeChartOptions.scales.x,
                                                title: {
                                                    ...revenueOverTimeChartOptions.scales.x.title,
                                                    text: 'Day of Month'
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

export default RevenueByDay;