import React, { useState, useEffect, useContext, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../context/AuthContext";
import SummaryAPI from "../../common/SummaryAPI";
import { Pie } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { FaUsers, FaDollarSign, FaShoppingCart, FaExternalLinkAlt } from 'react-icons/fa';
import RevenueByWeek from "./RevenueByWeek";
import RevenueByMonth from "./RevenueByMonth";
import RevenueByYear from "./RevenueByYear";
import Loading from "../../components/Loading";

// Register Chart.js components
ChartJS.register(
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);


const Statistics = () => {
  const { user, isAuthLoading } = useContext(AuthContext);
  const [customerStats, setCustomerStats] = useState(null);
  const [revenueStats, setRevenueStats] = useState(null);
  const [orderStats, setOrderStats] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('week');
  const navigate = useNavigate();

  // Auto-dismiss toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);


  // Fetch all statistics
  const fetchStatistics = useCallback(async () => {
    if (!user?._id) {
      setError("User not authenticated");
      return;
    }
    setLoading(true);
    setError("");

    try {
      console.log("Fetching statistics using SummaryAPI...");

      // Fetch all statistics in parallel using SummaryAPI with individual error handling
      const [
        customerResponse,
        revenueResponse,
        orderResponse
      ] = await Promise.allSettled([
        SummaryAPI.statistics.getCustomers(),
        SummaryAPI.statistics.getRevenue(),
        SummaryAPI.statistics.getOrders()
      ]);

      // Handle responses with error checking
      setCustomerStats(customerResponse.status === 'fulfilled' ? customerResponse.value : null);
      setRevenueStats(revenueResponse.status === 'fulfilled' ? revenueResponse.value : null);
      setOrderStats(orderResponse.status === 'fulfilled' ? orderResponse.value : null);

    } catch (err) {
      setError(err.message || "Failed to load statistics");
      console.error("Fetch statistics error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Handle authentication state
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user || !localStorage.getItem("token")) {
      navigate("/login", { replace: true });
    } else if (user && (user.role === 'admin' || user.role === 'manager')) {
      fetchStatistics();
    } else {
      setError("You do not have permission to view statistics");
    }
  }, [user, isAuthLoading, navigate, fetchStatistics]);

  // Retry fetching statistics
  const handleRetry = useCallback(() => {
    fetchStatistics();
  }, [fetchStatistics]);


  // Format currency
  const formatCurrency = (value) => {
    if (!value || value === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
  };

  // Helper: Get total completed (sold) orders
  const totalCompletedOrders = orderStats && Array.isArray(orderStats.statusCounts)
    ? (orderStats.statusCounts.find(s => s._id === 'delivered')?.count || 0)
    : 0;



  // Render loading state
  if (isAuthLoading) {
    return (
      <Loading
        type="auth"
        size="large"
        message="Verifying authentication..."
        fullScreen={true}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg font-medium transition-all duration-300 ${toast.type === "success"
            ? "bg-green-100 text-green-800 border border-green-200"
            : toast.type === "error"
              ? "bg-red-100 text-red-800 border border-red-200"
              : "bg-blue-100 text-blue-800 border border-blue-200"
            }`}
          role="alert"
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <div className="bg-blue-600 rounded-2xl p-8 text-white">
          <h1 className="text-4xl font-bold mb-3">Statistics Dashboard</h1>
          <p className="text-blue-100 text-lg">Comprehensive overview of your business performance</p>
        </div>
      </div>

      {/* Revenue Analytics Tabs */}
      {!loading && !error && (
        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="bg-white rounded-2xl p-2 shadow-lg border border-gray-200">
            <div className="flex space-x-2">
              <button
                onClick={() => setActiveTab('week')}
                className={`flex-1 px-4 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${activeTab === 'week'
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                📊 Week
              </button>
              <button
                onClick={() => setActiveTab('month')}
                className={`flex-1 px-4 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${activeTab === 'month'
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                📈 Month
              </button>
              <button
                onClick={() => setActiveTab('year')}
                className={`flex-1 px-4 py-4 rounded-xl font-semibold text-lg transition-all duration-300 ${activeTab === 'year'
                  ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                📅 Year
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'week' && <RevenueByWeek user={user} />}
            {activeTab === 'month' && <RevenueByMonth user={user} />}
            {activeTab === 'year' && <RevenueByYear user={user} />}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-2xl p-8 shadow-lg" role="alert" aria-live="true">
          <div className="flex items-center space-x-4">
            <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-2xl flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl">⚠</span>
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-bold text-red-800 mb-2">Error Loading Statistics</h3>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
            <button
              className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all duration-300 font-semibold shadow-lg hover:shadow-xl transform hover:scale-105"
              onClick={handleRetry}
              aria-label="Retry loading statistics"
            >
              🔄 Retry
            </button>
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <Loading
          type="page"
          size="large"
          message="Loading Statistics"
          subMessage="Please wait while we fetch your data..."
          className="min-h-96"
        />
      )}

    </div>
  );
};

export default Statistics;