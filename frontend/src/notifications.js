// ============================================================================
// NOTIFICATIONS MODULE
// Toast-style notifications to replace alert()
// ============================================================================

/**
 * Show a toast notification
 * @param {string} message - Notification message
 * @param {string} type - Notification type ('success' | 'error' | 'warning' | 'info')
 * @param {number} duration - Duration in milliseconds (0 = permanent until dismissed)
 */
export function showNotification(message, type = 'info', duration = 5000) {
    // Create notification container if it doesn't exist
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 10px;
            max-width: 400px;
        `;
        document.body.appendChild(container);
    }

    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'notification';

    // Set colors based on type
    const colors = {
        success: { bg: '#10b981', border: '#059669', icon: 'fa-check-circle' },
        error: { bg: '#ef4444', border: '#dc2626', icon: 'fa-exclamation-circle' },
        warning: { bg: '#f59e0b', border: '#d97706', icon: 'fa-exclamation-triangle' },
        info: { bg: '#3b82f6', border: '#2563eb', icon: 'fa-info-circle' }
    };

    const color = colors[type] || colors.info;

    notification.style.cssText = `
        background: ${color.bg};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        border-left: 4px solid ${color.border};
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        display: flex;
        align-items: start;
        gap: 1rem;
        min-width: 300px;
        animation: slideIn 0.3s ease-out;
        cursor: pointer;
    `;

    notification.innerHTML = `
        <i class="fas ${color.icon}" style="font-size: 1.25rem; flex-shrink: 0; margin-top: 2px;"></i>
        <div style="flex: 1;">
            <div style="font-weight: 600; margin-bottom: 0.25rem;">${type.charAt(0).toUpperCase() + type.slice(1)}</div>
            <div style="font-size: 0.875rem; opacity: 0.95;">${escapeHtml(message)}</div>
        </div>
        <button
            onclick="this.parentElement.remove()"
            style="
                background: none;
                border: none;
                color: white;
                font-size: 1.25rem;
                cursor: pointer;
                padding: 0;
                opacity: 0.7;
                transition: opacity 0.2s;
                flex-shrink: 0;
            "
            onmouseover="this.style.opacity='1'"
            onmouseout="this.style.opacity='0.7'"
        >
            <i class="fas fa-times"></i>
        </button>
    `;

    // Add click to dismiss
    notification.addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON' && e.target.tagName !== 'I') {
            notification.remove();
        }
    });

    // Add to container
    container.appendChild(notification);

    // Auto-remove after duration (if not permanent)
    if (duration > 0) {
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, duration);
    }
}

/**
 * Show success notification
 * @param {string} message - Success message
 * @param {number} duration - Duration in milliseconds
 */
export function showSuccess(message, duration = 5000) {
    showNotification(message, 'success', duration);
}

/**
 * Show error notification
 * @param {string} message - Error message
 * @param {number} duration - Duration in milliseconds (0 = permanent)
 */
export function showError(message, duration = 0) {
    showNotification(message, 'error', duration);
}

/**
 * Show warning notification
 * @param {string} message - Warning message
 * @param {number} duration - Duration in milliseconds
 */
export function showWarning(message, duration = 5000) {
    showNotification(message, 'warning', duration);
}

/**
 * Show info notification
 * @param {string} message - Info message
 * @param {number} duration - Duration in milliseconds
 */
export function showInfo(message, duration = 5000) {
    showNotification(message, 'info', duration);
}

/**
 * Escape HTML to prevent XSS
 * @param {string} str - String to escape
 * @returns {string} Escaped string
 */
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Add animation styles
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }

        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
