// ============================================================================
// ULTRA-COMPACT MOBILE MY TEAM VIEW
// Main module that orchestrates compact view rendering
// ============================================================================

// Re-export all functions from compact modules
export { renderCompactHeader, attachTransferListeners } from './myTeam/compact/compactHeader.js';
export { renderCompactPlayerRow } from './myTeam/compact/compactPlayerRow.js';
export { renderCompactTeamList } from './myTeam/compact/compactTeamList.js';
export { renderMatchSchedule } from './myTeam/compact/compactSchedule.js';
export { showPlayerModal, closePlayerModal } from './myTeam/compact/playerModal.js';
export { attachPlayerRowListeners } from './myTeam/compact/compactEventHandlers.js';
