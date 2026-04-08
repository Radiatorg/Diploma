import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, fileAPI } from '../api/api';
import Modal from '../components/UI/Modal';
import { fileAbsoluteUrl } from '../utils/apiOrigin';
import './Form.css';
import './Profile.css';

const Profile = () => {
  const { logout, updateUser } = useAuth();
  const [user, setUser] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  
  // Добавлены phoneNumber и birthDate
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    photoUrl: '',
    phoneNumber: '',
    birthDate: '',
  });

  const [originalFormData, setOriginalFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ show: false, step: 1, onConfirm: null, message: '' });
  const [successModal, setSuccessModal] = useState({ show: false, message: '' });

  useEffect(() => {
    loadProfile();
  }, []);

  // Закрываем меню при клике вне его
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && !event.target.closest('.profile-menu-dropdown') && !event.target.closest('button[onClick*="setShowMenu"]')) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const loadProfile = async () => {
    try {
      const response = await userAPI.getProfile();
      setUser(response.data);
      
      const data = {
        email: response.data.email || '',
        firstName: response.data.firstName || '',
        lastName: response.data.lastName || '',
        photoUrl: response.data.photoUrl || '',
        phoneNumber: response.data.phoneNumber || '',
        birthDate: response.data.birthDate || '', // Бэкенд присылает YYYY-MM-DD
      };
      setFormData(data);
      setOriginalFormData(data);
    } catch (err) {
      setError('Ошибка загрузки профиля');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    
    // Валидация номера телефона
    if (name === 'phoneNumber') {
      // Разрешаем только цифры, пробелы, +, -, (, )
      const phoneRegex = /^[\d\s()+-]*$/;
      if (value === '' || phoneRegex.test(value)) {
        setFormData({
          ...formData,
          [name]: value,
        });
      }
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const validatePhoneNumber = (phone) => {
    if (!phone || phone.trim() === '') {
      return true; // Пустой номер допустим
    }
    // Убираем все пробелы, скобки, дефисы для проверки
    const cleaned = phone.replace(/[\s()-]/g, '');
    // Проверяем, что остались только цифры и возможно + в начале
    const phoneRegex = /^\+?[1-9]\d{10,14}$/;
    return phoneRegex.test(cleaned);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    // Валидация номера телефона
    if (formData.phoneNumber && !validatePhoneNumber(formData.phoneNumber)) {
      setError('Номер телефона должен содержать только цифры и может начинаться с +. Минимум 10 цифр.');
      setSaving(false);
      return;
    }

    try {
      const response = await userAPI.updateProfile(formData);
      const updatedUser = response.data;
      setUser(updatedUser);
      updateUser(updatedUser); // Обновляем пользователя в контексте
      setOriginalFormData({ ...formData });
      setIsEditing(false);
      setSuccess('Профиль успешно обновлен');
    } catch (err) {
      setError(err.response?.data?.message || 'Ошибка обновления профиля');
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Пожалуйста, выберите изображение');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Размер файла не должен превышать 10MB');
      return;
    }

    setUploadingPhoto(true);
    setError('');

    try {
      const uploadRes = await fileAPI.upload(file, 'profiles');
      let photoUrl = uploadRes.data?.data || uploadRes.data;

      if (photoUrl) {
        if (!photoUrl.startsWith('/api/files/') && !photoUrl.startsWith('http')) {
          photoUrl = '/api/files/' + photoUrl;
        }

        const updatedFormData = { ...formData, photoUrl };
        setFormData(updatedFormData);

        const profileRes = await userAPI.updateProfile(updatedFormData);
        const updatedUser = profileRes.data;
        setUser(updatedUser);
        updateUser(updatedUser);
        setSuccess('Фото успешно обновлено');
        loadProfile();
      }
    } catch (err) {
      setError('Ошибка загрузки фото');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = () => {
    setConfirmModal({
      show: true,
      step: 1,
      onConfirm: async () => {
        try {
          setUploadingPhoto(true);
          setError('');
          const updatedFormData = { ...formData, photoUrl: '' };
          setFormData(updatedFormData);
          const response = await userAPI.updateProfile(updatedFormData);
          const updatedUser = response.data;
          setUser(updatedUser);
          updateUser(updatedUser); // Обновляем пользователя в контексте
          setSuccess('Фото успешно удалено');
          loadProfile();
          setConfirmModal({ show: false, step: 1, onConfirm: null, message: '' });
        } catch (err) {
          setError(err.response?.data?.message || 'Ошибка удаления фото');
          setConfirmModal({ show: false, step: 1, onConfirm: null, message: '' });
        } finally {
          setUploadingPhoto(false);
        }
      },
      message: 'Вы уверены, что хотите удалить фото профиля?'
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
    setOriginalFormData({ ...formData });
  };

  const handleCancel = () => {
    setIsEditing(false);
    if (originalFormData) setFormData({ ...originalFormData });
    setError('');
  };

  const handleDeleteProfile = async () => {
    setConfirmModal({
      show: true,
      step: 1,
      onConfirm: () => {
        setConfirmModal({
          show: true,
          step: 2,
          onConfirm: async () => {
            try {
              setSaving(true);
              await userAPI.deleteProfile();
          setConfirmModal({ show: false, step: 1, onConfirm: null, message: '' });
          setSuccessModal({ show: true, message: 'Ваш профиль успешно удален' });
              setTimeout(() => {
                logout();
              }, 1500);
            } catch (err) {
              const errorMessage = err.response?.data?.message || err.message || 'Ошибка удаления профиля';
              setError(errorMessage);
              setConfirmModal({ show: false, step: 1, onConfirm: null, message: '' });
              console.error('Ошибка удаления профиля:', err);
            } finally {
              setSaving(false);
            }
          }
        });
      }
    });
  };

  const getPhotoUrl = () => {
    const photoUrl = formData.photoUrl || user?.photoUrl;
    if (!photoUrl) return null;
    return fileAbsoluteUrl(photoUrl);
  };

  // Функция для красивого отображения даты
  const formatDate = (dateString) => {
    if (!dateString) return 'Не указана';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  // Функция для форматирования даты регистрации
  const formatRegistrationDate = (dateString) => {
    if (!dateString) return 'Не указана';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  if (loading) return <div className="loading-container">Загрузка...</div>;

  return (
    <div className="form-page form-page--wide profile-page profile-page--modern fade-in">
      <div className="profile-shell">
        <header className="profile-page-toolbar">
          <nav className="profile-breadcrumb" aria-label="Раздел профиля">
            <span className="profile-bc-muted">Мой профиль</span>
            {isEditing && (
              <>
                <span className="profile-bc-sep" aria-hidden="true">
                  /
                </span>
                <span className="profile-bc-active">Редактирование</span>
              </>
            )}
          </nav>
          <div className="profile-toolbar-actions">
            {isEditing && (
              <>
                <button type="button" className="profile-btn-text-cancel" onClick={handleCancel}>
                  Отмена
                </button>
                <button
                  type="submit"
                  form="profile-edit-form"
                  className="profile-btn-save"
                  disabled={saving}
                >
                  {saving ? 'Сохранение…' : 'Сохранить'}
                </button>
              </>
            )}
          </div>
        </header>

        <h1 className="profile-sr-only">Мой профиль</h1>

        {error && <div className="profile-alert profile-alert--error">{error}</div>}
        {success && <div className="profile-alert profile-alert--success">{success}</div>}

        <div className="profile-dashboard-card">
          {!isEditing && (
            <div className="profile-menu-button-top-right">
              <button
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                className="profile-menu-trigger"
                aria-expanded={showMenu}
                aria-label="Меню профиля"
              >
                ⋯
              </button>
              {showMenu && (
                <div className="profile-menu-dropdown">
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      handleEdit();
                    }}
                    className="profile-menu-item"
                  >
                    Редактировать данные
                  </button>
                  {user?.username !== 'admin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowMenu(false);
                        handleDeleteProfile();
                      }}
                      className="profile-menu-item profile-menu-item-danger"
                    >
                      Удалить профиль
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {!isEditing && (
            <div className="profile-header profile-header--modern">
              <div className="profile-photo-container">
                <div className="avatar-wrapper profile-avatar-ring">
                  {getPhotoUrl() ? (
                    <img src={getPhotoUrl()} alt="" className="profile-photo" />
                  ) : (
                    <div className="profile-photo-placeholder">
                      <span>{(user?.username || 'U').trim().charAt(0).toUpperCase()}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="profile-info">
                <h2 className="profile-display-name">{user?.username}</h2>
                <div className="profile-roles">
                  {user?.roles?.map((role) => {
                    const roleName =
                      role === 'ADMIN' ? 'Администратор' : role === 'DESIGNER' ? 'Расчётчик' : role;
                    return (
                      <span key={role} className="role-badge">
                        {roleName}
                      </span>
                    );
                  })}
                </div>
                {user?.createdAt && (
                  <div className="profile-registration-date">
                    Регистрация: {formatRegistrationDate(user.createdAt)}
                  </div>
                )}
              </div>
            </div>
          )}

          {isEditing ? (
            <form id="profile-edit-form" onSubmit={handleSubmit} className="profile-edit-form profile-edit-layout">
              <div className="profile-edit-sidebar">
                <div className="profile-photo-container profile-photo-container--edit">
                  <div className="avatar-wrapper profile-avatar-ring profile-avatar--editable">
                    {getPhotoUrl() ? (
                      <img src={getPhotoUrl()} alt="" className="profile-photo" />
                    ) : (
                      <div className="profile-photo-placeholder">
                        <span>{(user?.username || 'U').trim().charAt(0).toUpperCase()}</span>
                      </div>
                    )}
                    <label className="profile-avatar-edit-badge" htmlFor="photo-upload" title="Загрузить фото">
                      <span aria-hidden="true">✎</span>
                      <input
                        id="photo-upload"
                        type="file"
                        accept="image/*"
                        onChange={handlePhotoUpload}
                        className="profile-sr-only-input"
                      />
                    </label>
                  </div>
                </div>
                <div className="profile-photo-actions">
                  <span className="profile-photo-hint">
                    {uploadingPhoto ? 'Загрузка…' : 'Нажмите на значок, чтобы сменить фото'}
                  </span>
                  {getPhotoUrl() && (
                    <button
                      type="button"
                      onClick={handleDeletePhoto}
                      className="profile-link-danger"
                      disabled={uploadingPhoto}
                    >
                      Удалить фото
                    </button>
                  )}
                </div>
              </div>

              <div className="profile-edit-main">
                <div className="profile-form-grid">
                  <div className="form-group profile-field-modern">
                    <label htmlFor="pf-firstName">Имя</label>
                    <input
                      id="pf-firstName"
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group profile-field-modern">
                    <label htmlFor="pf-lastName">Фамилия</label>
                    <input
                      id="pf-lastName"
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                    />
                  </div>
                  <div className="form-group profile-field-modern profile-field-span-2">
                    <label htmlFor="pf-email">Email *</label>
                    <input
                      id="pf-email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      required
                    />
                    <p className="profile-field-hint">
                      Убедитесь, что адрес указан верно — он используется для уведомлений.
                    </p>
                  </div>
                  <div className="form-group profile-field-modern">
                    <label htmlFor="pf-phone">Телефон</label>
                    <input
                      id="pf-phone"
                      type="tel"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="+375 __ ___-__-__"
                    />
                  </div>
                  <div className="form-group profile-field-modern">
                    <label htmlFor="pf-birth">Дата рождения</label>
                    <input
                      id="pf-birth"
                      type="date"
                      name="birthDate"
                      value={formData.birthDate}
                      onChange={handleChange}
                    />
                  </div>
                </div>

                <div className="profile-form-footer-actions">
                  <button type="submit" className="profile-btn-save profile-btn-save--large" disabled={saving}>
                    {saving ? 'Сохранение…' : 'Сохранить изменения'}
                  </button>
                  <button type="button" className="profile-btn-outline" onClick={handleCancel}>
                    Отмена
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="profile-view-mode">
              <div className="profile-details-grid profile-details-grid--modern">
                <div className="profile-field-modern-readonly">
                  <span className="field-label">Email</span>
                  <span className="field-value">{user?.email || '—'}</span>
                </div>
                <div className="profile-field-modern-readonly">
                  <span className="field-label">Имя</span>
                  <span className="field-value">{user?.firstName || '—'}</span>
                </div>
                <div className="profile-field-modern-readonly">
                  <span className="field-label">Фамилия</span>
                  <span className="field-value">{user?.lastName || '—'}</span>
                </div>
                <div className="profile-field-modern-readonly">
                  <span className="field-label">Телефон</span>
                  <span className="field-value">{user?.phoneNumber || '—'}</span>
                </div>
                <div className="profile-field-modern-readonly">
                  <span className="field-label">Дата рождения</span>
                  <span className="field-value">{formatDate(user?.birthDate)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, step: 1, onConfirm: null, message: '' })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Да"
        cancelText="Отмена"
      >
        <p>{confirmModal.message || (confirmModal.step === 1 
          ? 'Вы уверены, что хотите удалить свой профиль? Это действие нельзя отменить.'
          : 'Это действие удалит ваш профиль и все связанные данные. Продолжить?')}
        </p>
      </Modal>
      <Modal
        show={successModal.show}
        title="Успех"
        type="info"
        onClose={() => setSuccessModal({ show: false, message: '' })}
        cancelText="Ок"
      >
        <p>{successModal.message}</p>
      </Modal>
    </div>
  );
};

export default Profile;