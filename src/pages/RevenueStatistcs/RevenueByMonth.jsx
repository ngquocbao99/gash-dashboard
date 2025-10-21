import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
    const [monthsToShow, setMonthsToShow] = useState(12); // Default to 12 months

    // Update filtered data when revenueByMonth or filter settings change
    useEffect(() => {
        if (!revenueByMonth || revenueByMonth.length === 0) {
            setFilteredRevenueByMonth([]);
            return;
        }

        // If requesting more months than available, show all available data
        if (monthsToShow >= revenueByMonth.length) {
            setFilteredRevenueByMonth(revenueByMonth);
        } else {
            // Take the most recent N months from the end
            const startIndex = Math.max(0, revenueByMonth.length - monthsToShow);
            const filtered = revenueByMonth.slice(startIndex);
            setFilteredRevenueByMonth(filtered);
        }
    }, [revenueByMonth, monthsToShow]);

    // Fetch revenue by month data
    const fetchRevenueByMonth = useCallback(async (requestedMonths = 12) => {
        if (!user?._id) {
            setError("User not authenticated");
            return;
        }
        setLoading(true);
        setError("");

        try {
            console.log("Fetching revenue by month data using SummaryAPI...");

            // Fetch revenue by month using SummaryAPI
            const monthResponse = await SummaryAPI.statistics.getRevenueByMonth(requestedMonths);

            console.log("Month response:", monthResponse);

            // Handle new API structure for revenue by month
            if (monthResponse) {
                const monthData = monthResponse;
                if (monthData?.data?.monthlyData) {
                    console.log("Using nested data structure");
                    const arr = Array.isArray(monthData.data.monthlyData) ? monthData.data.monthlyData : [];
                    const normalized = arr.map((item, index) => ({
                        month: item.month,
                        year: item.year,
                        totalRevenue: item.totalRevenue || 0,
                        comparedToPreviousMonth: item.comparedToPreviousMonth || '-',
                        totalRevenueFormatted: item.totalRevenueFormatted,
                        timeRange: item.timeRange || (item.month && item.year ? `${item.month} ${item.year}` : undefined)
                    }));
                    setRevenueByMonth(normalized);
                    setMonthSummary(monthData.data.summary || null);
                } else if (monthData?.monthlyData) {
                    console.log("Using direct data structure");
                    const arr = Array.isArray(monthData.monthlyData) ? monthData.monthlyData : [];
                    const normalized = arr.map((item, index) => ({
                        month: item.month,
                        year: item.year,
                        totalRevenue: item.totalRevenue || 0,
                        comparedToPreviousMonth: item.comparedToPreviousMonth || '-',
                        totalRevenueFormatted: item.totalRevenueFormatted,
                        timeRange: item.timeRange || (item.month && item.year ? `${item.month} ${item.year}` : undefined)
                    }));
                    setRevenueByMonth(normalized);
                    setMonthSummary(monthData.summary || null);
                } else if (Array.isArray(monthData)) {
                    console.log("Using array structure");
                    const normalized = monthData.map((item, index) => ({
                        month: item.month,
                        year: item.year,
                        totalRevenue: item.totalRevenue || 0,
                        comparedToPreviousMonth: item.comparedToPreviousMonth || '-',
                        totalRevenueFormatted: item.totalRevenueFormatted,
                        timeRange: item.timeRange || (item.month && item.year ? `${item.month} ${item.year}` : undefined)
                    }));
                    setRevenueByMonth(normalized);
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
            // Fetch with default 12 months to get maximum data
            fetchRevenueByMonth(12);
        }
    }, [user, fetchRevenueByMonth]);

    // Filter functions
    const handleChangeMonthsToShow = (months) => {
        setMonthsToShow(months);

        // Refetch data with new months parameter if needed
        if (months > revenueByMonth.length) {
            fetchRevenueByMonth(months);
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

    // Chart data - optimized with stable dependencies
    const monthChartData = useMemo(() => {
        if (filteredRevenueByMonth.length === 0) {
            return {
                labels: [],
                datasets: [{
                    label: 'Revenue (Month)',
                    data: [],
                    backgroundColor: [],
                    borderColor: [],
                    hoverBackgroundColor: []
                }]
            };
        }

        const labels = filteredRevenueByMonth.map(item => formatMonthLabel(item));
        const data = filteredRevenueByMonth.map(item => item.totalRevenue);
        const colors = generateColors(filteredRevenueByMonth.length);

        return {
            labels,
            datasets: [{
                label: 'Revenue (Month)',
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
    }, [filteredRevenueByMonth, generateColors, formatMonthLabel]);


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
                            text: 'Monthly Revenue',
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
                        const dataIndex = context[0].dataIndex;
                        const item = filteredRevenueByMonth[dataIndex];
                        const monthMaps = {
                            january: 'January', february: 'February', march: 'March', april: 'April', may: 'May', june: 'June',
                            july: 'July', august: 'August', september: 'September', october: 'October', november: 'November', december: 'December',
                            jan: 'January', feb: 'February', mar: 'March', apr: 'April', jun: 'June', jul: 'July', aug: 'August', sep: 'September', sept: 'September', oct: 'October', nov: 'November', dec: 'December'
                        };
                        const numToFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                        let fullMonth = '';
                        if (typeof item?.month === 'string' && item.month.trim()) {
                            const lower = item.month.trim().toLowerCase();
                            fullMonth = monthMaps[lower] || (lower.length >= 3 ? (lower.charAt(0).toUpperCase() + lower.slice(1)) : '');
                        } else if (typeof item?.month === 'number' && item.month >= 1 && item.month <= 12) {
                            fullMonth = numToFull[item.month - 1];
                        }
                        if (!fullMonth && typeof item?.timeRange === 'string') {
                            const m1 = item.timeRange.match(/\b(\d{4})[-\/.](\d{1,2})\b/);
                            const m2 = item.timeRange.match(/\b(\d{1,2})[-\/.](\d{4})\b/);
                            const n = m1 ? parseInt(m1[2], 10) : m2 ? parseInt(m2[1], 10) : null;
                            if (n && n >= 1 && n <= 12) fullMonth = numToFull[n - 1];
                        }

                        if (fullMonth && item?.year) return `${fullMonth} ${item.year}`;
                        return `${context[0].label}`;
                    },
                    label: function (context) {
                        const dataIndex = context.dataIndex;
                        const item = filteredRevenueByMonth[dataIndex];
                        const change = item?.comparedToPreviousMonth || '-';

                        // Build full month name + year for clarity, e.g., "October 2025"
                        const monthMaps = {
                            january: 'January', february: 'February', march: 'March', april: 'April', may: 'May', june: 'June',
                            july: 'July', august: 'August', september: 'September', october: 'October', november: 'November', december: 'December',
                            jan: 'January', feb: 'February', mar: 'March', apr: 'April', jun: 'June', jul: 'July', aug: 'August', sep: 'September', sept: 'September', oct: 'October', nov: 'November', dec: 'December'
                        };
                        const numToFull = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

                        let fullMonth = '';
                        if (typeof item?.month === 'string' && item.month.trim()) {
                            const lower = item.month.trim().toLowerCase();
                            fullMonth = monthMaps[lower] || (lower.length >= 3 ? (lower.charAt(0).toUpperCase() + lower.slice(1)) : '');
                        } else if (typeof item?.month === 'number' && item.month >= 1 && item.month <= 12) {
                            fullMonth = numToFull[item.month - 1];
                        }
                        if (!fullMonth && typeof item?.timeRange === 'string') {
                            const m1 = item.timeRange.match(/\b(\d{4})[-\/.](\d{1,2})\b/);
                            const m2 = item.timeRange.match(/\b(\d{1,2})[-\/.](\d{4})\b/);
                            const n = m1 ? parseInt(m1[2], 10) : m2 ? parseInt(m2[1], 10) : null;
                            if (n && n >= 1 && n <= 12) fullMonth = numToFull[n - 1];
                        }

                        const period = fullMonth && item?.year ? `${fullMonth} ${item.year}` : (item?.timeRange || 'N/A');

                        return [
                            `Revenue: ${formatCurrency(context.parsed.y)}`,
                            `Change: ${change}`,
                            `Period: ${period}`
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
                    color: function (context) {
                        const labels = Array.isArray(context?.chart?.data?.labels) ? context.chart.data.labels : [];
                        const label = String(labels[context.index] || '');
                        const m = label.match(/^(\d{1,2})\//);
                        const monthNum = m ? parseInt(m[1], 10) : null;
                        const isQuarterStart = monthNum === 1 || monthNum === 4 || monthNum === 7 || monthNum === 10;
                        return isQuarterStart ? '#111827' : '#64748b';
                    },
                    font: function (context) {
                        const labels = Array.isArray(context?.chart?.data?.labels) ? context.chart.data.labels : [];
                        const total = labels.length;
                        const label = String(labels[context.index] || '');
                        const m = label.match(/^(\d{1,2})\//);
                        const monthNum = m ? parseInt(m[1], 10) : null;
                        const isQuarterStart = monthNum === 1 || monthNum === 4 || monthNum === 7 || monthNum === 10;
                        const baseSize = total > 30 ? 9 : total > 24 ? 10 : total > 18 ? 11 : 12;
                        return { size: isQuarterStart ? baseSize + 1 : baseSize, weight: isQuarterStart ? '700' : '600', family: 'Inter, system-ui, sans-serif' };
                    },
                    padding: 15,
                    autoSkip: false,
                    maxTicksLimit: 12,
                    callback: function (value, index, ticks) {
                        const labels = Array.isArray(monthChartData?.labels) ? monthChartData.labels : [];
                        const total = labels.length || (Array.isArray(ticks) ? ticks.length : 0);
                        const step = Math.max(1, Math.ceil(total / 12));
                        const labelText = String(labels[index] || value || '');
                        const m = labelText.match(/^(\d{1,2})\//);
                        const monthNum = m ? parseInt(m[1], 10) : null;
                        const isQuarterStart = monthNum === 1 || monthNum === 4 || monthNum === 7 || monthNum === 10;
                        if (isQuarterStart) return labelText;
                        return index % step === 0 ? labelText : '';
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
    }), [formatCurrency, filteredRevenueByMonth, monthChartData.labels]);

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

            {/* Header Section */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
                    <div className="flex-1 min-w-0">
                        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Revenue by Month</h1>
                        <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Monthly revenue performance overview</p>
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
                    {monthsToShow === 12 && revenueByMonth.length < 12 && (
                        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center">
                                <svg className="w-4 h-4 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p className="text-sm text-blue-800">
                                    <strong>Info:</strong> Requesting 12 months but only {revenueByMonth.length} months of data available.
                                    Chart will display all available data.
                                </p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4">
                        <div>
                            <label className="block text-xs lg:text-sm font-medium text-gray-700 mb-2">Time Period</label>
                            <select
                                value={monthsToShow}
                                onChange={(e) => handleChangeMonthsToShow(parseInt(e.target.value))}
                                className="w-full px-3 py-2 lg:px-4 lg:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 bg-white text-sm lg:text-base"
                            >
                                <option value={6}>6 Months</option>
                                <option value={12}>12 Months</option>
                                <option value={24}>24 Months</option>
                                <option value={36}>36 Months</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setMonthsToShow(12);
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
                            {monthChartData.labels.length > 0 ? (
                                <Bar
                                    key={`chart-${filteredRevenueByMonth.length}-${monthsToShow}`}
                                    data={monthChartData}
                                    options={{
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
                                    }}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <div className="text-center">
                                        <div className="w-20 h-20 bg-gray-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
                                            <FaChartLine className="text-3xl text-gray-500" />
                                        </div>
                                        <p className="text-gray-600 font-semibold text-lg">
                                            No revenue data available for {monthsToShow} months
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
