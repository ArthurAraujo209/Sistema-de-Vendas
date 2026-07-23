export function Modal({ id, title, content, footer, size = 'medium', onClose }) {
  const modalHtml = `
    <div id="${id}" class="modal-overlay" role="dialog" aria-modal="true">
      <div class="modal modal-${size}">
        <div class="modal-header">
          <h3>${title}</h3>
          <button class="modal-close" data-close-modal="${id}">&times;</button>
        </div>
        <div class="modal-body">${content}</div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const overlay = document.getElementById(id);
  const closeHandler = (e) => {
    if (e.target === overlay || e.target.dataset.closeModal === id) {
      closeModal(id);
      if (onClose) onClose();
    }
  };
  overlay.addEventListener('click', closeHandler);
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeModal(id);
      document.removeEventListener('keydown', escHandler);
      if (onClose) onClose();
    }
  });

  return {
    id,
    content: overlay.querySelector('.modal-body'),
    close: () => closeModal(id)
  };
}

export function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('closing');
    modal.addEventListener('animationend', () => modal.remove());
  }
}

export function ConfirmDialog({ title, message, confirmText = 'Confirmar', cancelText = 'Cancelar', onConfirm }) {
  const id = 'confirm-' + Date.now();
  const content = `<p>${message}</p>`;
  const footer = `
    <button class="btn btn-secondary" data-close-modal="${id}">${cancelText}</button>
    <button class="btn btn-danger" id="${id}-confirm">${confirmText}</button>
  `;
  const modal = Modal({ id, title, content, footer });
  document.getElementById(`${id}-confirm`).addEventListener('click', () => {
    onConfirm();
    closeModal(id);
  });
  return modal;
}