// ============================================================================
// TEAM LOGOS
// SVG logos for Premier League teams
// Source: https://www.figma.com/community/file/1378407378373659105/premier-league-clubs-logos
// ============================================================================

// Import SVG files as text (Vite handles ?raw imports)
import arsenalLogo from '../assets/logos/1.svg?raw';
import astonVillaLogo from '../assets/logos/2.svg?raw';
import bournemouthLogo from '../assets/logos/3.svg?raw';
import brentfordLogo from '../assets/logos/4.svg?raw';
import brightonLogo from '../assets/logos/5.svg?raw';
import chelseaLogo from '../assets/logos/6.svg?raw';
import crystalPalaceLogo from '../assets/logos/7.svg?raw';
import evertonLogo from '../assets/logos/8.svg?raw';
import fulhamLogo from '../assets/logos/9.svg?raw';
import burnleyLogo from '../assets/logos/10.svg?raw';
import leedsLogo from '../assets/logos/11.svg?raw';
import liverpoolLogo from '../assets/logos/12.svg?raw';
import manCityLogo from '../assets/logos/13.svg?raw';
import manUnitedLogo from '../assets/logos/14.svg?raw';
import newcastleLogo from '../assets/logos/15.svg?raw';
import nottinghamForestLogo from '../assets/logos/16.svg?raw';
import sunderlandLogo from '../assets/logos/17.svg?raw';
import tottenhamLogo from '../assets/logos/18.svg?raw';
import westHamLogo from '../assets/logos/19.svg?raw';
import wolvesLogo from '../assets/logos/20.svg?raw';

// Import fplBootstrap to look up teams by ID
import { fplBootstrap } from '../data.js';

/**
 * Team logo mapping by team name and short name
 * This maps team names/short names from FPL API to the correct logo files
 * 
 * Comprehensive mapping of all Premier League teams (past and present):
 * - Uses both full name and short_name for matching
 * - Handles variations in naming (e.g., "Brighton & Hove Albion" vs "Brighton")
 * - Only includes teams for which we have actual logo files
 * - Teams without logos will fall back to displaying their short name as text
 */
const teamNameToLogoMap = {
    // Full team names (from FPL API team.name)
    'Arsenal': arsenalLogo,
    'Aston Villa': astonVillaLogo,
    'Bournemouth': bournemouthLogo,
    'Brentford': brentfordLogo,
    'Brighton': brightonLogo,
    'Brighton & Hove Albion': brightonLogo,
    'Burnley': burnleyLogo,
    'Chelsea': chelseaLogo,
    'Crystal Palace': crystalPalaceLogo,
    'Everton': evertonLogo,
    'Fulham': fulhamLogo,
    'Leeds': leedsLogo,
    'Leeds United': leedsLogo,
    'Leeds United F.C.': leedsLogo,
    'Liverpool': liverpoolLogo,
    'Manchester City': manCityLogo,
    'Man City': manCityLogo,
    'Manchester United': manUnitedLogo,
    'Man United': manUnitedLogo,
    'Newcastle': newcastleLogo,
    'Newcastle United': newcastleLogo,
    'Nottingham Forest': nottinghamForestLogo,
    'Nott\'m Forest': nottinghamForestLogo,
    'Sunderland': sunderlandLogo,
    'Tottenham': tottenhamLogo,
    'Tottenham Hotspur': tottenhamLogo,
    'West Ham': westHamLogo,
    'West Ham United': westHamLogo,
    'Wolves': wolvesLogo,
    'Wolverhampton Wanderers': wolvesLogo,
    'Wolverhampton': wolvesLogo,
    
    // Short names (from FPL API team.short_name)
    'ARS': arsenalLogo,
    'AVL': astonVillaLogo,
    'BOU': bournemouthLogo,
    'BRE': brentfordLogo,
    'BHA': brightonLogo,
    'BUR': burnleyLogo,
    'CHE': chelseaLogo,
    'CRY': crystalPalaceLogo,
    'EVE': evertonLogo,
    'FUL': fulhamLogo,
    'LEE': leedsLogo,
    'LIV': liverpoolLogo,
    'MCI': manCityLogo,
    'MUN': manUnitedLogo,
    'NEW': newcastleLogo,
    'NFO': nottinghamForestLogo,
    'SUN': sunderlandLogo,
    'TOT': tottenhamLogo,
    'WHU': westHamLogo,
    'WOL': wolvesLogo,
};

/**
 * Get team logo SVG by team object (name-based lookup)
 * @param {Object} team - Team object from bootstrap with {id, name, short_name}
 * @returns {string|null} SVG content or null if not available
 */
export function getTeamLogoByTeam(team) {
    if (!team) return null;
    
    // Try full name first
    if (team.name && teamNameToLogoMap[team.name]) {
        return teamNameToLogoMap[team.name];
    }
    
    // Try short name
    if (team.short_name && teamNameToLogoMap[team.short_name]) {
        return teamNameToLogoMap[team.short_name];
    }
    
    return null;
}

/**
 * Get team logo SVG by team ID (legacy support - looks up team first)
 * @param {number} teamId - Team ID (1-20)
 * @returns {string|null} SVG content or null if not available
 */
export function getTeamLogo(teamId) {
    if (!fplBootstrap?.teams) return null;
    
    const team = fplBootstrap.teams.find(t => t.id === teamId);
    if (team) {
        return getTeamLogoByTeam(team);
    }
    
    return null;
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
    
    let team;
    let logo = null;
    
    if (typeof teamIdOrTeam === 'number') {
        // Team ID provided - need to look up team object
        if (fplBootstrap?.teams) {
            team = fplBootstrap.teams.find(t => t.id === teamIdOrTeam);
        }
        
        if (team) {
            logo = getTeamLogoByTeam(team);
        }
    } else if (teamIdOrTeam && typeof teamIdOrTeam === 'object') {
        // Team object provided - use directly
        team = teamIdOrTeam;
        logo = getTeamLogoByTeam(team);
    } else {
        return '';
    }
    
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
    let team = null;
    
    if (typeof teamIdOrTeam === 'number') {
        if (fplBootstrap?.teams) {
            team = fplBootstrap.teams.find(t => t.id === teamIdOrTeam);
        }
    } else if (teamIdOrTeam && typeof teamIdOrTeam === 'object') {
        team = teamIdOrTeam;
    }
    
    if (!team) return false;
    
    return !!getTeamLogoByTeam(team);
}
