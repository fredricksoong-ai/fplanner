// ============================================================================
// AI SERVICE
// Handles Gemini AI integration for generating FPL insights
// ============================================================================

import axios from 'axios';
import { GEMINI } from '../config.js';
import logger from '../logger.js';

// ============================================================================
// PROMPT BUILDING
// ============================================================================

/**
 * Build AI prompt based on page context
 * @param {string} page - Page name (e.g., 'data-analysis')
 * @param {string} tab - Tab name (e.g., 'overview')
 * @param {string} position - Position filter (e.g., 'all', 'GKP', 'DEF', 'MID', 'FWD')
 * @param {number} gameweek - Current gameweek number
 * @param {Object} data - Player data context
 * @returns {string} AI prompt
 */
export function buildAIPrompt(page, tab, position, gameweek, data) {
  if (page === 'planner') {
    return `You are a concise, data-driven Fantasy Premier League assistant. Analyze the manager's current squad context and produce high-quality planning tips.

CRITICAL INSTRUCTIONS:
- Current FPL Gameweek is ${gameweek}
- Base all insights on the provided squad metrics and problem players
- Insights should guide transfer planning, chip timing, or risk mitigation
- Be extremely concise (max 1-2 sentences per insight)
- Reference specific player names, positions, fixtures, or stats when possible

SQUAD CONTEXT:
${JSON.stringify(data, null, 2)}

OUTPUT FORMAT (MUST be valid JSON):
{
  "Planner": [
    "insight 1 (concise, actionable)",
    "insight 2 (concise, actionable)",
    "insight 3 (concise, actionable)"
  ]
}

Generate the JSON now.`;
  }

  if (page === 'data-analysis' && tab === 'overview') {
    return `You are a concise, sharp, and highly accurate Fantasy Premier League (FPL) analyst. Your task is to analyze the current Premier League state and FPL player data to generate compelling transfer insights across multiple categories.

CRITICAL INSTRUCTIONS:
- Current FPL Gameweek is ${gameweek}
- Use the provided player data context to generate insights
- Generate exactly 3 sharp, concise, and actionable insights for EACH of the following 5 categories
- Each insight should be a single compelling statement (1-2 sentences max)
- Use actual player names and specific stats from the data provided
- Be data-driven and actionable

PLAYER DATA CONTEXT:
${JSON.stringify(data, null, 2)}

OUTPUT FORMAT (MUST be valid JSON):
{
  "Overview": [
    "insight 1 about overall FPL market trends and key opportunities",
    "insight 2 about form players and captain picks",
    "insight 3 about major news or fixture swings"
  ],
  "Hidden Gems": [
    "insight 1 about undervalued players with strong underlying stats",
    "insight 2 about budget enablers flying under the radar",
    "insight 3 about players in form but under 5% ownership"
  ],
  "Differentials": [
    "insight 1 about low-owned players with high upside (under 15% ownership)",
    "insight 2 about transfer momentum and price rise candidates",
    "insight 3 about fixture-based differential opportunities"
  ],
  "Transfer Targets": [
    "insight 1 about premium players worth transferring in",
    "insight 2 about mid-price players with excellent fixtures",
    "insight 3 about players to avoid or transfer out"
  ],
  "Team Analysis": [
    "insight 1 about teams with the best fixtures in the next 5 gameweeks",
    "insight 2 about teams to avoid due to tough upcoming fixtures",
    "insight 3 about fixture swings or teams entering/exiting good runs"
  ]
}

Generate the JSON now.`;
  }

  // Fallback for other tabs (shouldn't be called with new design)
  return `You are an expert Fantasy Premier League analyst. Provide comprehensive insights for Gameweek ${gameweek}.`;
}

// ============================================================================
// RESPONSE PARSING
// ============================================================================

/**
 * Parse Gemini API response into insights structure
 * @param {Object} geminiData - Raw Gemini API response
 * @param {number} gameweek - Current gameweek number
 * @returns {Object} Parsed insights with categories
 */
export function parseGeminiResponse(geminiData, gameweek, page) {
  try {
    const parts = geminiData.candidates?.[0]?.content?.parts || [];

    let categories;
    const jsonPart = parts.find(part => part.jsonValue);
    if (jsonPart && typeof jsonPart.jsonValue === 'object') {
      categories = jsonPart.jsonValue;
    } else {
      const text = parts.find(part => part.text)?.text || '';

      if (!text) {
        throw new Error('No text content in Gemini response');
      }

      // Try to extract JSON from response (handles markdown code blocks)
      let jsonText = text;

      const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
      if (jsonMatch) {
        jsonText = jsonMatch[1];
      } else {
        const objectMatch = text.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonText = objectMatch[0];
        } else {
          const firstBrace = text.indexOf('{');
          const lastBrace = text.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            jsonText = text.slice(firstBrace, lastBrace + 1);
          }
        }
      }

      categories = JSON.parse(jsonText);
    }

    // Validate structure - should be an object with category keys
    if (typeof categories !== 'object' || Array.isArray(categories)) {
      throw new Error('Parsed response is not an object');
    }

    // Determine expected categories based on page
    let expectedCategories;
    if (page === 'planner') {
      expectedCategories = ['Planner'];
    } else {
      expectedCategories = ['Overview', 'Hidden Gems', 'Differentials', 'Transfer Targets', 'Team Analysis'];
    }

    // Validate and sanitize each category
    const validatedCategories = {};
    for (const category of expectedCategories) {
      if (categories[category] && Array.isArray(categories[category])) {
        // Ensure each insight is a string and trim to reasonable length
        validatedCategories[category] = categories[category]
          .slice(0, 3)  // Take first 3 insights
          .map(insight => String(insight || '').substring(0, 300));
      } else {
        // Fallback if category missing
        validatedCategories[category] = [
          'Analysis pending for this category',
          'Please refresh for updated insights',
          'Check back at next era refresh (5am/5pm UTC)'
        ];
      }
    }

    return {
      gameweek: gameweek,
      categories: validatedCategories,
      timestamp: Date.now()
    };

  } catch (error) {
    logger.error('❌ Failed to parse Gemini response:', error.message);
    logger.error('❌ Full error:', error.stack);

    // Return fallback insights in case of parsing error
    // Provide generic fallback for both planner and stats pages
    const fallbackCategories = {};
    const fallbackKeys = page === 'planner'
      ? ['Planner']
      : ['Overview', 'Hidden Gems', 'Differentials', 'Transfer Targets', 'Team Analysis'];

    for (const category of fallbackKeys) {
      fallbackCategories[category] = [
        'AI insights temporarily unavailable',
        'Please try refreshing the page',
        'Check back at next update (5am/5pm UTC)'
      ];
    }

    return {
      gameweek: gameweek,
      categories: fallbackCategories,
      timestamp: Date.now(),
      parseError: true,
      error: true,
      message: 'Failed to generate AI insights. Please try refreshing or check back later.'
    };
  }
}

// ============================================================================
// AI INSIGHTS GENERATION
// ============================================================================

/**
 * Generate AI insights using Gemini API
 * @param {string} page - Page name
 * @param {string} tab - Tab name
 * @param {string} position - Position filter
 * @param {number} gameweek - Current gameweek
 * @param {Object} data - Player data context
 * @returns {Promise<Object>} AI insights
 */
export async function generateAIInsights(page, tab, position, gameweek, data) {
  // Check if Gemini API key is configured
  if (!GEMINI.API_KEY || GEMINI.API_KEY === '') {
    throw new Error('Gemini API key not configured');
  }

  logger.log(`🤖 Generating AI insights for ${page}/${tab}/${position}...`);

  // Build prompt
  const prompt = buildAIPrompt(page, tab, position, gameweek, data);

  // Call Gemini API
  const geminiResponse = await axios.post(
    `${GEMINI.API_URL}?key=${GEMINI.API_KEY}`,
    {
      contents: [{
        parts: [{ text: prompt }]
      }],
      // TODO: Re-enable Google Search grounding once we confirm it works
      // tools: [{
      //   googleSearchRetrieval: {
      //     dynamicRetrievalConfig: {
      //       mode: "MODE_DYNAMIC",
      //       dynamicThreshold: 0.3
      //     }
      //   }
      // }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2048,
        topP: 0.8,
        topK: 40,
        responseMimeType: 'application/json'
      }
    },
    {
      timeout: 45000,
      headers: {
        'Content-Type': 'application/json'
      }
    }
  );

  // Parse response
  const insights = parseGeminiResponse(geminiResponse.data, gameweek, page);

  const categoryCount = Object.keys(insights.categories || {}).length;
  logger.log(`✅ AI Insights generated (${categoryCount} categories)`);

  return insights;
}
