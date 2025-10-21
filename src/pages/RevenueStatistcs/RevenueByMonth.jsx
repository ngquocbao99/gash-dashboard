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
import { FaChartLine, FaArrowUp, FaTrophy } from 'react-icons/fa';
import SummaryAPI from "../../common/SummaryAPI";
import Loading from "../../components/Loading";


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

const RevenueByMonth = ({ user }) => {
    // Data states
    const [revenueByMonth, setRevenueByMonth] = useState([]);
    const [filteredRevenueByMonth, setFilteredRevenueByMonth] = useState([]);
    const [monthSummary, setMonthSummary] = useState(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    // Filter states
    const [showFilter, setShowFilter] = useState(false);
    const [selectedYears, setSelectedYears] = useState([]); // Will be set to 2 most recent years

    // Fetch revenue by month data
    const fetchRevenueByMonth = useCallback(async (requestedYears = 10) => {
        if (!user?._id) {
            setError("User not authenticated");
            return;
        }
        setLoading(true);
        setError("");

        try {
            console.log(`Fetching revenue by month data for ${requestedYears} years using SummaryAPI...`);

            // Fetch revenue by month using SummaryAPI with years parameter
            const monthResponse = await SummaryAPI.statistics.getRevenueByMonth(requestedYears);

            console.log("Month response:", monthResponse);

            // Handle API response structure for revenue by month
            if (monthResponse && monthResponse.success) {
                const monthData = monthResponse;
                let yearlyData = [];
                let summary = null;

                if (monthData?.data?.monthlyData) {
                    console.log("Using nested data structure");
                    yearlyData = Array.isArray(monthData.data.monthlyData) ? monthData.data.monthlyData : [];
                    summary = monthData.data.summary || null;
                } else if (monthData?.monthlyData) {
                    console.log("Using direct data structure");
                    yearlyData = Array.isArray(monthData.monthlyData) ? monthData.monthlyData : [];
                    summary = monthData.summary || null;
                } else if (Array.isArray(monthData)) {
                    console.log("Using array structure");
                    yearlyData = monthData;
                    summary = null;
                } else {
                    console.log("No valid data found");
                    yearlyData = [];
                    summary = null;
                }

                console.log(`API returned ${yearlyData.length} years of data`);
                console.log('Yearly data structure:', yearlyData);
                console.log('First year data:', yearlyData[0]);

                // Validate that we have enough data
                if (yearlyData.length < 2) {
                    console.warn(`API only returned ${yearlyData.length} years, but at least 2 years are needed for comparison`);
                }

                setRevenueByMonth(yearlyData);
                setMonthSummary(summary);
            } else {
                console.log("Month response failed or not successful");
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
            // Fetch with 10 years to get maximum data
            fetchRevenueByMonth(10);
        }
    }, [user, fetchRevenueByMonth]);

    // Update filtered data when revenueByMonth or selectedYears change
    useEffect(() => {
        if (!revenueByMonth || revenueByMonth.length === 0) {
            setFilteredRevenueByMonth([]);
            return;
        }

        // Auto-select 2 most recent years
        if (selectedYears.length === 0) {
            const currentYear = new Date().getFullYear();
            const twoMostRecentYears = [currentYear, currentYear - 1];
            setSelectedYears(twoMostRecentYears);
            return;
        }

        // Filter data based on selected years
        const filtered = revenueByMonth.filter(yearData =>
            selectedYears.includes(yearData.year)
        );

        console.log('Filtering data:', {
            selectedYears,
            totalData: revenueByMonth.length,
            filteredData: filtered.length,
            filteredYears: [...new Set(filtered.map(item => item.year))]
        });

        setFilteredRevenueByMonth(filtered);
    }, [revenueByMonth, selectedYears]);

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

    // Resolve month number from various possible API formats
    const resolveMonthNumber = useCallback((item) => {
        if (!item) return null;
        if (typeof item.monthNumber === 'number' && item.monthNumber >= 1 && item.monthNumber <= 12) {
            return item.monthNumber;
        }
        if (typeof item.month === 'number' && item.month >= 1 && item.month <= 12) {
            return item.month;
        }
        const tryParseFromString = (str) => {
            if (!str || typeof str !== 'string') return null;
            // Patterns: YYYY-MM or YYYY/M or YYYY.MM
            let m = str.match(/\b(\d{4})[-\/.](\d{1,2})\b/);
            if (m) {
                const n = parseInt(m[2], 10);
                if (n >= 1 && n <= 12) return n;
            }
            // Patterns: MM/YYYY or M/YYYY
            m = str.match(/\b(\d{1,2})[-\/.](\d{4})\b/);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n >= 1 && n <= 12) return n;
            }
            // Pattern: Tháng N
            m = str.match(/tháng\s*(\d{1,2})/i);
            if (m) {
                const n = parseInt(m[1], 10);
                if (n >= 1 && n <= 12) return n;
            }
            // English month names
            const monthMap = {
                january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
                july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
                jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
            };
            const lower = str.toLowerCase();
            for (const name in monthMap) {
                if (lower.includes(name)) return monthMap[name];
            }
            return null;
        };
        return tryParseFromString(item.month) || tryParseFromString(item.timeRange) || null;
    }, []);

    // Resolve year from possible fields/strings
    const resolveYear = useCallback((item) => {
        if (!item) return null;
        if (typeof item.year === 'number' && item.year > 1900 && item.year < 3000) return item.year;
        const tryParseYear = (str) => {
            if (!str || typeof str !== 'string') return null;
            const m = str.match(/\b(19|20)\d{2}\b/);
            return m ? parseInt(m[0], 10) : null;
        };
        return tryParseYear(item.month) || tryParseYear(item.timeRange) || null;
    }, []);

    const formatMonthLabel = useCallback((item) => {
        // Prefer numeric month, format M/YY
        const monthNum = resolveMonthNumber(item);
        const yearVal = resolveYear(item) ?? (typeof item?.year === 'number' ? item.year : null);
        if (monthNum && monthNum >= 1 && monthNum <= 12) {
            const yy = (typeof yearVal === 'number' && yearVal > 0) ? String(yearVal).slice(-2) : null;
            return yy ? `${monthNum}/${yy}` : `${monthNum}`;
        }
        // Fallback from string month to number
        if (item && typeof item.month === 'string' && item.month.trim().length > 0) {
            const map = {
                january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
                july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
                jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12
            };
            const raw = item.month.trim().toLowerCase();
            const num = map[raw];
            if (num) {
                const yy = (typeof yearVal === 'number' && yearVal > 0) ? String(yearVal).slice(-2) : null;
                return yy ? `${num}/${yy}` : `${num}`;
            }
        }
        return 'N/A';
    }, [resolveMonthNumber, resolveYear]);



    // Generate colors - optimized
    const generateColors = useCallback((dataLength) => {
        return {
            backgroundColor: GRADIENT_COLORS.slice(0, dataLength).map(c => c.bg),
            borderColor: GRADIENT_COLORS.slice(0, dataLength).map(c => c.border),
            hoverBackgroundColor: GRADIENT_COLORS.slice(0, dataLength).map(c => c.hover),
            shadowColor: GRADIENT_COLORS.slice(0, dataLength).map(c => c.shadow)
        };
    }, [GRADIENT_COLORS]);

    // Generate colors for different years
    const generateYearColors = useCallback((year) => {
        const colors = [
            { border: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)', hover: 'rgba(59, 130, 246, 0.2)' },
            { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', hover: 'rgba(34, 197, 94, 0.2)' },
            { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', hover: 'rgba(239, 68, 68, 0.2)' },
            { border: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)', hover: 'rgba(168, 85, 247, 0.2)' },
            { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', hover: 'rgba(245, 158, 11, 0.2)' },
            { border: '#ec4899', bg: 'rgba(236, 72, 153, 0.1)', hover: 'rgba(236, 72, 153, 0.2)' },
            { border: '#14b8a6', bg: 'rgba(20, 184, 166, 0.1)', hover: 'rgba(20, 184, 166, 0.2)' },
            { border: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.1)', hover: 'rgba(139, 92, 246, 0.2)' },
            { border: '#f97316', bg: 'rgba(249, 115, 22, 0.1)', hover: 'rgba(249, 115, 22, 0.2)' },
            { border: '#06b6d4', bg: 'rgba(6, 182, 212, 0.1)', hover: 'rgba(6, 182, 212, 0.2)' }
        ];

        // Ensure we have a valid year and selectedYears array
        if (!year || !selectedYears || selectedYears.length === 0) {
            return colors[0]; // Return first color as fallback
        }

        const yearIndex = selectedYears.indexOf(year);
        if (yearIndex === -1) {
            return colors[0]; // Return first color if year not found
        }

        return colors[yearIndex % colors.length];
    }, [selectedYears]);

    // Chart data - optimized with stable dependencies
    const monthChartData = useMemo(() => {
        if (filteredRevenueByMonth.length === 0) {
            return {
                labels: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
                datasets: []
            };
        }

        const labels = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        // Group data by year since API now returns flat array with year per month
        const groupedByYear = {};
        filteredRevenueByMonth.forEach(monthData => {
            const year = monthData.year;
            if (!groupedByYear[year]) {
                groupedByYear[year] = [];
            }
            groupedByYear[year].push(monthData);
        });

        // Create datasets for all selected years, even if no data exists
        const datasets = selectedYears.map(year => {
            const yearData = groupedByYear[year] || [];
            const color = generateYearColors(parseInt(year));
            const data = labels.map(month => {
                const monthData = yearData.find(m => m.month === month);
                return monthData ? monthData.totalRevenue : 0;
            });

            console.log(`Creating dataset for year ${year}:`, {
                year,
                dataPoints: data.length,
                nonZeroData: data.filter(d => d > 0).length,
                yearDataLength: yearData.length,
                selectedYears: selectedYears,
                hasData: yearData.length > 0
            });

            // Fallback color if generateYearColors returns undefined
            const safeColor = color || {
                border: '#3b82f6',
                bg: 'rgba(59, 130, 246, 0.1)',
                hover: 'rgba(59, 130, 246, 0.2)'
            };

            return {
                label: `${year}`,
                data,
                backgroundColor: safeColor.bg,
                borderColor: safeColor.border,
                hoverBackgroundColor: safeColor.hover,
                borderWidth: 3,
                fill: false,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: safeColor.border,
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverBackgroundColor: '#ffffff',
                pointHoverBorderColor: safeColor.border,
                pointHoverBorderWidth: 3
            };
        });

        console.log('Final chart data:', {
            labelsCount: labels.length,
            datasetsCount: datasets.length,
            datasetLabels: datasets.map(d => d.label),
            selectedYears: selectedYears
        });

        return {
            labels,
            datasets
        };
    }, [filteredRevenueByMonth, generateYearColors, selectedYears]);


    // Chart options - Beautiful and modern - memoized for performance
    const revenueOverTimeChartOptions = useMemo(() => ({
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                display: true,
                onClick: function (e, legendItem, legend) {
                    const index = legendItem.datasetIndex;
                    const chart = legend.chart;
                    const meta = chart.getDatasetMeta(index);

                    // Toggle visibility
                    meta.hidden = meta.hidden === null ? !chart.data.datasets[index].hidden : null;
                    chart.update();
                },
                labels: {
                    color: '#374151',
                    font: { size: 14, weight: '600', family: 'Inter, system-ui, sans-serif' },
                    padding: 20,
                    usePointStyle: true,
                    pointStyle: 'circle',
                    boxWidth: 12,
                    boxHeight: 12,
                    generateLabels: function (chart) {
                        const datasets = chart.data.datasets;
                        return datasets.map((dataset, index) => {
                            const meta = chart.getDatasetMeta(index);
                            return {
                                text: dataset.label,
                                fillStyle: dataset.borderColor,
                                strokeStyle: dataset.borderColor,
                                lineWidth: 3,
                                pointStyle: 'circle',
                                hidden: meta.hidden,
                                index: index
                            };
                        });
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
                        const dataIndex = context[0].dataIndex;
                        const month = context[0].chart.data.labels[dataIndex];
                        return month;
                    },
                    label: function (context) {
                        const datasetIndex = context.datasetIndex;
                        const dataIndex = context.dataIndex;
                        const dataset = context.chart.data.datasets[datasetIndex];
                        const year = dataset.label;
                        const month = context.chart.data.labels[dataIndex];

                        // Find the original data to get comparedToPreviousMonth
                        const originalData = filteredRevenueByMonth.find(item =>
                            item.year === parseInt(year) && item.month === month
                        );

                        const comparison = originalData ? originalData.comparedToPreviousMonth : '-';

                        return [
                            `Year: ${year}`,
                            `Revenue: ${formatCurrency(context.parsed.y)}`,
                            `Change vs Previous Month: ${comparison}`
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
                type: 'category',
                title: {
                    display: true,
                    text: 'Month',
                    color: '#374151',
                    font: { size: 14, weight: '700', family: 'Inter, system-ui, sans-serif' },
                    padding: { top: 30, bottom: 30 }
                },
                grid: {
                    // Show vertical tick lines to help distinguish months
                    display: true,
                    drawOnChartArea: false,
                    color: 'rgba(148, 163, 184, 0.3)'
                },
                offset: true,
                ticks: {
                    color: '#64748b',
                    font: { size: 12, weight: '600', family: 'Inter, system-ui, sans-serif' },
                    padding: 15,
                    autoSkip: false,
                    maxTicksLimit: 12,
                    callback: function (value, index, ticks) {
                        const labels = Array.isArray(monthChartData?.labels) ? monthChartData.labels : [];
                        const labelText = String(labels[index] || value || '');

                        // Convert full month names to abbreviated form
                        const monthAbbreviations = {
                            'January': 'Jan', 'February': 'Feb', 'March': 'Mar', 'April': 'Apr',
                            'May': 'May', 'June': 'Jun', 'July': 'Jul', 'August': 'Aug',
                            'September': 'Sep', 'October': 'Oct', 'November': 'Nov', 'December': 'Dec'
                        };

                        return monthAbbreviations[labelText] || labelText;
                    },
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
    }), [formatCurrency, monthChartData.labels, filteredRevenueByMonth]);

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

    // Filter functions
    const handleYearToggle = (year) => {
        if (selectedYears.includes(year)) {
            // Only allow removal if we have more than 2 years selected
            if (selectedYears.length > 2) {
                setSelectedYears(selectedYears.filter(y => y !== year));
            }
        } else {
            // Only allow addition if we haven't reached the limit
            if (selectedYears.length < 10) {
                setSelectedYears([...selectedYears, year]);
            }
        }
    };

    const getAvailableYears = () => {
        // Always return 10 most recent years (2016-2025)
        const currentYear = new Date().getFullYear();
        const years = [];

        for (let i = 0; i < 10; i++) {
            years.push(currentYear - i);
        }

        console.log('Available years (10 most recent):', years);
        console.log('Total years available:', years.length);

        return years;
    };

    return (
        <div className="space-y-6">
            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Revenue by Month</h1>
                        <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Monthly revenue performance comparison by year</p>
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
                    <h2 className="text-base lg:text-lg font-semibold text-gray-900 mb-3 lg:mb-4">Select Years to Compare</h2>
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center">
                            <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <p className="text-sm text-blue-800">
                                <strong>Info:</strong> Select minimum 2 years, maximum 10 years for comparison.
                                Showing 10 most recent years (2016-2025). Default: 2 most recent years selected.
                            </p>
                        </div>
                    </div>

                    {/* API Warning - Hidden since we always show 10 years */}
                    {false && getAvailableYears().length > 0 && getAvailableYears().length < 2 && (
                        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <p className="text-sm text-yellow-800">
                                    <strong>Info:</strong> API returned {getAvailableYears().length} year(s) of data.
                                    {getAvailableYears().length === 1 ? ' Showing single year data.' : ' At least 2 years are recommended for comparison.'}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Year Selection Grid */}
                    {getAvailableYears().length > 0 ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 mb-4">
                            {getAvailableYears().map(year => (
                                <label key={year} className="flex items-center space-x-2 cursor-pointer p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200 hover:border-blue-300">
                                    <input
                                        type="checkbox"
                                        checked={selectedYears.includes(year)}
                                        onChange={() => handleYearToggle(year)}
                                        disabled={!selectedYears.includes(year) && selectedYears.length >= 10}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-medium ${selectedYears.includes(year) ? 'text-blue-600 font-semibold' : 'text-gray-700'}`}>
                                        {year}
                                    </span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-4">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <p className="text-sm text-yellow-800">
                                    <strong>No data available:</strong> Please wait for data to load or try refreshing the page.
                                </p>
                            </div>
                        </div>
                    )}

                    {/* Quick Selection Buttons */}
                    {getAvailableYears().length > 0 && (
                        <div className="flex flex-wrap gap-2 mb-4">
                            <button
                                onClick={() => {
                                    const availableYears = getAvailableYears();
                                    setSelectedYears(availableYears.slice(0, 2));
                                }}
                                className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm"
                            >
                                Reset to 2 Years
                            </button>
                            <button
                                onClick={() => {
                                    const availableYears = getAvailableYears();
                                    setSelectedYears(availableYears.slice(0, Math.min(3, availableYears.length)));
                                }}
                                className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm"
                            >
                                Select 3 Years
                            </button>
                            <button
                                onClick={() => {
                                    const availableYears = getAvailableYears();
                                    setSelectedYears(availableYears.slice(0, Math.min(5, availableYears.length)));
                                }}
                                className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm"
                            >
                                Select 5 Years
                            </button>
                            <button
                                onClick={() => {
                                    const availableYears = getAvailableYears();
                                    setSelectedYears(availableYears);
                                }}
                                className="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-all duration-200 border border-gray-300 hover:border-gray-400 font-medium text-sm"
                            >
                                Select All 10 Years
                            </button>
                        </div>
                    )}

                    {/* Selected Years Display */}
                    {selectedYears.length > 0 && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-green-800">
                                    <strong>Selected Years:</strong> {selectedYears.sort((a, b) => b - a).join(', ')}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Summary Cards */}
            {monthSummary && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    {/* Total Revenue This Month */}
                    <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                                <FaArrowUp className="text-xl text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium">This Month Revenue</p>
                                <p className="text-2xl font-bold text-gray-800">
                                    {monthSummary.totalRevenueThisMonthFormatted ? monthSummary.totalRevenueThisMonthFormatted + ' ₫' : formatCurrency(monthSummary.totalRevenueThisMonth)}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Change vs Last Month */}
                    <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                                <FaArrowUp className="text-xl text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium">vs Last Month</p>
                                <p className={`text-2xl font-bold ${monthSummary.changeVsLastMonth?.startsWith('+')
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
                    <div className="bg-white rounded-xl p-4 shadow-lg border border-gray-200 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
                                <FaTrophy className="text-xl text-white" />
                            </div>
                            <div>
                                <p className="text-gray-600 text-xs font-medium">Best Month</p>
                                <p className="text-lg font-bold text-gray-800">
                                    {monthSummary.bestMonthInPeriod || '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}


            {/* Revenue by Month Content */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-3 sm:p-4 lg:p-6 border-b border-gray-200">
                    <h3 className="text-base lg:text-lg font-semibold text-gray-900">Chart & Data</h3>
                    <p className="text-gray-600 text-sm lg:text-base">Visual representation and detailed data</p>
                </div>

                {/* Chart */}
                <div className="p-3 sm:p-4 lg:p-6">
                    <div className="h-[28rem] bg-gradient-to-br from-gray-50 via-white to-gray-100 rounded-xl p-4 lg:p-6 shadow-inner border border-gray-200">
                        <div className="h-full">
                            {monthChartData.datasets.length > 0 ? (
                                <Line
                                    key={`chart-${selectedYears.join('-')}-${monthChartData.datasets.length}`}
                                    data={monthChartData}
                                    options={{
                                        ...revenueOverTimeChartOptions,
                                        plugins: {
                                            ...revenueOverTimeChartOptions.plugins,
                                            title: {
                                                ...revenueOverTimeChartOptions.plugins.title,
                                                text: 'Revenue by Month - Year Comparison'
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
                                    }}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <FaChartLine className="text-3xl text-gray-500" />
                                        </div>
                                        <p className="text-gray-600 font-semibold text-lg">
                                            No revenue data available for selected years
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

export default RevenueByMonth;
