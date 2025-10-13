import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, AuthContext } from "./context/AuthContext.jsx";

// ==== Import các component hiện có ====
import Products from "./pages/Products.jsx";
import ProductVariants from "./pages/ProductVariants.jsx";
import Login from "./pages/Login.jsx";
import Profile from "./pages/Profile.jsx";
import Carts from "./pages/Carts.jsx";
import Orders from "./pages/Orders.jsx";
import ProductSpecifications from "./pages/ProductSpecifications.jsx";
import Accounts from "./pages/Accounts.jsx";
import Categories from "./pages/Categories.jsx";
import Feedbacks from "./pages/Feedbacks.jsx";
import ImportBills from "./pages/ImportBills.jsx";
import Statistics from "./pages/Statistics.jsx";
import Layout from "./pages/Layout.jsx";
import Vouchers from "./pages/Vouchers.jsx";

// ==== Import Forgot Password, OTP, Reset Password ====
import ForgotPassword from "./pages/ForgotPassword.jsx";
import OTPVerification from "./pages/OTPVerification.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";

// ✅ Import thêm Chat và Notifications
import AdminChat from "./pages/AdminChat.jsx";
import Notifications from "./pages/Notifications.jsx";

// ===============================
// 🔒 ProtectedRoute (chặn người không có quyền)
// ===============================
const ProtectedRoute = ({ children }) => {
  const { user, isAuthLoading } = React.useContext(AuthContext);
  const location = useLocation();

  if (isAuthLoading) {
    return null; // hoặc spinner loading
  }

  if (!user || !["admin", "manager"].includes(user.role)) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return children;
};

// ===============================
// 🧠 App Component
// ===============================
const App = () => {
  return (
    <Router>
      <AuthProvider>
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
                  <Statistics />
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
              path="/statistics"
              element={
                <ProtectedRoute>
                  <Statistics />
                </ProtectedRoute>
              }
            />
            <Route
              path="/imports"
              element={
                <ProtectedRoute>
                  <ImportBills />
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
              path="/carts"
              element={
                <ProtectedRoute>
                  <Carts />
                </ProtectedRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <ProtectedRoute>
                  <Categories />
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

            {/* ✅ Vouchers */}
            <Route
              path="/vouchers"
              element={
                <ProtectedRoute>
                  <Vouchers />
                </ProtectedRoute>
              }
            />

            {/* ✅ Notifications */}
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <Notifications />
                </ProtectedRoute>
              }
            />

            {/* ✅ Admin Chat */}
            <Route
              path="/chat"
              element={
                <ProtectedRoute>
                  <AdminChat />
                </ProtectedRoute>
              }
            />
          </Routes>
        </Layout>
      </AuthProvider>
    </Router>
  );
};

export default App;
