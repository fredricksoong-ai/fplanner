// ============================================================================
// AWS S3 STORAGE SERVICE
// Handles cache persistence to AWS S3 for ephemeral environments like Render
// ============================================================================

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { S3 } from '../config.js';
import logger from '../logger.js';

// ============================================================================
// S3 CLIENT INITIALIZATION
// ============================================================================

let s3Client = null;

/**
 * Initialize S3 client with AWS credentials
 * @returns {S3Client|null} S3 client instance or null if disabled/invalid
 */
function initS3Client() {
  if (!S3.ENABLED) {
    logger.log('ℹ️ S3 cache persistence disabled (local file will be used)');
    return null;
  }

  if (!S3.ACCESS_KEY_ID || !S3.SECRET_ACCESS_KEY) {
    logger.error('❌ S3 enabled but AWS credentials missing');
    return null;
  }

  try {
    const client = new S3Client({
      region: S3.REGION,
      credentials: {
        accessKeyId: S3.ACCESS_KEY_ID,
        secretAccessKey: S3.SECRET_ACCESS_KEY,
      },
    });
    logger.log(`✅ S3 client initialized (bucket: ${S3.BUCKET}, region: ${S3.REGION})`);
    return client;
  } catch (err) {
    logger.error('❌ Failed to initialize S3 client:', err.message);
    return null;
  }
}

// Initialize on module load
s3Client = initS3Client();

// ============================================================================
// S3 STORAGE OPERATIONS
// ============================================================================

/**
 * Save cache data to S3
 * @param {Object} cacheData - Serialized cache data to save
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function saveCacheToS3(cacheData) {
  if (!s3Client) {
    return false;
  }

  try {
    const command = new PutObjectCommand({
      Bucket: S3.BUCKET,
      Key: S3.CACHE_KEY,
      Body: JSON.stringify(cacheData, null, 2),
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    logger.log('☁️ Cache backed up to S3');
    return true;
  } catch (err) {
    logger.error('❌ Failed to save cache to S3:', err.message);
    return false;
  }
}

/**
 * Load cache data from S3
 * @returns {Promise<Object|null>} Parsed cache data or null if not found/error
 */
export async function loadCacheFromS3() {
  if (!s3Client) {
    return null;
  }

  try {
    // First check if object exists
    const headCommand = new HeadObjectCommand({
      Bucket: S3.BUCKET,
      Key: S3.CACHE_KEY,
    });
    await s3Client.send(headCommand);

    // Object exists, now fetch it
    const getCommand = new GetObjectCommand({
      Bucket: S3.BUCKET,
      Key: S3.CACHE_KEY,
    });

    const response = await s3Client.send(getCommand);
    const bodyString = await streamToString(response.Body);
    const cacheData = JSON.parse(bodyString);

    logger.log('☁️ Cache loaded from S3');
    return cacheData;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      logger.log('ℹ️ No cache backup found in S3, starting fresh');
      return null;
    }
    logger.error('❌ Failed to load cache from S3:', err.message);
    return null;
  }
}

/**
 * Archive a specific type of gameweek data to S3
 * @param {number} gameweek - Gameweek number
 * @param {string} type - Data type (cohorts, picks, bootstrap, github)
 * @param {Object} data - Data to archive
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function archiveGameweekToS3(gameweek, type, data) {
  if (!s3Client) {
    return false;
  }

  try {
    const key = `gameweeks/gw${gameweek}/${type}.json`;
    const command = new PutObjectCommand({
      Bucket: S3.BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    logger.log(`📦 GW${gameweek}/${type} archived to S3`);
    return true;
  } catch (err) {
    logger.error(`❌ Failed to archive GW${gameweek}/${type} to S3:`, err.message);
    return false;
  }
}

/**
 * Load a specific type of gameweek data from S3
 * @param {number} gameweek - Gameweek number
 * @param {string} type - Data type (cohorts, picks, bootstrap, github)
 * @returns {Promise<Object|null>} Parsed data or null if not found
 */
export async function loadGameweekFromS3(gameweek, type = 'cohorts') {
  if (!s3Client) {
    return null;
  }

  try {
    const key = `gameweeks/gw${gameweek}/${type}.json`;
    const getCommand = new GetObjectCommand({
      Bucket: S3.BUCKET,
      Key: key,
    });

    const response = await s3Client.send(getCommand);
    const bodyString = await streamToString(response.Body);
    const data = JSON.parse(bodyString);

    logger.log(`📦 GW${gameweek}/${type} loaded from S3`);
    return data;
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      logger.log(`ℹ️ GW${gameweek}/${type} not found in S3 archive`);
      return null;
    }
    logger.error(`❌ Failed to load GW${gameweek}/${type} from S3:`, err.message);
    return null;
  }
}

/**
 * Load all data types for a gameweek from S3
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object>} Object with cohorts, picks, bootstrap, github data
 */
export async function loadCompleteGameweekFromS3(gameweek) {
  if (!s3Client) {
    return null;
  }

  const types = ['cohorts', 'picks', 'bootstrap', 'github'];
  const results = await Promise.all(
    types.map(async type => {
      const data = await loadGameweekFromS3(gameweek, type);
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
 * Save aggregated player history to S3
 * @param {number} playerId - Player ID
 * @param {Object} data - Aggregated player history data
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function saveAggregatedPlayerHistory(playerId, data) {
  if (!s3Client) {
    return false;
  }

  try {
    const key = `aggregated/players/${playerId}.json`;
    const command = new PutObjectCommand({
      Bucket: S3.BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    logger.log(`📦 Aggregated player history for ${playerId} saved to S3`);
    return true;
  } catch (err) {
    logger.error(`❌ Failed to save aggregated player history for ${playerId}:`, err.message);
    return false;
  }
}

/**
 * Load aggregated player history from S3
 * @param {number} playerId - Player ID
 * @returns {Promise<Object|null>} Aggregated player history or null if not found
 */
export async function loadAggregatedPlayerHistory(playerId) {
  if (!s3Client) {
    return null;
  }

  try {
    const key = `aggregated/players/${playerId}.json`;
    const getCommand = new GetObjectCommand({
      Bucket: S3.BUCKET,
      Key: key,
    });

    const response = await s3Client.send(getCommand);
    const bodyString = await streamToString(response.Body);
    const data = JSON.parse(bodyString);

    logger.log(`📦 Aggregated player history for ${playerId} loaded from S3`);
    return data;
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return null;
    }
    logger.error(`❌ Failed to load aggregated player history for ${playerId}:`, err.message);
    return null;
  }
}

/**
 * Check if aggregated player history exists in S3
 * @param {number} playerId - Player ID
 * @returns {Promise<boolean>} True if exists, false otherwise
 */
export async function hasAggregatedPlayerHistory(playerId) {
  if (!s3Client) {
    return false;
  }

  try {
    const key = `aggregated/players/${playerId}.json`;
    const headCommand = new HeadObjectCommand({
      Bucket: S3.BUCKET,
      Key: key,
    });
    await s3Client.send(headCommand);
    return true;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    logger.error(`❌ Failed to check aggregated player history for ${playerId}:`, err.message);
    return false;
  }
}

/**
 * Helper function to convert stream to string
 * @param {ReadableStream} stream - Response body stream
 * @returns {Promise<string>} String contents
 */
async function streamToString(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf-8');
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  saveCacheToS3,
  loadCacheFromS3,
  archiveGameweekToS3,
  loadGameweekFromS3,
  loadCompleteGameweekFromS3,
  saveAggregatedPlayerHistory,
  loadAggregatedPlayerHistory,
  hasAggregatedPlayerHistory,
  isEnabled: () => s3Client !== null,
};
