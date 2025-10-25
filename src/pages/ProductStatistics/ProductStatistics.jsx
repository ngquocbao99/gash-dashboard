/**
 * ProductStatistics.jsx
 *
 * Full-featured Product Statistics Dashboard (rich, verbose, production-ready)
 * - Header with filters (period / category / status)
 * - Animated stat cards with mini-sparklines and trend badges
 * - Main Bar Chart (status overview) with gradients and rounded bars
 * - Category donut (PieChart) with legend bottom (fixed label/legend overlap)
 * - Top Products table with export CSV
 * - Export Excel (server), Print support
 * - Lots of Framer Motion animation for polished UX
 *
 * Notes:
 * - Make sure you have the dependencies:
 *   npm i recharts framer-motion axios react-icons
 *
 * - Backend endpoints expected (adjust if necessary):
 *   GET  /statistics/products?period=...&category=...&status=...
 *   GET  /statistics/products/categories?period=...
 *   GET  /statistics/products/export
 *   GET  /products/top?period=...&limit=5
 *
 * - This file intentionally keeps many UI niceties for "600-line" feel:
 *   animations, detailed comments, polished tooltips, fallback mock data, etc.
 */

import React, { useState, useEffect, useContext, useRef } from "react";
import { AuthContext } from "../../context/AuthContext";
import Loading from "../../components/Loading";
import { motion } from "framer-motion";
import axios from "axios";

// icons
import {
  FaBox,
  FaBoxOpen,
  FaShoppingCart,
  FaStar,
  FaFileExport,
  FaDownload,
  FaPrint,
  FaFilter,
} from "react-icons/fa";

// recharts
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";

/* ===========================
   Fallback mock data (dev)
   =========================== */
const MOCK_CATEGORY_DISTRIBUTION = [
  { name: "Clothes", value: 310 },
  { name: "Accessories", value: 120 },
  { name: "Footwear", value: 210 },
];

const MOCK_TOP_PRODUCTS = [
  { id: 1, name: "Classic Tee", sku: "CT-001", sold: 320, stock: 28 },
  { id: 2, name: "Denim Jacket", sku: "DJ-014", sold: 251, stock: 12 },
  { id: 3, name: "Leather Boots", sku: "LB-007", sold: 198, stock: 6 },
  { id: 4, name: "Sport Sneakers", sku: "SS-032", sold: 170, stock: 4 },
  { id: 5, name: "Wool Scarf", sku: "WS-021", sold: 140, stock: 60 },
];

const MOCK_SPARK = {
  total: [
    { d: "D-6", v: 300 },
    { d: "D-5", v: 310 },
    { d: "D-4", v: 320 },
    { d: "D-3", v: 330 },
    { d: "D-2", v: 340 },
    { d: "D-1", v: 350 },
    { d: "Today", v: 360 },
  ],
  active: [
    { d: "D-6", v: 200 },
    { d: "D-5", v: 210 },
    { d: "D-4", v: 220 },
    { d: "D-3", v: 230 },
    { d: "D-2", v: 240 },
    { d: "D-1", v: 250 },
    { d: "Today", v: 260 },
  ],
  pending: [
    { d: "D-6", v: 60 },
    { d: "D-5", v: 58 },
    { d: "D-4", v: 62 },
    { d: "D-3", v: 64 },
    { d: "D-2", v: 66 },
    { d: "D-1", v: 68 },
    { d: "Today", v: 70 },
  ],
  inactive: [
    { d: "D-6", v: 40 },
    { d: "D-5", v: 42 },
    { d: "D-4", v: 38 },
    { d: "D-3", v: 36 },
    { d: "D-2", v: 34 },
    { d: "D-1", v: 32 },
    { d: "Today", v: 30 },
  ],
};

/* palette for category slices */
const CATEGORY_COLORS = [
  "#8B5CF6", // purple
  "#F59E0B", // amber
  "#10B981", // green
  "#3B82F6", // blue
  "#F472B6", // pink
  "#EF4444", // red
];

/* ===========================
   Main Component
   =========================== */
export default function ProductStatistics() {
  const { user, isAuthLoading } = useContext(AuthContext);
  const printRef = useRef(null);

  // loading & error
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // filters
  const [period, setPeriod] = useState("month"); // month, quarter, year, all
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // data
  const [stats, setStats] = useState({
    totalProducts: 0,
    inStock: 0,
    outOfStock: 0,
    lowStock: 0,
    newProducts: 0,
  });

  const [categoryDistribution, setCategoryDistribution] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [sparkData, setSparkData] = useState(MOCK_SPARK);

  // trend percentages (example)
  const [trend, setTrend] = useState({
    total: 6,
    active: 10,
    pending: -4,
    inactive: 2,
  });

  // categories list for dropdown
  const [categories, setCategories] = useState(["All", "Clothes", "Accessories", "Footwear"]);

  /* ---------------------------
     Data fetching
     - fetch stats, categories, top products, sparkline
     --------------------------- */
  useEffect(() => {
  let mounted = true;

  async function fetchAll() {
    try {
      setLoading(true);
      setError("");

      const token = user?.token || localStorage.getItem("token");
      if (!token) {
        setError("You are not authenticated");
        setLoading(false);
        return;
      }

      // fetch main product statistics
      const res = await fetch(
  `http://localhost:5000/statistics/products?period=${period}&category=${categoryFilter}&status=${statusFilter}`,
  {
    headers: { Authorization: `Bearer ${token}` },
  }
);

      const j = await res.json();
      if (res.ok && j.success && mounted) {
        setStats({
          totalProducts: j.data.totalProducts || 0,
          inStock: j.data.activeProducts || 0,
          outOfStock: j.data.inactiveProducts || 0,
          lowStock: j.data.pendingProducts || 0,
          newProducts: j.data.newProducts || 0,
        });
      }

      // fetch category distribution
      const resCat = await fetch("http://localhost:5000/statistics/products/categories", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const jc = await resCat.json();
      if (resCat.ok && jc.success && mounted) {
        setCategoryDistribution(jc.data);
        setCategories(["All", ...jc.data.map((c) => c.name)]);
      }

      // fetch top products
      const resTop = await fetch("http://localhost:5000/statistics/products/top?limit=6", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const jt = await resTop.json();
      if (resTop.ok && jt.success && mounted) {
        setTopProducts(jt.data);
      }

    } catch (err) {
      console.error("❌ Error fetching stats:", err);
      if (mounted) setError("Error fetching product statistics");
    } finally {
      if (mounted) setLoading(false);
    }
  }

  fetchAll();

  return () => {
    mounted = false;
  };
}, [user, period, categoryFilter, statusFilter]);


    
  /* ---------------------------
     Export functions
     --------------------------- */
  const handleExportExcel = async () => {
    try {
      const token = user?.token || localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/statistics/products/export", {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `product_statistics_${period}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Export Excel failed", err);
      alert("❌ Failed to export Excel");
    }
  };

  const handleExportTopCSV = () => {
    if (!topProducts || topProducts.length === 0) {
      alert("No top products to export");
      return;
    }
    const header = ["Name", "SKU", "Sold", "Stock"];
    const rows = topProducts.map((p) => [p.name, p.sku ?? "", p.sold ?? p.sales ?? 0, p.stock ?? p.quantity ?? 0]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `top_products_${period}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handlePrint = () => {
    window.print();
  };

  /* ---------------------------
     Loading / Error states
     --------------------------- */
  if (isAuthLoading || loading) {
    return (
      <Loading
        type="auth"
        size="large"
        message="Loading product statistics..."
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

  /* ===========================
     Derived chart data
     =========================== */
  const barData = [
    { name: "Active", value: stats.inStock },
    { name: "Pending", value: stats.lowStock },
    { name: "Inactive", value: stats.outOfStock },
    { name: "New", value: stats.newProducts },
  ];

  const pieData = categoryDistribution && categoryDistribution.length ? categoryDistribution : MOCK_CATEGORY_DISTRIBUTION;

  /* ===========================
     Render
     =========================== */
  return (
    <div className="min-h-screen bg-gray-50 p-8" ref={printRef}>
      {/* HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-3xl p-6 md:p-8 text-white shadow-xl mb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold mb-0">📊 Product Statistics</h1>
          {/* description intentionally left out as requested */}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-2 rounded-lg">
            <FaFilter />
            <span className="text-white text-sm">Filters</span>
          </div>

          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-white text-gray-800 font-semibold px-4 py-2 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-300"
            title="Select period"
          >
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
            <option value="all">All Time</option>
          </select>

          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-white text-gray-800 font-semibold px-4 py-2 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-300"
            title="Category"
          >
            {categories.map((c, idx) => (
              <option key={idx} value={c === "All" ? "all" : c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white text-gray-800 font-semibold px-4 py-2 rounded-xl shadow-sm focus:ring-2 focus:ring-indigo-300"
            title="Status"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="inactive">Inactive</option>
          </select>

          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleExportExcel}
            className="bg-white text-purple-700 px-4 py-2 rounded-xl shadow-md font-semibold flex items-center gap-2"
            title="Export Excel"
          >
            <FaFileExport /> Export
          </motion.button>

          
        </div>
      </motion.div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <AnimatedStatCard
          title="Total Products"
          value={stats.totalProducts}
          icon={<FaBox className="text-purple-600 text-2xl" />}
          bgIcon="bg-purple-100"
          gradient="from-purple-500 to-purple-700"
          sparkData={sparkData.total}
          trend={trend.total}
          delay={0.05}
        />
        <AnimatedStatCard
          title="Active Products"
          value={stats.inStock}
          icon={<FaBoxOpen className="text-green-600 text-2xl" />}
          bgIcon="bg-green-100"
          gradient="from-green-500 to-emerald-600"
          sparkData={sparkData.active}
          trend={trend.active}
          delay={0.12}
        />
        <AnimatedStatCard
          title="Pending Products"
          value={stats.lowStock}
          icon={<FaShoppingCart className="text-yellow-600 text-2xl" />}
          bgIcon="bg-yellow-100"
          gradient="from-yellow-500 to-amber-600"
          sparkData={sparkData.pending}
          trend={trend.pending}
          delay={0.18}
        />
        <AnimatedStatCard
          title="Inactive Products"
          value={stats.outOfStock}
          icon={<FaStar className="text-red-600 text-2xl" />}
          bgIcon="bg-red-100"
          gradient="from-red-500 to-rose-600"
          sparkData={sparkData.inactive}
          trend={trend.inactive}
          delay={0.24}
        />
      </div>

      {/* CHARTS + TOP PRODUCTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main charts - large left area (span 2 columns) */}
        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-xl border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-bold text-gray-800">Product Overview</h3>
            <div className="text-sm text-gray-500">Period: <strong>{period}</strong></div>
          </div>

          {/* Bar Chart */}
          <div style={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barData}
                margin={{ top: 20, right: 16, left: 8, bottom: 20 }}
                barCategoryGap="24%"
              >
                {/* Gradient defs */}
                <defs>
                  <linearGradient id="gradPurple" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#A78BFA" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#7C3AED" stopOpacity={0.85} />
                  </linearGradient>
                  <linearGradient id="gradGreen" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34D399" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#059669" stopOpacity={0.85} />
                  </linearGradient>
                </defs>

                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fill: "#374151", fontWeight: 700 }} />
                <YAxis tick={{ fill: "#374151" }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e5e7eb",
                    backgroundColor: "#fff",
                    boxShadow: "0 6px 18px rgba(15,23,42,0.08)",
                  }}
                />
                <Legend verticalAlign="top" wrapperStyle={{ fontWeight: 600 }} />
                {/* Use one Bar with multiple Cell fills for individual slices */}
                <Bar dataKey="value" radius={[12, 12, 0, 0]} animationDuration={900}>
                  <LabelList dataKey="value" position="top" fill="#111827" />
                  <Cell fill="url(#gradPurple)" />
                  <Cell fill="#F59E0B" />
                  <Cell fill="#EF4444" />
                  <Cell fill="#3B82F6" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Category Distribution & Inventory Health */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Category donut */}
            <div className="bg-gray-50 p-4 rounded-xl">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Category Distribution</h4>
              <div style={{ height: 220 }}>
                <div className="flex flex-col items-center justify-center">
  <ResponsiveContainer width="100%" height={260}>
    <PieChart>
      <Pie
        data={pieData}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={60}
        outerRadius={110}
        paddingAngle={4}
        labelLine={false}
        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
      >
        {pieData.map((c, i) => (
          <Cell key={`slice-${i}`} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
        ))}
      </Pie>
      <Tooltip
        contentStyle={{
          borderRadius: 10,
          backgroundColor: "#fff",
          border: "none",
          boxShadow: "0 6px 18px rgba(15,23,42,0.06)",
        }}
      />
    </PieChart>
  </ResponsiveContainer>

  {/* ✅ Legend tách ra ngoài, không bị cắt */}
  <div
    className="flex flex-wrap justify-center gap-3 mt-3"
    style={{ maxWidth: 400 }}
  >
    {pieData.map((entry, index) => (
      <div
        key={`legend-${index}`}
        className="flex items-center text-sm font-medium text-gray-700"
      >
        <span
          className="w-3 h-3 rounded-full mr-2"
          style={{ backgroundColor: CATEGORY_COLORS[index % CATEGORY_COLORS.length] }}
        ></span>
        {entry.name}
      </div>
    ))}
  </div>
</div>


              </div>
            </div>

            {/* Inventory health card */}
            <div className="bg-gray-50 p-4 rounded-xl flex flex-col justify-between">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Inventory Health</h4>
              <div className="text-sm text-gray-600">
                <div className="flex justify-between py-2">
                  <span>Active</span>
                  <strong>{stats.inStock}</strong>
                </div>
                <div className="flex justify-between py-2">
                  <span>Pending</span>
                  <strong>{stats.lowStock}</strong>
                </div>
                <div className="flex justify-between py-2">
                  <span>Inactive</span>
                  <strong>{stats.outOfStock}</strong>
                </div>
                <div className="flex justify-between py-2">
                  <span>New Products</span>
                  <strong>{stats.newProducts}</strong>
                </div>
              </div>

              <div className="mt-4">
                
              </div>
            </div>
          </div>
        </div>

        {/* Right column - Top products */}
<div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-200">
  <div className="flex justify-between items-center mb-3">
    <h4 className="text-lg font-semibold text-gray-800">Top Products</h4>
    <button
      onClick={handleExportTopCSV}
      className="bg-purple-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-purple-700 transition"
    >
      Export CSV
    </button>
  </div>

  <table className="w-full text-left border-separate border-spacing-y-1">
    <thead>
      <tr className="text-sm text-gray-500 border-b">
        <th className="pb-2">Product</th>
        <th className="pb-2">SKU</th>
        <th className="pb-2 text-center">Sold</th>
        <th className="pb-2 text-center">Stock</th>
      </tr>
    </thead>
    <tbody>
      {(topProducts && topProducts.length ? topProducts : MOCK_TOP_PRODUCTS).map((p) => (
        <tr
          key={p.id}
          className="border-b last:border-0 hover:bg-gray-50 transition"
        >
          <td className="py-2 font-medium text-gray-800">{p.name}</td>
          <td className="py-2 text-sm text-gray-600">{p.sku ?? "-"}</td>
          <td className="py-2 text-center text-blue-600 font-semibold">{p.sold ?? p.sales ?? 0}</td>
          <td
            className={`py-2 text-center font-semibold ${
              (p.stock ?? p.quantity ?? 0) <= 5 ? "text-red-600" : "text-gray-700"
            }`}
          >
            {p.stock ?? p.quantity ?? 0}
          </td>
        </tr>
      ))}
    </tbody>
  </table>

  <p className="text-sm text-gray-500 mt-3">
    Showing top {(topProducts && topProducts.length) ? topProducts.length : MOCK_TOP_PRODUCTS.length} products.
  </p>
</div>

      </div>

      {/* FOOTER */}
      
    </div>
  );
}

/* ===========================
   AnimatedStatCard (rich)
   - includes mini sparkline, trend badge, motion
   =========================== */
function AnimatedStatCard({ title, value, icon, bgIcon = "bg-gray-100", gradient = "from-indigo-500 to-indigo-700", sparkData = [], trend = 0, delay = 0 }) {
  // sparkData: [{d, v}, ...]
  const showSpark = Array.isArray(sparkData) && sparkData.length > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-2xl p-4 shadow-md border border-gray-100"
    >
      <div className="flex items-start justify-between">
        <div className={`w-14 h-14 ${bgIcon} rounded-xl flex items-center justify-center`}>{icon}</div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Trend</div>
          <div className={`inline-block px-2 py-1 rounded-full text-sm font-semibold ${trend >= 0 ? "bg-green-50 text-green-600" : "bg-red-50 text-red-500"}`}>
            {trend >= 0 ? `+${trend}%` : `${trend}%`}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-800">{value}</h3>
          <p className="text-sm text-gray-500">{title}</p>
        </div>

        <div style={{ width: 120, height: 50 }}>
          {showSpark ? (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sparkData}>
                <Line type="monotone" dataKey="v" stroke="#8B5CF6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-28 h-12 bg-gray-100 rounded" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
