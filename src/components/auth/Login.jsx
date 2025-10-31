import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Eye, EyeOff, Mail, Lock, Loader2, Sparkles, AlertCircle } from 'lucide-react';

const Login = ({ onToggleMode }) => {
  const { login, isLoading } = useAuth();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hardStopEvent = (e) => { if (!e) return; e.preventDefault(); e.stopPropagation(); e.nativeEvent && typeof e.nativeEvent.stopImmediatePropagation === 'function' && e.nativeEvent.stopImmediatePropagation(); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (Object.keys(errors).length) setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Please enter a valid email';
    if (!formData.password) newErrors.password = 'Password is required';
    else if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submitCore = async () => {
    if (!validateForm()) return false;
    if (isSubmitting || isLoading) return false;
    setIsSubmitting(true);
    try {
      const result = await login(formData.email, formData.password);
      if (!result.success) {
        const msg = (result.error || '').toLowerCase();
        if (msg.includes('invalid credentials') || msg.includes('password') || msg.includes('wrong')) setErrors({ password: 'Wrong password. Please try again.' });
        else if (msg.includes('email') || msg.includes('user')) setErrors({ email: 'Account not found with this email address.' });
        else setErrors({ general: result.error || 'Login failed. Please try again.' });
      }
    } catch (err) {
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
    return false;
  };

  const handleSubmit = async (e) => { hardStopEvent(e); await submitCore(); return false; };
  const handleEnter = async (e) => { if (e.key === 'Enter') { hardStopEvent(e); await submitCore(); } };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 w-16 h-16 rounded-xl flex items-center justify-center shadow-lg">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Welcome back</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to your Content Factory account</p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit} onKeyDown={handleEnter} noValidate>
          {errors.general && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <span className="text-sm text-red-700 font-medium">{errors.general}</span>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">Email address</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Mail className="h-5 w-5 text-gray-400" /></div>
                <input id="email" name="email" type="email" autoComplete="email" value={formData.email} onChange={handleChange} onInvalid={(e)=>e.preventDefault()} className={`block w-full pl-10 pr-3 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${errors.email ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-blue-200'}`} placeholder="Enter your email" disabled={isSubmitting || isLoading} />
              </div>
              {errors.email && (<p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" />{errors.email}</p>)}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock className="h-5 w-5 text-gray-400" /></div>
                <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" value={formData.password} onChange={handleChange} onInvalid={(e)=>e.preventDefault()} className={`block w-full pl-10 pr-10 py-3 border-2 rounded-xl focus:outline-none focus:ring-4 transition-all duration-200 ${errors.password ? 'border-red-300 bg-red-50 focus:border-red-500 focus:ring-red-200' : 'border-gray-300 bg-white hover:border-gray-400 focus:border-blue-500 focus:ring-blue-200'}`} placeholder="Enter your password" disabled={isSubmitting || isLoading} />
                <button type="button" className="absolute inset-y-0 right-0 pr-3 flex items-center" onClick={(e)=>{hardStopEvent(e); setShowPassword(!showPassword);}} disabled={isSubmitting || isLoading}>{showPassword ? (<EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />) : (<Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />)}</button>
              </div>
              {errors.password && (<p className="mt-2 text-sm text-red-600 flex items-center gap-1"><AlertCircle className="h-4 w-4" />{errors.password}</p>)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <input id="remember-me" name="remember-me" type="checkbox" checked={rememberMe} onChange={(e)=>setRememberMe(e.target.checked)} className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded" disabled={isSubmitting || isLoading} />
              <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-700">Remember me</label>
            </div>
            <div className="text-sm">
              <button type="button" className="font-medium text-blue-600 hover:text-blue-500 transition-colors" disabled={isSubmitting || isLoading}>Forgot your password?</button>
            </div>
          </div>

          <div>
            <button type="submit" onClick={hardStopEvent} disabled={isSubmitting || isLoading} className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-sm font-semibold rounded-xl text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-4 focus:ring-offset-2 focus:ring-blue-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-[1.02]">{isSubmitting || isLoading ? (<><Loader2 className="w-5 h-5 mr-2 animate-spin" />Signing in...</>) : ('Sign in to Content Factory')}</button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">Don't have an account?{' '}<button type="button" onClick={(e)=>{hardStopEvent(e); onToggleMode();}} className="font-medium text-blue-600 hover:text-blue-500 transition-colors" disabled={isSubmitting || isLoading}>Sign up for free</button></p>
          </div>
        </form>

        <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border-2 border-blue-200">
          <div className="flex items-center gap-2 mb-2"><Sparkles className="h-4 w-4 text-blue-600" /><h4 className="text-sm font-semibold text-gray-800">Demo Account</h4></div>
          <p className="text-xs text-gray-600 mb-3">Use these credentials to test the app:</p>
          <div className="space-y-2">
            <div className="bg-white rounded-lg p-3 border border-blue-200"><div className="flex items-center justify-between"><span className="text-xs text-gray-500 font-medium">Email:</span><code className="text-xs font-mono text-blue-700 bg-blue-100 px-2 py-1 rounded">demo@contentfabrica.com</code></div></div>
            <div className="bg-white rounded-lg p-3 border border-blue-200"><div className="flex items-center justify-between"><span className="text-xs text-gray-500 font-medium">Password:</span><code className="text-xs font-mono text-blue-700 bg-blue-100 px-2 py-1 rounded">demo123</code></div></div>
          </div>
          <button onClick={(e)=>{hardStopEvent(e); setFormData({ email: 'demo@contentfabrica.com', password: 'demo123' }); setErrors({});}} className="mt-3 w-full text-xs bg-blue-600 text-white py-2 px-3 rounded-lg hover:bg-blue-700 transition-all duration-200 font-medium" disabled={isSubmitting || isLoading}>Fill Demo Credentials</button>
        </div>
      </div>
    </div>
  );
};

export default Login;
