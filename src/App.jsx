import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { AuthProvider, AuthContext } from "./context/AuthContext.jsx";
import { ToastProvider } from "./components/Toast.jsx";

// ==== Import các component hiện có ====
import Products from "./pages/ProductManagement/Products.jsx";
import ProductVariants from "./pages/VariantManagement/ProductVariants.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import Orders from "./pages/Order/Orders.jsx";
import ProductSpecifications from "./pages/ProductSpecifications.jsx";

// Component to redirect to categories tab in ProductSpecifications
const CategoriesRedirect = () => {
  const navigate = useNavigate();
  React.useEffect(() => {
    navigate('/product-specifications?tab=categories', { replace: true });
  }, [navigate]);
  return null;
};
import Accounts from "./pages/Account/Accounts.jsx";
import Feedbacks from "./pages/Feedback/Feedbacks.jsx";
import Bills from "./pages/Bills/Bill.jsx";
import Layout from "./pages/Layout.jsx";
import Vouchers from "./pages/VoucherManagement/Vouchers.jsx";
import AdminChat from "./pages/AdminChat.jsx";
import Notifications from "./pages/Notifications.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import OTPVerification from "./pages/OTPVerification.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import RevenueStatistics from "./pages/RevenueStatistcs/RevenueStatistics.jsx";
import OrderStatistics from "./pages/OrderStatistics/OrderStatistics.jsx";
import CustomerStatistics from "./pages/CustomerStatistics/CustomerStatistics.jsx";
import ProductStatistics from "./pages/ProductStatistics/ProductStatistics.jsx";
import LiveStream from "./pages/LiveStream/LiveStream.jsx";
import LiveStreamDashboard from "./pages/LiveStream/LiveStreamDashboard.jsx";
import LiveStreamDetails from "./pages/LiveStream/LiveStreamDetails.jsx";


// ===============================
// ProtectedRoute (chặn người không có quyền)
// ===============================
const ProtectedRoute = ({ children }) => {
  const { user, isAuthLoading } = React.useContext(AuthContext);
  const location = useLocation();

  if (isAuthLoading) {
    return null;
  }

  if (!user || !["admin", "manager"].includes(user.role)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
};

// ===============================
// App Component
// ===============================
const App = () => {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <Layout>
            <Routes>
              {/* ==== Public routes ==== */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/otp-verification" element={<OTPVerification />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* ==== Protected Routes ==== */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <OrderStatistics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/products"
                element={
                  <ProtectedRoute>
                    <Products />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/feedbacks"
                element={
                  <ProtectedRoute>
                    <Feedbacks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/statistics/revenue"
                element={
                  <ProtectedRoute>
                    <RevenueStatistics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/statistics/customer"
                element={
                  <ProtectedRoute>
                    <CustomerStatistics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/statistics/product"
                element={
                  <ProtectedRoute>
                    <ProductStatistics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/statistics/order"
                element={
                  <ProtectedRoute>
                    <OrderStatistics />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/bills"
                element={
                  <ProtectedRoute>
                    <Bills />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/accounts"
                element={
                  <ProtectedRoute>
                    <Accounts />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/specifications"
                element={
                  <ProtectedRoute>
                    <ProductSpecifications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/variants"
                element={
                  <ProtectedRoute>
                    <ProductVariants />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Profile />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/categories"
                element={
                  <ProtectedRoute>
                    <CategoriesRedirect />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/orders"
                element={
                  <ProtectedRoute>
                    <Orders />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/vouchers"
                element={
                  <ProtectedRoute>
                    <Vouchers />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/notifications"
                element={
                  <ProtectedRoute>
                    <Notifications />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <AdminChat />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/livestream"
                element={
                  <ProtectedRoute>
                    <LiveStream />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/manage-livestream/:livestreamId"
                element={
                  <ProtectedRoute>
                    <LiveStreamDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/livestream/details/:livestreamId"
                element={
                  <ProtectedRoute>
                    <LiveStreamDetails />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </Layout>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
