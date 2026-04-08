import React from 'react';
import './Modal.css';

const Modal = ({
  show,
  title,
  children,
  onClose,
  onConfirm,
  onCancel,
  confirmText = "Ок",
  cancelText = "Отмена",
  type = "form",
  zIndex = 2000,
  containerClassName = "",
}) => {
  if (!show) return null;

  return (
    <div className="modal-overlay" style={{ zIndex }}>
      <div className={`modal-container ${type === 'confirm' ? 'modal-mini' : ''} ${containerClassName}`}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-x" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {children}
        </div>
        <div className="modal-footer">
          <button className="btn-secondary" onClick={onCancel || onClose}>{cancelText}</button>
          {onConfirm && (
            <button 
              className={confirmText.toLowerCase().includes('удалить') || confirmText.toLowerCase().includes('delete') 
                ? 'btn-danger' 
                : 'btn-primary'} 
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Modal;