// ============================================================================
// 1. assets/js/modules/ui-components.js - PRIORITÀ ALTA
// ============================================================================
class UIComponents {
    static createModal(id, title, content, actions = []) {
        const modalHTML = `
            <div class="modal fade" id="${id}" tabindex="-1">
                <div class="modal-dialog modal-lg">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">${title}</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                        </div>
                        <div class="modal-body">${content}</div>
                        <div class="modal-footer">
                            ${actions.map(action => action.html).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById(id)?.remove();
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // Bind eventi
        actions.forEach(action => {
            if (action.handler) {
                document.querySelector(`#${id} ${action.selector}`)
                    ?.addEventListener('click', action.handler);
            }
        });
        
        return new bootstrap.Modal(document.getElementById(id));
    }

    static showToast(message, type = 'info') {
        const toastContainer = document.getElementById('toastContainer');
        const toastId = 'toast_' + Date.now();
        
        const icons = { 
            success: 'check-circle', 
            error: 'exclamation-triangle', 
            info: 'info-circle',
            warning: 'exclamation-triangle'
        };
        
        const titles = { 
            success: 'Successo', 
            error: 'Errore', 
            info: 'Informazione',
            warning: 'Attenzione'
        };
        
        const toastHTML = `
            <div class="toast" id="${toastId}" role="alert">
                <div class="toast-header">
                    <i class="fas fa-${icons[type]} me-2"></i>
                    <strong class="me-auto">${titles[type]}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">${message}</div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHTML);
        const toast = new bootstrap.Toast(document.getElementById(toastId));
        toast.show();
        
        // Auto-remove after hiding
        document.getElementById(toastId).addEventListener('hidden.bs.toast', () => {
            document.getElementById(toastId)?.remove();
        });
    }

    static createStatsCard(icon, number, label) {
        return `
            <div class="stat-card-management">
                <div class="stat-icon"><i class="${icon}"></i></div>
                <div class="stat-number">${number}</div>
                <div class="stat-label">${label}</div>
            </div>
        `;
    }

    static createLoadingState(message = 'Caricamento...') {
        return `
            <div class="text-center py-5">
                <div class="loading-text">
                    <div class="loading-spinner"></div>
                    ${message}
                </div>
            </div>
        `;
    }

    static createEmptyState(icon, title, message, actionButton = null) {
        return `
            <div class="empty-state">
                <i class="${icon}"></i>
                <h5>${title}</h5>
                <p>${message}</p>
                ${actionButton ? `<button class="${actionButton.class}">${actionButton.text}</button>` : ''}
            </div>
        `;
    }
}

window.UIComponents = UIComponents;