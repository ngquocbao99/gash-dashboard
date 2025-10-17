import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AuthContext } from '../../context/AuthContext';
import Colors from './Colors';
import Sizes from './Sizes';
import Categories from './Categories';

const ProductSpecifications = () => {
  const { user, isAuthLoading } = useContext(AuthContext);
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('colors');
  const navigate = useNavigate();

  // Handle URL parameter for tab selection
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['colors', 'sizes', 'categories'].includes(tabParam)) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // Handle authentication state
  useEffect(() => {
    if (isAuthLoading) return;
    if (!user && !localStorage.getItem('token')) {
      navigate('/login', { replace: true });
    }
  }, [user, isAuthLoading, navigate]);

  // Show loading state while auth is being verified
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8" role="status" aria-live="polite">
          <div className="flex flex-col items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-600 font-medium">Verifying authentication...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-2 sm:p-3 lg:p-4 xl:p-6">
      {/* Header Section */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-3 sm:p-4 lg:p-6 mb-4 lg:mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 mb-1 lg:mb-2">Product Specifications</h1>
            <p className="text-gray-600 text-sm sm:text-base lg:text-lg">Manage colors, sizes, and categories</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-4 lg:mb-6">
        <div className="flex border-b border-gray-200">
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${activeTab === 'colors'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            onClick={() => setActiveTab('colors')}
            aria-selected={activeTab === 'colors'}
            role="tab"
          >
            Colors
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${activeTab === 'sizes'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            onClick={() => setActiveTab('sizes')}
            aria-selected={activeTab === 'sizes'}
            role="tab"
          >
            Sizes
          </button>
          <button
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all duration-200 ${activeTab === 'categories'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            onClick={() => setActiveTab('categories')}
            aria-selected={activeTab === 'categories'}
            role="tab"
          >
            Categories
          </button>
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === 'colors' && <Colors />}
      {activeTab === 'sizes' && <Sizes />}
      {activeTab === 'categories' && <Categories />}
    </div>
  );
};

export default ProductSpecifications;