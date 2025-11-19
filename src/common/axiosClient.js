import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
axiosClient.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
axiosClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const message = status === 401 ? 'Unauthorized access - please log in' :
      status === 404 ? 'Resource not found' :
        status >= 500 ? 'Server error - please try again later' :
          !error.response ? 'Failed to connect to server. Please check your connection.' :
            'An error occurred. Please try again.';

    // Handle 401 errors by clearing token and redirecting to login
    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject({ ...error, message });
  }
);

export default axiosClient;