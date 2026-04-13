import React, { useState, useEffect, useRef, useCallback } from 'react';
import { adminAPI, fileAPI, categoryAPI, manufacturerAPI } from '../../api/api';
import { fileAbsoluteUrl } from '../../utils/apiOrigin';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import Modal from '../../components/UI/Modal';
import Pagination from '../../components/UI/Pagination';
import './Admin.css';

const AdminAppliances = () => {
  const [appliances, setAppliances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAppliance, setEditingAppliance] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ show: false, message: '', onConfirm: null });
  const [errorModal, setErrorModal] = useState({ show: false, message: '' });
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20); // Приборов на странице
  const [totalItems, setTotalItems] = useState(0);
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isFirstLoad, setIsFirstLoad] = useState(true);
  const [categories, setCategories] = useState([]);
  const [importResult, setImportResult] = useState(null);
  const [pendingImportFile, setPendingImportFile] = useState(null);
  const [showImportPreview, setShowImportPreview] = useState(false);
  const excelImportRef = useRef(null);

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      const response = await categoryAPI.getAll();
      setCategories(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки категорий:', err);
    }
  };

  const loadAppliances = useCallback(async () => {
    if (isFirstLoad) {
      setLoading(true);
    }
    try {
      const response = await adminAPI.getAllAppliances({
        page: currentPage - 1,
        size: itemsPerPage,
        search: searchQuery.trim() || undefined,
        category: selectedCategory || undefined,
        sortBy,
        sortDir,
        priceFrom: priceFrom !== '' ? priceFrom : undefined,
        priceTo: priceTo !== '' ? priceTo : undefined
      });
      setAppliances(response.data);
      const totalCountHeader = response.headers?.['x-total-count'];
      setTotalItems(totalCountHeader ? Number(totalCountHeader) : response.data.length);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки приборов');
    } finally {
      if (isFirstLoad) {
        setLoading(false);
        setIsFirstLoad(false);
      }
    }
  }, [
    currentPage,
    itemsPerPage,
    searchQuery,
    selectedCategory,
    sortBy,
    sortDir,
    priceFrom,
    priceTo,
    isFirstLoad
  ]);

  useEffect(() => {
    loadAppliances();
  }, [loadAppliances]);

  const handleDelete = async (id) => {
    setConfirmModal({
      show: true,
      message: 'Удалить прибор?',
      onConfirm: async () => {
        try {
          await adminAPI.deleteAppliance(id);
          loadAppliances();
          setConfirmModal({ show: false, message: '', onConfirm: null });
        } catch (err) {
          setConfirmModal({ show: false, message: '', onConfirm: null });
          setErrorModal({ show: true, message: 'Ошибка удаления прибора' });
        }
      }
    });
  };

  const handleEdit = (appliance) => {
    setEditingAppliance(appliance);
    setShowForm(true);
  };

  const downloadAppliancesExcel = async () => {
    try {
      const res = await adminAPI.exportAppliancesExcel();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'appliances.xlsx';
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setErrorModal({ show: true, message: 'Ошибка экспорта Excel' });
    }
  };

  const onAppliancesExcelImport = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPendingImportFile(file);
    setShowImportPreview(true);
  };

  const confirmAppliancesExcelImport = async () => {
    if (!pendingImportFile) return;
    try {
      const res = await adminAPI.importAppliancesExcel(pendingImportFile);
      setImportResult(res.data);
      setShowImportPreview(false);
      setPendingImportFile(null);
      loadAppliances();
    } catch (err) {
      setShowImportPreview(false);
      setPendingImportFile(null);
      setErrorModal({ show: true, message: 'Ошибка импорта Excel' });
    }
  };

  // Сбрасываем страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, priceFrom, priceTo, sortBy, sortDir, selectedCategory]);

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

  if (loading) return <div>Загрузка...</div>;
  if (error) return <div className="error">{error}</div>;

  return (
    <div className="admin-page appliances-page">
      <AdminNavPanel />
      <div className="page-header">
        <h1>Управление электроприборами</h1>
        <button onClick={() => setShowForm(true)} className="btn-primary btn-primary-wide">
          Создать прибор
        </button>
      </div>
      <div className="admin-search-container">
        <input
          type="text"
          placeholder="Поиск по названию, модели, характеристикам..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="admin-search-input"
        />
      </div>
      <div className="appliances-filters-row">
        <div className="appliances-filter-group">
          <label className="appliances-filter-label">Цена:</label>
          <input
            type="number"
            placeholder="От"
            value={priceFrom}
            onChange={(e) => setPriceFrom(e.target.value)}
            min="0"
            step="0.01"
            className="admin-search-input appliances-filter-input-sm"
          />
          <span className="appliances-filter-separator">-</span>
          <input
            type="number"
            placeholder="До"
            value={priceTo}
            onChange={(e) => setPriceTo(e.target.value)}
            min="0"
            step="0.01"
            className="admin-search-input appliances-filter-input-sm"
          />
        </div>
        <div className="appliances-filter-group">
          <label className="appliances-filter-label">Категория:</label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="admin-search-input appliances-filter-select"
          >
            <option value="">Все категории</option>
            {categories.map(cat => (
              <option key={cat.id} value={cat.name}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div className="appliances-filter-group">
          <label className="appliances-filter-label">Сортировка:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="admin-search-input appliances-filter-select"
          >
            <option value="name">Название</option>
            <option value="powerConsumption">Мощность</option>
            <option value="voltage">Напряжение</option>
            <option value="current">Ток</option>
            <option value="price">Цена</option>
            <option value="model">Модель</option>
            <option value="ipRating">IP</option>
            <option value="categories">Категории</option>
            <option value="manufacturer">Изготовитель</option>
          </select>
          <select
            value={sortDir}
            onChange={(e) => setSortDir(e.target.value)}
            className="admin-search-input appliances-filter-select"
          >
            <option value="asc">По возрастанию</option>
            <option value="desc">По убыванию</option>
          </select>
        </div>
        <div className="appliances-filters-spacer" />
        <div className="appliances-excel-actions">
          <button type="button" className="btn-excel" onClick={downloadAppliancesExcel}>
            Экспорт Excel
          </button>
          <button type="button" className="btn-excel" onClick={() => excelImportRef.current?.click()}>
            Импорт Excel
          </button>
          <input
            ref={excelImportRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: 'none' }}
            onChange={onAppliancesExcelImport}
          />
        </div>
      </div>
      {showForm && (
        <ApplianceForm
          appliance={editingAppliance}
          onClose={() => {
            setShowForm(false);
            setEditingAppliance(null);
          }}
          onSuccess={() => {
            loadAppliances();
            // Форма сама обновит список категорий после сохранения
          }}
        />
      )}
      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('name')}>Название{getSortIndicator('name')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('powerConsumption')}>Мощность (Вт){getSortIndicator('powerConsumption')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('voltage')}>Напряжение (В){getSortIndicator('voltage')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('current')}>Ток (А){getSortIndicator('current')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('price')}>Цена (BYN){getSortIndicator('price')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('model')}>Модель{getSortIndicator('model')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('ipRating')}>IP{getSortIndicator('ipRating')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('categories')}>Категории{getSortIndicator('categories')}</th>
              <th style={{ cursor: 'pointer' }} onClick={() => toggleSort('manufacturer')}>Изготовитель{getSortIndicator('manufacturer')}</th>
              <th>Действия</th>
            </tr>
          </thead>
          <tbody>
            {appliances.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
                  {searchQuery ? 'Приборы не найдены' : 'Нет приборов'}
                </td>
              </tr>
            ) : (
              appliances.map((appliance) => (
              <ApplianceRow 
                key={appliance.id} 
                appliance={appliance}
                onEdit={handleEdit}
                onDelete={handleDelete}
              />
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
      
      <Modal
        show={confirmModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setConfirmModal({ show: false, message: '', onConfirm: null })}
        onConfirm={confirmModal.onConfirm}
        confirmText="Да"
        cancelText="Отмена"
      >
        <p>{confirmModal.message}</p>
      </Modal>
      <Modal
        show={errorModal.show}
        title="Ошибка"
        type="info"
        onClose={() => setErrorModal({ show: false, message: '' })}
        cancelText="Ок"
      >
        <p>{errorModal.message}</p>
      </Modal>
      <Modal
        show={!!importResult}
        title="Результат импорта Excel"
        type="info"
        onClose={() => setImportResult(null)}
        cancelText="Закрыть"
      >
        {importResult && (
          <div>
            <p>
              Создано: {importResult.created}, обновлено: {importResult.updated}, пропущено:{' '}
              {importResult.skipped}
            </p>
            {importResult.errors?.length > 0 && (
              <ul className="import-errors">
                {importResult.errors.slice(0, 40).map((er, i) => (
                  <li key={i}>
                    Строка {er.rowNumber}: {er.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>
      <Modal
        show={showImportPreview}
        title="Предпросмотр импорта Excel"
        type="confirm"
        onClose={() => {
          setShowImportPreview(false);
          setPendingImportFile(null);
        }}
        onConfirm={confirmAppliancesExcelImport}
        confirmText="Импортировать"
        cancelText="Отмена"
      >
        <p><strong>Файл:</strong> {pendingImportFile?.name || '—'}</p>
        <p style={{ marginTop: '0.65rem' }}>
          Excel: только <strong>.xlsx</strong>, заголовки как в экспорте. Обязательны колонки
          {' '}<code>name</code> и <code>powerConsumption</code>. Производитель:
          {' '}<code>manufacturerId</code> или существующий <code>manufacturerName</code>.
        </p>
      </Modal>
    </div>
  );
};

// Компонент строки таблицы с категориями
const ApplianceRow = ({ appliance, onEdit, onDelete }) => {
  const [showCategoriesModal, setShowCategoriesModal] = useState(false);
  
  // Получаем список категорий
  const getCategories = () => {
    if (appliance.categories && appliance.categories.length > 0) {
      return appliance.categories.map(cat => typeof cat === 'object' ? cat.name : cat);
    }
    if (appliance.category) {
      return [appliance.category];
    }
    return [];
  };

  const categories = getCategories();
  const MAX_VISIBLE_CATEGORIES = 2;
  const visibleCategories = categories.slice(0, MAX_VISIBLE_CATEGORIES);
  const hiddenCategories = categories.slice(MAX_VISIBLE_CATEGORIES);

  return (
    <>
      <tr>
        <td>{appliance.name}</td>
        <td>{appliance.powerConsumption || '-'}</td>
        <td>{appliance.voltage || '-'}</td>
        <td>{appliance.current || '-'}</td>
        <td className="text-right">{appliance.price ? parseFloat(appliance.price).toFixed(2) : '-'}</td>
        <td>{appliance.model || '-'}</td>
        <td>{appliance.ipRating || '-'}</td>
        <td>
          <div className="categories-display">
            {categories.length === 0 ? (
              <span className="no-categories">-</span>
            ) : (
              <>
                <div className="categories-preview">
                  {visibleCategories.map((cat, idx) => (
                    <span key={idx} className="category-badge-small">
                      {cat}
                    </span>
                  ))}
                  {hiddenCategories.length > 0 && (
                    <span 
                      className="category-more"
                      onClick={() => setShowCategoriesModal(true)}
                      title={`Ещё ${hiddenCategories.length} категорий. Нажмите для просмотра всех.`}
                    >
                      +{hiddenCategories.length}
                    </span>
                  )}
                </div>
                {categories.length > 0 && (
                  <span 
                    className="category-click-hint"
                    onClick={() => setShowCategoriesModal(true)}
                    title="Нажмите для просмотра всех категорий"
                  >
                    (показать все)
                  </span>
                )}
              </>
            )}
          </div>
        </td>
        <td>{appliance.manufacturer?.name || '—'}</td>
        <td className="actions-cell">
          <button onClick={() => onEdit(appliance)} className="btn-secondary">
            Редактировать
          </button>
          <button onClick={() => onDelete(appliance.id)} className="btn-danger">
            Удалить
          </button>
        </td>
      </tr>
      {showCategoriesModal && (
        <Modal
          show={showCategoriesModal}
          onClose={() => setShowCategoriesModal(false)}
          title={`Категории прибора: ${appliance.name}`}
          type="info"
          cancelText="Закрыть"
        >
          <div className="categories-modal-content">
            {categories.length === 0 ? (
              <p>У прибора нет категорий</p>
            ) : (
              <div className="categories-list-full">
                {categories.map((cat, idx) => (
                  <span key={idx} className="category-badge-full">
                    {cat}
                  </span>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
};

const ApplianceForm = ({ appliance, onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    powerConsumption: '',
    voltage: '',
    current: '',
    category: '',
    imageUrl: '',
    width: '',
    height: '',
    price: '',
    model: '',
    ipRating: '',
    color: '',
    cableBrand: '',
    cableCrossSection: '',
    categoryIds: [],
    newCategoryNames: [],
    manufacturerId: '',
  });
  const [categories, setCategories] = useState([]);
  const [manufacturers, setManufacturers] = useState([]);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [error, setError] = useState('');
  const [alertModal, setAlertModal] = useState({ show: false, message: '' });
  const [deleteCategoryModal, setDeleteCategoryModal] = useState({ show: false, categoryId: null, categoryName: '', onConfirm: null });

  useEffect(() => {
    loadCategories();
    loadManufacturers();
  }, []);

  const loadManufacturers = async () => {
    try {
      const res = await manufacturerAPI.list();
      setManufacturers(res.data || []);
    } catch (e) {
      console.warn('Не удалось загрузить производителей', e);
    }
  };

  // Обновляем список категорий при изменении appliance (при открытии формы редактирования)
  useEffect(() => {
    if (appliance) {
      loadCategories();
    }
  }, [appliance]);

  useEffect(() => {
    if (appliance) {
      const categoryIds = appliance.categories 
        ? appliance.categories.map(cat => (typeof cat === 'object' ? cat.id : cat))
        : [];
      setFormData({
        name: appliance.name || '',
        description: appliance.description || '',
        powerConsumption: appliance.powerConsumption || '',
        voltage: appliance.voltage || '',
        current: appliance.current || '',
        category: appliance.category || '',
        imageUrl: appliance.imageUrl || '',
        width: appliance.width || '',
        height: appliance.height || '',
        price: appliance.price || '',
        model: appliance.model || '',
        ipRating: appliance.ipRating || '',
        color: appliance.color || '',
        cableBrand: appliance.cableBrand || '',
        cableCrossSection: appliance.cableCrossSection || '',
        categoryIds: categoryIds || [],
        newCategoryNames: [], // Инициализируем пустым массивом
        manufacturerId: appliance.manufacturer?.id != null ? String(appliance.manufacturer.id) : '',
      });
    } else {
      // При создании нового прибора сбрасываем форму
      setFormData({
        name: '',
        description: '',
        powerConsumption: '',
        voltage: '',
        current: '',
        category: '',
        imageUrl: '',
        width: '',
        height: '',
        price: '',
        model: '',
        ipRating: '',
        color: '',
        cableBrand: '',
        cableCrossSection: '',
        categoryIds: [],
        newCategoryNames: [],
        manufacturerId: '',
      });
      setNewCategoryInput('');
    }
  }, [appliance]);

  const loadCategories = async () => {
    try {
      const response = await categoryAPI.getAll();
      setCategories(response.data || []);
    } catch (err) {
      console.error('Ошибка загрузки категорий:', err);
    }
  };

  const handleAddNewCategory = async () => {
    const trimmedName = newCategoryInput.trim();
    if (!trimmedName || (formData.newCategoryNames || []).includes(trimmedName)) {
      return;
    }

    // Проверяем, не существует ли уже такая категория
    const existingCategory = categories.find(cat => cat.name.toLowerCase() === trimmedName.toLowerCase());
    if (existingCategory) {
      setAlertModal({ show: true, message: `Категория "${trimmedName}" уже существует. Выберите её из списка выше.` });
      setNewCategoryInput('');
      return;
    }

    try {
      // Сразу создаем категорию в БД
      const response = await categoryAPI.create({ name: trimmedName });
      const newCategory = response.data;
      console.log('Категория создана в БД:', newCategory);

      // Обновляем список категорий в форме
      setCategories(prev => [...prev, newCategory]);

      // Добавляем категорию в newCategoryNames и автоматически выбираем её
      setFormData(prev => ({
        ...prev,
        newCategoryNames: [...(prev.newCategoryNames || []), trimmedName],
        categoryIds: [...(prev.categoryIds || []), newCategory.id]
      }));

      setNewCategoryInput('');
      console.log('Категория добавлена и выбрана:', trimmedName);
    } catch (err) {
      console.error('Ошибка создания категории:', err);
      const errorMessage = err.response?.data?.message || 'Ошибка создания категории';
      setAlertModal({ show: true, message: errorMessage });
    }
  };

  const handleRemoveNewCategory = async (categoryName) => {
    // Находим категорию в списке
    const categoryToRemove = categories.find(cat => cat.name === categoryName);
    
    if (categoryToRemove) {
      // Если категория существует в БД, пытаемся удалить её
      // Но только если она не используется в других приборах
      try {
        await categoryAPI.delete(categoryToRemove.id);
        console.log('Категория удалена из БД:', categoryName);
        
        // Обновляем список категорий
        setCategories(prev => prev.filter(cat => cat.id !== categoryToRemove.id));
      } catch (err) {
        // Если категория используется в приборах, просто удаляем из newCategoryNames
        if (err.response?.status === 400 || err.response?.status === 409) {
          console.log('Категория используется в приборах, не удаляем из БД');
        } else {
          console.error('Ошибка удаления категории:', err);
        }
      }
    }

    // Удаляем из newCategoryNames
    setFormData(prev => ({
      ...prev,
      newCategoryNames: (prev.newCategoryNames || []).filter(name => name !== categoryName),
      // Также убираем из выбранных, если была выбрана
      categoryIds: (prev.categoryIds || []).filter(id => {
        const cat = categories.find(c => c.id === id);
        return !cat || cat.name !== categoryName;
      })
    }));
  };

  const handleDeleteCategory = async (categoryId, categoryName) => {
    setDeleteCategoryModal({
      show: true,
      categoryId,
      categoryName,
      onConfirm: async () => {
        try {
          await categoryAPI.delete(categoryId);
          await loadCategories();
          // Убираем категорию из выбранных, если она была выбрана
          setFormData(prev => ({
            ...prev,
            categoryIds: prev.categoryIds.filter(id => id !== categoryId)
          }));
          setDeleteCategoryModal({ show: false, categoryId: null, categoryName: '', onConfirm: null });
        } catch (err) {
          setDeleteCategoryModal({ show: false, categoryId: null, categoryName: '', onConfirm: null });
          setAlertModal({ show: true, message: err.response?.data?.message || 'Ошибка удаления категории. Возможно, существуют приборы с этой категорией.' });
        }
      }
    });
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
      const response = await fileAPI.upload(file, 'appliances');
      console.log('Полный ответ от сервера (прибор):', response);
      console.log('response.data:', response.data);
      console.log('response.data.data:', response.data.data);
      
      // Проверяем структуру ответа
      let imageUrl = null;
      if (response.data && response.data.data) {
        imageUrl = typeof response.data.data === 'string' 
          ? response.data.data 
          : String(response.data.data);
      } else if (response.data && typeof response.data === 'string') {
        imageUrl = response.data;
      }
      
      console.log('Извлеченный imageUrl:', imageUrl);
      
      if (imageUrl) {
        // Убеждаемся, что URL правильный формат
        if (!imageUrl.startsWith('/api/files/') && !imageUrl.startsWith('http')) {
          imageUrl = '/api/files/' + imageUrl;
        }
        console.log('Финальный imageUrl для сохранения:', imageUrl);
        setFormData({ ...formData, imageUrl });
      } else {
        console.error('Не удалось получить URL из ответа. Полный ответ:', JSON.stringify(response, null, 2));
        setError('Не удалось получить URL загруженного файла');
      }
    } catch (err) {
      console.error('Ошибка загрузки фото прибора:', err);
      setError('Ошибка загрузки фото: ' + (err.response?.data?.message || err.message));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleCategoryChange = (categoryId) => {
    setFormData(prev => {
      const categoryIds = prev.categoryIds || [];
      if (categoryIds.includes(categoryId)) {
        return { ...prev, categoryIds: categoryIds.filter(id => id !== categoryId) };
      } else {
        return { ...prev, categoryIds: [...categoryIds, categoryId] };
      }
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // newCategoryNames больше не нужны, так как категории уже созданы в БД при добавлении
    // Оставляем только categoryIds
    const submitData = {
      name: formData.name,
      description: formData.description || null,
      powerConsumption: formData.powerConsumption ? Number(formData.powerConsumption) : null,
      voltage: formData.voltage ? Number(formData.voltage) : null,
      current: formData.current ? Number(formData.current) : null,
      width: formData.width ? Number(formData.width) : null,
      height: formData.height ? Number(formData.height) : null,
      imageUrl: formData.imageUrl || null,
      price: formData.price ? Number(formData.price) : null,
      model: formData.model || null,
      ipRating: formData.ipRating || null,
      color: formData.color || null,
      cableBrand: formData.cableBrand || null,
      cableCrossSection: formData.cableCrossSection || null,
      category: formData.category || null, // Для обратной совместимости
      categoryIds: (formData.categoryIds && formData.categoryIds.length > 0) ? formData.categoryIds : null,
      // newCategoryNames больше не отправляем, так как категории уже созданы в БД
      newCategoryNames: null,
      manufacturerId:
        formData.manufacturerId !== '' && formData.manufacturerId != null
          ? Number(formData.manufacturerId)
          : null,
    };

    // Логируем данные для отладки
    console.log('=== Отправка данных прибора ===');
    console.log('formData:', formData);
    console.log('submitData:', submitData);
    console.log('categoryIds в formData:', formData.categoryIds);
    console.log('categoryIds в submitData:', submitData.categoryIds);

    try {
      let response;
      if (appliance) {
        response = await adminAPI.updateAppliance(appliance.id, submitData);
      } else {
        response = await adminAPI.createAppliance(submitData);
      }
      console.log('Ответ от сервера:', response.data);
      
      // Обновляем список категорий после создания/обновления прибора
      // Категории уже созданы в БД при добавлении, поэтому задержка не нужна
      await loadCategories();
      console.log('Список категорий обновлен');
      
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Ошибка сохранения прибора:', err);
      console.error('Детали ошибки:', err.response?.data);
      setError(err.response?.data?.message || 'Ошибка сохранения прибора');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay appliance-form-overlay">
      <div className="modal-content appliance-form-sheet">
        <h2>{appliance ? 'Редактировать прибор' : 'Создать прибор'}</h2>
        {error && <div className="error-message">{error}</div>}
        <form onSubmit={handleSubmit}>
          <div className="appliance-form-portrait">
            <div className="appliance-form-col appliance-form-col-left">
          <div className="form-group">
            <label>Название *</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              maxLength={100}
            />
          </div>
          <div className="form-group">
            <label>Описание</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              maxLength={500}
            />
          </div>
          <div className="form-group">
            <label>Мощность (Вт) *</label>
            <input
              type="number"
              name="powerConsumption"
              value={formData.powerConsumption}
              onChange={handleChange}
              required
              min="0.01"
              step="0.01"
            />
          </div>
          <div className="form-group">
            <label>Напряжение (В)</label>
            <input
              type="number"
              name="voltage"
              value={formData.voltage}
              onChange={handleChange}
              min="0"
              step="1"
            />
          </div>
          <div className="form-group">
            <label>Ток (А)</label>
            <input
              type="number"
              name="current"
              value={formData.current}
              onChange={handleChange}
              min="0"
              step="0.1"
            />
          </div>
          <div className="form-group">
            <label>Категории</label>
            <div className="category-select-container">
              {categories.length === 0 ? (
                <p style={{ opacity: 0.6, fontSize: '0.9rem' }}>Загрузка категорий...</p>
              ) : (
                categories.map((category) => (
                  <div key={category.id} className="category-item-with-delete">
                    <label className="category-checkbox-label">
                      <input
                        type="checkbox"
                        checked={formData.categoryIds?.includes(category.id) || false}
                        onChange={() => handleCategoryChange(category.id)}
                      />
                      <span>{category.name}</span>
                    </label>
                    <button
                      type="button"
                      className="category-delete-btn"
                      onClick={() => handleDeleteCategory(category.id, category.name)}
                      title="Удалить категорию"
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>
            
            <div className="new-category-section">
              <label>Создать новые категории</label>
              <div className="new-category-input-group">
                <input
                  type="text"
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddNewCategory()}
                  placeholder="Введите название категории и нажмите Enter"
                  maxLength={100}
                />
                <button
                  type="button"
                  onClick={handleAddNewCategory}
                  className="btn-add-category"
                  disabled={!newCategoryInput.trim()}
                >
                  Добавить
                </button>
              </div>
              {/* Убрано отображение новых категорий снизу - они видны только в блоке Категории */}
              {false && (formData.newCategoryNames || []).length > 0 && (
                <div className="new-categories-list">
                  {(formData.newCategoryNames || []).map((name, index) => (
                    <span key={index} className="new-category-badge">
                      {name}
                      <button
                        type="button"
                        onClick={() => handleRemoveNewCategory(name)}
                        className="remove-category-btn"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div className="form-group">
            <label>Цена (BYN)</label>
            <input
              type="number"
              name="price"
              value={formData.price}
              onChange={handleChange}
              min="0"
              step="0.01"
              placeholder="Например: 1500.00"
            />
          </div>
            </div>
            <div className="appliance-form-col appliance-form-col-right">
          <div className="form-group">
            <label>Фото прибора</label>
            <div className="appliance-photo-panel">
              {formData.imageUrl ? (
                <img
                  src={fileAbsoluteUrl(formData.imageUrl) || ''}
                  alt="Фото прибора"
                  className="appliance-photo-preview"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="appliance-photo-empty">Изображение не выбрано</div>
              )}
            </div>
            <label htmlFor="appliance-photo-upload" className="photo-upload-label" style={{ display: 'inline-block', cursor: 'pointer' }}>
              {uploadingPhoto ? 'Загрузка...' : '📷 Загрузить фото'}
              <input
                id="appliance-photo-upload"
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                style={{ display: 'none' }}
                disabled={uploadingPhoto}
              />
            </label>
          </div>
          <div className="form-group">
            <label>Изготовитель (производитель)</label>
            <select
              value={formData.manufacturerId}
              onChange={(e) => setFormData({ ...formData, manufacturerId: e.target.value })}
            >
              <option value="">— не выбран —</option>
              {manufacturers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <p className="form-hint-small">Создавайте производителей в разделе «Производители» админ-панели.</p>
          </div>
          <div className="form-group">
            <label>Модель</label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              maxLength={100}
              placeholder="Например: LG F2J5NS3W"
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Степень защиты IP</label>
              <input
                type="text"
                name="ipRating"
                value={formData.ipRating}
                onChange={handleChange}
                maxLength={10}
                placeholder="Например: IP54"
              />
            </div>
            <div className="form-group">
              <label>Цвет</label>
              <input
                type="text"
                name="color"
                value={formData.color}
                onChange={handleChange}
                maxLength={50}
                placeholder="Например: Белый"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Марка кабеля</label>
              <input
                type="text"
                name="cableBrand"
                value={formData.cableBrand}
                onChange={handleChange}
                maxLength={100}
                placeholder="Например: ВВГ"
              />
            </div>
            <div className="form-group">
              <label>Сечение кабеля</label>
              <input
                type="text"
                name="cableCrossSection"
                value={formData.cableCrossSection}
                onChange={handleChange}
                maxLength={20}
                placeholder="Например: 2.5 мм²"
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Ширина (см)</label>
              <input
                type="number"
                name="width"
                value={formData.width}
                onChange={handleChange}
                min="1"
                step="1"
                placeholder="Например: 60"
              />
            </div>
            <div className="form-group">
              <label>Высота (см)</label>
              <input
                type="number"
                name="height"
                value={formData.height}
                onChange={handleChange}
                min="1"
                step="1"
                placeholder="Например: 40"
              />
            </div>
          </div>
            </div>
          </div>
          <div className="form-actions">
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Сохранение...' : 'Сохранить'}
            </button>
            <button type="button" onClick={onClose} className="btn-secondary">
              Отмена
            </button>
          </div>
        </form>
      </div>
      <Modal
        show={alertModal.show}
        title="Информация"
        type="info"
        onClose={() => setAlertModal({ show: false, message: '' })}
        cancelText="Ок"
      >
        <p>{alertModal.message}</p>
      </Modal>
      <Modal
        show={deleteCategoryModal.show}
        title="Подтверждение"
        type="confirm"
        onClose={() => setDeleteCategoryModal({ show: false, categoryId: null, categoryName: '', onConfirm: null })}
        onConfirm={deleteCategoryModal.onConfirm}
        confirmText="Удалить"
        cancelText="Отмена"
      >
        <p>Удалить категорию "{deleteCategoryModal.categoryName}"? Это действие нельзя отменить.</p>
      </Modal>
    </div>
  );
};

export default AdminAppliances;

