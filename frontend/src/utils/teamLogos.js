// ============================================================================
// TEAM LOGOS
// SVG logos for Premier League teams
// Source: https://www.figma.com/community/file/1378407378373659105/premier-league-clubs-logos
// ============================================================================

// Import SVG files as text (Vite handles ?raw imports)
// Team ID mapping: 1=Arsenal, 2=Aston Villa, etc.
import arsenalLogo from '../assets/logos/1.svg?raw';
import astonVillaLogo from '../assets/logos/2.svg?raw';
import bournemouthLogo from '../assets/logos/3.svg?raw';
import brentfordLogo from '../assets/logos/4.svg?raw';
import brightonLogo from '../assets/logos/5.svg?raw';
import chelseaLogo from '../assets/logos/6.svg?raw';
import crystalPalaceLogo from '../assets/logos/7.svg?raw';
import evertonLogo from '../assets/logos/8.svg?raw';
import fulhamLogo from '../assets/logos/9.svg?raw';
import ipswichLogo from '../assets/logos/10.svg?raw';
import leicesterLogo from '../assets/logos/11.svg?raw';
import liverpoolLogo from '../assets/logos/12.svg?raw';
import manCityLogo from '../assets/logos/13.svg?raw';
import manUnitedLogo from '../assets/logos/14.svg?raw';
import newcastleLogo from '../assets/logos/15.svg?raw';
import nottinghamForestLogo from '../assets/logos/16.svg?raw';
import southamptonLogo from '../assets/logos/17.svg?raw';
import tottenhamLogo from '../assets/logos/18.svg?raw';
import westHamLogo from '../assets/logos/19.svg?raw';
import wolvesLogo from '../assets/logos/20.svg?raw';

/**
 * Team logo SVG mapping by team ID
 * Team ID Reference (2024-25 season):
 * 1: Arsenal (ARS), 2: Aston Villa (AVL), 3: Bournemouth (BOU), 4: Brentford (BRE)
 * 5: Brighton (BHA), 6: Chelsea (CHE), 7: Crystal Palace (CRY), 8: Everton (EVE)
 * 9: Fulham (FUL), 10: Ipswich (IPS), 11: Leicester (LEI), 12: Liverpool (LIV)
 * 13: Manchester City (MCI), 14: Manchester United (MUN), 15: Newcastle (NEW)
 * 16: Nottingham Forest (NFO), 17: Southampton (SOU), 18: Tottenham (TOT)
 * 19: West Ham (WHU), 20: Wolves (WOL)
 */
const teamLogos = {
    1: arsenalLogo,
    2: astonVillaLogo,
    3: bournemouthLogo,
    4: brentfordLogo,
    5: brightonLogo,
    6: chelseaLogo,
    7: crystalPalaceLogo,
    8: evertonLogo,
    9: fulhamLogo,
    10: ipswichLogo,
    11: leicesterLogo,
    12: liverpoolLogo,
    13: manCityLogo,
    14: manUnitedLogo,
    15: newcastleLogo,
    16: nottinghamForestLogo,
    17: southamptonLogo,
    18: tottenhamLogo,
    19: westHamLogo,
    20: wolvesLogo,
};

/**
 * Get team logo SVG by team ID
 * @param {number} teamId - Team ID (1-20)
 * @returns {string|null} SVG content or null if not available
 */
export function getTeamLogo(teamId) {
    const logo = teamLogos[teamId];
    return logo && logo !== null ? logo : null;
}

/**
 * Get team logo SVG by team object
 * @param {Object} team - Team object from bootstrap
 * @returns {string|null} SVG content or null if not available
 */
export function getTeamLogoByTeam(team) {
    if (!team || !team.id) return null;
    return getTeamLogo(team.id);
}

/**
 * Render team logo as inline SVG
 * @param {number|Object} teamIdOrTeam - Team ID or team object
 * @param {Object} options - Rendering options
 * @param {number} options.size - Logo size in pixels (default: 20)
 * @param {string} options.className - Additional CSS classes
 * @returns {string} HTML string with SVG logo or fallback text
 */
export function renderTeamLogo(teamIdOrTeam, options = {}) {
    const { size = 20, className = '' } = options;
    
    let teamId;
    let team;
    
    if (typeof teamIdOrTeam === 'number') {
        teamId = teamIdOrTeam;
    } else if (teamIdOrTeam && typeof teamIdOrTeam === 'object') {
        team = teamIdOrTeam;
        teamId = team.id;
    } else {
        return '';
    }
    
    const logo = getTeamLogo(teamId);
    
    if (logo) {
        // Parse and resize SVG
        const svgWithSize = logo
            .replace(/width="[^"]*"/, `width="${size}"`)
            .replace(/height="[^"]*"/, `height="${size}"`)
            .replace(/<svg/, `<svg class="team-logo ${className}" style="width: ${size}px; height: ${size}px; display: inline-block; vertical-align: middle;"`);
        
        return svgWithSize;
    }
    
    // Fallback to short name if logo not available
    if (team) {
        const shortName = team.short_name || team.name?.substring(0, 3).toUpperCase() || 'TBD';
        return `<span style="font-size: ${size * 0.6}px; font-weight: 600; color: var(--text-primary);">${shortName}</span>`;
    }
    
    return '';
}

/**
 * Check if logo is available for a team
 * @param {number|Object} teamIdOrTeam - Team ID or team object
 * @returns {boolean} True if logo is available
 */
export function hasTeamLogo(teamIdOrTeam) {
    let teamId;
    
    if (typeof teamIdOrTeam === 'number') {
        teamId = teamIdOrTeam;
    } else if (teamIdOrTeam && typeof teamIdOrTeam === 'object') {
        teamId = teamIdOrTeam.id;
    } else {
        return false;
    }
    
    return !!getTeamLogo(teamId);
}
