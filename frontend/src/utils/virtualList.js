// ============================================================================
// VIRTUAL LIST COMPONENT
// Renders only visible items for large lists to improve performance
// ============================================================================

/**
 * Create a virtual scrolling list that only renders visible items
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - Container element for the list
 * @param {Array} options.items - Array of items to render
 * @param {Function} options.renderItem - Function to render a single item (item, index) => HTMLElement|string
 * @param {number} [options.itemHeight=50] - Estimated height of each item in pixels
 * @param {number} [options.overscan=5] - Number of items to render outside viewport
 * @param {string} [options.className=''] - CSS class for the container
 * @returns {Object} Virtual list instance with update and destroy methods
 * @example
 * const virtualList = createVirtualList({
 *   container: document.getElementById('list'),
 *   items: players,
 *   renderItem: (player) => `<div>${player.name}</div>`,
 *   itemHeight: 60
 * });
 */
export function createVirtualList(options) {
    const {
        container,
        items,
        renderItem,
        itemHeight = 50,
        overscan = 5,
        className = ''
    } = options;

    if (!container || !items || !renderItem) {
        throw new Error('container, items, and renderItem are required');
    }

    let scrollTop = 0;
    let containerHeight = container.clientHeight || 500;
    let visibleStart = 0;
    let visibleEnd = 0;

    // Create wrapper structure
    const wrapper = document.createElement('div');
    wrapper.className = `virtual-list-wrapper ${className}`;
    wrapper.style.position = 'relative';
    wrapper.style.height = '100%';
    wrapper.style.overflow = 'auto';

    const spacer = document.createElement('div');
    spacer.style.height = `${items.length * itemHeight}px`;
    spacer.style.position = 'relative';

    const content = document.createElement('div');
    content.style.position = 'absolute';
    content.style.top = '0';
    content.style.left = '0';
    content.style.right = '0';

    wrapper.appendChild(spacer);
    spacer.appendChild(content);
    container.innerHTML = '';
    container.appendChild(wrapper);

    /**
     * Calculate visible range
     */
    function calculateVisibleRange() {
        const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
        const end = Math.min(
            items.length,
            Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
        );
        return { start, end };
    }

    /**
     * Render visible items
     */
    function renderVisibleItems() {
        const { start, end } = calculateVisibleRange();

        // Only re-render if range changed
        if (start === visibleStart && end === visibleEnd) {
            return;
        }

        visibleStart = start;
        visibleEnd = end;

        // Clear content
        content.innerHTML = '';

        // Render visible items
        const fragment = document.createDocumentFragment();
        for (let i = start; i < end; i++) {
            const item = items[i];
            if (!item) continue;

            const itemElement = document.createElement('div');
            itemElement.style.position = 'absolute';
            itemElement.style.top = `${i * itemHeight}px`;
            itemElement.style.left = '0';
            itemElement.style.right = '0';
            itemElement.style.height = `${itemHeight}px`;

            const rendered = renderItem(item, i);
            if (typeof rendered === 'string') {
                itemElement.innerHTML = rendered;
            } else if (rendered instanceof HTMLElement) {
                itemElement.appendChild(rendered);
            }

            fragment.appendChild(itemElement);
        }

        content.appendChild(fragment);
    }

    /**
     * Handle scroll event
     */
    function handleScroll() {
        scrollTop = wrapper.scrollTop;
        containerHeight = wrapper.clientHeight;
        renderVisibleItems();
    }

    // Use requestAnimationFrame for smooth scrolling
    let rafId = null;
    function throttledScroll() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            handleScroll();
            rafId = null;
        });
    }

    // Initial render
    renderVisibleItems();

    // Attach scroll listener with passive option for better performance
    wrapper.addEventListener('scroll', throttledScroll, { passive: true });

    // Handle resize
    const resizeObserver = new ResizeObserver(() => {
        containerHeight = wrapper.clientHeight;
        renderVisibleItems();
    });
    resizeObserver.observe(wrapper);

    return {
        /**
         * Update items and re-render
         */
        update(newItems) {
            if (newItems === items) return; // Same reference, no update needed
            items.length = 0;
            items.push(...newItems);
            spacer.style.height = `${items.length * itemHeight}px`;
            renderVisibleItems();
        },

        /**
         * Scroll to a specific item
         */
        scrollToIndex(index) {
            const targetScroll = index * itemHeight;
            wrapper.scrollTop = targetScroll;
        },

        /**
         * Get current scroll position
         */
        getScrollTop() {
            return wrapper.scrollTop;
        },

        /**
         * Clean up event listeners
         */
        destroy() {
            wrapper.removeEventListener('scroll', throttledScroll);
            resizeObserver.disconnect();
            if (rafId) {
                cancelAnimationFrame(rafId);
            }
        }
    };
}

/**
 * Simple pagination-based list (load more on scroll)
 * Better for mobile when virtualization might be overkill
 * @param {Object} options - Configuration options
 * @param {HTMLElement} options.container - Container element
 * @param {Array} options.items - All items
 * @param {Function} options.renderItem - Render function
 * @param {number} [options.initialCount=20] - Initial items to show
 * @param {number} [options.loadMoreCount=20] - Items to load per batch
 * @param {string} [options.loadMoreText='Load More'] - Button text
 * @returns {Object} Paginated list instance
 */
export function createPaginatedList(options) {
    const {
        container,
        items,
        renderItem,
        initialCount = 20,
        loadMoreCount = 20,
        loadMoreText = 'Load More'
    } = options;

    if (!container || !items || !renderItem) {
        throw new Error('container, items, and renderItem are required');
    }

    let visibleCount = Math.min(initialCount, items.length);
    const listContainer = document.createElement('div');
    container.innerHTML = '';
    container.appendChild(listContainer);

    /**
     * Render visible items
     */
    function render() {
        const visibleItems = items.slice(0, visibleCount);
        const fragment = document.createDocumentFragment();

        visibleItems.forEach((item, index) => {
            const rendered = renderItem(item, index);
            if (typeof rendered === 'string') {
                const div = document.createElement('div');
                div.innerHTML = rendered;
                fragment.appendChild(div);
            } else if (rendered instanceof HTMLElement) {
                fragment.appendChild(rendered);
            }
        });

        listContainer.innerHTML = '';
        listContainer.appendChild(fragment);

        // Add load more button if there are more items
        if (visibleCount < items.length) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.textContent = loadMoreText;
            loadMoreBtn.className = 'load-more-btn';
            loadMoreBtn.style.cssText = `
                width: 100%;
                padding: 1rem;
                margin-top: 1rem;
                background: var(--primary-color);
                color: white;
                border: none;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
            `;
            loadMoreBtn.addEventListener('click', () => {
                visibleCount = Math.min(visibleCount + loadMoreCount, items.length);
                render();
            });
            container.appendChild(loadMoreBtn);
        } else {
            // Remove load more button if all items are visible
            const existingBtn = container.querySelector('.load-more-btn');
            if (existingBtn) {
                existingBtn.remove();
            }
        }
    }

    // Initial render
    render();

    return {
        /**
         * Update items
         */
        update(newItems) {
            items.length = 0;
            items.push(...newItems);
            visibleCount = Math.min(initialCount, items.length);
            render();
        },

        /**
         * Reset to initial count
         */
        reset() {
            visibleCount = Math.min(initialCount, items.length);
            render();
        }
    };
}

