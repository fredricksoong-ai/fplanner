// ============================================================================
// TABLE STYLES MODULE
// Centralized styling constants and helpers for all table components
// ============================================================================

// ============================================================================
// LAYOUT & SPACING
// ============================================================================

export const SPACING = {
    // Desktop padding
    desktop: {
        cell: '0.75rem 1rem',           // Standard cell padding
        cellCompact: '0.75rem 0.5rem',  // Compact cell (many columns)
        cellTight: '0.5rem',            // Very tight (fixture cells)
        header: '0.75rem 1rem',         // Header cell padding
        headerCompact: '0.75rem 0.5rem',// Compact header
        container: '2rem',              // Empty state padding
    },
    // Mobile padding (smaller)
    mobile: {
        cell: '0.5rem 0.75rem',
        cellCompact: '0.5rem',
        cellTight: '0.25rem 0.5rem',
        header: '0.5rem 0.75rem',
        headerCompact: '0.5rem',
        container: '1rem',
    },
    // Border radius
    radius: {
        container: '12px',
        cell: '0.25rem',
        badge: '0.2rem',
    }
};

// ============================================================================
// COLORS & BACKGROUNDS
// ============================================================================

export const COLORS = {
    // Table headers
    header: {
        background: 'var(--primary-color)',
        color: 'white',
    },

    // Row backgrounds (alternating)
    row: {
        even: 'var(--bg-secondary)',
        odd: 'var(--bg-primary)',
    },

    // State-specific highlights
    highlights: {
        selected: 'rgba(139, 92, 246, 0.1)',      // Purple tint - selected items
        userTeam: 'rgba(56, 189, 248, 0.1)',      // Blue tint - user's team
        warning: 'rgba(220, 38, 38, 0.05)',       // Red tint - warnings/risks
        upcoming: 'rgba(139, 92, 246, 0.3)',      // Purple - upcoming gameweek
        upcomingCell: 'rgba(139, 92, 246, 0.1)',  // Lighter for cells
    },

    // Text colors
    text: {
        primary: 'var(--text-primary)',
        secondary: 'var(--text-secondary)',
        captain: 'var(--primary-color)',
        success: '#22c55e',
        danger: '#ef4444',
    },

    // Borders
    border: {
        default: 'var(--border-color)',
        separator: 'linear-gradient(90deg, #37003c, #2a002e)', // Dark purple for bench separator
    },

    // Empty states
    empty: {
        text: 'var(--text-secondary)',
    }
};

// ============================================================================
// TYPOGRAPHY
// ============================================================================

export const TYPOGRAPHY = {
    desktop: {
        tableSize: '0.875rem',
        badgeSize: '0.75rem',
    },
    mobile: {
        tableSize: '0.75rem',
        badgeSize: '0.65rem',
    },
    weight: {
        normal: '400',
        medium: '500',
        semibold: '600',
        bold: '700',
    }
};

// ============================================================================
// SHADOWS & EFFECTS
// ============================================================================

export const EFFECTS = {
    shadow: {
        container: '0 2px 8px var(--shadow)',
        modal: '0 8px 32px rgba(0, 0, 0, 0.3)',
    }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get row background color based on index and state
 * @param {number} index - Row index
 * @param {Object} options - State options
 * @param {boolean} options.isSelected - Is row selected
 * @param {boolean} options.isUserTeam - Is in user's team
 * @param {boolean} options.hasWarning - Has warning/risk
 * @returns {string} CSS background color
 */
export function getRowBackground(index, options = {}) {
    const { isSelected, isUserTeam, hasWarning } = options;

    if (hasWarning) return COLORS.highlights.warning;
    if (isUserTeam) return COLORS.highlights.userTeam;
    if (isSelected) return COLORS.highlights.selected;

    return index % 2 === 0 ? COLORS.row.even : COLORS.row.odd;
}

/**
 * Get cell padding based on device and style
 * @param {boolean} isMobile - Is mobile device
 * @param {string} style - Padding style ('standard', 'compact', 'tight')
 * @returns {string} CSS padding value
 */
export function getCellPadding(isMobile, style = 'standard') {
    const device = isMobile ? 'mobile' : 'desktop';

    switch (style) {
        case 'compact':
            return SPACING[device].cellCompact;
        case 'tight':
            return SPACING[device].cellTight;
        default:
            return SPACING[device].cell;
    }
}

/**
 * Get header padding based on device and style
 * @param {boolean} isMobile - Is mobile device
 * @param {string} style - Padding style ('standard', 'compact')
 * @returns {string} CSS padding value
 */
export function getHeaderPadding(isMobile, style = 'standard') {
    const device = isMobile ? 'mobile' : 'desktop';
    return style === 'compact'
        ? SPACING[device].headerCompact
        : SPACING[device].header;
}

/**
 * Generate inline style string for table container
 * @param {boolean} isMobile - Is mobile device
 * @returns {string} Inline CSS style string
 */
export function getTableContainerStyle(isMobile = false) {
    return `overflow-x: auto; ${isMobile ? 'overflow-y: visible;' : ''} background: var(--bg-secondary); border-radius: ${SPACING.radius.container}; box-shadow: ${EFFECTS.shadow.container};`;
}

/**
 * Generate inline style string for table element
 * @param {boolean} isMobile - Is mobile device
 * @returns {string} Inline CSS style string
 */
export function getTableStyle(isMobile = false) {
    const fontSize = isMobile ? TYPOGRAPHY.mobile.tableSize : TYPOGRAPHY.desktop.tableSize;
    return `width: 100%; font-size: ${fontSize}; border-collapse: collapse;`;
}

/**
 * Generate inline style string for table header
 * @returns {string} Inline CSS style string
 */
export function getTableHeaderStyle() {
    return `background: ${COLORS.header.background}; color: ${COLORS.header.color};`;
}

/**
 * Generate inline style string for header cell
 * @param {boolean} isMobile - Is mobile device
 * @param {Object} options - Cell options
 * @param {string} options.align - Text alignment ('left', 'center', 'right')
 * @param {boolean} options.compact - Use compact padding
 * @param {boolean} options.nowrap - Prevent text wrapping
 * @param {boolean} options.isUpcoming - Is upcoming gameweek column
 * @returns {string} Inline CSS style string
 */
export function getHeaderCellStyle(isMobile, options = {}) {
    const { align = 'left', compact = false, nowrap = false, isUpcoming = false } = options;
    const padding = getHeaderPadding(isMobile, compact ? 'compact' : 'standard');
    const bgColor = isUpcoming ? COLORS.highlights.upcoming : '';

    let style = `text-align: ${align}; padding: ${padding};`;
    if (nowrap) style += ' white-space: nowrap;';
    if (bgColor) style += ` background: ${bgColor};`;

    return style;
}

/**
 * Generate inline style string for table cell
 * @param {boolean} isMobile - Is mobile device
 * @param {Object} options - Cell options
 * @param {string} options.align - Text alignment ('left', 'center', 'right')
 * @param {string} options.padding - Padding style ('standard', 'compact', 'tight')
 * @param {boolean} options.isUpcoming - Is upcoming gameweek column
 * @param {string} options.background - Custom background color
 * @param {string} options.color - Custom text color
 * @param {boolean} options.bold - Use bold font weight
 * @returns {string} Inline CSS style string
 */
export function getCellStyle(isMobile, options = {}) {
    const {
        align = 'left',
        padding = 'standard',
        isUpcoming = false,
        background,
        color,
        bold = false
    } = options;

    const cellPadding = getCellPadding(isMobile, padding);
    let style = `padding: ${cellPadding}; text-align: ${align};`;

    if (isUpcoming) style += ` background: ${COLORS.highlights.upcomingCell};`;
    if (background) style += ` background: ${background};`;
    if (color) style += ` color: ${color};`;
    if (bold) style += ` font-weight: ${TYPOGRAPHY.weight.semibold};`;

    return style;
}

/**
 * Generate inline style string for empty state
 * @param {boolean} isMobile - Is mobile device
 * @returns {string} Inline CSS style string
 */
export function getEmptyStateStyle(isMobile = false) {
    const padding = isMobile ? SPACING.mobile.container : SPACING.desktop.container;
    return `text-align: center; padding: ${padding}; color: ${COLORS.empty.text};`;
}

/**
 * Generate inline style string for separator row (bench separator)
 * @param {number} colspan - Number of columns to span
 * @returns {string} HTML for separator row
 */
export function getSeparatorRow(colspan) {
    return `<tr><td colspan="${colspan}" style="padding: 0; background: ${COLORS.border.separator}; height: 3px;"></td></tr>`;
}

/**
 * Generate inline style string for captain/vice badge
 * @param {boolean} isCaptain - Is captain
 * @returns {string} Inline CSS style string
 */
export function getBadgeStyle(isCaptain) {
    const color = isCaptain ? COLORS.text.captain : COLORS.text.secondary;
    return `color: ${color}; font-weight: ${TYPOGRAPHY.weight.bold};`;
}

/**
 * Generate inline style string for fixture difficulty badge
 * @param {boolean} isMobile - Is mobile device
 * @returns {string} Inline CSS style string
 */
export function getFixtureBadgeStyle(isMobile = false) {
    const fontSize = isMobile ? TYPOGRAPHY.mobile.badgeSize : TYPOGRAPHY.desktop.badgeSize;
    return `padding: ${SPACING.radius.cell}; border-radius: ${SPACING.radius.cell}; font-weight: ${TYPOGRAPHY.weight.semibold}; font-size: ${fontSize}; display: inline-block;`;
}

// ============================================================================
// MOBILE TABLE GRID STYLES (for CSS Grid-based mobile tables)
// ============================================================================

export const MOBILE_GRID = {
    // Grid template columns for different table types
    templates: {
        playerTable: 'auto 2fr 1fr 1fr',           // Rank, Player, Stats, Stats
        teamTable: '1fr 2fr auto auto',            // Team, Name, Stats, Stats
        leagueTable: 'auto 2fr auto auto auto',    // Rank, Manager, GW, Total, Gap
    },

    // Row styling
    row: {
        padding: '0.75rem 0.5rem',
        gap: '0.5rem',
        borderBottom: '1px solid var(--border-color)',
    },

    // Header styling (sticky)
    header: {
        padding: '0.5rem',
        fontSize: '0.7rem',
        fontWeight: TYPOGRAPHY.weight.semibold,
        background: 'var(--bg-secondary)',
        borderBottom: '2px solid var(--border-color)',
    }
};

/**
 * Generate CSS grid template for mobile table
 * @param {string} type - Table type ('player', 'team', 'league')
 * @returns {string} CSS grid-template-columns value
 */
export function getMobileGridTemplate(type = 'player') {
    const key = `${type}Table`;
    return MOBILE_GRID.templates[key] || MOBILE_GRID.templates.playerTable;
}
