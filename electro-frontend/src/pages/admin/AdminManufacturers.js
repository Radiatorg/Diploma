import React, { useEffect, useState } from 'react';
import { adminAPI, fileAPI } from '../../api/api';
import { fileAbsoluteUrl } from '../../utils/apiOrigin';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import './Admin.css';

const emptyForm = {
  name: '',
  legalName: '',
  description: '',
  logoUrl: '',
  email: '',
  websiteUrl: '',
  socialVk: '',
  socialTelegram: '',
  socialYoutube: '',
  socialInstagram: '',
  active: true,
};

const AdminManufacturers = () => {
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = async () => {
    try {
      const res = await adminAPI.getAllManufacturers();
      setList(res.data || []);
      setError('');
    } catch (e) {
      setError('Ошибка загрузки производителей');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (m) => {
    setEditing(m);
    setForm({
      name: m.name || '',
      legalName: m.legalName || '',
      description: m.description || '',
      logoUrl: m.logoUrl || '',
      email: m.email || '',
      websiteUrl: m.websiteUrl || '',
      socialVk: m.socialVk || '',
      socialTelegram: m.socialTelegram || '',
      socialYoutube: m.socialYoutube || '',
      socialInstagram: m.socialInstagram || '',
      active: m.active !== false,
    });
    setShowForm(true);
  };

  const handleLogo = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploading(true);
    try {
      const res = await fileAPI.upload(file, 'manufacturers');
      let url = res.data?.data;
      if (typeof url !== 'string') url = url ? String(url) : null;
      if (url && !url.startsWith('/api/files/') && !url.startsWith('http')) {
        url = `/api/files/${url}`;
      }
      if (url) setForm((f) => ({ ...f, logoUrl: url }));
    } catch (err) {
      alert('Ошибка загрузки логотипа');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing) {
        await adminAPI.updateManufacturer(editing.id, payload);
      } else {
        await adminAPI.createManufacturer(payload);
      }
      setShowForm(false);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Удалить производителя «${m.name}»?`)) return;
    try {
      await adminAPI.deleteManufacturer(m.id);
      await load();
    } catch (err) {
      alert(err.response?.data?.message || 'Нельзя удалить (есть привязанные приборы)');
    }
  };

  if (loading) return <div className="admin-page">Загрузка…</div>;

  return (
    <div className="admin-page manufacturers-admin fade-in">
      <AdminNavPanel />
      <div className="page-header">
        <h1>Производители (изготовители)</h1>
        <button type="button" className="btn-primary btn-primary-wide" onClick={openCreate}>
          Добавить производителя
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Email</th>
              <th>Сайт</th>
              <th>Активен</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center' }}>
                  Нет производителей
                </td>
              </tr>
            ) : (
              list.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    {m.legalName && <div className="subtle">{m.legalName}</div>}
                  </td>
                  <td>{m.email || '—'}</td>
                  <td>
                    {m.websiteUrl ? (
                      <a href={m.websiteUrl} target="_blank" rel="noreferrer">
                        ссылка
                      </a>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{m.active ? 'да' : 'нет'}</td>
                  <td className="actions-cell">
                    <button type="button" className="btn-secondary" onClick={() => openEdit(m)}>
                      Изменить
                    </button>
                    <button type="button" className="btn-danger" onClick={() => handleDelete(m)}>
                      Удалить
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showForm && (
        <div className="modal-overlay">
          <div className="modal-content modal-content--wide">
            <h2>{editing ? 'Редактировать производителя' : 'Новый производитель'}</h2>
            <form onSubmit={submit} className="manufacturer-admin-form">
              <div className="form-row-2">
                <div className="form-group">
                  <label>Название *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    maxLength={150}
                  />
                </div>
                <div className="form-group">
                  <label>Юридическое название</label>
                  <input
                    value={form.legalName}
                    onChange={(e) => setForm({ ...form, legalName: e.target.value })}
                    maxLength={200}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Описание компании</label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  maxLength={4000}
                />
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Сайт</label>
                  <input
                    value={form.websiteUrl}
                    onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })}
                    placeholder="https://"
                  />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>VK</label>
                  <input value={form.socialVk} onChange={(e) => setForm({ ...form, socialVk: e.target.value })} />
                </div>
                <div className="form-group">
                  <label>Telegram</label>
                  <input
                    value={form.socialTelegram}
                    onChange={(e) => setForm({ ...form, socialTelegram: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-row-2">
                <div className="form-group">
                  <label>YouTube</label>
                  <input
                    value={form.socialYoutube}
                    onChange={(e) => setForm({ ...form, socialYoutube: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Instagram</label>
                  <input
                    value={form.socialInstagram}
                    onChange={(e) => setForm({ ...form, socialInstagram: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Логотип (фото компании)</label>
                {form.logoUrl && (
                  <div className="logo-preview">
                    <img src={fileAbsoluteUrl(form.logoUrl) || ''} alt="" />
                  </div>
                )}
                <label className="btn-secondary" style={{ display: 'inline-block', cursor: 'pointer' }}>
                  {uploading ? 'Загрузка…' : 'Загрузить логотип'}
                  <input type="file" accept="image/*" hidden onChange={handleLogo} disabled={uploading} />
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="checkbox"
                    checked={form.active}
                    onChange={(e) => setForm({ ...form, active: e.target.checked })}
                  />{' '}
                  Активен (виден в каталоге)
                </label>
              </div>
              <div className="form-actions">
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
                <button type="button" className="btn-secondary" onClick={() => setShowForm(false)}>
                  Отмена
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminManufacturers;
