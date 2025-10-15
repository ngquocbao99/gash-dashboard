import React, { useState, useRef, useEffect, useContext, useCallback, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import {
  ShoppingCart,
  List,
  ShoppingBag,
  Comment,
  Inventory,
  Info,
  Layers,
  FileUpload,
  LocalOffer,
  Notifications,
  Chat,
  People,
  BarChart,
  Person,
  Menu,
  Close,
  AccountCircle,
  Settings,
  Logout,
  Email,
  CalendarToday,
  AccessTime,
  CheckCircle,
  Cancel,
  Visibility
} from '@mui/icons-material';
import '../styles/Layout.css';
import gashLogo from '../assets/image/gash-logo.svg';

// Constants
const ERROR_TIMEOUT = 5000;

const Layout = ({ children }) => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();

  // State
  const [error, setError] = useState(null);
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isStatisticsExpanded, setIsStatisticsExpanded] = useState(false);

  // Event handlers
  const handleAccountClick = useCallback(() => {
    if (user) {
      setIsAccountOpen((prev) => !prev);
    } else {
      navigate('/login', { state: { from: location.pathname } });
    }
  }, [user, navigate, location.pathname]);

  const handleLogout = useCallback(async () => {
    try {
      setIsAccountOpen(false);
      await logout();
      navigate('/orders');
    } catch (err) {
      console.error('Logout error:', err);
      setError('Failed to sign out. Please try again.');
      setTimeout(() => setError(null), ERROR_TIMEOUT);
    }
  }, [logout, navigate]);

  const handleLogoClick = useCallback(
    (e) => {
      e.preventDefault();
      navigate(user?.role === 'manager' ? '/orders' : '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate, user]
  );

  const handleSidebarToggle = useCallback(() => {
    setIsSidebarExpanded((prev) => !prev);
  }, []);

  const handleStatisticsToggle = useCallback(() => {
    setIsStatisticsExpanded((prev) => !prev);
  }, []);

  // Sidebar items with MUI Icons
  const sidebarItems = useMemo(
    () => {
      const items = [
        { label: 'Order', to: '/orders', icon: ShoppingBag },
        { label: 'Product', to: '/products', icon: Inventory },
        { label: 'Category', to: '/categories', icon: List },
        { label: 'Cart', to: '/carts', icon: ShoppingCart },
        { label: 'Product Specification', to: '/specifications', icon: Info },
        { label: 'Product Variant', to: '/variants', icon: Layers },
        { label: 'Import Bills', to: '/imports', icon: FileUpload },
        { label: 'Voucher', to: '/vouchers', icon: LocalOffer },
        { label: 'Feedback', to: '/feedbacks', icon: Comment },
        { label: 'Chat', to: '/chat', icon: Chat },
        { label: 'Notifications', to: '/notifications', icon: Notifications },
      ];

      if (user?.role === 'admin') {
        items.unshift(
          { label: 'Account', to: '/accounts', icon: People },
          {
            label: 'Statistics',
            to: '/statistics',
            icon: BarChart,
            hasSubmenu: true,
            submenuItems: [
              { label: 'Customer', to: '/statistics/customer', icon: People },
              { label: 'Product', to: '/statistics/product', icon: Inventory },
              { label: 'Order', to: '/statistics/order', icon: ShoppingBag },
              { label: 'Revenue', to: '/statistics/revenue', icon: BarChart }
            ]
          }
        );
      }

      return items;
    },
    [user]
  );

  // Account sublist items
  const accountItems = useMemo(
    () => [
      { label: 'My Account', to: '/profile', icon: AccountCircle },
      { label: 'Settings', to: '/settings', icon: Settings },
      { label: 'Sign Out', action: handleLogout, className: 'logout-item', icon: Logout },
    ],
    [handleLogout]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsAccountOpen(false);
        setIsSidebarExpanded(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Reset error and account sublist on route change
  useEffect(() => {
    setIsAccountOpen(false);
    setError(null);
    // Auto-expand statistics if on statistics route
    if (location.pathname.startsWith('/statistics')) {
      setIsStatisticsExpanded(true);
    }
  }, [location.pathname]);

  // User display name
  const userDisplayName = useMemo(() => {
    if (!user) return null;
    return user.username || user.email?.split('@')[0] || 'Account';
  }, [user]);

  // User profile info
  const userProfileInfo = useMemo(() => {
    if (!user) return null;
    return {
      name: user.username || user.email?.split('@')[0] || 'Unknown User',
      email: user.email || 'No email provided',
      role: user.role || 'user',
      roleDisplay: user.role === 'admin' ? 'Administrator' : user.role === 'manager' ? 'Manager' : 'Staff',
      joinDate: user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'Unknown',
      lastLogin: user.lastLogin ? new Date(user.lastLogin).toLocaleDateString() : 'Never',
      status: user.isActive !== false ? 'Active' : 'Inactive'
    };
  }, [user]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Error notification */}
      {error && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md shadow-lg z-50 flex items-center gap-2 max-w-sm animate-slide-in" role="alert">
          <span className="text-lg" aria-hidden="true">⚠</span>
          <span className="text-sm flex-1">{error}</span>
          <button
            className="bg-transparent border-none text-red-600 text-lg cursor-pointer p-1 leading-none hover:opacity-80"
            onClick={() => setError(null)}
            type="button"
            aria-label="Close error notification"
          >
            ×
          </button>
        </div>
      )}

      {/* Sidebar */}
      {user && ['admin', 'manager'].includes(user.role) && (
        <aside
          className={`fixed top-0 left-0 h-full bg-white text-gray-800 shadow-xl z-50 flex flex-col transition-all duration-300 border-r border-gray-200 ${isSidebarExpanded ? 'w-64' : 'w-16'
            }`}
          role="navigation"
          aria-label="Admin navigation"
        >
          {/* Sidebar Header */}
          <div className="px-4 py-4 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            {isSidebarExpanded ? (
              <Link
                to={user?.role === 'manager' ? '/orders' : '/'}
                className="flex items-center transition-opacity duration-200 hover:opacity-90"
                onClick={handleLogoClick}
                aria-label="Gash homepage"
              >
                <h1 className="text-xl font-bold text-gray-800 font-sans">Gash Dashboard</h1>
              </Link>
            ) : (
              <Link
                to={user?.role === 'manager' ? '/orders' : '/'}
                className="flex items-center justify-center transition-opacity duration-200 hover:opacity-90"
                onClick={handleLogoClick}
                aria-label="Gash homepage"
              >
              </Link>
            )}
            <button
              onClick={handleSidebarToggle}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 text-gray-600 hover:text-gray-800"
              aria-label={isSidebarExpanded ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              {isSidebarExpanded ? (
                <Close sx={{ fontSize: 20 }} />
              ) : (
                <Menu sx={{ fontSize: 20 }} />
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col flex-1 py-4 overflow-y-auto">
            <div className="space-y-1 px-2">
              {sidebarItems.map((item, index) => (
                <div key={index}>
                  {/* Main Item */}
                  {item.hasSubmenu ? (
                    <div>
                      <button
                        onClick={handleStatisticsToggle}
                        className={`flex items-center justify-between w-full px-3 py-3 mx-1 rounded-xl text-sm font-medium transition-all duration-200 relative group ${location.pathname.startsWith(item.to)
                          ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                          }`}
                        role="menuitem"
                        title={item.label}
                      >
                        <div className="flex items-center">
                          {location.pathname.startsWith(item.to) && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full"></div>
                          )}
                          <item.icon
                            sx={{ fontSize: 20 }}
                            className={`flex-shrink-0 transition-colors duration-200 ${location.pathname.startsWith(item.to)
                              ? 'text-blue-600'
                              : 'text-gray-500 group-hover:text-gray-700'
                              }`}
                          />
                          {isSidebarExpanded && (
                            <span className="ml-3 whitespace-nowrap font-medium">{item.label}</span>
                          )}
                        </div>
                        {isSidebarExpanded && (
                          <div className={`transition-transform duration-200 ${isStatisticsExpanded ? 'rotate-180' : ''}`}>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        )}
                      </button>

                      {/* Submenu Items */}
                      {isSidebarExpanded && isStatisticsExpanded && (
                        <div className="ml-4 mt-1 space-y-1">
                          {item.submenuItems.map((subItem, subIndex) => (
                            <Link
                              key={subIndex}
                              to={subItem.to}
                              className={`flex items-center px-3 py-2 mx-1 rounded-lg text-sm font-medium transition-all duration-200 relative group ${location.pathname === subItem.to
                                ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm'
                                : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                                }`}
                              role="menuitem"
                              title={subItem.label}
                            >
                              {location.pathname === subItem.to && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full"></div>
                              )}
                              <subItem.icon
                                sx={{ fontSize: 16 }}
                                className={`flex-shrink-0 transition-colors duration-200 ${location.pathname === subItem.to
                                  ? 'text-blue-600'
                                  : 'text-gray-500 group-hover:text-gray-700'
                                  }`}
                              />
                              <span className="ml-3 whitespace-nowrap font-medium">{subItem.label}</span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.to}
                      className={`flex items-center px-3 py-3 mx-1 rounded-xl text-sm font-medium transition-all duration-200 relative group ${location.pathname === item.to
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 text-blue-700 shadow-sm'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                        }`}
                      role="menuitem"
                      title={item.label}
                    >
                      {location.pathname === item.to && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-blue-500 to-blue-600 rounded-r-full"></div>
                      )}
                      <item.icon
                        sx={{ fontSize: 20 }}
                        className={`flex-shrink-0 transition-colors duration-200 ${location.pathname === item.to
                          ? 'text-blue-600'
                          : 'text-gray-500 group-hover:text-gray-700'
                          }`}
                      />
                      {isSidebarExpanded && (
                        <span className="ml-3 whitespace-nowrap font-medium">{item.label}</span>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </nav>

          {/* Profile Section */}
          <div className="flex flex-col border-t border-gray-200 py-3 mt-auto bg-gradient-to-t from-white via-purple-50/30 to-transparent">
            {/* Profile Info */}
            <div className="px-4 py-2 mx-2">
              {isSidebarExpanded ? (
                <div className="space-y-2">
                  {/* Avatar and Basic Info - Clickable */}
                  <Link
                    to="/profile"
                    className="flex items-center space-x-3 hover:bg-purple-100/60 rounded-lg p-2 -m-2 transition-all duration-200"
                  >
                    <div className="w-9 h-9 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center shadow-sm">
                      <AccountCircle sx={{ fontSize: 22, color: 'white' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {userProfileInfo?.name || 'Guest User'}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {userProfileInfo?.roleDisplay || 'User'}
                      </p>
                    </div>
                  </Link>

                  {/* Sign Out Button */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-red-600 hover:bg-red-100/70 rounded-lg text-sm font-medium transition-all duration-200"
                  >
                    <Logout sx={{ fontSize: 16 }} />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center space-y-2">
                  <Link
                    to="/profile"
                    className="w-8 h-8 bg-gradient-to-tr from-purple-500 to-indigo-500 rounded-full flex items-center justify-center hover:scale-110 transition-all duration-200 shadow-md"
                  >
                    <AccountCircle sx={{ fontSize: 18, color: 'white' }} />
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="p-1 text-red-500 hover:bg-red-100 rounded transition-all duration-200 hover:scale-110"
                    title="Sign Out"
                  >
                    <Logout sx={{ fontSize: 16 }} />
                  </button>
                </div>
              )}
            </div>
          </div>

        </aside>
      )}

      {/* Main Content */}
      <main
        className={`flex-grow bg-gray-50 min-h-screen transition-all duration-300 ${user && ['admin', 'manager'].includes(user.role)
          ? (isSidebarExpanded ? 'ml-64 w-[calc(100%-16rem)]' : 'ml-16 w-[calc(100%-4rem)]')
          : 'ml-0 w-full'
          }`}
        role="main"
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;