import React, { createContext, useState, useEffect, useContext } from 'react';
import axiosClient from '../common/axiosClient';
import { useNavigate } from 'react-router-dom';
import { ToastContext } from './ToastContext';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const navigate = useNavigate();
  const { showToast } = useContext(ToastContext);

  const handleForcedLogout = (message) => {
    showToast(message, 'error');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    setUser(null);
    navigate('/login');
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    const loginTime = localStorage.getItem('loginTime');

    if (token && storedUser && loginTime) {
      const now = Date.now();
      const sessionDuration = 24 * 60 * 60 * 1000; // 1 day
      const elapsed = now - parseInt(loginTime, 10);

      if (elapsed >= sessionDuration) {
        handleForcedLogout('Your session has expired. You will be logged out.');
        setIsAuthLoading(false);
        return;
      }

      setUser(JSON.parse(storedUser));

      const remaining = sessionDuration - elapsed;
      const timer = setTimeout(() => {
        handleForcedLogout('Your session has expired. You will be logged out.');
      }, remaining);

      setIsAuthLoading(false);
      return () => clearTimeout(timer);
    } else {
      setIsAuthLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    const interceptor = axiosClient.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err.response) {
          const { status } = err.response;
          const msg = err.response.data?.message ?? '';

          if (
            status === 401 ||
            (status === 403 && /inactive|suspended/i.test(msg))
          ) {
            if (localStorage.getItem('token')) {
              const reason =
                status === 401
                  ? 'Your session has expired or the token is invalid. You will be logged out.'
                  : 'Your account has been suspended or deactivated. You will be logged out.';
              handleForcedLogout(reason);
            }
          }
        }
        return Promise.reject(err);
      }
    );

    return () => axiosClient.interceptors.response.eject(interceptor);
  }, [showToast]);

  useEffect(() => {
    let interval;
    if (user) {
      interval = setInterval(async () => {
        try {
          await axiosClient.get('/auth/check-status');
        } catch {
          // Interceptor will handle logout if 403 due to inactive
        }
      }, 5000); // Every 5 seconds for more immediate response
    }
    return () => clearInterval(interval);
  }, [user]);

  const login = async (username, password) => {
    try {
      const { data } = await axiosClient.post('/auth/login', {
        username,
        password,
      });

      const { token, account } = data;

      if (!['admin', 'manager'].includes(account.role)) {
        showToast('Only admin or manager roles are allowed', 'error');
        return;
      }

      if (
        account.role !== 'admin' &&
        /^\/(accounts|statistics)/.test(window.location.pathname)
      ) {
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
        handleForcedLogout('Your session has expired. You will be logged out.');
      }, 24 * 60 * 60 * 1000);


      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Login failed';
      showToast(msg, 'error');
    }
  };

  const signup = async (userData) => {
    try {
      if (!['admin', 'manager'].includes(userData.role)) {
        showToast('Only admin or manager roles are allowed', 'error');
        return;
      }

      const { data } = await axiosClient.post(
        '/auth/register',
        userData
      );
      const { token, account } = data;

      if (!['admin', 'manager'].includes(account.role)) {
        showToast('Invalid role assigned by server', 'error');
        return;
      }

      if (
        account.role !== 'admin' &&
        /^\/(accounts|statistics)/.test(window.location.pathname)
      ) {
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
        handleForcedLogout('Your session has expired. You will be logged out.');
      }, 24 * 60 * 60 * 1000);

      showToast('Account created successfully!', 'success');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Signup failed';
      showToast(msg, 'error');
    }
  };

  const passkeyLogin = async (username) => {
    try {
      const { startAuthentication } = await import('@simplewebauthn/browser');
      
      // Step 1: Get authentication options from server
      const response = await axiosClient.post('/passkeys/auth/generate', { username });
      const { options } = response.data;

      // Step 2: Start authentication with browser
      const authenticationResponse = await startAuthentication(options);

      // Step 3: Verify authentication with server
      const verifyResponse = await axiosClient.post('/passkeys/auth/verify', {
        username,
        ...authenticationResponse,
        challenge: options.challenge,
      });

      const { token, account } = verifyResponse.data;

      if (!['admin', 'manager'].includes(account.role)) {
        showToast('Only admin or manager roles are allowed', 'error');
        return;
      }

      if (
        account.role !== 'admin' &&
        /^\/(accounts|statistics)/.test(window.location.pathname)
      ) {
        showToast('You do not have permission to access this page.', 'error');
        navigate('/');
        return;
      }

      const loginTime = Date.now().toString();
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(account));
      localStorage.setItem('loginTime', loginTime);
      setUser(account);

      showToast('Passkey login successful!', 'success');

      setTimeout(() => {
        handleForcedLogout('Your session has expired. You will be logged out.');
      }, 24 * 60 * 60 * 1000);

      navigate('/');
    } catch (error) {
      const msg = error.response?.data?.message || 'Passkey login failed. Please try again.';
      showToast(msg, 'error');
      throw error;
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
    <AuthContext.Provider
      value={{ user, login, signup, passkeyLogin, logout, isAuthLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};