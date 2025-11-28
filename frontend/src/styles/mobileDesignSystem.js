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
        large: '0.75rem'    // containers
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
 * @param {string} size - 'small' | 'medium' | 'large'
 * @returns {string} Border radius value
 */
export function getMobileBorderRadius(size = 'medium') {
    return MOBILE_DESIGN_SYSTEM.borderRadius[size] || MOBILE_DESIGN_SYSTEM.borderRadius.medium;
}

