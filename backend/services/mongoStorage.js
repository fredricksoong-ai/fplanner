// ============================================================================
// MONGODB STORAGE SERVICE
// Handles cache persistence to MongoDB Atlas for ephemeral environments like Render
// ============================================================================

import { MongoClient } from 'mongodb';
import { MONGO } from '../config.js';
import logger from '../logger.js';

// ============================================================================
// MONGO CLIENT INITIALIZATION
// ============================================================================

let mongoClient = null;
let db = null;

/**
 * Initialize MongoDB client with connection string
 * @returns {MongoClient|null} MongoDB client instance or null if disabled/invalid
 */
function initMongoClient() {
  if (!MONGO.ENABLED) {
    logger.log('ℹ️ MongoDB cache persistence disabled (local file will be used)');
    return null;
  }

  if (!MONGO.CONNECTION_STRING) {
    logger.error('❌ MongoDB enabled but connection string missing');
    return null;
  }

  try {
    const client = new MongoClient(MONGO.CONNECTION_STRING);
    logger.log(`✅ MongoDB client initialized (database: ${MONGO.DATABASE_NAME})`);
    return client;
  } catch (err) {
    logger.error('❌ Failed to initialize MongoDB client:', err.message);
    return null;
  }
}

/**
 * Get database instance (connects if needed)
 * @returns {Promise<Db|null>} Database instance or null if disabled
 */
async function getDatabase() {
  if (!mongoClient) {
    return null;
  }

  if (!db) {
    try {
      await mongoClient.connect();
      db = mongoClient.db(MONGO.DATABASE_NAME);
      logger.log(`✅ Connected to MongoDB database: ${MONGO.DATABASE_NAME}`);
    } catch (err) {
      logger.error('❌ Failed to connect to MongoDB:', err.message);
      return null;
    }
  }

  return db;
}

// Initialize on module load
mongoClient = initMongoClient();

// ============================================================================
// MONGO STORAGE OPERATIONS
// ============================================================================

/**
 * Save cache data to MongoDB
 * @param {Object} cacheData - Serialized cache data to save
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function saveCacheToMongo(cacheData) {
  const database = await getDatabase();
  if (!database) {
    return false;
  }

  try {
    const collection = database.collection('cache');
    await collection.updateOne(
      { _id: 'main' },
      { 
        $set: { 
          data: cacheData,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    logger.log('☁️ Cache backed up to MongoDB');
    return true;
  } catch (err) {
    logger.error('❌ Failed to save cache to MongoDB:', err.message);
    return false;
  }
}

/**
 * Load cache data from MongoDB
 * @returns {Promise<Object|null>} Parsed cache data or null if not found/error
 */
export async function loadCacheFromMongo() {
  const database = await getDatabase();
  if (!database) {
    return null;
  }

  try {
    const collection = database.collection('cache');
    const doc = await collection.findOne({ _id: 'main' });
    
    if (!doc || !doc.data) {
      logger.log('ℹ️ No cache backup found in MongoDB, starting fresh');
      return null;
    }

    logger.log('☁️ Cache loaded from MongoDB');
    return doc.data;
  } catch (err) {
    logger.error('❌ Failed to load cache from MongoDB:', err.message);
    return null;
  }
}

/**
 * Archive a specific type of gameweek data to MongoDB
 * @param {number} gameweek - Gameweek number
 * @param {string} type - Data type (cohorts, picks, bootstrap, github)
 * @param {Object} data - Data to archive
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function archiveGameweekToMongo(gameweek, type, data) {
  const database = await getDatabase();
  if (!database) {
    return false;
  }

  try {
    const collection = database.collection('gameweeks');
    const docId = `gw${gameweek}-${type}`;
    await collection.updateOne(
      { _id: docId },
      { 
        $set: { 
          gameweek,
          type,
          data,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    logger.log(`📦 GW${gameweek}/${type} archived to MongoDB`);
    return true;
  } catch (err) {
    logger.error(`❌ Failed to archive GW${gameweek}/${type} to MongoDB:`, err.message);
    return false;
  }
}

/**
 * Load a specific type of gameweek data from MongoDB
 * @param {number} gameweek - Gameweek number
 * @param {string} type - Data type (cohorts, picks, bootstrap, github)
 * @returns {Promise<Object|null>} Parsed data or null if not found
 */
export async function loadGameweekFromMongo(gameweek, type = 'cohorts') {
  const database = await getDatabase();
  if (!database) {
    return null;
  }

  try {
    const collection = database.collection('gameweeks');
    const docId = `gw${gameweek}-${type}`;
    const doc = await collection.findOne({ _id: docId });
    
    if (!doc || !doc.data) {
      logger.log(`ℹ️ GW${gameweek}/${type} not found in MongoDB archive`);
      return null;
    }

    logger.log(`📦 GW${gameweek}/${type} loaded from MongoDB`);
    return doc.data;
  } catch (err) {
    logger.error(`❌ Failed to load GW${gameweek}/${type} from MongoDB:`, err.message);
    return null;
  }
}

/**
 * Load all data types for a gameweek from MongoDB
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object>} Object with cohorts, picks, bootstrap, github data
 */
export async function loadCompleteGameweekFromMongo(gameweek) {
  const database = await getDatabase();
  if (!database) {
    return null;
  }

  const types = ['cohorts', 'picks', 'bootstrap', 'github'];
  const results = await Promise.all(
    types.map(async type => {
      const data = await loadGameweekFromMongo(gameweek, type);
      return { type, data };
    })
  );

  const complete = {};
  for (const { type, data } of results) {
    complete[type] = data;
  }

  return complete;
}

/**
 * Save aggregated player history to MongoDB
 * @param {number} playerId - Player ID
 * @param {Object} data - Aggregated player history data
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function saveAggregatedPlayerHistory(playerId, data) {
  const database = await getDatabase();
  if (!database) {
    return false;
  }

  try {
    const collection = database.collection('playerHistory');
    await collection.updateOne(
      { _id: `player-${playerId}` },
      { 
        $set: { 
          playerId,
          data,
          updatedAt: new Date()
        } 
      },
      { upsert: true }
    );
    logger.log(`📦 Aggregated player history for ${playerId} saved to MongoDB`);
    return true;
  } catch (err) {
    logger.error(`❌ Failed to save aggregated player history for ${playerId}:`, err.message);
    return false;
  }
}

/**
 * Load aggregated player history from MongoDB
 * @param {number} playerId - Player ID
 * @returns {Promise<Object|null>} Aggregated player history or null if not found
 */
export async function loadAggregatedPlayerHistory(playerId) {
  const database = await getDatabase();
  if (!database) {
    return null;
  }

  try {
    const collection = database.collection('playerHistory');
    const doc = await collection.findOne({ _id: `player-${playerId}` });
    
    if (!doc || !doc.data) {
      return null;
    }

    logger.log(`📦 Aggregated player history for ${playerId} loaded from MongoDB`);
    return doc.data;
  } catch (err) {
    logger.error(`❌ Failed to load aggregated player history for ${playerId}:`, err.message);
    return null;
  }
}

/**
 * Check if aggregated player history exists in MongoDB
 * @param {number} playerId - Player ID
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
export async function hasAggregatedPlayerHistory(playerId) {
  const database = await getDatabase();
  if (!database) {
    return false;
  }

  try {
    const collection = database.collection('playerHistory');
    const doc = await collection.findOne({ _id: `player-${playerId}` });
    return doc !== null;
  } catch (err) {
    logger.error(`❌ Failed to check aggregated player history for ${playerId}:`, err.message);
    return false;
  }
}

/**
 * Close MongoDB connection (for graceful shutdown)
 */
export async function closeMongoConnection() {
  if (mongoClient) {
    try {
      await mongoClient.close();
      logger.log('✅ MongoDB connection closed');
    } catch (err) {
      logger.error('❌ Error closing MongoDB connection:', err.message);
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  saveCacheToMongo,
  loadCacheFromMongo,
  archiveGameweekToMongo,
  loadGameweekFromMongo,
  loadCompleteGameweekFromMongo,
  saveAggregatedPlayerHistory,
  loadAggregatedPlayerHistory,
  hasAggregatedPlayerHistory,
  closeMongoConnection,
  isEnabled: () => mongoClient !== null,
};

