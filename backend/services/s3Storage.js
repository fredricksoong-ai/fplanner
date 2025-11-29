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
 * Archive a specific gameweek's data to S3
 * @param {number} gameweek - Gameweek number
 * @param {Object} data - Gameweek data to archive (cohorts, etc.)
 * @returns {Promise<boolean>} True if successful, false otherwise
 */
export async function archiveGameweekToS3(gameweek, data) {
  if (!s3Client) {
    return false;
  }

  try {
    const key = `gameweeks/gw${gameweek}.json`;
    const command = new PutObjectCommand({
      Bucket: S3.BUCKET,
      Key: key,
      Body: JSON.stringify(data, null, 2),
      ContentType: 'application/json',
    });

    await s3Client.send(command);
    logger.log(`📦 GW${gameweek} archived to S3 (${key})`);
    return true;
  } catch (err) {
    logger.error(`❌ Failed to archive GW${gameweek} to S3:`, err.message);
    return false;
  }
}

/**
 * Load a specific gameweek's archived data from S3
 * @param {number} gameweek - Gameweek number
 * @returns {Promise<Object|null>} Parsed gameweek data or null if not found
 */
export async function loadGameweekFromS3(gameweek) {
  if (!s3Client) {
    return null;
  }

  try {
    const key = `gameweeks/gw${gameweek}.json`;
    const getCommand = new GetObjectCommand({
      Bucket: S3.BUCKET,
      Key: key,
    });

    const response = await s3Client.send(getCommand);
    const bodyString = await streamToString(response.Body);
    const data = JSON.parse(bodyString);

    logger.log(`📦 GW${gameweek} loaded from S3 archive`);
    return data;
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      logger.log(`ℹ️ GW${gameweek} not found in S3 archive`);
      return null;
    }
    logger.error(`❌ Failed to load GW${gameweek} from S3:`, err.message);
    return null;
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
  isEnabled: () => s3Client !== null,
};
