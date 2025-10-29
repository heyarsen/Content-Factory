import React, { useState } from 'react';
import { Eye, EyeOff, Loader, AlertCircle } from 'lucide-react';

const LoginForm = ({ onSuccess, onSwitchToRegister }) => {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorType, setErrorType] = useState('');
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
    setErrorType('');
  };
  
  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Please fill in all fields');
      return false;
    }
    
    if (!formData.email.includes('@')) {
      setError('Please enter a valid email address');
      return false;
    }
    
    return true;
  };
  
  const handleSubmit = async (e) => {
    // Prevent form submission and page reload
    e.preventDefault();
    e.stopPropagation();
    
    console.log('Form submitted, preventing default behavior');
    
    if (!validateForm()) {
      console.log('Form validation failed');
      return;
    }
    
    setLoading(true);
    setError('');
    setErrorType('');
    
    console.log('Attempting login for:', formData.email);
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json' 
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password
        })
      });
      
      console.log('Login response status:', response.status);
      
      const data = await response.json();
      console.log('Login response data:', { ...data, token: data.token ? '[TOKEN]' : null });
      
      if (data.success) {
        console.log('Login successful, storing data and calling onSuccess');
        
        // Store token and user data
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        if (data.workspace) {
          localStorage.setItem('currentWorkspace', JSON.stringify(data.workspace));
        }
        if (data.workspaces) {
          localStorage.setItem('workspaces', JSON.stringify(data.workspaces));
        }
        
        // Call success callback
        if (onSuccess) {
          onSuccess(data);
        }
      } else {
        console.log('Login failed:', data.error, 'Type:', data.errorType);
        
        // Preserve email from response if available
        if (data.email && data.email !== formData.email) {
          setFormData(prev => ({ ...prev, email: data.email }));
        }
        
        setError(data.error || 'Login failed');
        setErrorType(data.errorType || '');
        
        // Clear password only if it was wrong, not for other errors
        if (data.errorType === 'invalid_password') {
          setFormData(prev => ({ ...prev, password: '' }));
          // Focus back to password field
          setTimeout(() => {
            const passwordField = document.getElementById('password');
            if (passwordField) {
              passwordField.focus();
            }
          }, 100);
        }
      }
    } catch (error) {
      console.error('Network error during login:', error);
      setError('Network error. Please check your connection and try again.');
      setErrorType('network_error');
    } finally {
      setLoading(false);
    }
  };
  
  const handleButtonClick = (e) => {
    // Prevent any default button behavior
    e.preventDefault();
    e.stopPropagation();
    handleSubmit(e);
  };
  
  const getErrorColor = () => {
    switch (errorType) {
      case 'invalid_password':
        return 'text-red-600';
      case 'email_not_found':
        return 'text-orange-600';
      case 'account_inactive':
        return 'text-yellow-600';
      default:
        return 'text-red-600';
    }
  };
  
  const getErrorIcon = () => {
    return <AlertCircle className="w-4 h-4 mr-2 flex-shrink-0" />;
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to your account
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Welcome back to Content Factory
          </p>
        </div>
        
        {/* Form with explicit onSubmit handler */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className={`bg-red-50 border border-red-200 px-4 py-3 rounded-md flex items-start ${getErrorColor()}`}>
              {getErrorIcon()}
              <div className="flex-1">
                <p className="text-sm font-medium">{error}</p>
                {errorType === 'email_not_found' && (
                  <p className="text-xs mt-1 text-gray-600">
                    Don't have an account?{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        onSwitchToRegister();
                      }}
                      className="font-medium text-blue-600 hover:text-blue-500"
                    >
                      Sign up here
                    </button>
                  </p>
                )}
                {errorType === 'invalid_password' && (
                  <p className="text-xs mt-1 text-gray-600">
                    Forgot your password?{' '}
                    <button
                      type="button"
                      className="font-medium text-blue-600 hover:text-blue-500"
                      onClick={(e) => {
                        e.preventDefault();
                        alert('Password reset feature coming soon!');
                      }}
                    >
                      Reset it here
                    </button>
                  </p>
                )}
              </div>
            </div>
          )}
          
          <div className="space-y-4">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={handleInputChange}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const passwordField = document.getElementById('password');
                    if (passwordField) {
                      passwordField.focus();
                    }
                  }
                }}
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm ${
                  errorType === 'email_not_found' 
                    ? 'border-orange-300 bg-orange-50' 
                    : 'border-gray-300'
                }`}
                placeholder="Enter your email"
                autoComplete="email"
              />
            </div>
            
            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={formData.password}
                  onChange={handleInputChange}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleSubmit(e);
                    }
                  }}
                  className={`appearance-none relative block w-full px-3 py-2 border placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm pr-10 ${
                    errorType === 'invalid_password' 
                      ? 'border-red-300 bg-red-50' 
                      : 'border-gray-300'
                  }`}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowPassword(!showPassword);
                  }}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4 text-gray-400" />
                  ) : (
                    <Eye className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input
                id="remember-me"
                name="remember-me"
                type="checkbox"
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-900">
                Remember me
              </label>
            </div>
            
            <div className="text-sm">
              <button
                type="button"
                className="font-medium text-blue-600 hover:text-blue-500"
                onClick={(e) => {
                  e.preventDefault();
                  alert('Password reset feature coming soon!');
                }}
              >
                Forgot your password?
              </button>
            </div>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              onClick={handleButtonClick}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </div>
          
          <div className="text-center">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onSwitchToRegister();
              }}
              className="text-blue-600 hover:text-blue-500 text-sm"
            >
              Don't have an account? Sign up
            </button>
          </div>
          
          {/* Debug section - remove in production */}
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md text-xs">
              <details>
                <summary className="cursor-pointer text-gray-600">Debug Info</summary>
                <div className="mt-2 space-y-1">
                  <p><strong>Email:</strong> {formData.email}</p>
                  <p><strong>Password Length:</strong> {formData.password.length}</p>
                  <p><strong>Error Type:</strong> {errorType || 'None'}</p>
                  <p><strong>Loading:</strong> {loading ? 'Yes' : 'No'}</p>
                  <button
                    type="button"
                    className="text-blue-600 hover:text-blue-500"
                    onClick={async (e) => {
                      e.preventDefault();
                      if (!formData.email) {
                        alert('Enter an email first');
                        return;
                      }
                      
                      try {
                        const response = await fetch('/api/auth/debug-user', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ email: formData.email })
                        });
                        const data = await response.json();
                        alert(JSON.stringify(data, null, 2));
                      } catch (error) {
                        alert('Debug request failed: ' + error.message);
                      }
                    }}
                  >
                    Check if user exists
                  </button>
                  <br />
                  <button
                    type="button"
                    className="text-green-600 hover:text-green-500"
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Current form data:', formData);
                      console.log('Current error:', error, errorType);
                      console.log('Loading state:', loading);
                    }}
                  >
                    Log current state
                  </button>
                </div>
              </details>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginForm;