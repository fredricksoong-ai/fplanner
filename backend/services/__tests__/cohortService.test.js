import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cache } from '../cacheManager.js';
import * as cohortService from '../cohortService.js';

describe('cohortService caching', () => {
  beforeEach(() => {
    cache.cohorts.entries.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    cache.cohorts.entries.clear();
  });

  it('returns cached cohort data when fresh', async () => {
    const payload = { gameweek: 5, timestamp: Date.now(), buckets: {} };
    cache.cohorts.entries.set('5', { data: payload, timestamp: payload.timestamp });

    const computeSpy = vi.spyOn(cohortService.executors, 'computeCohorts').mockResolvedValue(payload);
    const result = await cohortService.getCohortMetrics(5);

    expect(result).toEqual(payload);
    expect(computeSpy).not.toHaveBeenCalled();
  });

  it('recomputes cohorts when cache is stale', async () => {
    const stalePayload = { gameweek: 6, timestamp: Date.now() - (7 * 60 * 60 * 1000), buckets: {} };
    cache.cohorts.entries.set('6', { data: stalePayload, timestamp: stalePayload.timestamp });

    const freshPayload = { gameweek: 6, timestamp: Date.now(), buckets: { top10k: { sampleSize: 0, averages: {}, distributions: {} } } };
    const computeSpy = vi.spyOn(cohortService.executors, 'computeCohorts').mockResolvedValue(freshPayload);

    const result = await cohortService.getCohortMetrics(6);

    expect(result).toEqual(freshPayload);
    expect(computeSpy).toHaveBeenCalledTimes(1);
  });

  it('builds sample pages evenly for bucket ranges', () => {
    const bucket = { key: 'top10k', maxRank: 10000 };
    const pages = cohortService.__internal.getSamplePagesForBucket(bucket);

    expect(pages[0]).toBe(1);
    expect(pages[pages.length - 1]).toBeGreaterThanOrEqual(1);
    expect(pages).toContain(200); // total pages for 10k ranks
  });
});

