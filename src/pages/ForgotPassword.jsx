import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-hot-toast';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Countdown timer for resend functionality
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validateEmail = (email) => {
    if (!email.trim()) {
      return 'Email is required';
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      return 'Please enter a valid email address';
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const emailError = validateEmail(email);
    if (emailError) {
      setErrors({ email: emailError });
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setIsSuccess(true);
        setCountdown(60); // 60 seconds cooldown
        toast.success('Password reset email sent!');
      } else {
        if (data.error.includes('not found') || data.error.includes('No account')) {
          setErrors({ email: 'No account found with this email address' });
        } else {
          setErrors({ general: data.error || 'Failed to send reset email. Please try again.' });
        }
      }
    } catch (error) {
      console.error('Password reset error:', error);
      setErrors({ general: 'Network error. Please check your connection and try again.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;
    
    setIsLoading(true);
    setErrors({});

    try {
      const response = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setCountdown(60);
        toast.success('Reset email sent again!');
      } else {
        toast.error(data.error || 'Failed to resend email');
      }
    } catch (error) {
      console.error('Resend error:', error);
      toast.error('Failed to resend email');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    setEmail(e.target.value);
    
    // Clear errors as user types
    if (errors.email) {
      setErrors(prev => ({ ...prev, email: '' }));
    }
    if (errors.general) {
      setErrors(prev => ({ ...prev, general: '' }));
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center"
          >
            {/* Success Icon */}
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Check Your Email</h1>
            
            <div className="bg-white rounded-2xl shadow-xl p-8 mb-6">
              <p className="text-gray-600 mb-4">
                We've sent password reset instructions to:
              </p>
              <p className="text-lg font-medium text-gray-900 mb-6">
                {email}
              </p>
              
              <div className="space-y-4">
                <p className="text-sm text-gray-500">
                  Didn't receive the email? Check your spam folder or click below to resend.
                </p>
                
                <button
                  onClick={handleResend}
                  disabled={countdown > 0 || isLoading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : countdown > 0 ? (
                    `Resend in ${countdown}s`
                  ) : (
                    'Resend Email'
                  )}
                </button>
              </div>
            </div>
            
            <div className="space-y-4">
              <Link
                to="/login"
                className="inline-flex items-center text-indigo-600 hover:text-indigo-500 font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Sign In
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-cyan-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <span className="text-white text-2xl font-bold">CF</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Forgot Password?</h1>
          <p className="text-gray-600">No worries! Enter your email and we'll send you reset instructions.</p>
        </motion.div>

        {/* Reset Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl shadow-xl p-8"
        >
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* General Error */}
            <AnimatePresence>
              {errors.general && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 rounded-lg p-4"
                >
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <p className="text-red-700 text-sm">{errors.general}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={handleInputChange}
                  className={`block w-full pl-10 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${
                    errors.email ? 'border-red-300 bg-red-50' : 'border-gray-300'
                  }`}
                  placeholder="Enter your email address"
                  disabled={isLoading}
                  autoFocus
                />
              </div>
              <AnimatePresence>
                {errors.email && (
                  <motion.p
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 text-sm text-red-600 flex items-center space-x-1"
                  >
                    <AlertCircle className="w-4 h-4" />
                    <span>{errors.email}</span>
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-lg shadow-lg text-sm font-medium text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Sending reset email...
                </>
              ) : (
                <>
                  Send Reset Instructions
                  <ArrowRight className="w-5 h-5 ml-2" />
                </>
              )}
            </button>
          </form>

          {/* Back to Login Link */}
          <div className="mt-8 text-center">
            <Link
              to="/login"
              className="inline-flex items-center text-sm text-gray-600 hover:text-indigo-600 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Sign In
            </Link>
          </div>
        </motion.div>

        {/* Help Text */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center mt-8"
        >
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Having trouble?</h3>
            <p className="text-xs text-blue-700">
              If you don't receive the email within a few minutes, check your spam folder or 
              try again with a different email address.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ForgotPassword;