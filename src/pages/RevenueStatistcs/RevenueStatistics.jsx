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
import RevenueByDay from "./RevenueByDay";
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
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [activeTab, setActiveTab] = useState('day');
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


  // Handle authentication state
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user || !localStorage.getItem("token")) {
      navigate("/login", { replace: true });
    } else if (user && (user.role === 'admin' || user.role === 'manager')) {
      // No need to fetch statistics - each tab handles its own data
    } else {
      setError("You do not have permission to view statistics");
    }
  }, [user, isAuthLoading, navigate]);



  // Format currency
  const formatCurrency = (value) => {
    if (!value || value === 0) return '0 ₫';
    return new Intl.NumberFormat('vi-VN').format(value) + ' ₫';
  };




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
    <div className="min-h-screen bg-gray-100 p-4">
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
      <div className="mb-6">
        <div className="bg-blue-600 rounded-xl p-4 text-white">
          <h1 className="text-2xl font-bold mb-1">Statistics Dashboard</h1>
          <p className="text-blue-100 text-sm">Comprehensive overview of your business performance</p>
        </div>
      </div>

      {/* Revenue Analytics Tabs */}
      {!error && (
        <div className="space-y-4">
          {/* Tab Navigation */}
          <div className="bg-white rounded-xl p-2 shadow-lg border border-gray-200">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab('day')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === 'day'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                Day
              </button>
              <button
                onClick={() => setActiveTab('week')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === 'week'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                Week
              </button>
              <button
                onClick={() => setActiveTab('month')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === 'month'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                Month
              </button>
              <button
                onClick={() => setActiveTab('year')}
                className={`flex-1 px-3 py-2 rounded-lg font-medium text-sm transition-all duration-300 ${activeTab === 'year'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                  }`}
              >
                Year
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === 'day' && <RevenueByDay user={user} />}
            {activeTab === 'week' && <RevenueByWeek user={user} />}
            {activeTab === 'month' && <RevenueByMonth user={user} />}
            {activeTab === 'year' && <RevenueByYear user={user} />}
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 border-2 border-red-200 rounded-xl p-6 shadow-lg" role="alert" aria-live="true">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white text-xl">⚠</span>
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-red-800 mb-1">Access Denied</h3>
              <p className="text-red-700 font-medium">{error}</p>
            </div>
          </div>
        </div>
      )}


    </div>
  );
};

export default Statistics;