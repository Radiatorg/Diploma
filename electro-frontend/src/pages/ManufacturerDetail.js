import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { manufacturerAPI } from '../api/api';
import { fileAbsoluteUrl } from '../utils/apiOrigin';
import ApplianceCardModal from '../components/ApplianceCardModal/ApplianceCardModal';
import './ManufacturerDetail.css';

const ManufacturerDetail = () => {
  const { id } = useParams();
  const [manufacturer, setManufacturer] = useState(null);
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAppliance, setSelectedAppliance] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [mRes, aRes] = await Promise.all([
          manufacturerAPI.getById(id),
          manufacturerAPI.getAppliances(id),
        ]);
        if (!cancelled) {
          setManufacturer(mRes.data);
          setAppliances(aRes.data || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError('Не удалось загрузить данные производителя');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return <div className="manufacturer-page loading-state">Загрузка…</div>;
  }
  if (error || !manufacturer) {
    return (
      <div className="manufacturer-page error-state">
        <p>{error || 'Производитель не найден'}</p>
        <Link to="/appliances" className="btn-back-catalog">← В каталог</Link>
      </div>
    );
  }

  const logoUrl = fileAbsoluteUrl(manufacturer.logoUrl);

  const socials = [
    { key: 'vk', label: 'VK', url: manufacturer.socialVk },
    { key: 'tg', label: 'Telegram', url: manufacturer.socialTelegram },
    { key: 'yt', label: 'YouTube', url: manufacturer.socialYoutube },
    { key: 'ig', label: 'Instagram', url: manufacturer.socialInstagram },
  ].filter((s) => s.url && s.url.trim());

  return (
    <div className="manufacturer-page fade-in">
      <div className="manufacturer-hero">
        <div className="manufacturer-hero-bg" />
        <div className="manufacturer-hero-inner">
          <div className="manufacturer-logo-wrap">
            {logoUrl ? (
              <img src={logoUrl} alt="" className="manufacturer-logo" />
            ) : (
              <div className="manufacturer-logo-placeholder">{manufacturer.name?.charAt(0) || '?'}</div>
            )}
          </div>
          <div className="manufacturer-hero-text">
            <p className="manufacturer-kicker">Производитель</p>
            <h1>{manufacturer.name}</h1>
            {manufacturer.legalName && (
              <p className="manufacturer-legal">{manufacturer.legalName}</p>
            )}
            {manufacturer.description && (
              <p className="manufacturer-desc">{manufacturer.description}</p>
            )}
            <div className="manufacturer-actions">
              {manufacturer.websiteUrl && (
                <a
                  href={manufacturer.websiteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mfr-btn mfr-btn-primary"
                >
                  Сайт компании
                </a>
              )}
              {manufacturer.email && (
                <a href={`mailto:${manufacturer.email}`} className="mfr-btn mfr-btn-outline">
                  {manufacturer.email}
                </a>
              )}
              <Link to="/appliances" className="mfr-btn mfr-btn-ghost">
                Весь каталог
              </Link>
            </div>
            {socials.length > 0 && (
              <div className="manufacturer-socials">
                {socials.map((s) => (
                  <a
                    key={s.key}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mfr-social-pill"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <section className="manufacturer-appliances-section">
        <div className="manufacturer-section-head">
          <h2>Приборы этого производителя</h2>
          <span className="manufacturer-count">{appliances.length}</span>
        </div>
        {appliances.length === 0 ? (
          <p className="manufacturer-empty">В каталоге пока нет активных приборов этого изготовителя.</p>
        ) : (
          <div className="manufacturer-appliance-grid">
            {appliances.map((a) => {
              const img = fileAbsoluteUrl(a.imageUrl);
              return (
                <button
                  type="button"
                  key={a.id}
                  className="manufacturer-appliance-card"
                  onClick={() => {
                    setSelectedAppliance(a);
                    setShowModal(true);
                  }}
                >
                  <div className="mac-image">
                    {img ? <img src={img} alt="" /> : <span className="mac-no-img">Нет фото</span>}
                  </div>
                  <div className="mac-body">
                    <h3>{a.name}</h3>
                    {a.model && <p className="mac-model">{a.model}</p>}
                    {a.powerConsumption != null && (
                      <p className="mac-power">{Number(a.powerConsumption).toFixed(0)} Вт</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <ApplianceCardModal
        appliance={selectedAppliance}
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedAppliance(null);
        }}
      />
    </div>
  );
};

export default ManufacturerDetail;
