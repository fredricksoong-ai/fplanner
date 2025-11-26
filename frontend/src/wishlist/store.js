import { getPlayerById } from '../data.js';
import { getMyPlayerIdSet } from '../utils/myPlayers.js';

const STORAGE_KEY = 'fplanner_wishlist';

let wishlistCache = loadFromStorage();
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
        console.warn('Failed to parse wishlist storage', err);
        return [];
    }
}

function persist() {
    if (typeof window === 'undefined' || !window.localStorage) {
        return;
    }
    try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(wishlistCache));
    } catch (err) {
        console.warn('Failed to persist wishlist', err);
    }
}

function emitChange() {
    if (typeof window === 'undefined') return;
    // Batch DOM events to avoid duplicate renders when toggling quickly.
    if (eventScheduled) return;
    eventScheduled = true;
    window.requestAnimationFrame(() => {
        window.dispatchEvent(new CustomEvent('wishlist-updated', {
            detail: { wishlist: [...wishlistCache] }
        }));
        eventScheduled = false;
    });
}

function sanitizeCache() {
    // Remove entries that are now in the user's squad.
    const myIds = getMyPlayerIdSet();
    const before = wishlistCache.length;
    wishlistCache = wishlistCache.filter(entry => !myIds.has(entry.id));
    if (wishlistCache.length !== before) {
        persist();
        emitChange();
    }
}

export function getWishlistEntries() {
    sanitizeCache();
    return [...wishlistCache];
}

export function isWishlisted(playerId) {
    sanitizeCache();
    return wishlistCache.some(entry => entry.id === playerId);
}

export function toggleWishlist(playerId) {
    if (!playerId) return;
    const myIds = getMyPlayerIdSet();
    if (myIds.has(playerId)) {
        return false;
    }

    const exists = isWishlisted(playerId);
    if (exists) {
        wishlistCache = wishlistCache.filter(entry => entry.id !== playerId);
    } else {
        wishlistCache.push({
            id: playerId,
            addedAt: Date.now()
        });
    }
    persist();
    emitChange();
    return !exists;
}

export function getWishlistPlayers() {
    const entries = getWishlistEntries();
    return entries
        .map(entry => {
            const player = getPlayerById(entry.id);
            return player ? { player, addedAt: entry.addedAt } : null;
        })
        .filter(Boolean);
}

