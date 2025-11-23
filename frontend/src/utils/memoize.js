// ============================================================================
// MEMOIZATION UTILITY
// Provides memoization functions for expensive computations
// ============================================================================

/**
 * Create a memoized version of a function
 * Caches results based on stringified arguments
 * @param {Function} fn - Function to memoize
 * @param {Object} options - Memoization options
 * @param {number} [options.maxSize=1000] - Maximum cache size
 * @param {Function} [options.keyGenerator] - Custom key generator function
 * @returns {Function} Memoized function
 * @example
 * const expensiveCalc = memoize((a, b) => a * b * 1000);
 * expensiveCalc(5, 10); // Calculates and caches
 * expensiveCalc(5, 10); // Returns cached result
 */
export function memoize(fn, options = {}) {
  const { maxSize = 1000, keyGenerator } = options;
  const cache = new Map();
  
  return function(...args) {
    // Generate cache key
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);
    
    // Check cache
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    // Calculate and cache result
    const result = fn.apply(this, args);
    
    // Evict oldest entry if cache is full
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  };
}

/**
 * Create a memoized function with cache invalidation
 * @param {Function} fn - Function to memoize
 * @param {Object} options - Memoization options
 * @param {number} [options.maxSize=1000] - Maximum cache size
 * @param {Function} [options.keyGenerator] - Custom key generator function
 * @returns {Object} Object with memoized function and clearCache method
 * @example
 * const { fn, clearCache } = memoizeWithClear((a, b) => a * b);
 * fn(5, 10); // Calculates
 * clearCache(); // Clears all cached results
 */
export function memoizeWithClear(fn, options = {}) {
  const cache = new Map();
  const maxSize = options.maxSize || 1000;
  const keyGenerator = options.keyGenerator;
  
  const memoized = function(...args) {
    const key = keyGenerator 
      ? keyGenerator(...args)
      : JSON.stringify(args);
    
    if (cache.has(key)) {
      return cache.get(key);
    }
    
    const result = fn.apply(this, args);
    
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      cache.delete(firstKey);
    }
    
    cache.set(key, result);
    return result;
  };
  
  return {
    fn: memoized,
    clearCache: () => cache.clear()
  };
}

/**
 * Create a memoized function that invalidates based on a dependency
 * Useful for caching calculations that depend on gameweek or other changing values
 * @param {Function} fn - Function to memoize
 * @param {Function} getDependency - Function that returns current dependency value
 * @param {Object} options - Memoization options
 * @returns {Function} Memoized function that auto-invalidates on dependency change
 * @example
 * const getCurrentGW = () => currentGW;
 * const calc = memoizeWithDependency((playerId) => expensiveCalc(playerId), getCurrentGW);
 */
export function memoizeWithDependency(fn, getDependency, options = {}) {
  let lastDependency = getDependency();
  const memoizedObj = memoizeWithClear(fn, options);
  const memoized = memoizedObj.fn;
  const clearCache = memoizedObj.clearCache;
  
  return function(...args) {
    const currentDependency = getDependency();
    
    // Clear cache if dependency changed
    if (currentDependency !== lastDependency) {
      clearCache();
      lastDependency = currentDependency;
    }
    
    return memoized.apply(this, args);
  };
}

