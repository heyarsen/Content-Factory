import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import Login from './Login';
import Register from './Register';
import { Loader2, Sparkles } from 'lucide-react';

const AuthWrapper = ({ children }) => {
  const { isAuthenticated, isLoading } = useAuth();
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'

  const toggleAuthMode = () => {
    setAuthMode(prev => prev === 'login' ? 'register' : 'login');
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-16 h-16 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-blue-600" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Content Factory</h2>
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  // Show auth forms if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen">
        {authMode === 'login' ? (
          <Login onToggleMode={toggleAuthMode} />
        ) : (
          <Register onToggleMode={toggleAuthMode} />
        )}
      </div>
    );
  }

  // Show main app if authenticated
  return children;
};

export default AuthWrapper;