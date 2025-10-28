import React, { createContext, useContext, useReducer, useEffect } from 'react';

const AuthContext = createContext();

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
      const response = await fetch('/api/auth/verify', {
        headers: {
          'Authorization': `Bearer ${token}`
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
      
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (response.ok) {
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
      dispatch({ type: 'LOADING', payload: false });
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const register = async (userData) => {
    try {
      dispatch({ type: 'LOADING', payload: true });
      
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
      });

      const data = await response.json();

      if (response.ok) {
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
      dispatch({ type: 'LOADING', payload: false });
      return { success: false, error: 'Network error. Please try again.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    dispatch({ type: 'LOGOUT' });
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
      const response = await fetch(url, config);
      
      if (response.status === 401) {
        // Token expired or invalid
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