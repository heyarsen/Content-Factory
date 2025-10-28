import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext();

// API Base URL - in development use proxy, in production use relative URLs
const API_BASE_URL = import.meta.env.DEV ? '' : '';

const initialState = {
  user: null,
  token: null,
  isAuthenticated: false,
  isLoading: true,
  workspace: null
};

const authReducer = (state, action) => {
  switch (action.type) {
    case 'LOGIN_SUCCESS':
      return {
        ...state,
        user: action.payload.user,
        token: action.payload.token,
        workspace: action.payload.workspace,
        isAuthenticated: true,
        isLoading: false
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false
      };
    case 'LOADING':
      return {
        ...state,
        isLoading: action.payload
      };
    case 'UPDATE_USER':
      return {
        ...state,
        user: { ...state.user, ...action.payload }
      };
    case 'UPDATE_WORKSPACE':
      return {
        ...state,
        workspace: { ...state.workspace, ...action.payload }
      };
    default:
      return state;
  }
};

export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Check for existing token on app load
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      // Verify token and get user data
      verifyToken(token);
    } else {
      dispatch({ type: 'LOADING', payload: false });
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      console.log('Verifying token with URL:', `${API_BASE_URL}/api/auth/verify`);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: data.user,
            token: token,
            workspace: data.workspace
          }
        });
      } else {
        console.warn('Token verification failed:', response.status);
        localStorage.removeItem('auth_token');
        dispatch({ type: 'LOADING', payload: false });
      }
    } catch (error) {
      console.error('Token verification failed:', error);
      localStorage.removeItem('auth_token');
      dispatch({ type: 'LOADING', payload: false });
    }
  };

  const login = async (email, password) => {
    try {
      dispatch({ type: 'LOADING', payload: true });
      
      console.log('Attempting login with URL:', `${API_BASE_URL}/api/auth/login`);
      console.log('Login data:', { email, password: '***' });
      
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      console.log('Login response status:', response.status);
      
      const data = await response.json();
      console.log('Login response data:', data);

      if (response.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: data.user,
            token: data.token,
            workspace: data.workspace
          }
        });
        return { success: true };
      } else {
        dispatch({ type: 'LOADING', payload: false });
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      dispatch({ type: 'LOADING', payload: false });
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: 'LOADING', payload: true });
      
      console.log('Attempting registration with URL:', `${API_BASE_URL}/api/auth/register`);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        localStorage.setItem('auth_token', data.token);
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: data.user,
            token: data.token,
            workspace: data.workspace
          }
        });
        return { success: true };
      } else {
        dispatch({ type: 'LOADING', payload: false });
        return { success: false, error: data.error || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      dispatch({ type: 'LOADING', payload: false });
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint to invalidate token on server
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${state.token}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      dispatch({ type: 'LOGOUT' });
    }
  };

  const updateUser = (userData) => {
    dispatch({ type: 'UPDATE_USER', payload: userData });
  };

  const updateWorkspace = (workspaceData) => {
    dispatch({ type: 'UPDATE_WORKSPACE', payload: workspaceData });
  };

  // Helper function to make authenticated API calls
  const apiCall = async (url, options = {}) => {
    const token = state.token || localStorage.getItem('auth_token');
    
    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    };

    try {
      // Handle relative URLs
      const fullUrl = url.startsWith('/') ? `${API_BASE_URL}${url}` : url;
      
      const response = await fetch(fullUrl, config);
      
      if (response.status === 401) {
        // Token expired or invalid
        console.warn('Authentication expired, logging out');
        logout();
        throw new Error('Authentication expired. Please login again.');
      }

      return response;
    } catch (error) {
      throw error;
    }
  };

  const value = {
    ...state,
    login,
    register,
    logout,
    updateUser,
    updateWorkspace,
    apiCall
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};