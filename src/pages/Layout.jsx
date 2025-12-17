import React, {
  useState,
  useRef,
  useEffect,
  useContext,
  useCallback,
  useMemo,
} from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../context/AuthContext";
import {
  ShoppingCart,
  List,
  Assignment,
  RateReview,
  Inventory,
  Settings as SettingsIcon,
  Layers,
  Receipt,
  ConfirmationNumber,
  Notifications,
  Message,
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
  Visibility,
  VideoCall,
  LiveTv,
  RecordVoiceOver,
  CameraAlt,
  Category,
  Widgets,
  AttachMoney,
  Group,
} from "@mui/icons-material";
import "../styles/Layout.css";
import gashLogo from "../assets/image/gash-logo.svg";

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
      navigate("/login", { state: { from: location.pathname } });
    }
  }, [user, navigate, location.pathname]);

  const handleLogout = useCallback(async () => {
    try {
      setIsAccountOpen(false);
      await logout();
      navigate("/orders");
    } catch (err) {
      console.error("Logout error:", err);
      setError("Failed to sign out. Please try again.");
      setTimeout(() => setError(null), ERROR_TIMEOUT);
    }
  }, [logout, navigate]);

  const handleLogoClick = useCallback(
    (e) => {
      e.preventDefault();
      navigate(user?.role === "manager" ? "/orders" : "/statistics/order");
      window.scrollTo({ top: 0, behavior: "smooth" });
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
  const sidebarItems = useMemo(() => {
    const items = [
      { label: "Order", to: "/orders", icon: Assignment },
      { label: "Product Specification", to: "/specifications", icon: Category },
      { label: "Product", to: "/products", icon: Inventory },
      { label: "Product Variant", to: "/variants", icon: Widgets },
      { label: "Bills", to: "/bills", icon: Receipt },
      { label: "Voucher", to: "/vouchers", icon: ConfirmationNumber },
      { label: "Feedback", to: "/feedbacks", icon: RateReview },
      { label: "Chat", to: "/chat", icon: Message },
      { label: "Notifications", to: "/notifications", icon: Notifications },
      { label: "Livestream", to: "/livestream", icon: LiveTv },
    ];

    // Statistics submenu (có ở admin & manager)
    const statisticsSubmenu = [
      { label: "Customer", to: "/statistics/customer", icon: Group },
      { label: "Product", to: "/statistics/product", icon: Inventory },
      { label: "Order", to: "/statistics/order", icon: Assignment },
    ];

    // Chỉ admin mới có Revenue
    if (user?.role === "admin") {
      statisticsSubmenu.push({
        label: "Revenue",
        to: "/statistics/revenue",
        icon: AttachMoney,
      });
    }

    // Add Statistics vào menu
    items.unshift({
      label: "Statistics",
      to: "/statistics",
      icon: BarChart,
      hasSubmenu: true,
      submenuItems: statisticsSubmenu,
    });

    // Chỉ admin mới có Account
    if (user?.role === "admin") {
      items.unshift({ label: "Account", to: "/accounts", icon: People });
    }

    return items;
  }, [user]);

  // Account sublist items
  const accountItems = useMemo(
    () => [
      { label: "My Account", to: "/profile", icon: AccountCircle },
      { label: "Settings", to: "/settings", icon: Settings },
      {
        label: "Sign Out",
        action: handleLogout,
        className: "logout-item",
        icon: Logout,
      },
    ],
    [handleLogout]
  );

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setIsAccountOpen(false);
        setIsSidebarExpanded(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Reset error and account sublist on route change
  useEffect(() => {
    setIsAccountOpen(false);
    setError(null);
    // Auto-expand statistics if on statistics route
    if (location.pathname.startsWith("/statistics")) {
      setIsStatisticsExpanded(true);
    }
  }, [location.pathname]);

  // User display name
  const userDisplayName = useMemo(() => {
    if (!user) return null;
    return user.username || user.email?.split("@")[0] || "Account";
  }, [user]);

  // User profile info
  const userProfileInfo = useMemo(() => {
    if (!user) return null;
    return {
      name: user.username || user.email?.split("@")[0] || "Unknown User",
      email: user.email || "No email provided",
      role: user.role || "user",
      roleDisplay:
        user.role === "admin"
          ? "Administrator"
          : user.role === "manager"
            ? "Manager"
            : "Staff",
      joinDate: user.createdAt
        ? new Date(user.createdAt).toLocaleDateString()
        : "Unknown",
      lastLogin: user.lastLogin
        ? new Date(user.lastLogin).toLocaleDateString()
        : "Never",
    };
  }, [user]);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Error notification */}
      {error && (
        <div
          className="fixed top-4 right-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-md shadow-lg z-50 flex items-center gap-2 max-w-sm animate-slide-in"
          role="alert"
        >
          <span className="text-lg" aria-hidden="true">
            ⚠
          </span>
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
      {user && ["admin", "manager"].includes(user.role) && (
        <aside
          className={`fixed top-0 left-0 h-full bg-white text-gray-800 shadow-xl z-50 flex flex-col transition-all duration-300 border-r ${isSidebarExpanded ? "w-72" : "w-20"
            }`}
          style={{ borderColor: '#A86523' }}
          role="navigation"
          aria-label="Admin navigation"
        >
          {/* Sidebar Header */}
          <div className="px-4 py-4 border-b flex items-center justify-between bg-gradient-to-r from-[#E9A319] via-[#A86523] to-[#8B4E1A]" style={{ borderColor: '#A86523' }}>
            {isSidebarExpanded ? (
              <Link
                to={user?.role === "manager" ? "/orders" : "/statistics/order"}
                className="flex items-center transition-all duration-300 opacity-100"
                onClick={handleLogoClick}
                aria-label="GASH homepage"
              >
                <h1 className="text-xl font-bold text-white font-sans whitespace-nowrap">
                  GASH Dashboard
                </h1>
              </Link>
            ) : (
              <div className="w-8 h-8" />
            )}
            <button
              onClick={handleSidebarToggle}
              className="p-2 rounded-lg hover:bg-white/20 transition-colors duration-200 text-white hover:text-white"
              aria-label={
                isSidebarExpanded ? "Collapse sidebar" : "Expand sidebar"
              }
            >
              {isSidebarExpanded ? (
                <Close sx={{ fontSize: 20 }} />
              ) : (
                <Menu sx={{ fontSize: 20 }} />
              )}
            </button>
          </div>

          {/* Navigation Items */}
          <nav className="flex flex-col flex-1 py-3 overflow-y-auto">
            <div className="space-y-0.5 px-3">
              {sidebarItems.map((item, index) => (
                <div key={index}>
                  {item.hasSubmenu ? (
                    <div>
                      <button
                        onClick={handleStatisticsToggle}
                        className={`flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group ${location.pathname.startsWith(item.to)
                          ? "bg-[#FCEFCB] text-[#A86523] shadow-sm"
                          : "text-gray-600 hover:bg-[#FCEFCB] hover:text-[#A86523]"
                          }`}
                        role="menuitem"
                      >
                        <div className="flex items-center flex-1">
                          {location.pathname.startsWith(item.to) && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full" style={{ backgroundColor: '#A86523' }}></div>
                          )}
                          <item.icon
                            sx={{ fontSize: 21, color: location.pathname.startsWith(item.to) ? '#A86523' : undefined }}
                            className={`flex-shrink-0 ${location.pathname.startsWith(item.to)
                              ? ""
                              : "text-gray-500 group-hover:text-[#A86523]"
                              }`}
                          />
                          {isSidebarExpanded && (
                            <span className="ml-3 whitespace-nowrap">
                              {item.label}
                            </span>
                          )}
                        </div>
                        {isSidebarExpanded && (
                          <div
                            className={`transition-transform duration-200 ${isStatisticsExpanded ? "rotate-180" : ""
                              }`}
                          >
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M19 9l-7 7-7-7"
                              />
                            </svg>
                          </div>
                        )}
                      </button>

                      {/* Submenu – also centered */}
                      {isSidebarExpanded && isStatisticsExpanded && (
                        <div className="ml-8 mt-1 space-y-0.5">
                          {item.submenuItems.map((subItem, subIndex) => (
                            <Link
                              key={subIndex}
                              to={subItem.to}
                              className={`flex items-center px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 relative group ${location.pathname === subItem.to
                                ? "bg-[#FCEFCB] text-[#A86523] shadow-sm"
                                : "text-gray-600 hover:bg-[#FCEFCB] hover:text-[#A86523]"
                                }`}
                            >
                              {location.pathname === subItem.to && (
                                <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full" style={{ backgroundColor: '#A86523' }}></div>
                              )}
                              <subItem.icon
                                sx={{ fontSize: 18, color: location.pathname === subItem.to ? '#A86523' : undefined }}
                                className={`flex-shrink-0 ${location.pathname === subItem.to
                                  ? ""
                                  : "text-gray-500 group-hover:text-[#A86523]"
                                  }`}
                              />
                              <span className="ml-3 whitespace-nowrap">
                                {subItem.label}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Link
                      to={item.to}
                      className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 relative group ${location.pathname === item.to
                        ? "bg-[#FCEFCB] text-[#A86523] shadow-sm"
                        : "text-gray-600 hover:bg-[#FCEFCB] hover:text-[#A86523]"
                        }`}
                      role="menuitem"
                    >
                      {location.pathname === item.to && (
                        <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r-full" style={{ backgroundColor: '#A86523' }}></div>
                      )}
                      <item.icon
                        sx={{ fontSize: 21, color: location.pathname === item.to ? '#A86523' : undefined }}
                        className={`flex-shrink-0 ${location.pathname === item.to
                          ? ""
                          : "text-gray-500 group-hover:text-[#A86523]"
                          }`}
                      />
                      {isSidebarExpanded && (
                        <span className="ml-3 whitespace-nowrap">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </nav>

          {/* Profile Section */}
          <div className="flex flex-col border-t py-4 mt-auto bg-gradient-to-t from-white via-[#FCEFCB]/30 to-transparent" style={{ borderColor: '#A86523' }}>
            <div className="px-4">
              {isSidebarExpanded ? (
                /* Expanded view – full info with consistent spacing */
                <div className="space-y-3">
                  {/* User Info */}
                  <Link
                    to="/profile"
                    className="flex items-center space-x-3.5 hover:bg-[#FCEFCB] rounded-xl p-3 -m-3 transition-all duration-200 group"
                  >
                    <div className="w-11 h-11 rounded-full flex items-center justify-center shadow-md ring-2 ring-white" style={{ background: 'linear-gradient(to top right, #E9A319, #A86523)' }}>
                      <AccountCircle sx={{ fontSize: 26, color: "white" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {userProfileInfo?.name || "Guest User"}
                      </p>
                      <p className="text-xs text-gray-500 truncate">
                        {userProfileInfo?.roleDisplay || "User"}
                      </p>
                    </div>
                  </Link>

                  {/* Sign Out Button */}
                  <button
                    onClick={handleLogout}
                    className="flex items-center space-x-3.5 w-full px-3 py-2.5 text-red-600 hover:bg-red-50 rounded-xl text-sm font-medium transition-all duration-200 group"
                  >
                    <Logout sx={{ fontSize: 19 }} />
                    <span>Sign Out</span>
                  </button>
                </div>
              ) : (
                /* Collapsed view – icons only, perfectly centered */
                <div className="flex flex-col items-center space-y-4 pt-2">
                  <Link
                    to="/profile"
                    className="w-11 h-11 rounded-full flex items-center justify-center hover:scale-110 transition-all duration-200 shadow-lg ring-2 ring-white"
                    style={{ background: 'linear-gradient(to top right, #E9A319, #A86523)' }}
                    title="My Profile"
                  >
                    <AccountCircle sx={{ fontSize: 24, color: "white" }} />
                  </Link>

                  <button
                    onClick={handleLogout}
                    className="p-2.5 text-red-500 hover:bg-red-100 rounded-xl transition-all duration-200 hover:scale-110"
                    title="Sign Out"
                  >
                    <Logout sx={{ fontSize: 19 }} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      {/* Main Content */}
      <main
        className={`flex-grow bg-gray-50 min-h-screen transition-all duration-300 ${user && ["admin", "manager"].includes(user.role)
          ? isSidebarExpanded
            ? "ml-72 w-[calc(100%-18rem)]"
            : "ml-20 w-[calc(100%-5rem)]"
          : "ml-0 w-full"
          }`}
        role="main"
      >
        {children}
      </main>
    </div>
  );
};

export default Layout;
