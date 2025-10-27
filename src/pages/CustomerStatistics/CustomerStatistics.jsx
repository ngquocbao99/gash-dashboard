import React, { useState, useEffect, useContext, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import Loading from "../../components/Loading";
import {
  FaUsers,
  FaUserCheck,
  FaUserTimes,
  FaUserPlus,
  FaFileExport,
  FaPrint,
  FaFilePdf,
  FaChartPie,
  FaChartBar,
  FaDownload,
} from "react-icons/fa";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  ResponsiveContainer as RC2,
} from "recharts";
import { motion } from "framer-motion";
import axios from "axios";

/**
 * Full Premium Customer Statistics Dashboard
 *
 * Features:
 * - Header with time filter, chart toggle, export (Excel + CSV + Print)
 * - Stat cards with mini sparkline & trend
 * - Main chart with Bar / Pie / Donut views
 * - Small Active vs Inactive donut
 * - Top customers table (attempt fetch, fallback to mock)
 * - Loading & error handling
 *
 * Notes:
 * - Endpoints assumed:
 *   GET /statistics/customers?period=month|year|all
 *   GET /statistics/customers/export  (returns blob/xlsx)
 *   GET /customers/top?period=...     (optional endpoint)
 *
 * - If /customers/top is not available, component will use mock topCustomers
 */

const CustomerStatistics = () => {
  const { user, isAuthLoading } = useContext(AuthContext);
  const printRef = useRef();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeFilter, setTimeFilter] = useState("month");
  const [chartView, setChartView] = useState("bar"); // 'bar' | 'pie' | 'donut'
  const [stats, setStats] = useState({
    totalCustomers: 0,
    activeCustomers: 0,
    inactiveCustomers: 0,
    newCustomers: 0,
  });
  // trend percents (could be computed server-side)
  const [trend, setTrend] = useState({
    total: 4,
    active: 8,
    inactive: -3,
    new: 5,
  });

  const [topCustomers, setTopCustomers] = useState([]);
  const [sparklineData, setSparklineData] = useState({
    total: [],
    active: [],
    inactive: [],
    new: [],
  });

  // Utility: mock fallback for top customers and sparkline if API doesn't provide
  const MOCK_TOP_CUSTOMERS = [
    { id: 1, name: "Lê Văn A", email: "levana@example.com", orders: 12, spent: 1250 },
    { id: 2, name: "Nguyễn Thị B", email: "nguyenthb@example.com", orders: 9, spent: 980 },
    { id: 3, name: "Trần C", email: "tranc@example.com", orders: 8, spent: 720 },
    { id: 4, name: "Phạm D", email: "phamd@example.com", orders: 6, spent: 540 },
    { id: 5, name: "Hoàng E", email: "hoange@example.com", orders: 5, spent: 410 },
  ];

  const MOCK_SPARK = {
    total: [
      { d: "D-6", v: 120 },
      { d: "D-5", v: 135 },
      { d: "D-4", v: 128 },
      { d: "D-3", v: 140 },
      { d: "D-2", v: 150 },
      { d: "D-1", v: 160 },
      { d: "Today", v: 170 },
    ],
    active: [
      { d: "D-6", v: 80 },
      { d: "D-5", v: 92 },
      { d: "D-4", v: 85 },
      { d: "D-3", v: 95 },
      { d: "D-2", v: 102 },
      { d: "D-1", v: 110 },
      { d: "Today", v: 120 },
    ],
    inactive: [
      { d: "D-6", v: 30 },
      { d: "D-5", v: 28 },
      { d: "D-4", v: 30 },
      { d: "D-3", v: 32 },
      { d: "D-2", v: 34 },
      { d: "D-1", v: 36 },
      { d: "Today", v: 40 },
    ],
    new: [
      { d: "D-6", v: 10 },
      { d: "D-5", v: 15 },
      { d: "D-4", v: 13 },
      { d: "D-3", v: 13 },
      { d: "D-2", v: 14 },
      { d: "D-1", v: 20 },
      { d: "Today", v: 30 },
    ],
  };

  // fetch stats + top customers + sparkline
  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);
        setError("");

        const token = user?.token || localStorage.getItem("token");
        if (!token) {
          setError("You are not authenticated");
          return;
        }

        // fetch stats
        const statsRes = await fetch(
          `http://localhost:5000/statistics/customers?period=${timeFilter}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        const statsJson = await statsRes.json();
        if (statsRes.ok && statsJson.success) {
          setStats(statsJson.data);
        } else {
          // fallback to zeros and show message (server might not provide period param)
          if (!statsRes.ok) console.warn("stats fetch warning:", statsJson?.message);
          setStats((prev) => prev); // keep default
        }

        // attempt to fetch top customers (optional endpoint)
        try {
          const topRes = await fetch(
            `http://localhost:5000/statistics/customers/top?period=${timeFilter}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const topJson = await topRes.json();
          if (topRes.ok && Array.isArray(topJson.data)) {
            setTopCustomers(topJson.data);
          } else {
            setTopCustomers(MOCK_TOP_CUSTOMERS);
          }
        } catch (errTop) {
          console.warn("top customers fetch failed, using mock:", errTop);
          setTopCustomers(MOCK_TOP_CUSTOMERS);
        }

        // attempt to fetch sparkline data (optional)
        try {
          const sparkRes = await fetch(
            `http://localhost:5000/statistics/customers/sparkline?period=${timeFilter}`,
            {
              headers: { Authorization: `Bearer ${token}` },
            }
          );
          const sparkJson = await sparkRes.json();
          if (sparkRes.ok && sparkJson.success) {
            setSparklineData(sparkJson.data);
          } else {
            setSparklineData(MOCK_SPARK);
          }
        } catch (errSpark) {
          setSparklineData(MOCK_SPARK);
        }
      } catch (err) {
        console.error("Error fetching customer stats:", err);
        setError("Error fetching customer statistics");
      } finally {
        setLoading(false);
      }
    };

    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, timeFilter]);

  // Export Excel (server-provided)
  const handleExportExcel = async () => {
    try {
      const token = user?.token || localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/statistics/customers/export", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "customer_statistics.xlsx");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export Excel error:", err);
      alert("❌ Failed to export Excel");
    }
  };

  // Export Top Customers as CSV (client-side)
  const handleExportCSV = () => {
    if (!topCustomers || topCustomers.length === 0) {
      alert("No data to export");
      return;
    }
    const header = ["Name", "Email", "Orders", "Total Spent"];
    const rows = topCustomers.map((c) => [c.name, c.email, c.orders, c.spent]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [header, ...rows].map((e) => e.join(",")).join("\n");
    const encoded = encodeURI(csvContent);
    const link = document.createElement("a");
    link.href = encoded;
    link.setAttribute("download", `top_customers_${timeFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  if (isAuthLoading || loading) {
    return (
      <Loading
        type="auth"
        size="large"
        message="Loading customer statistics..."
        fullScreen={true}
      />
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center text-red-600 text-lg font-semibold">
        {error}
      </div>
    );
  }

  // chart data
  const chartData = [
    { name: "Active", value: stats.activeCustomers },
    { name: "Inactive", value: stats.inactiveCustomers },
    { name: "New", value: stats.newCustomers },
  ];

  const COLORS = ["#10B981", "#EF4444", "#3B82F6"];

  return (
    <div className="min-h-screen bg-gray-50 p-8" ref={printRef}>
      {/* Header */}
      <motion.div
        className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-3xl p-8 text-white shadow-lg mb-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex-1">
          <h1 className="text-4xl font-extrabold mb-2 tracking-wide">
            👥 Customer Statistics
          </h1>
      
        </div>

        <div className="flex items-center gap-3">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="bg-white text-gray-700 font-semibold px-4 py-2 rounded-xl shadow-md focus:ring-2 focus:ring-indigo-300 transition-all"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>

          <motion.button
            onClick={() => setChartView((v) => (v === "bar" ? "pie" : v === "pie" ? "donut" : "bar"))}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="bg-white text-blue-700 px-4 py-2 rounded-xl shadow-md font-semibold hover:shadow-lg flex items-center gap-2"
            title="Toggle chart view (Bar → Pie → Donut)"
          >
            {chartView === "bar" ? <FaChartPie /> : chartView === "pie" ? <FaChartBar /> : <FaChartPie />}
            <span>
              {chartView === "bar" ? "Pie" : chartView === "pie" ? "Donut" : "Bar"}
            </span>
          </motion.button>

          <motion.button
            onClick={handleExportExcel}
            whileHover={{ scale: 1.04 }}
            className="bg-white text-blue-700 px-4 py-2 rounded-xl shadow-md font-semibold hover:shadow-lg flex items-center gap-2"
            title="Export Excel"
          >
            <FaFileExport />
            Excel
          </motion.button>

          <motion.button
            onClick={handleExportCSV}
            whileHover={{ scale: 1.04 }}
            className="bg-white text-blue-700 px-4 py-2 rounded-xl shadow-md font-semibold hover:shadow-lg flex items-center gap-2"
            title="Export Top Customers CSV"
          >
            <FaDownload />
            CSV
          </motion.button>

          <motion.button
            onClick={handlePrint}
            whileHover={{ scale: 1.04 }}
            className="bg-white text-blue-700 px-4 py-2 rounded-xl shadow-md font-semibold hover:shadow-lg flex items-center gap-2"
            title="Print dashboard"
          >
            <FaPrint />
            Print
          </motion.button>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Customers"
          value={stats.totalCustomers}
          icon={<FaUsers className="text-blue-600 text-2xl" />}
          bgIcon="bg-blue-100"
          gradient="from-blue-500 to-indigo-600"
          sparkData={sparklineData.total}
          trend={trend.total}
        />
        <StatCard
          title="Active Customers"
          value={stats.activeCustomers}
          icon={<FaUserCheck className="text-green-600 text-2xl" />}
          bgIcon="bg-green-100"
          gradient="from-green-500 to-emerald-600"
          sparkData={sparklineData.active}
          trend={trend.active}
        />
        <StatCard
          title="Inactive Customers"
          value={stats.inactiveCustomers}
          icon={<FaUserTimes className="text-red-600 text-2xl" />}
          bgIcon="bg-red-100"
          gradient="from-red-500 to-rose-600"
          sparkData={sparklineData.inactive}
          trend={trend.inactive}
        />
        <StatCard
          title="New This Period"
          value={stats.newCustomers}
          icon={<FaUserPlus className="text-indigo-600 text-2xl" />}
          bgIcon="bg-indigo-100"
          gradient="from-indigo-500 to-blue-600"
          sparkData={sparklineData.new}
          trend={trend.new}
        />
      </div>

      {/* Main Charts + Small Pie + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Large Chart area (span 2 col on large screens) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-gray-800">Customer Overview</h3>
            <p className="text-sm text-gray-500">Period: <strong>{timeFilter}</strong></p>
          </div>

          <div style={{ height: 380 }}>
            <ResponsiveContainer width="100%" height="100%">
              {chartView === "bar" ? (
                <BarChart
                  data={[
                    { name: "Active", value: stats.activeCustomers },
                    { name: "Inactive", value: stats.inactiveCustomers },
                    { name: "New", value: stats.newCustomers },
                  ]}
                  margin={{ top: 20, right: 24, left: 8, bottom: 20 }}
                  barSize={48}
                >
                  <defs>
                    <linearGradient id="gActive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#34D399" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#047857" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="gInactive" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#FB7185" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#991B1B" stopOpacity={0.85} />
                    </linearGradient>
                    <linearGradient id="gNew" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#60A5FA" stopOpacity={0.95} />
                      <stop offset="100%" stopColor="#1E3A8A" stopOpacity={0.85} />
                    </linearGradient>
                  </defs>

                  <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                  <XAxis dataKey="name" tick={{ fill: "#374151", fontWeight: 600 }} />
                  <YAxis tick={{ fill: "#374151" }} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e5e7eb" }} />
                  <Legend verticalAlign="top" wrapperStyle={{ fontWeight: 600 }} />
                  <Bar dataKey="value" radius={[10, 10, 0, 0]} animationDuration={900}>
                    <LabelList dataKey="value" position="top" fill="#111827" fontSize={14} />
                    <Cell fill="url(#gActive)" />
                    <Cell fill="url(#gInactive)" />
                    <Cell fill="url(#gNew)" />
                  </Bar>
                </BarChart>
              ) : chartView === "pie" ? (
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    outerRadius={120}
                    label={({ name, value }) => `${name}: ${value}`}
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10 }} />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              ) : (
                // donut
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    label
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-d-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10 }} />
                  <Legend verticalAlign="bottom" />
                </PieChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right Column: Small Donut + Top Customers */}
        <div className="flex flex-col gap-6">
          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
            <h4 className="text-lg font-semibold mb-3">Active vs Inactive</h4>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={[
                      { name: "Active", value: stats.activeCustomers },
                      { name: "Inactive", value: stats.inactiveCustomers },
                    ]}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={6}
                    dataKey="value"
                  >
                    <Cell fill="#10B981" />
                    <Cell fill="#EF4444" />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-green-500 rounded-full inline-block" /> Active
                </span>
                <strong>{stats.activeCustomers}</strong>
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full inline-block" /> Inactive
                </span>
                <strong>{stats.inactiveCustomers}</strong>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
  <h4 className="text-xl font-semibold mb-4 text-gray-800 flex items-center gap-2">
    🏆 Top Customers
  </h4>

  <div className="overflow-x-auto">
    <table className="min-w-full border-separate border-spacing-y-2">
      <thead>
        <tr className="bg-gray-100 text-gray-600 text-sm uppercase tracking-wide">
          <th className="px-4 py-2 text-left rounded-l-xl">Name</th>
          <th className="px-4 py-2 text-left">Email</th>
          <th className="px-4 py-2 text-center">Orders</th>
          <th className="px-4 py-2 text-center rounded-r-xl">Spent ($)</th>
        </tr>
      </thead>
      <tbody>
        {topCustomers && topCustomers.length > 0 ? (
          topCustomers.map((c, index) => (
            <tr
              key={c.id || index}
              className="bg-white hover:bg-blue-50 transition-all duration-150 shadow-sm rounded-xl border-b border-gray-100"
            >
              <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
              <td className="px-4 py-3 text-gray-600 text-sm">{c.email}</td>
              <td className="px-4 py-3 text-center font-semibold text-blue-600">{c.orders}</td>
              <td className="px-4 py-3 text-center font-semibold text-gray-700">
                ${c.spent?.toLocaleString() || 0}
              </td>
            </tr>
          ))
        ) : (
          <tr>
            <td
              colSpan="4"
              className="py-4 text-center text-gray-500 italic bg-gray-50 rounded-xl"
            >
              No top customers available
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>

  <div className="mt-5 flex justify-end">
    <button
      onClick={handleExportCSV}
      className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-md hover:shadow-lg flex items-center gap-2 transition-all"
    >
      <FaDownload className="text-sm" /> Export CSV
    </button>
  </div>
</div>

        </div>
      </div>

      {/* Footer / small notes */}
      <div className="mt-8 text-sm text-gray-500">
        <p>
          Tip: Use the filter to change the reporting period. Export options include Excel and CSV.
        </p>
      </div>
    </div>
  );
};

/* ---------------------------
   Subcomponents: StatCard
   - includes mini sparkline (LineChart)
   --------------------------- */
const StatCard = ({ title, value, icon, bgIcon, gradient, sparkData, trend }) => {
  // sparkData: array of {d, v}
  const spark = Array.isArray(sparkData) && sparkData.length > 0 ? sparkData : [];

  return (
    <motion.div
      className="bg-white rounded-2xl p-4 shadow-md hover:shadow-xl transition-shadow duration-300 border border-gray-100"
      whileHover={{ scale: 1.02 }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className={`w-14 h-14 ${bgIcon} rounded-xl flex items-center justify-center`}>{icon}</div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Trend</div>
          <div className={`inline-block px-2 py-1 rounded-full text-sm font-semibold ${trend >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
            {trend >= 0 ? `+${trend}%` : `${trend}%`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
          <p className="text-sm text-gray-500">{title}</p>
        </div>

        <div style={{ width: 120, height: 50 }}>
          {spark.length > 0 ? (
            <RC2 width="100%" height="100%">
              <LineChart data={spark}>
                <Line type="monotone" dataKey="v" stroke="#6366F1" strokeWidth={2} dot={false} />
              </LineChart>
            </RC2>
          ) : (
            <div className="w-28 h-12 bg-gray-100 rounded" />
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default CustomerStatistics;
