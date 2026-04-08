import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Modal from '../UI/Modal';
import ImageModal from '../ImageModal/ImageModal';
import { fileAbsoluteUrl } from '../../utils/apiOrigin';
import '../../pages/admin/Admin.css';
import './ApplianceCardModal.css';

const formatPower = (p) => {
  if (p == null || p === '') return '—';
  const n = typeof p === 'number' ? p : parseFloat(String(p));
  if (Number.isNaN(n)) return String(p);
  const w = n < 1 ? (n * 1000).toFixed(2) : n.toFixed(2);
  return `${w} Вт`;
};

const RoField = ({ label, children }) => (
  <div className="form-group appliance-ro-field">
    <label>{label}</label>
    <div className="appliance-ro-value">{children != null && children !== '' ? children : '—'}</div>
  </div>
);

const ApplianceCardModal = ({ appliance, show, onClose }) => {
  const [showImageModal, setShowImageModal] = useState(false);

  if (!appliance) return null;

  const imageUrl = fileAbsoluteUrl(appliance.imageUrl);
  const categories =
    appliance.categories || (appliance.category ? [{ name: appliance.category }] : []);

  return (
    <Modal
      show={show}
      onClose={onClose}
      title={appliance.name}
      type="info"
      cancelText="Назад"
      containerClassName="modal-wide"
    >
      <div className="appliance-readonly-modal">
        <div className="appliance-form-portrait">
          <div className="appliance-form-col appliance-form-col-left">
            <RoField label="Название">{appliance.name}</RoField>
            <RoField label="Описание">
              {appliance.description ? (
                <span className="appliance-ro-multiline">{appliance.description}</span>
              ) : null}
            </RoField>
            <RoField label="Мощность (Вт)">{formatPower(appliance.powerConsumption)}</RoField>
            <RoField label="Напряжение (В)">
              {appliance.voltage != null && appliance.voltage !== '' ? `${appliance.voltage} В` : null}
            </RoField>
            <RoField label="Ток (А)">
              {appliance.current != null && appliance.current !== '' ? `${appliance.current} А` : null}
            </RoField>
            <div className="form-group appliance-ro-field">
              <label>Категории</label>
              <div className="appliance-ro-value appliance-ro-categories">
                {categories.length === 0 ? (
                  '—'
                ) : (
                  <div className="appliance-ro-category-tags">
                    {categories.map((cat, idx) => (
                      <span key={idx} className="appliance-ro-cat-tag">
                        {cat.name || cat}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <RoField label="Цена (BYN)">
              {appliance.price != null && appliance.price !== ''
                ? parseFloat(appliance.price).toFixed(2)
                : null}
            </RoField>
          </div>

          <div className="appliance-form-col appliance-form-col-right">
            <div className="form-group appliance-ro-field">
              <label>Фото прибора</label>
              <div
                className="appliance-photo-panel appliance-ro-photo-panel"
                onClick={() => imageUrl && setShowImageModal(true)}
                role={imageUrl ? 'button' : undefined}
                tabIndex={imageUrl ? 0 : undefined}
                onKeyDown={(e) => {
                  if (imageUrl && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    setShowImageModal(true);
                  }
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={appliance.name}
                    className="appliance-photo-preview"
                  />
                ) : (
                  <div className="appliance-photo-empty">Фотография отсутствует</div>
                )}
              </div>
              {imageUrl && (
                <p className="form-hint-small">Нажмите на фото, чтобы открыть в полном размере</p>
              )}
            </div>

            <div className="form-group appliance-ro-field">
              <label>Изготовитель</label>
              <div className="appliance-ro-value">
                {appliance.manufacturer?.id ? (
                  <Link to={`/manufacturers/${appliance.manufacturer.id}`} className="appliance-ro-mfr-link">
                    {appliance.manufacturer.logoUrl && (
                      <img
                        src={fileAbsoluteUrl(appliance.manufacturer.logoUrl) || ''}
                        alt=""
                        className="appliance-ro-mfr-logo"
                      />
                    )}
                    <span>{appliance.manufacturer.name}</span>
                  </Link>
                ) : (
                  '—'
                )}
              </div>
            </div>

            <RoField label="Модель">{appliance.model}</RoField>

            <div className="form-row">
              <RoField label="Степень защиты IP">{appliance.ipRating}</RoField>
              <RoField label="Цвет">{appliance.color}</RoField>
            </div>
            <div className="form-row">
              <RoField label="Марка кабеля">{appliance.cableBrand}</RoField>
              <RoField label="Сечение кабеля">{appliance.cableCrossSection}</RoField>
            </div>
            <div className="form-row">
              <RoField label="Ширина (см)">{appliance.width}</RoField>
              <RoField label="Высота (см)">{appliance.height}</RoField>
            </div>
          </div>
        </div>
      </div>

      <ImageModal
        show={showImageModal}
        imageUrl={imageUrl}
        alt={appliance.name}
        onClose={() => setShowImageModal(false)}
      />
    </Modal>
  );
};

export default ApplianceCardModal;
