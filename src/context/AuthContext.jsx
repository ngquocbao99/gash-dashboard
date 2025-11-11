import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { ToastContext } from './ToastContext'; // Adjust path if needed

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const navigate = useNavigate();

  // Use Toast context
  const { showToast } = useContext(ToastContext);

  // Handle session expiration with toast
  const handleSessionExpired = () => {
    showToast('Your session has expired. You will be logged out.', 'error');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    setUser(null);
    navigate('/login');
  };

  // Check session on app load and set up expiration timer
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const loginTime = localStorage.getItem('loginTime');

    if (token && storedUser && loginTime) {
      const currentTime = Date.now();
      const sessionDuration = 24 * 60 * 60 * 1000; // 1 day
      const timeElapsed = currentTime - parseInt(loginTime);

      if (timeElapsed >= sessionDuration) {
        handleSessionExpired();
        setIsAuthLoading(false);
      } else {
        setUser(JSON.parse(storedUser));
        const remainingTime = sessionDuration - timeElapsed;

        const timer = setTimeout(() => {
          handleSessionExpired();
        }, remainingTime);

        setIsAuthLoading(false); // Added this to ensure loading state is cleared on valid session

        // Cleanup timer on unmount
        return () => clearTimeout(timer);
      }
    } else {
      setIsAuthLoading(false);
    }
  }, []);

  // Axios interceptor for 401 responses
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          handleSessionExpired();
        }
        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, []);

  const login = async (username, password) => {
    try {
      const response = await axios.post('http://localhost:5000/auth/login', {
        username,
        password,
      });

      const { token, account } = response.data;

      // Restrict to admin or manager only
      if (!['admin', 'manager'].includes(account.role)) {
        showToast('Only admin or manager roles are allowed', 'error');
        return;
      }

      // Block non-admins from protected routes after login
      if (account.role !== 'admin' && window.location.pathname.match(/^\/(accounts|statistics)/)) {
        showToast('You do not have permission to access this page.', 'error');
        navigate('/');
        return;
      }

      const loginTime = Date.now().toString();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(account));
      localStorage.setItem('loginTime', loginTime);
      setUser(account);

      // Auto logout after 24 hours
      setTimeout(() => {
        handleSessionExpired();
      }, 24 * 60 * 60 * 1000);

      navigate('/');
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Login failed';
      showToast(message, 'error');
    }
  };

  const signup = async (userData) => {
    try {
      // Client-side role validation
      if (!['admin', 'manager'].includes(userData.role)) {
        showToast('Only admin or manager roles are allowed', 'error');
        return;
      }

      const response = await axios.post('http://localhost:5000/auth/register', userData);
      const { token, account } = response.data;

      // Server-side role double-check
      if (!['admin', 'manager'].includes(account.role)) {
        showToast('Invalid role assigned by server', 'error');
        return;
      }

      if (account.role !== 'admin' && window.location.pathname.match(/^\/(accounts|statistics)/)) {
        showToast('You do not have permission to access this page.', 'error');
        navigate('/');
        return;
      }

      const loginTime = Date.now().toString();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(account));
      localStorage.setItem('loginTime', loginTime);
      setUser(account);

      setTimeout(() => {
        handleSessionExpired();
      }, 24 * 60 * 60 * 1000);

      showToast('Account created successfully!', 'success');
      navigate('/');
    } catch (error) {
      const message = error.response?.data?.message || error.message || 'Signup failed';
      showToast(message, 'error');
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    setUser(null);
    navigate('/login');
  };

  return (
    <AuthContext.Provider value={{ user, login, signup, logout, isAuthLoading }}>
      {children}
    </AuthContext.Provider>
  );
};