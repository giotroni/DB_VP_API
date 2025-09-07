// ============================================================================
// 1. assets/js/modules/ui-components.js - PRIORITÀ ALTA
// ============================================================================
class UIComponents {

        static createModal(id, title, content, actions = [], options = {}) {
        const modalId = id || `modal_${Date.now()}`;
        const modalSize = options.size || 'modal-lg'; // es. 'modal-xl', 'modal-sm'

        // Rimuove eventuali modali precedenti con lo stesso ID
        document.getElementById(modalId)?.remove();

        const modalHTML = `
            <div class="modal fade" id="${modalId}" tabindex="-1">
                <div class="modal-dialog ${modalSize}">
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
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        const modalElement = document.getElementById(modalId);
        
        // Associa gli handler per le azioni del footer
        actions.forEach(action => {
            if (action.selector && action.handler) {
                modalElement.querySelector(action.selector)?.addEventListener('click', action.handler);
            }
        });
        
        const modal = new bootstrap.Modal(modalElement);
        modal.show();

        // Pulisce il DOM e il backdrop dopo la chiusura della modale
        modalElement.addEventListener('hidden.bs.modal', () => {
            // remove modal element
            modalElement.remove();
            // remove any leftover modal backdrops
            document.querySelectorAll('.modal-backdrop').forEach(b => b.remove());
        });

        return modal;
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