# Content Factory - Brand Identity Guide

🎨 **A comprehensive brand system for the AI-powered content creation platform**

## Brand Overview

**Mission:** Democratize AI-powered content creation for teams and creators worldwide.

**Vision:** The world's most intuitive platform for generating, managing, and publishing AI content across all channels.

**Values:**
- **Innovation** - Cutting-edge AI technology made simple
- **Collaboration** - Teams working together seamlessly
- **Quality** - Professional-grade content for every creator
- **Accessibility** - Powerful tools for everyone

## Visual Identity

### Logo & Brand Mark

**Primary Logo:** "Content Factory"
- **Wordmark:** Modern, bold typography
- **Symbol:** Interconnected nodes representing AI + creativity
- **Tagline:** "AI-Powered Content Creation"

**Usage Guidelines:**
- Minimum size: 120px wide
- Clear space: 1x logo height on all sides
- Never stretch, rotate, or alter colors

### Color Palette

#### Primary Colors
```css
/* Brand Purple - Innovation & Creativity */
--brand-purple-50: #faf5ff
--brand-purple-100: #f3e8ff
--brand-purple-500: #a855f7  /* Primary Brand Color */
--brand-purple-600: #9333ea
--brand-purple-900: #581c87

/* Brand Blue - Technology & Trust */
--brand-blue-50: #eff6ff
--brand-blue-100: #dbeafe
--brand-blue-500: #3b82f6   /* Secondary Brand Color */
--brand-blue-600: #2563eb
--brand-blue-900: #1e3a8a
```

#### Semantic Colors
```css
/* Success - Content Published */
--success-50: #ecfdf5
--success-500: #10b981
--success-600: #059669

/* Warning - Content Processing */
--warning-50: #fffbeb
--warning-500: #f59e0b
--warning-600: #d97706

/* Error - Failed Operations */
--error-50: #fef2f2
--error-500: #ef4444
--error-600: #dc2626

/* Info - General Information */
--info-50: #f0f9ff
--info-500: #0ea5e9
--info-600: #0284c7
```

#### Neutral Palette
```css
/* Modern Grays */
--gray-50: #f9fafb   /* Background */
--gray-100: #f3f4f6  /* Light borders */
--gray-200: #e5e7eb  /* Borders */
--gray-300: #d1d5db  /* Disabled states */
--gray-400: #9ca3af  /* Placeholders */
--gray-500: #6b7280  /* Secondary text */
--gray-600: #4b5563  /* Primary text light */
--gray-700: #374151  /* Primary text */
--gray-800: #1f2937  /* Headings */
--gray-900: #111827  /* Dark text */
```

### Typography

#### Font Families
```css
/* Primary Font - Interface */
--font-primary: 'Inter', system-ui, -apple-system, sans-serif;

/* Display Font - Headlines */
--font-display: 'Manrope', 'Inter', system-ui, sans-serif;

/* Monospace - Code */
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
```

#### Type Scale
```css
/* Display - Hero Headlines */
--text-display: 3.75rem; /* 60px */
--text-display-mobile: 2.5rem; /* 40px */

/* Headings */
--text-h1: 2.25rem; /* 36px */
--text-h2: 1.875rem; /* 30px */
--text-h3: 1.5rem; /* 24px */
--text-h4: 1.25rem; /* 20px */
--text-h5: 1.125rem; /* 18px */
--text-h6: 1rem; /* 16px */

/* Body Text */
--text-lg: 1.125rem; /* 18px */
--text-base: 1rem; /* 16px */
--text-sm: 0.875rem; /* 14px */
--text-xs: 0.75rem; /* 12px */
```

## Component Design System

### Buttons

#### Primary Button
```css
.btn-primary {
  background: linear-gradient(135deg, var(--brand-purple-600), var(--brand-blue-600));
  color: white;
  border-radius: 1rem;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 25px -5px rgba(168, 85, 247, 0.4);
}
```

#### Secondary Button
```css
.btn-secondary {
  background: white;
  color: var(--gray-700);
  border: 2px solid var(--gray-200);
  border-radius: 1rem;
  padding: 0.75rem 1.5rem;
  font-weight: 600;
}

.btn-secondary:hover {
  background: var(--gray-50);
  border-color: var(--brand-purple-300);
}
```

### Cards

#### Modern Card
```css
.card-modern {
  background: white;
  border-radius: 1.5rem;
  padding: 2rem;
  box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  border: 1px solid var(--gray-100);
  transition: all 0.2s ease;
}

.card-modern:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);
}
```

### Forms

#### Input Fields
```css
.input-modern {
  background: white;
  border: 2px solid var(--gray-200);
  border-radius: 1rem;
  padding: 1rem 1.25rem;
  font-size: 1rem;
  transition: all 0.2s ease;
}

.input-modern:focus {
  border-color: var(--brand-purple-400);
  box-shadow: 0 0 0 4px var(--brand-purple-100);
  outline: none;
}
```

## Brand Voice & Messaging

### Tone of Voice
- **Professional yet approachable** - Expert but never intimidating
- **Innovative** - Forward-thinking and cutting-edge
- **Empowering** - Helps users achieve their goals
- **Clear and direct** - No jargon, easy to understand

### Key Messages
- "AI-powered content creation made simple"
- "From idea to published content in minutes"
- "Professional results, no expertise required"
- "Scale your content with intelligent automation"

### Content Guidelines
- Use active voice
- Keep sentences concise
- Focus on benefits, not features
- Include specific examples
- End with clear calls-to-action

## UI/UX Patterns

### Navigation
- **Clean, minimal sidebar** with collapsible sections
- **Breadcrumb trails** for deep navigation
- **Quick actions** prominently displayed
- **Search-first** approach for finding content

### Status Indicators
```css
/* Processing Status */
.status-processing {
  background: var(--warning-100);
  color: var(--warning-700);
  animation: pulse 2s infinite;
}

/* Success Status */
.status-completed {
  background: var(--success-100);
  color: var(--success-700);
}

/* Error Status */
.status-failed {
  background: var(--error-100);
  color: var(--error-700);
}
```

### Data Visualization
- **Consistent color mapping** across all charts
- **Purple-blue gradient** for primary metrics
- **Subtle animations** for data updates
- **Accessible color combinations** (WCAG AA compliant)

## Platform Specific Guidelines

### Dashboard
- **Widget-based layout** with drag-and-drop customization
- **Real-time updates** with smooth transitions
- **Progressive disclosure** of complex features
- **Action-oriented** design with clear next steps

### Video Generation
- **Step-by-step wizard** interface
- **Live preview** whenever possible
- **Progress indicators** for AI processing
- **Template gallery** with visual previews

### Content Calendar
- **Visual-first** design with thumbnail previews
- **Drag-and-drop** scheduling
- **Color-coded** content types
- **Quick edit** inline actions

### Team Collaboration
- **Comment threads** with threaded discussions
- **Version history** with visual diffs
- **Permission levels** clearly indicated
- **Activity feeds** with user avatars

## Accessibility Standards

### Color Contrast
- **AA compliance** minimum for all text
- **AAA compliance** for critical interfaces
- **High contrast mode** support
- **Color-blind friendly** palette

### Typography
- **Minimum 16px** for body text
- **1.5x line height** for optimal readability
- **Adequate spacing** between interactive elements
- **Scalable fonts** up to 200% zoom

### Interaction
- **Keyboard navigation** for all functions
- **Screen reader** compatibility
- **Focus indicators** clearly visible
- **Touch targets** minimum 44px

## Brand Assets

### Logo Variations
- **Primary logo** (full color)
- **Monochrome** (single color)
- **White version** (for dark backgrounds)
- **Icon only** (square format)
- **Horizontal** and **stacked** layouts

### Templates
- **Email signatures**
- **Presentation templates**
- **Social media assets**
- **Marketing materials**
- **Business cards**

## Implementation Guidelines

### CSS Custom Properties
Implement the brand system using CSS custom properties for easy theming:

```css
:root {
  /* Brand Colors */
  --brand-primary: var(--brand-purple-500);
  --brand-secondary: var(--brand-blue-500);
  
  /* Semantic Colors */
  --color-success: var(--success-500);
  --color-warning: var(--warning-500);
  --color-error: var(--error-500);
  --color-info: var(--info-500);
  
  /* Typography */
  --font-primary: 'Inter', system-ui, sans-serif;
  --font-display: 'Manrope', var(--font-primary);
  
  /* Spacing */
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2rem;
  
  /* Border Radius */
  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.5rem;
  
  /* Shadows */
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
}
```

### Component Library
Maintain a living style guide with:
- **Interactive components** with code examples
- **Usage guidelines** for each component
- **Do's and don'ts** with visual examples
- **Accessibility notes** for implementation

## Brand Evolution

### Review Schedule
- **Quarterly** brand consistency audits
- **Annual** comprehensive brand review
- **User feedback** integration for improvements
- **Market research** for competitive positioning

### Future Considerations
- **Dark mode** theme implementation
- **Mobile-first** design principles
- **Internationalization** support
- **Emerging platform** adaptations

---

**Brand Guidelines Version:** 1.0  
**Last Updated:** October 31, 2025  
**Next Review:** January 31, 2026

**Contact:** Brand Team - brand@contentfabrica.com