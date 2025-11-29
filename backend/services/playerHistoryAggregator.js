// ============================================================================
// PLAYER HISTORY AGGREGATOR
// Pre-aggregates player history data across all gameweeks for efficient querying
// ============================================================================

import s3Storage from './s3Storage.js';
import { getLatestFinishedGameweek } from './gameweekUtils.js';
import { fetchElementSummary } from './fplService.js';
import logger from '../logger.js';

// ============================================================================
// AGGREGATION FUNCTIONS
// ============================================================================

/**
 * Aggregate player history data for all players across all gameweeks
 * @param {Object} options - Aggregation options
 * @param {number} options.fromGW - Starting gameweek (default: 1)
 * @param {number} options.toGW - Ending gameweek (default: latest finished)
 * @param {boolean} options.force - Force re-aggregation even if exists (default: false)
 * @returns {Promise<Object>} Aggregation result with stats
 */
export async function aggregatePlayerHistory(options = {}) {
  const latestFinished = getLatestFinishedGameweek();
  const fromGW = options.fromGW || 1;
  const toGW = options.toGW || latestFinished;
  const force = options.force || false;

  logger.log(`🔄 Starting player history aggregation for GW${fromGW} to GW${toGW}...`);

  // Track all unique player IDs across all gameweeks
  const allPlayerIds = new Set();
  const playerDataMap = new Map(); // playerId -> Map<gameweek, data>

  // Step 1: Load all gameweek data and collect player IDs
  logger.log(`📦 Loading gameweek data from S3...`);
  for (let gw = fromGW; gw <= toGW; gw++) {
    try {
      const picksData = await s3Storage.loadGameweekFromS3(gw, 'picks');
      const bootstrapData = await s3Storage.loadGameweekFromS3(gw, 'bootstrap');

      if (!picksData || !picksData.buckets) {
        logger.warn(`⚠️ GW${gw}: No picks data available, skipping`);
        continue;
      }

      // Extract all player IDs from picks data
      for (const [cohortKey, cohortData] of Object.entries(picksData.buckets)) {
        if (cohortData.players) {
          cohortData.players.forEach(player => {
            allPlayerIds.add(player.element);
          });
        }
      }

      // Store gameweek data for processing
      playerDataMap.set(gw, { picks: picksData, bootstrap: bootstrapData });
    } catch (err) {
      logger.warn(`⚠️ GW${gw}: Failed to load data - ${err.message}`);
      continue;
    }
  }

  logger.log(`📊 Found ${allPlayerIds.size} unique players across ${playerDataMap.size} gameweeks`);

  // Step 2: Fetch player history from FPL API for all players (for price/points)
  logger.log(`📥 Fetching player history from FPL API...`);
  const playerHistoryMap = new Map();
  const playerIdsArray = Array.from(allPlayerIds);
  
  // Process in batches to avoid overwhelming the API
  const batchSize = 10;
  for (let i = 0; i < playerIdsArray.length; i += batchSize) {
    const batch = playerIdsArray.slice(i, i + batchSize);
    await Promise.all(
      batch.map(async (playerId) => {
        try {
          const playerSummary = await fetchElementSummary(playerId);
          if (playerSummary.history) {
            playerHistoryMap.set(playerId, playerSummary.history);
          }
        } catch (err) {
          logger.warn(`⚠️ Failed to fetch history for player ${playerId}: ${err.message}`);
        }
      })
    );
    logger.log(`  Progress: ${Math.min(i + batchSize, playerIdsArray.length)}/${playerIdsArray.length} players`);
  }

  // Step 3: Aggregate data per player
  logger.log(`🔨 Aggregating player data...`);
  let aggregatedCount = 0;
  let skippedCount = 0;

  for (const playerId of allPlayerIds) {
    try {
      const playerHistory = playerHistoryMap.get(playerId) || [];
      
      // Create history map for quick lookup
      const historyMap = new Map();
      playerHistory.forEach(h => {
        if (h.round) {
          historyMap.set(h.round, h);
        }
      });

      // Calculate form and cumulative points
      const formMap = new Map();
      const cumulativePointsMap = new Map();
      const pointsArray = playerHistory
        .filter(h => h.round && h.total_points !== null && h.total_points !== undefined)
        .sort((a, b) => a.round - b.round)
        .map(h => ({ round: h.round, points: h.total_points }));

      let cumulativeTotal = 0;
      pointsArray.forEach((item, index) => {
        cumulativeTotal += item.points;
        cumulativePointsMap.set(item.round, cumulativeTotal);

        // Calculate form as average of last 3-5 gameweeks
        const lookback = Math.min(5, index + 1);
        const startIndex = Math.max(0, index - lookback + 1);
        const recentPoints = pointsArray.slice(startIndex, index + 1).map(p => p.points);
        const avgPoints = recentPoints.reduce((sum, p) => sum + p, 0) / recentPoints.length;
        formMap.set(item.round, parseFloat(avgPoints.toFixed(1)));
      });

      // Build gameweek array for this player
      const gameweeks = [];
      for (let gw = fromGW; gw <= toGW; gw++) {
        const gwData = playerDataMap.get(gw);
        if (!gwData || !gwData.picks || !gwData.picks.buckets) {
          continue;
        }

        const gwOwnership = { gameweek: gw };

        // Extract ownership from each cohort
        for (const [cohortKey, cohortData] of Object.entries(gwData.picks.buckets)) {
          const player = cohortData.players?.find(p => p.element === playerId);
          if (player) {
            gwOwnership[cohortKey] = {
              ownership: player.ownership,
              ownershipPercent: (player.ownership / cohortData.sampleSize * 100).toFixed(1),
              captainCount: player.captainCount,
              captainPercent: (player.captainCount / cohortData.sampleSize * 100).toFixed(1)
            };
          }
        }

        // Add price and points from player history
        const historyEntry = historyMap.get(gw);
        if (historyEntry) {
          if (historyEntry.value !== null && historyEntry.value !== undefined) {
            gwOwnership.price = historyEntry.value;
          }
          if (historyEntry.total_points !== null && historyEntry.total_points !== undefined) {
            gwOwnership.gw_points = historyEntry.total_points;
          }
          const cumulativePoints = cumulativePointsMap.get(gw);
          if (cumulativePoints !== undefined) {
            gwOwnership.total_points = cumulativePoints;
          }
        }

        // Add form
        const calculatedForm = formMap.get(gw);
        if (calculatedForm !== undefined) {
          gwOwnership.form = calculatedForm.toString();
        }

        // Add overall ownership from bootstrap
        if (gwData.bootstrap && gwData.bootstrap.elements) {
          const playerData = gwData.bootstrap.elements.find(p => p.id === playerId);
          if (playerData && playerData.selected_by_percent) {
            gwOwnership.overall_ownership = playerData.selected_by_percent;
          }
        }

        // Only add if we have at least some data
        if (Object.keys(gwOwnership).length > 1) { // More than just gameweek
          gameweeks.push(gwOwnership);
        }
      }

      // Save aggregated data for this player
      if (gameweeks.length > 0) {
        const aggregatedData = {
          playerId,
          lastUpdated: new Date().toISOString(),
          gameweeks
        };

        const saved = await s3Storage.saveAggregatedPlayerHistory(playerId, aggregatedData);
        if (saved) {
          aggregatedCount++;
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    } catch (err) {
      logger.error(`❌ Failed to aggregate player ${playerId}: ${err.message}`);
      skippedCount++;
    }
  }

  const result = {
    fromGW,
    toGW,
    totalPlayers: allPlayerIds.size,
    aggregated: aggregatedCount,
    skipped: skippedCount,
    completedAt: new Date().toISOString()
  };

  logger.log(`✅ Player history aggregation complete!`);
  logger.log(`   Aggregated: ${aggregatedCount} players`);
  logger.log(`   Skipped: ${skippedCount} players`);

  return result;
}

/**
 * Check if aggregated player history exists for a player
 * @param {number} playerId - Player ID
 * @returns {Promise<boolean>} True if aggregated data exists
 */
export async function hasAggregatedPlayerHistory(playerId) {
  return await s3Storage.hasAggregatedPlayerHistory(playerId);
}

