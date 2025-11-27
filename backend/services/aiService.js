// ============================================================================
// AI SERVICE
// Handles Gemini AI integration for generating FPL insights
// ============================================================================

import axios from 'axios';
import { jsonrepair } from 'jsonrepair';
import { GEMINI } from '../config.js';
import logger from '../logger.js';

// ============================================================================
// PROMPT BUILDING
// ============================================================================

function splitPromptData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return {
      sanitizedData: data ?? {},
      managerSnapshot: null
    };
  }

  const { managerSnapshot, ...rest } = data;
  return {
    sanitizedData: rest,
    managerSnapshot: managerSnapshot || null
  };
}

function formatManagerSnapshotBlock(managerSnapshot) {
  if (!managerSnapshot) {
    return '';
  }

  return `
MANAGER SNAPSHOT (personalize insights to this exact squad):
${JSON.stringify(managerSnapshot, null, 2)}
`;
}

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
  const normalizedPosition = position || 'all';
  const { sanitizedData, managerSnapshot } = splitPromptData(data);
  const payload = sanitizedData ?? {};
  const dataSnapshot = JSON.stringify(payload, null, 2);
  const managerSnapshotBlock = formatManagerSnapshotBlock(managerSnapshot);

  const baseContext = `
CONTEXT:
- Gameweek: ${gameweek}
- Page: ${page}
- Tab: ${tab}
- Position filter: ${normalizedPosition}
- Only use the supplied JSON data; never invent stats
`;

  if (page === 'planner') {
    return `You are a concise, data-driven Fantasy Premier League assistant.

${baseContext}

${managerSnapshotBlock}

SQUAD SNAPSHOT:
${dataSnapshot}

INSTRUCTIONS:
- Write exactly three insights that help with transfer planning, chip timing, or mitigating clear risks.
- Keep each insight to one sentence (max 35 words) and reference specific players, fixtures, or metrics from the snapshot.
- Mention urgent problems first (injuries, suspensions, blank/double threats) before upside plays.
- Never repeat the same player or recommendation twice.
- If a manager snapshot is provided, tie each insight directly to that squad's gaps, budget, and chips. Do not recommend buying players already owned unless you are discussing captaincy or bench usage.

OUTPUT JSON SCHEMA:
{
  "Planner": [
    "Insight #1 (concise, actionable, references supplied data)",
    "Insight #2 (concise, actionable, references supplied data)",
    "Insight #3 (concise, actionable, references supplied data)"
  ]
}

Return only valid JSON that matches the schema.`;
  }

  if (page === 'data-analysis' && tab === 'overview') {
    return `You are a sharp Fantasy Premier League analyst that writes market-ready scouting blurbs.

${baseContext}

${managerSnapshotBlock}

PLAYER DATA SNAPSHOT:
${dataSnapshot}

INSTRUCTIONS:
- Produce exactly three bullet-style insights for each category below (15 total statements).
- Each insight must cite at least one player or club and mention the relevant stat, trend, or fixture run from the snapshot.
- Keep insights to 1–2 sentences, prioritizing actionable transfer advice and differentiator picks.
- Avoid generic phrasing such as "monitor" or "keep an eye"—be decisive.
- When a manager snapshot is available, highlight where that squad lacks coverage, carries redundant assets, or needs chip planning before offering broad market commentary.

OUTPUT JSON SCHEMA:
{
  "Overview": [
    "Insight about macro FPL trends, captaincy, or premium debates",
    "Insight about form players or fixture swings that affect most squads",
    "Insight highlighting risk factors (injuries, rotation, blank threats)"
  ],
  "Hidden Gems": [
    "Insight about undervalued players with strong underlying stats",
    "Insight about budget enablers under ~5% ownership",
    "Insight about players poised to break out"
  ],
  "Differentials": [
    "Insight covering <15% owned players with upside",
    "Insight covering transfer momentum or price changes",
    "Insight covering fixture-based differentials"
  ],
  "Transfer Targets": [
    "Premium or mid-price players worth buying",
    "Players to sell or avoid with justification",
    "Chip or captaincy angles tied to player moves"
  ],
  "Team Analysis": [
    "Team(s) with best fixtures next 4–5 GWs",
    "Team(s) entering poor runs or rotation risk",
    "Notable fixture or doubles/blank inflection points"
  ]
}

Respond with JSON that strictly matches this schema—no commentary.`;
  }

  // Fallback prompt keeps JSON expectations consistent
  return `You are an expert Fantasy Premier League analyst.

${baseContext}

${managerSnapshotBlock}

DATA SNAPSHOT:
${dataSnapshot}

Produce valid JSON with the following keys: "Overview", "Hidden Gems", "Differentials", "Transfer Targets", "Team Analysis". Each key must contain an array of exactly three concise, data-backed insights sourced from the snapshot. If a manager snapshot is present, personalize every recommendation to that squad's needs and avoid duplicating players they already own unless the advice is about captaincy or benching.`;
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
function parseCategoriesFromParts(parts) {
  const jsonPart = parts.find(part => part.jsonValue);
  if (jsonPart && typeof jsonPart.jsonValue === 'object') {
    return jsonPart.jsonValue;
  }

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

  return safeParseJson(jsonText);
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch (primaryError) {
    try {
      const repaired = jsonrepair(text);
      return JSON.parse(repaired);
    } catch (repairError) {
      primaryError.message += ` | repair attempt failed: ${repairError.message}`;
      throw primaryError;
    }
  }
}

export function parseGeminiResponse(geminiData, gameweek, page) {
  try {
    const parts = geminiData.candidates?.[0]?.content?.parts || [];

    const categories = parseCategoriesFromParts(parts);

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
  if (data?.managerSnapshot) {
    const ownedPlayers = Array.isArray(data.managerSnapshot.squad)
      ? data.managerSnapshot.squad.length
      : 0;
    const bank = data.managerSnapshot.budget?.bankMillions ?? 0;
    logger.log(`🧠 Personalization enabled (owned players: ${ownedPlayers}, bank: £${bank}m)`);
  }

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
