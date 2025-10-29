import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext();

// API Base URL - automatically detects environment
const getApiBaseUrl = () => {
  // If we're in development and running on localhost, use empty string for proxy
  if (import.meta.env.DEV && window.location.hostname === 'localhost') {
    return '';
  }
  // For production or when accessing via domain name, use relative URLs
  return '';
};

const API_BASE_URL = getApiBaseUrl();

// Token key for localStorage - use consistent key throughout app
const TOKEN_KEY = 'auth_token';

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
    const token = localStorage.getItem(TOKEN_KEY);
    console.log('AuthProvider: Checking for existing token:', !!token);
    
    if (token) {
      // Verify token and get user data
      verifyToken(token);
    } else {
      console.log('AuthProvider: No token found, setting loading to false');
      dispatch({ type: 'LOADING', payload: false });
    }
  }, []);

  const verifyToken = async (token) => {
    try {
      console.log('AuthProvider: Verifying token with URL:', `${API_BASE_URL}/api/auth/verify`);
      console.log('AuthProvider: Current location:', window.location.href);
      
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('AuthProvider: Token verification response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('AuthProvider: Token verification successful:', { hasUser: !!data.user, hasWorkspace: !!data.workspace });
        
        dispatch({
          type: 'LOGIN_SUCCESS',
          payload: {
            user: data.user,
            token: token,
            workspace: data.workspace
          }
        });
      } else {
        console.warn('AuthProvider: Token verification failed:', response.status);
        localStorage.removeItem(TOKEN_KEY);
        dispatch({ type: 'LOADING', payload: false });
      }
    } catch (error) {
      console.error('AuthProvider: Token verification failed:', error);
      localStorage.removeItem(TOKEN_KEY);
      dispatch({ type: 'LOADING', payload: false });
    }
  };

  const login = async (email, password) => {
    try {
      console.log('AuthProvider: Starting login process');
      dispatch({ type: 'LOADING', payload: true });
      
      const apiUrl = `${API_BASE_URL}/api/auth/login`;
      console.log('AuthProvider: Login URL:', apiUrl);
      console.log('AuthProvider: Environment:', import.meta.env.MODE);
      console.log('AuthProvider: Login data:', { email, password: '***' });
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      console.log('AuthProvider: Login response status:', response.status);
      console.log('AuthProvider: Login response headers:', Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('AuthProvider: Login response data:', {
        success: data.success,
        hasToken: !!data.token,
        hasUser: !!data.user,
        hasWorkspace: !!data.workspace,
        error: data.error
      });

      if (response.ok && data.success) {
        console.log('AuthProvider: Login successful, storing token');
        localStorage.setItem(TOKEN_KEY, data.token);
        
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
        console.error('AuthProvider: Login failed:', data.error);
        dispatch({ type: 'LOADING', payload: false });
        return { success: false, error: data.error || 'Login failed' };
      }
    } catch (error) {
      console.error('AuthProvider: Login error:', error);
      dispatch({ type: 'LOADING', payload: false });
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
  };

  const register = async (userData) => {
    try {
      console.log('AuthProvider: Starting registration process');
      dispatch({ type: 'LOADING', payload: true });
      
      const apiUrl = `${API_BASE_URL}/api/auth/register`;
      console.log('AuthProvider: Registration URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      console.log('AuthProvider: Registration response status:', response.status);
      const data = await response.json();
      console.log('AuthProvider: Registration response data:', {
        success: data.success,
        hasToken: !!data.token,
        hasUser: !!data.user,
        hasWorkspace: !!data.workspace,
        error: data.error
      });

      if (response.ok && data.success) {
        localStorage.setItem(TOKEN_KEY, data.token);
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
      console.error('AuthProvider: Registration error:', error);
      dispatch({ type: 'LOADING', payload: false });
      return { success: false, error: 'Network error. Please check your connection and try again.' };
    }
  };

  const logout = async () => {
    try {
      console.log('AuthProvider: Starting logout process');
      
      // Call logout endpoint to invalidate token on server
      if (state.token) {
        try {
          await fetch(`${API_BASE_URL}/api/auth/logout`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${state.token}`,
              'Content-Type': 'application/json'
            }
          });
        } catch (logoutError) {
          console.warn('AuthProvider: Server logout failed (continuing with local logout):', logoutError);
        }
      }
    } catch (error) {
      console.error('AuthProvider: Logout error:', error);
    } finally {
      console.log('AuthProvider: Clearing local auth data');
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('user'); // Remove legacy user data if exists
      localStorage.removeItem('token'); // Remove legacy token if exists
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
    const token = state.token || localStorage.getItem(TOKEN_KEY);
    
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
      console.log('AuthProvider: Making API call to:', fullUrl);
      
      const response = await fetch(fullUrl, config);
      
      if (response.status === 401) {
        // Token expired or invalid
        console.warn('AuthProvider: Authentication expired, logging out');
        await logout();
        throw new Error('Authentication expired. Please login again.');
      }

      return response;
    } catch (error) {
      console.error('AuthProvider: API call error:', error);
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