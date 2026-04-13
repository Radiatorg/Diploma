import React, { useCallback, useEffect, useState } from 'react';
import { adminAPI, fileAPI } from '../../api/api';
import { fileAbsoluteUrl } from '../../utils/apiOrigin';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import Pagination from '../../components/UI/Pagination';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActive, setSelectedActive] = useState('ALL');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [totalItems, setTotalItems] = useState(0);
  const [isFirstLoad, setIsFirstLoad] = useState(true);

  const load = useCallback(async () => {
    if (isFirstLoad) {
      setLoading(true);
    }
    try {
      const activeParam = selectedActive === 'ALL' ? undefined : selectedActive === 'ACTIVE';
      const res = await adminAPI.getAllManufacturers({
        search: searchQuery.trim() || undefined,
        active: activeParam,
        sortBy,
        sortDir,
        page: currentPage - 1,
        size: itemsPerPage
      });
      setList(res.data || []);
      const totalCountHeader = res.headers?.['x-total-count'];
      setTotalItems(totalCountHeader ? Number(totalCountHeader) : (res.data || []).length);
      setError('');
    } catch (e) {
      setError('Ошибка загрузки производителей');
    } finally {
      if (isFirstLoad) {
        setLoading(false);
        setIsFirstLoad(false);
      }
    }
  }, [isFirstLoad, selectedActive, searchQuery, sortBy, sortDir, currentPage, itemsPerPage]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedActive, sortBy, sortDir]);

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

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortBy(field);
    setSortDir('asc');
  };

  const getSortIndicator = (field) => {
    if (sortBy !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  if (loading) return <div className="admin-page">Загрузка…</div>;

  return (
    <div className="admin-page manufacturers-admin">
      <AdminNavPanel />
      <div className="page-header">
        <h1>Производители (изготовители)</h1>
        <button type="button" className="btn-primary btn-primary-wide" onClick={openCreate}>
          Добавить производителя
        </button>
      </div>
      {error && <p className="error-message">{error}</p>}
      <div className="admin-search-container">
        <input
          type="text"
          placeholder="Поиск по названию, email, сайту, описанию..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input"
        />
        <select
          value={selectedActive}
          onChange={(e) => setSelectedActive(e.target.value)}
          className="admin-search-input"
          style={{ maxWidth: '220px' }}
        >
          <option value="ALL">Все статусы</option>
          <option value="ACTIVE">Только активные</option>
          <option value="INACTIVE">Только неактивные</option>
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="admin-search-input"
          style={{ maxWidth: '240px' }}
        >
          <option value="name">Сортировка: Название</option>
          <option value="legalName">Сортировка: Юр. название</option>
          <option value="email">Сортировка: Email</option>
          <option value="websiteUrl">Сортировка: Сайт</option>
          <option value="active">Сортировка: Активность</option>
          <option value="id">Сортировка: ID</option>
        </select>
        <select
          value={sortDir}
          onChange={(e) => setSortDir(e.target.value)}
          className="admin-search-input"
          style={{ maxWidth: '220px' }}
        >
          <option value="asc">По возрастанию</option>
          <option value="desc">По убыванию</option>
        </select>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Название{getSortIndicator('name')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('email')}>Email{getSortIndicator('email')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('websiteUrl')}>Сайт{getSortIndicator('websiteUrl')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('active')}>Активен{getSortIndicator('active')}</th>
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
      {totalItems > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(totalItems / itemsPerPage)}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={totalItems}
        />
      )}

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
