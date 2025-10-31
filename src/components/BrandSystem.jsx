import React from 'react';
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

// Brand Colors
export const BRAND_COLORS = {
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    500: '#a855f7', // Primary
    600: '#9333ea',
    900: '#581c87',
  },
  blue: {
    50: '#eff6ff',
    100: '#dbeafe', 
    500: '#3b82f6', // Secondary
    600: '#2563eb',
    900: '#1e3a8a',
  }
};

// Brand Logo Component
export const BrandLogo = ({ size = 'md', variant = 'full', className = '' }) => {
  const sizes = {
    sm: 'h-6',
    md: 'h-8',
    lg: 'h-12',
    xl: 'h-16'
  };

  const gradientId = `brand-gradient-${Math.random().toString(36).substr(2, 9)}`;

  if (variant === 'icon') {
    return (
      <div className={`${sizes[size]} ${className} flex items-center justify-center`}>
        <svg viewBox="0 0 40 40" className={sizes[size]} fill="none">
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={BRAND_COLORS.purple[600]} />
              <stop offset="100%" stopColor={BRAND_COLORS.blue[600]} />
            </linearGradient>
          </defs>
          <rect width="40" height="40" rx="12" fill={`url(#${gradientId})`} />
          <path
            d="M12 20L16 16L24 24L28 20"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="20" cy="20" r="3" fill="white" fillOpacity="0.3" />
          <circle cx="16" cy="16" r="2" fill="white" />
          <circle cx="24" cy="24" r="2" fill="white" />
        </svg>
      </div>
    );
  }

  return (
    <div className={`${className} flex items-center gap-3`}>
      <svg viewBox="0 0 40 40" className={sizes[size]} fill="none">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={BRAND_COLORS.purple[600]} />
            <stop offset="100%" stopColor={BRAND_COLORS.blue[600]} />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="12" fill={`url(#${gradientId})`} />
        <path
          d="M12 20L16 16L24 24L28 20"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="20" r="3" fill="white" fillOpacity="0.3" />
        <circle cx="16" cy="16" r="2" fill="white" />
        <circle cx="24" cy="24" r="2" fill="white" />
      </svg>
      <span className={`font-display font-bold text-gradient ${
        size === 'sm' ? 'text-lg' : 
        size === 'md' ? 'text-xl' : 
        size === 'lg' ? 'text-2xl' : 'text-3xl'
      }`}>
        Content Factory
      </span>
    </div>
  );
};

// Brand Button Components
export const Button = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  disabled = false, 
  loading = false,
  icon: Icon,
  className = '',
  ...props 
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-semibold transition-smooth focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variants = {
    primary: 'bg-gradient-brand text-white hover:shadow-colored hover:-translate-y-0.5 focus:ring-brand-purple-200',
    secondary: 'bg-white text-gray-700 border-2 border-gray-200 hover:bg-gray-50 hover:border-brand-purple-300 focus:ring-brand-purple-200',
    outline: 'bg-transparent text-brand-purple-600 border-2 border-brand-purple-600 hover:bg-brand-purple-50 focus:ring-brand-purple-200',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900 focus:ring-gray-200',
    danger: 'bg-error-600 text-white hover:bg-error-700 hover:shadow-lg hover:-translate-y-0.5 focus:ring-error-200'
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm rounded-lg gap-2',
    md: 'px-4 py-2.5 text-sm rounded-xl gap-2',
    lg: 'px-6 py-3 text-base rounded-xl gap-3',
    xl: 'px-8 py-4 text-lg rounded-2xl gap-3'
  };
  
  return (
    <button
      className={`${baseClasses} ${variants[variant]} ${sizes[size]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      ) : Icon ? (
        <Icon className="h-4 w-4" />
      ) : null}
      {children}
    </button>
  );
};

// Brand Input Component
export const Input = ({ 
  label, 
  error, 
  helper, 
  icon: Icon,
  className = '',
  ...props 
}) => {
  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
        )}
        <input
          className={`
            input-modern w-full
            ${Icon ? 'pl-10' : ''}
            ${error ? 'border-error-500 focus:border-error-500 focus:ring-error-200' : 'border-gray-200 focus:border-brand-purple-400 focus:ring-brand-purple-200'}
            ${className}
          `}
          {...props}
        />
      </div>
      {error && (
        <p className="text-sm text-error-600 flex items-center gap-1">
          <XCircleIcon className="h-4 w-4" />
          {error}
        </p>
      )}
      {helper && !error && (
        <p className="text-sm text-gray-500">{helper}</p>
      )}
    </div>
  );
};

// Brand Card Component
export const Card = ({ 
  children, 
  variant = 'default',
  hover = false,
  className = '',
  ...props 
}) => {
  const variants = {
    default: 'bg-white border border-gray-200',
    gradient: 'bg-gradient-brand-subtle border border-brand-purple-200',
    glass: 'glass-effect border border-white/20'
  };
  
  return (
    <div
      className={`
        card-modern
        ${variants[variant]}
        ${hover ? 'hover-lift cursor-pointer' : ''}
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  );
};

// Status Badge Component
export const StatusBadge = ({ status, children, className = '' }) => {
  const statusConfig = {
    generating: {
      bg: 'bg-warning-100',
      text: 'text-warning-800',
      icon: ExclamationTriangleIcon,
      pulse: true
    },
    processing: {
      bg: 'bg-info-100',
      text: 'text-info-800', 
      icon: InformationCircleIcon,
      pulse: true
    },
    completed: {
      bg: 'bg-success-100',
      text: 'text-success-800',
      icon: CheckCircleIcon
    },
    published: {
      bg: 'bg-brand-purple-100',
      text: 'text-brand-purple-800',
      icon: CheckCircleIcon
    },
    failed: {
      bg: 'bg-error-100',
      text: 'text-error-800',
      icon: XCircleIcon
    },
    draft: {
      bg: 'bg-gray-100',
      text: 'text-gray-800',
      icon: InformationCircleIcon
    }
  };
  
  const config = statusConfig[status] || statusConfig.draft;
  const Icon = config.icon;
  
  return (
    <span className={`
      inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
      ${config.bg} ${config.text}
      ${config.pulse ? 'animate-pulse' : ''}
      ${className}
    `}>
      <Icon className="h-3.5 w-3.5" />
      {children || status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
};

// Brand Alert Component
export const Alert = ({ 
  type = 'info', 
  title, 
  children, 
  dismissible = false, 
  onDismiss,
  className = '' 
}) => {
  const types = {
    success: {
      bg: 'bg-success-50',
      border: 'border-success-200',
      text: 'text-success-800',
      icon: CheckCircleIcon,
      iconColor: 'text-success-600'
    },
    error: {
      bg: 'bg-error-50',
      border: 'border-error-200', 
      text: 'text-error-800',
      icon: XCircleIcon,
      iconColor: 'text-error-600'
    },
    warning: {
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      text: 'text-warning-800',
      icon: ExclamationTriangleIcon,
      iconColor: 'text-warning-600'
    },
    info: {
      bg: 'bg-info-50',
      border: 'border-info-200',
      text: 'text-info-800',
      icon: InformationCircleIcon,
      iconColor: 'text-info-600'
    }
  };
  
  const config = types[type];
  const Icon = config.icon;
  
  return (
    <div className={`
      rounded-xl border p-4
      ${config.bg} ${config.border} ${config.text}
      ${className}
    `}>
      <div className="flex items-start gap-3">
        <Icon className={`h-5 w-5 mt-0.5 ${config.iconColor}`} />
        <div className="flex-1 min-w-0">
          {title && (
            <h3 className="text-sm font-semibold mb-1">{title}</h3>
          )}
          <div className="text-sm">{children}</div>
        </div>
        {dismissible && (
          <button
            onClick={onDismiss}
            className="ml-auto -mt-1 -mr-1 p-1 rounded-lg hover:bg-black/5 transition-colors"
          >
            <XCircleIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

// Brand Modal Component
export const Modal = ({ 
  open, 
  onClose, 
  title, 
  children, 
  size = 'md',
  className = '' 
}) => {
  if (!open) return null;
  
  const sizes = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl'
  };
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="modal-overlay" onClick={onClose}>
        <div 
          className={`modal-content ${sizes[size]} ${className}`}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
              <button
                onClick={onClose}
                className="p-2 -m-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XCircleIcon className="h-5 w-5" />
              </button>
            </div>
          )}
          {children}
        </div>
      </div>
    </div>
  );
};

// Brand Loading Component
export const Loading = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };
  
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <svg className={`animate-spin ${sizes[size]} text-brand-purple-600`} fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path 
          className="opacity-75" 
          fill="currentColor" 
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" 
        />
      </svg>
    </div>
  );
};

// Brand Typography Components
export const Heading = ({ as: Component = 'h1', size, children, className = '', gradient = false, ...props }) => {
  const sizes = {
    display: 'text-display font-display font-bold tracking-tight',
    h1: 'text-h1 font-display font-bold tracking-tight',
    h2: 'text-h2 font-display font-semibold tracking-tight',
    h3: 'text-h3 font-display font-semibold',
    h4: 'text-h4 font-medium',
    h5: 'text-h5 font-medium',
    h6: 'text-h6 font-medium'
  };
  
  const sizeClass = sizes[size] || sizes[Component];
  
  return (
    <Component 
      className={`
        ${sizeClass}
        ${gradient ? 'text-gradient' : 'text-gray-900'}
        ${className}
      `}
      {...props}
    >
      {children}
    </Component>
  );
};

// Utility function to get brand colors
export const getBrandColor = (color, shade = 500) => {
  return BRAND_COLORS[color]?.[shade] || BRAND_COLORS.purple[500];
};

// Export all components as default
export default {
  BrandLogo,
  Button,
  Input,
  Card,
  StatusBadge,
  Alert,
  Modal,
  Loading,
  Heading,
  getBrandColor,
  BRAND_COLORS
};