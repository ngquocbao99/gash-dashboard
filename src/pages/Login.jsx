import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { AuthContext } from '../context/AuthContext';
import '../styles/Login.css';

const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, passkeyLogin } = React.useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const usernameRef = useRef(null);

  // Focus username input on mount
  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  // Handle redirect after login
  const from = location.state?.from || '/';

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please enter both username and password');
      usernameRef.current?.focus();
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (err) {
      const errorMessage = err.response?.status === 401
        ? 'Invalid username or password'
        : 'Failed to sign in. Please try again.';
      setError(errorMessage);
      usernameRef.current?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [username, password, login, navigate, from]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    if (name === 'username') setUsername(value);
    if (name === 'password') setPassword(value);
    setError('');
  }, []);

  const handlePasskeyLogin = useCallback(async () => {
    const trimmedUsername = username.trim();
    
    if (!trimmedUsername) {
      setError('Please enter your username to use passkey login.');
      usernameRef.current?.focus();
      return;
    }

    if (trimmedUsername.length < 3 || trimmedUsername.length > 30) {
      setError('Username must be between 3 and 30 characters.');
      usernameRef.current?.focus();
      return;
    }

    setIsLoading(true);
    setError('');
    try {
      await passkeyLogin(trimmedUsername);
      navigate(from, { replace: true });
    } catch (err) {
      // Error message is already shown in passkeyLogin
    } finally {
      setIsLoading(false);
    }
  }, [username, passkeyLogin, navigate, from]);

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">Sign In</h1>
        {error && (
          <div className="login-error" id="error-message" role="alert">
            <span className="login-error-icon" aria-hidden="true">⚠</span>
            {error}
          </div>
        )}
        <form className="login-form" onSubmit={handleSubmit} aria-describedby={error ? 'error-message' : undefined}>
          <div className="login-form-group">
            <label htmlFor="username" className="login-form-label">Username</label>
            <input
              id="username"
              type="text"
              name="username"
              value={username}
              onChange={handleInputChange}
              ref={usernameRef}
              required
              className="login-form-input"
              aria-required="true"
              aria-invalid={!!error}
            />
          </div>
          <div className="login-form-group">
            <label htmlFor="password" className="login-form-label">Password</label>
            <input
              id="password"
              type="password"
              name="password"
              value={password}
              onChange={handleInputChange}
              required
              className="login-form-input"
              aria-required="true"
              aria-invalid={!!error}
            />
          </div>
          <div className="login-forgot-password">
            <Link to="/forgot-password" className="login-forgot-password-link">
              Forgot Password?
            </Link>
          </div>
          <button
            type="submit"
            className="sign-in-button"
            disabled={isLoading}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="login-loading-spinner" aria-hidden="true" />
                Signing In...
              </>
            ) : (
              'Sign In'
            )}
          </button>
        </form>
        <div className="mt-4 space-y-3">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>
          <button
            type="button"
            onClick={handlePasskeyLogin}
            disabled={isLoading}
            className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-3 px-4 rounded-xl transition-all duration-200 border border-gray-300 hover:border-gray-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            aria-label="Sign in with Passkey"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            {isLoading ? 'Authenticating...' : 'Sign in with Passkey'}
          </button>
        </div>
        <p className="login-signup-prompt">
          New to GASH?{' '}
          <Link to="/signup" className="login-signup-link">
            Create your GASH account
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Login;