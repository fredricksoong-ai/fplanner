// ============================================================================
// DEBOUNCE UTILITY
// Provides debouncing and throttling functions for performance optimization
// ============================================================================

/**
 * Debounce a function - delays execution until after wait time has passed
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Debounce options
 * @param {boolean} [options.immediate=false] - Execute immediately on first call
 * @returns {Function} Debounced function
 * @example
 * const debouncedSearch = debounce((query) => search(query), 300);
 * debouncedSearch('a'); // Waits 300ms
 * debouncedSearch('ab'); // Cancels previous, waits 300ms
 */
export function debounce(fn, wait, options = {}) {
  const { immediate = false } = options;
  let timeout = null;
  
  return function(...args) {
    const context = this;
    const callNow = immediate && !timeout;
    
    const later = () => {
      timeout = null;
      if (!immediate) {
        fn.apply(context, args);
      }
    };
    
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
    
    if (callNow) {
      fn.apply(context, args);
    }
  };
}

/**
 * Throttle a function - limits execution to at most once per wait period
 * @param {Function} fn - Function to throttle
 * @param {number} wait - Wait time in milliseconds
 * @param {Object} options - Throttle options
 * @param {boolean} [options.leading=true] - Execute on leading edge
 * @param {boolean} [options.trailing=true] - Execute on trailing edge
 * @returns {Function} Throttled function
 * @example
 * const throttledScroll = throttle(() => handleScroll(), 100);
 * window.addEventListener('scroll', throttledScroll);
 */
export function throttle(fn, wait, options = {}) {
  const { leading = true, trailing = true } = options;
  let timeout = null;
  let previous = 0;
  
  return function(...args) {
    const context = this;
    const now = Date.now();
    const remaining = wait - (now - previous);
    
    if (remaining <= 0 || remaining > wait) {
      if (previous === 0 && !leading) {
        previous = now;
        return;
      }
      
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      
      previous = now;
      fn.apply(context, args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        previous = leading ? Date.now() : 0;
        timeout = null;
        fn.apply(context, args);
      }, remaining);
    }
  };
}

