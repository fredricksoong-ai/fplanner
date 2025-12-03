import { getPlayerById } from '../data.js';
import { getMyPlayerIdSet } from '../utils/myPlayers.js';

const STORAGE_KEY = 'fplanner_guillotine';

let guillotineCache = loadFromStorage();
let eventScheduled = false;

function loadFromStorage() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return [];
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(entry => typeof entry === 'object' && entry !== null && typeof entry.id === 'number');
    } catch (err) {
        console.warn('Failed to parse guillotine storage', err);
        return [];
    }
}

function persist() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(guillotineCache));
    } catch (err) {
        console.warn('Failed to persist guillotine', err);
    }
}

function emitChange() {
    if (typeof window === 'undefined') return;
    // Batch DOM events to avoid duplicate renders when toggling quickly.
    if (eventScheduled) return;
    eventScheduled = true;
    window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('guillotine-updated', {
            detail: { guillotine: [...guillotineCache] }
        }));
        eventScheduled = false;
    });
}

function sanitizeCache() {
    // Remove entries that are no longer in the user's squad.
    const myIds = getMyPlayerIdSet();
    const before = guillotineCache.length;
    guillotineCache = guillotineCache.filter(entry => myIds.has(entry.id));
    if (guillotineCache.length !== before) {
        persist();
        emitChange();
    }
}

export function getGuillotineEntries() {
    sanitizeCache();
    return [...guillotineCache];
}

export function isGuillotined(playerId) {
    sanitizeCache();
    return guillotineCache.some(entry => entry.id === playerId);
}

export function toggleGuillotine(playerId) {
    if (!playerId) return;
    const myIds = getMyPlayerIdSet();
    // Only allow players IN my team to be added to guillotine
    if (!myIds.has(playerId)) {
        return false;
    }

    const exists = isGuillotined(playerId);
    if (exists) {
        guillotineCache = guillotineCache.filter(entry => entry.id !== playerId);
    } else {
        guillotineCache.push({
            id: playerId,
            addedAt: Date.now()
        });
    }
    persist();
    emitChange();
    return !exists;
}

export function getGuillotinePlayers() {
    const entries = getGuillotineEntries();
    return entries
        .map(entry => {
            const player = getPlayerById(entry.id);
            return player ? { player, addedAt: entry.addedAt } : null;
        })
        .filter(Boolean);
}

