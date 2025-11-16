// ============================================================================
// AI INSIGHTS SERVICE
// Handles Gemini API integration with smart caching
// Aligns with GitHub data refresh (era-based: morning/evening)
// ============================================================================

const CACHE_DURATION = 12 * 60 * 60 * 1000; // 12 hours (fallback TTL)
const CACHE_PREFIX = 'fplanner_ai_insights_';

/**
 * Get current data era based on UTC time
 * Morning: 5am-5pm UTC | Evening: 5pm-5am UTC
 * Matches GitHub CSV refresh timing
 */
function getCurrentEra() {
    const now = new Date();
    const hour = now.getUTCHours();
    return (hour >= 5 && hour < 17) ? 'morning' : 'evening';
}

/**
 * AI Insights Service
 * Manages fetching, caching, and parsing of AI-generated insights
 */
export class AIInsightsService {
    /**
     * Get AI insights for a specific page context
     * @param {Object} context - Context data for AI analysis
     * @param {string} context.page - Page identifier (data-analysis, my-team, etc)
     * @param {string} context.tab - Tab identifier (overview, differentials, etc)
     * @param {string} context.position - Position filter (all, GKP, DEF, MID, FWD)
     * @param {number} context.gameweek - Current gameweek number
     * @param {Object} context.data - Page-specific data for analysis
     * @returns {Promise<Object>} AI insights response
     */
    async getInsights(context) {
        console.log('🤖 AI Insights: Fetching for', context.page, context.tab);

        // Check cache first
        const cached = this.getCached(context);
        if (cached && !this.isExpired(cached)) {
            console.log('✨ AI Insights: Using cached data (era:', cached.era + ')');
            return cached.data;
        }

        // Fetch fresh insights from backend
        try {
            const insights = await this.fetchFromGemini(context);
            this.cache(context, insights);
            console.log('✅ AI Insights: Fresh data cached for era:', getCurrentEra());
            return insights;
        } catch (error) {
            console.error('❌ AI Insights: Failed to fetch', error);

            // Return cached data even if expired as fallback
            if (cached) {
                console.log('⚠️ AI Insights: Using stale cache as fallback');
                return cached.data;
            }

            // Return empty insights on complete failure
            return this.getEmptyInsights(context);
        }
    }

    /**
     * Fetch insights from backend Gemini API
     * @param {Object} context - Context data
     * @returns {Promise<Object>} AI insights
     */
    async fetchFromGemini(context) {
        const response = await fetch('/api/ai-insights', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(context)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // TEMPORARY DEBUG: Log full response
        if (data.debug || data.parseError) {
            console.log('🔍 DEBUG: Full AI Insights Response:', data);
            if (data.debug) {
                console.log('🔍 DEBUG: Error Message:', data.debug.errorMessage);
                console.log('🔍 DEBUG: Extracted Text:', data.debug.extractedText);
                console.log('🔍 DEBUG: Raw Gemini Data:', data.debug.rawGeminiData);
            }
        }

        return data;
    }

    /**
     * Get cached insights for context
     * @param {Object} context - Context data
     * @returns {Object|null} Cached insights or null
     */
    getCached(context) {
        const key = this.getCacheKey(context);
        const cached = localStorage.getItem(key);

        if (!cached) {
            return null;
        }

        try {
            return JSON.parse(cached);
        } catch (error) {
            console.error('❌ AI Insights: Invalid cache data', error);
            localStorage.removeItem(key);
            return null;
        }
    }

    /**
     * Cache insights for context
     * @param {Object} context - Context data
     * @param {Object} insights - Insights to cache
     */
    cache(context, insights) {
        const key = this.getCacheKey(context);
        const cacheData = {
            data: insights,
            timestamp: Date.now(),
            era: getCurrentEra(),
            ttl: CACHE_DURATION
        };

        try {
            localStorage.setItem(key, JSON.stringify(cacheData));
        } catch (error) {
            console.error('❌ AI Insights: Failed to cache', error);
        }
    }

    /**
     * Check if cached data is expired
     * Uses era-based expiration (aligned with GitHub data refresh)
     * Falls back to 12-hour TTL if era data missing
     * @param {Object} cached - Cached data object
     * @returns {boolean} True if expired
     */
    isExpired(cached) {
        // Primary check: Era changed (morning/evening switch)
        if (cached.era && cached.era !== getCurrentEra()) {
            console.log(`🔄 AI Insights: Cache expired (era changed: ${cached.era} → ${getCurrentEra()})`);
            return true;
        }

        // Fallback check: 12-hour TTL (for older cache entries without era)
        if (!cached.era) {
            const age = Date.now() - cached.timestamp;
            if (age > CACHE_DURATION) {
                console.log(`🔄 AI Insights: Cache expired (>12 hours old)`);
                return true;
            }
        }

        return false;
    }

    /**
     * Generate cache key from context
     * @param {Object} context - Context data
     * @returns {string} Cache key
     */
    getCacheKey(context) {
        const { page, tab, position, gameweek } = context;
        return `${CACHE_PREFIX}${page}_${tab}_${position}_gw${gameweek}`;
    }

    /**
     * Clear specific cache entry
     * @param {Object} context - Context data
     */
    clearCache(context) {
        const key = this.getCacheKey(context);
        localStorage.removeItem(key);
        console.log('🗑️ AI Insights: Cache cleared for', key);
    }

    /**
     * Clear all AI insights cache
     */
    clearAllCache() {
        const keys = Object.keys(localStorage).filter(key =>
            key.startsWith(CACHE_PREFIX)
        );

        keys.forEach(key => localStorage.removeItem(key));
        console.log(`🗑️ AI Insights: Cleared ${keys.length} cache entries`);
    }

    /**
     * Get empty insights structure (fallback)
     * @param {Object} context - Context data
     * @returns {Object} Empty insights
     */
    getEmptyInsights(context) {
        return {
            gameweek: context.gameweek,
            items: [],
            timestamp: Date.now(),
            error: true,
            message: 'Unable to generate insights at this time'
        };
    }
}

// Export singleton instance
export const aiInsights = new AIInsightsService();
