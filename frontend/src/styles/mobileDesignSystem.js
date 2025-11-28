/**
 * Mobile Design System
 * Centralized design tokens for consistent mobile styling
 */

export const MOBILE_DESIGN_SYSTEM = {
    // Typography
    typography: {
        // Page headers (H1)
        h1: {
            fontSize: '1.25rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.2
        },
        // Section headers (H2)
        h2: {
            fontSize: '1rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            lineHeight: 1.2
        },
        // Subsection headers (H3)
        h3: {
            fontSize: '0.875rem',
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.2
        },
        // Body text
        body: {
            fontSize: '0.75rem',
            fontWeight: 400,
            color: 'var(--text-primary)',
            lineHeight: 1.4
        },
        // Secondary text
        secondary: {
            fontSize: '0.7rem',
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.4
        },
        // Tertiary text
        tertiary: {
            fontSize: '0.65rem',
            fontWeight: 400,
            color: 'var(--text-tertiary)',
            lineHeight: 1.4
        },
        // Small text (labels/captions)
        small: {
            fontSize: '0.6rem',
            fontWeight: 400,
            color: 'var(--text-secondary)',
            lineHeight: 1.3
        }
    },

    // Spacing scale
    spacing: {
        xs: '0.25rem',
        sm: '0.5rem',
        md: '0.75rem',
        lg: '1rem',
        xl: '1.5rem',
        '2xl': '2rem'
    },

    // Border radius
    borderRadius: {
        small: '0.25rem',   // badges/pills
        medium: '0.5rem',   // buttons/cards
        large: '0.75rem',   // containers
        xlarge: '1rem'      // modals/sheets
    },

    // Apple-style blur effects
    blur: {
        light: '10px',      // Subtle glass effect
        medium: '20px',     // Standard glass effect
        heavy: '40px'       // Heavy backdrop blur
    },

    // Opacity scales for glassmorphism
    opacity: {
        glass: 0.72,        // Standard glass background
        glassLight: 0.85,   // Lighter glass variant
        overlay: 0.4,       // Modal overlays
        border: 0.18,       // Glass border highlights
        borderDark: 0.08    // Dark mode borders
    },

    // Layered shadow system (Apple-style depth)
    shadows: {
        low: '0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)',
        medium: '0 2px 8px rgba(0, 0, 0, 0.12), 0 8px 16px rgba(0, 0, 0, 0.08)',
        high: '0 8px 16px rgba(0, 0, 0, 0.12), 0 16px 32px rgba(0, 0, 0, 0.08), 0 24px 48px rgba(0, 0, 0, 0.04)',
        modal: '0 8px 32px rgba(0, 0, 0, 0.24), 0 16px 64px rgba(0, 0, 0, 0.16)'
    },

    // Apple-style animation curves
    animations: {
        // Timing curves
        curves: {
            standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)',      // General UI transitions
            decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)',    // Elements entering
            accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)',      // Elements exiting
            spring: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)' // Spring bounce effect
        },
        // Durations (Apple standard)
        durations: {
            fast: '200ms',      // Micro-interactions
            standard: '300ms',  // Most UI transitions
            slow: '400ms',      // Complex animations
            modal: '500ms'      // Sheet presentations
        }
    },

    // Colors (using CSS variables)
    colors: {
        // Headers
        header: 'var(--text-primary)',
        // Active/Selected states
        activeBg: 'var(--primary-color)',
        activeText: 'white',
        // Accent elements
        accent: 'var(--accent-color)',
        // Special highlights
        highlight: 'var(--secondary-color)',
        // Backgrounds
        bgPrimary: 'var(--bg-primary)',
        bgSecondary: 'var(--bg-secondary)',
        bgTertiary: 'var(--bg-tertiary)',
        // Borders
        border: 'var(--border-color)',
        // Text
        textPrimary: 'var(--text-primary)',
        textSecondary: 'var(--text-secondary)',
        textTertiary: 'var(--text-tertiary)'
    },

    // Button styles
    buttons: {
        primary: {
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: 'var(--primary-color)',
            color: 'white',
            border: 'none'
        },
        secondary: {
            padding: '0.5rem 1rem',
            borderRadius: '0.5rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-color)'
        },
        tab: {
            padding: '0.5rem 0.75rem',
            borderRadius: '0',
            fontSize: '0.75rem',
            fontWeight: 600,
            background: 'transparent',
            color: 'var(--text-primary)',
            border: 'none',
            borderBottom: '3px solid transparent'
        },
        tabActive: {
            background: 'var(--primary-color)',
            color: 'white',
            borderBottom: '3px solid var(--primary-color)'
        }
    },

    // Table styles
    tables: {
        mobile: {
            header: {
                fontSize: '0.7rem',
                fontWeight: 700,
                padding: '0.4rem 0.75rem',
                background: 'var(--bg-secondary)',
                color: 'var(--text-primary)'
            },
            cell: {
                fontSize: '0.75rem',
                padding: '0.5rem',
                color: 'var(--text-primary)'
            }
        }
    },

    // Page padding
    page: {
        padding: '0.75rem'
    },

    // Section spacing
    section: {
        marginBottom: '1rem'
    }
};

/**
 * Get mobile typography style object
 * @param {string} variant - 'h1' | 'h2' | 'h3' | 'body' | 'secondary' | 'tertiary' | 'small'
 * @returns {Object} Style object
 */
export function getMobileTypography(variant = 'body') {
    return MOBILE_DESIGN_SYSTEM.typography[variant] || MOBILE_DESIGN_SYSTEM.typography.body;
}

/**
 * Get mobile spacing value
 * @param {string} size - 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl'
 * @returns {string} Spacing value
 */
export function getMobileSpacing(size = 'md') {
    return MOBILE_DESIGN_SYSTEM.spacing[size] || MOBILE_DESIGN_SYSTEM.spacing.md;
}

/**
 * Get mobile border radius
 * @param {string} size - 'small' | 'medium' | 'large' | 'xlarge'
 * @returns {string} Border radius value
 */
export function getMobileBorderRadius(size = 'medium') {
    return MOBILE_DESIGN_SYSTEM.borderRadius[size] || MOBILE_DESIGN_SYSTEM.borderRadius.medium;
}

/**
 * Get Apple-style glassmorphism effect
 * @param {boolean} isDarkMode - Whether dark mode is active
 * @param {string} blurLevel - 'light' | 'medium' | 'heavy'
 * @returns {Object} Style object with backdrop-filter and background
 */
export function getGlassmorphism(isDarkMode = false, blurLevel = 'medium') {
    const blur = MOBILE_DESIGN_SYSTEM.blur[blurLevel] || MOBILE_DESIGN_SYSTEM.blur.medium;
    const opacity = MOBILE_DESIGN_SYSTEM.opacity.glass;
    const borderOpacity = isDarkMode ? MOBILE_DESIGN_SYSTEM.opacity.borderDark : MOBILE_DESIGN_SYSTEM.opacity.border;

    return {
        backdropFilter: `blur(${blur}) saturate(180%)`,
        WebkitBackdropFilter: `blur(${blur}) saturate(180%)`, // Safari support
        background: isDarkMode
            ? `rgba(28, 28, 30, ${opacity})`
            : `rgba(255, 255, 255, ${opacity})`,
        border: `1px solid rgba(255, 255, 255, ${borderOpacity})`
    };
}

/**
 * Get layered shadow
 * @param {string} level - 'low' | 'medium' | 'high' | 'modal'
 * @returns {string} Box shadow value
 */
export function getShadow(level = 'medium') {
    return MOBILE_DESIGN_SYSTEM.shadows[level] || MOBILE_DESIGN_SYSTEM.shadows.medium;
}

/**
 * Get animation curve
 * @param {string} type - 'standard' | 'decelerate' | 'accelerate' | 'spring'
 * @returns {string} Cubic-bezier curve
 */
export function getAnimationCurve(type = 'standard') {
    return MOBILE_DESIGN_SYSTEM.animations.curves[type] || MOBILE_DESIGN_SYSTEM.animations.curves.standard;
}

/**
 * Get animation duration
 * @param {string} speed - 'fast' | 'standard' | 'slow' | 'modal'
 * @returns {string} Duration value
 */
export function getAnimationDuration(speed = 'standard') {
    return MOBILE_DESIGN_SYSTEM.animations.durations[speed] || MOBILE_DESIGN_SYSTEM.animations.durations.standard;
}

/**
 * Get iOS-style segmented control styles
 * @param {boolean} isDarkMode - Whether dark mode is active
 * @param {boolean} isMobile - Whether on mobile device
 * @returns {Object} Style configuration for segmented controls
 */
export function getSegmentedControlStyles(isDarkMode = false, isMobile = false) {
    const shadow = MOBILE_DESIGN_SYSTEM.shadows.low;
    const radius = MOBILE_DESIGN_SYSTEM.borderRadius.medium;
    const springCurve = MOBILE_DESIGN_SYSTEM.animations.curves.spring;
    const standardDuration = MOBILE_DESIGN_SYSTEM.animations.durations.standard;

    return {
        container: {
            background: isDarkMode ? 'rgba(58, 58, 60, 0.6)' : 'rgba(209, 209, 214, 0.6)',
            borderRadius: radius,
            padding: '2px',
            display: 'inline-flex',
            gap: '2px',
            boxShadow: shadow,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)'
        },
        button: {
            padding: isMobile ? '0.4rem 0.75rem' : '0.5rem 1rem',
            background: 'transparent',
            color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
            border: 'none',
            borderRadius: radius,
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: isMobile ? '0.7rem' : '0.75rem',
            transition: `all ${standardDuration} ${springCurve}`,
            whiteSpace: 'nowrap',
            position: 'relative',
            zIndex: '1'
        },
        activeButton: {
            background: isDarkMode ? 'rgba(28, 28, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
            color: isDarkMode ? 'rgba(255, 255, 255, 1)' : 'rgba(0, 0, 0, 0.9)',
            boxShadow: `0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.08)`
        },
        spring: springCurve,
        duration: standardDuration
    };
}

