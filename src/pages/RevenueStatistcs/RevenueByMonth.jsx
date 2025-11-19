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
    const [showFilter, setShowFilter] = useState(true);
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
            // Fetch revenue by month using SummaryAPI with years parameter
            const monthResponse = await SummaryAPI.statistics.getRevenueByMonth(requestedYears);

            // Handle API response structure for revenue by month
            if (monthResponse && monthResponse.success) {
                const monthData = monthResponse;
                let yearlyData = [];
                let summary = null;

                if (monthData?.data?.monthlyData) {
                    yearlyData = Array.isArray(monthData.data.monthlyData) ? monthData.data.monthlyData : [];
                    summary = monthData.data.summary || null;
                } else if (monthData?.monthlyData) {
                    yearlyData = Array.isArray(monthData.monthlyData) ? monthData.monthlyData : [];
                    summary = monthData.summary || null;
                } else if (Array.isArray(monthData)) {
                    yearlyData = monthData;
                    summary = null;
                } else {
                    yearlyData = [];
                    summary = null;
                }

                // Validate that we have enough data
                if (yearlyData.length < 2) {
                }

                setRevenueByMonth(yearlyData);
                setMonthSummary(summary);
            } else {
                setRevenueByMonth([]);
                setMonthSummary(null);
            }
        } catch (err) {
            setError(err.message || "Failed to load revenue by month statistics");
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

        setFilteredRevenueByMonth(filtered);
    }, [revenueByMonth, selectedYears]);

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
                    text: 'Revenue (đ)',
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
                            return (value / 1000000).toFixed(1) + 'M đ';
                        } else if (value >= 1000) {
                            return (value / 1000).toFixed(0) + 'K đ';
                        }
                        return value + ' đ';
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

    // Get default years (2 most recent)
    const getDefaultYears = useCallback(() => {
        const currentYear = new Date().getFullYear();
        return [currentYear, currentYear - 1];
    }, []);

    // Check if any filters are active
    const hasActiveFilters = useCallback(() => {
        const defaultYears = getDefaultYears().sort((a, b) => b - a);
        const currentYears = [...selectedYears].sort((a, b) => b - a);

        // Check if selectedYears is different from default (2 most recent years)
        if (currentYears.length !== defaultYears.length) {
            return true;
        }

        // Check if years are different
        return !currentYears.every((year, index) => year === defaultYears[index]);
    }, [selectedYears, getDefaultYears]);

    // Clear all filters
    const clearFilters = useCallback(() => {
        const defaultYears = getDefaultYears();
        setSelectedYears(defaultYears);
    }, [getDefaultYears]);

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

        return years;
    };

    // Loading state
    if (loading) {
        return (
            <div className="backdrop-blur-xl rounded-xl border p-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(233, 163, 25, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }} role="status" aria-live="polite">
                <Loading
                    type="page"
                    size="medium"
                    message="Loading Revenue by Month..."
                />
            </div>
        );
    }

    // Error state
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
                            onClick={fetchRevenueByMonth}
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
                    <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2 leading-tight">Revenue by Month</h1>
                    <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Monthly revenue performance comparison by year</p>
                </div>
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 lg:gap-4 shrink-0">
                    <button
                        className="flex items-center space-x-1 lg:space-x-2 px-3 lg:px-4 py-2 lg:py-3 text-white rounded-xl transition-all duration-300 shadow-lg hover:shadow-xl text-xs lg:text-sm font-semibold bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 transform hover:scale-105"
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
                <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                    {/* Header with Selected Years */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                        <h2 className="text-base lg:text-lg font-semibold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">Search & Filter</h2>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={clearFilters}
                                disabled={!hasActiveFilters()}
                                className="px-2 py-1.5 lg:px-3 lg:py-2 text-gray-600 hover:text-white hover:bg-gradient-to-r hover:from-red-500 hover:via-pink-500 hover:to-rose-500 rounded-xl transition-all duration-300 border-2 border-gray-300/60 hover:border-transparent font-medium text-xs lg:text-sm disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-600 shadow-md hover:shadow-lg"
                                aria-label="Clear all filters"
                            >
                                Clear
                            </button>
                        </div>
                    </div>

                    {/* Quick Selection Buttons - Compact */}
                    {getAvailableYears().length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-3">
                            <button
                                onClick={clearFilters}
                                className="px-2 py-1 text-gray-600 hover:text-white hover:bg-gradient-to-r hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 rounded-lg transition-all duration-300 border border-gray-300/60 hover:border-transparent font-medium text-xs shadow-sm hover:shadow-md"
                            >
                                2 Years
                            </button>
                            <button
                                onClick={() => {
                                    const availableYears = getAvailableYears();
                                    setSelectedYears(availableYears.slice(0, Math.min(3, availableYears.length)));
                                }}
                                className="px-2 py-1 text-gray-600 hover:text-white hover:bg-gradient-to-r hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 rounded-lg transition-all duration-300 border border-gray-300/60 hover:border-transparent font-medium text-xs shadow-sm hover:shadow-md"
                            >
                                3 Years
                            </button>
                            <button
                                onClick={() => {
                                    const availableYears = getAvailableYears();
                                    setSelectedYears(availableYears.slice(0, Math.min(5, availableYears.length)));
                                }}
                                className="px-2 py-1 text-gray-600 hover:text-white hover:bg-gradient-to-r hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 rounded-lg transition-all duration-300 border border-gray-300/60 hover:border-transparent font-medium text-xs shadow-sm hover:shadow-md"
                            >
                                5 Years
                            </button>
                            <button
                                onClick={() => {
                                    const availableYears = getAvailableYears();
                                    setSelectedYears(availableYears);
                                }}
                                className="px-2 py-1 text-gray-600 hover:text-white hover:bg-gradient-to-r hover:from-amber-500 hover:via-yellow-500 hover:to-orange-500 rounded-lg transition-all duration-300 border border-gray-300/60 hover:border-transparent font-medium text-xs shadow-sm hover:shadow-md"
                            >
                                All 10
                            </button>
                        </div>
                    )}

                    {/* Year Selection Grid - Compact */}
                    {getAvailableYears().length > 0 ? (
                        <div className="grid grid-cols-5 sm:grid-cols-5 md:grid-cols-5 lg:grid-cols-10 gap-2">
                            {getAvailableYears().map(year => (
                                <label key={year} className="flex items-center justify-center space-x-1.5 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-all duration-300 border-2 border-gray-300/60 hover:border-amber-400/60 shadow-sm hover:shadow-md">
                                    <input
                                        type="checkbox"
                                        checked={selectedYears.includes(year)}
                                        onChange={() => handleYearToggle(year)}
                                        disabled={!selectedYears.includes(year) && selectedYears.length >= 10}
                                        className="w-3.5 h-3.5 text-amber-600 border-gray-300 rounded focus:ring-amber-500 disabled:opacity-50"
                                    />
                                    <span className={`text-xs font-semibold ${selectedYears.includes(year) ? 'text-amber-600' : 'text-gray-700'}`}>
                                        {year}
                                    </span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                                </svg>
                                <p className="text-xs text-yellow-800">
                                    <strong>No data available:</strong> Please wait for data to load.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Summary Cards */}
            {monthSummary && (
                <div className="backdrop-blur-xl rounded-xl border p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
                        {/* 1. Current Month Revenue */}
                        <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                                    <FaChartLine className="text-sm text-white" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">Current Month</p>
                                    <p className="text-sm font-bold text-gray-800 truncate">
                                        {replaceVND(monthSummary.currentMonthRevenueFormatted) || '0'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 2. Average Monthly Revenue */}
                        <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                                    <FaTrophy className="text-sm text-white" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">Average Monthly</p>
                                    <p className="text-sm font-bold text-gray-800 truncate">
                                        {replaceVND(monthSummary.averageMonthlyRevenueFormatted) || '0'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 3. Best Month in Period */}
                        {monthSummary.bestMonth && (
                            <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                                <div className="flex flex-col items-center text-center space-y-2">
                                    <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                                        <FaTrophy className="text-sm text-white" />
                                    </div>
                                    <div>
                                        <p className="text-gray-600 text-xs font-medium mb-1">Best Month</p>
                                        <p className="text-xs font-bold text-gray-800 truncate">
                                            {replaceVND(monthSummary.bestMonth)}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* 4. vs Last Month */}
                        <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                                    <FaArrowUp className="text-sm text-white" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">vs Last Month</p>
                                    <p className={`text-sm font-bold ${monthSummary.changeVsLastMonth?.startsWith('+')
                                        ? 'text-green-600'
                                        : monthSummary.changeVsLastMonth?.startsWith('-')
                                            ? 'text-red-600'
                                            : 'text-gray-800'
                                        } truncate`}>
                                        {monthSummary.changeVsLastMonth || '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 5. vs Same Period Last Year */}
                        <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                            <div className="flex flex-col items-center text-center space-y-2">
                                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                                    <FaChartLine className="text-sm text-white" />
                                </div>
                                <div>
                                    <p className="text-gray-600 text-xs font-medium mb-1">vs Last Year</p>
                                    <p className={`text-sm font-bold ${monthSummary.changeVsSamePeriodLastYear?.startsWith('+')
                                        ? 'text-green-600'
                                        : monthSummary.changeVsSamePeriodLastYear?.startsWith('-')
                                            ? 'text-red-600'
                                            : 'text-gray-800'
                                        } truncate`}>
                                        {monthSummary.changeVsSamePeriodLastYear || '-'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* 6. Trend Status */}
                        {monthSummary.trend && (
                            <div className="bg-white rounded-xl p-3 shadow-lg border hover:shadow-xl transition-all duration-300 h-24 flex flex-col justify-center" style={{ borderColor: '#A86523' }}>
                                <div className="flex flex-col items-center text-center space-y-1">
                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${monthSummary.trend.status === 'increasing' ? 'bg-green-500' :
                                        monthSummary.trend.status === 'decreasing' ? 'bg-red-500' : 'bg-gray-500'
                                        }`}>
                                        {monthSummary.trend.status === 'increasing' ? (
                                            <FaArrowUp className="text-sm text-white" />
                                        ) : monthSummary.trend.status === 'decreasing' ? (
                                            <FaArrowDown className="text-sm text-white" />
                                        ) : (
                                            <FaChartLine className="text-sm text-white" />
                                        )}
                                    </div>
                                    <div>
                                        <p className="text-gray-600 text-xs font-medium mb-1">Trend</p>
                                        <p className="text-xs font-bold text-gray-800 truncate">
                                            {monthSummary.trend.description}
                                        </p>
                                        <p className={`text-xs ${monthSummary.trend.changePercentage?.startsWith('+')
                                            ? 'text-green-600'
                                            : monthSummary.trend.changePercentage?.startsWith('-')
                                                ? 'text-red-600'
                                                : 'text-gray-500'
                                            } truncate`}>
                                            {monthSummary.trend.changePercentage || '-'} vs {monthSummary.trend.comparedTo || 'previous period'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Revenue by Month Content */}
            <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#A86523', boxShadow: '0 25px 70px rgba(168, 101, 35, 0.3), 0 15px 40px rgba(251, 191, 36, 0.25), 0 5px 15px rgba(168, 101, 35, 0.2)' }}>
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
