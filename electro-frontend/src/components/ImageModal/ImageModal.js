import React from 'react';
import './ImageModal.css';

const ImageModal = ({ show, imageUrl, alt, onClose }) => {
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  React.useEffect(() => {
    if (!show) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [show, onClose]);

  if (!show || !imageUrl) return null;

  return (
    <div className="image-modal-overlay" onClick={handleBackdropClick}>
      <div className="image-modal-container">
        <button className="image-modal-close" onClick={onClose} aria-label="Закрыть">
          ✕
        </button>
        <div className="image-modal-content">
          <img 
            src={imageUrl} 
            alt={alt || 'Изображение прибора'} 
            className="image-modal-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>
    </div>
  );
};

export default ImageModal;

