import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { applianceAPI, categoryAPI } from '../api/api';
import ApplianceCardModal from '../components/ApplianceCardModal/ApplianceCardModal';
import ImageModal from '../components/ImageModal/ImageModal';
import Pagination from '../components/UI/Pagination';
import { fileAbsoluteUrl } from '../utils/apiOrigin';
import './Appliances.css';

const Appliances = () => {
  const { isAdmin } = useAuth();
  const [searchParams] = useSearchParams();
  const [appliances, setAppliances] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [showCategoryFilter, setShowCategoryFilter] = useState(false);
  const [selectedAppliance, setSelectedAppliance] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);
  const [selectedImageAlt, setSelectedImageAlt] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(12); // Приборов на странице
  const [priceFrom, setPriceFrom] = useState('');
  const [priceTo, setPriceTo] = useState('');
  const [sortBy, setSortBy] = useState('name'); // 'name', 'price-asc', 'price-desc'
  const [selectedManufacturer, setSelectedManufacturer] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const q = searchParams.get('q');
    if (q != null && q !== '') {
      setSearchTerm(q);
    }
  }, [searchParams]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [appliancesRes, categoriesRes] = await Promise.all([
        applianceAPI.getAll(),
        categoryAPI.getAll().catch(() => ({ data: [] }))
      ]);
      setAppliances(appliancesRes.data || []);
      setCategories(categoriesRes.data || []);
      setError('');
    } catch (err) {
      setError('Ошибка загрузки каталога приборов');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const getImageUrl = (imageUrl) => fileAbsoluteUrl(imageUrl);

  // Получаем все уникальные категории из приборов с подсчетом количества
  const getCategoriesWithCount = () => {
    const categoryMap = new Map();
    
    // Подсчитываем количество приборов по категориям
    appliances.forEach(appliance => {
      if (appliance.categories && appliance.categories.length > 0) {
        appliance.categories.forEach(cat => {
          const catName = cat.name || cat;
          categoryMap.set(catName, (categoryMap.get(catName) || 0) + 1);
        });
      } else if (appliance.category) {
        categoryMap.set(appliance.category, (categoryMap.get(appliance.category) || 0) + 1);
      }
    });
    
    // Также добавляем категории из API (если они еще не добавлены)
    categories.forEach(cat => {
      if (!categoryMap.has(cat.name)) {
        categoryMap.set(cat.name, 0);
      }
    });
    
    // Преобразуем в массив объектов с именем и количеством
    return Array.from(categoryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const availableCategories = getCategoriesWithCount();
  const availableManufacturers = Array.from(
    new Map(
      appliances
        .filter((a) => a.manufacturer?.id)
        .map((a) => [a.manufacturer.id, a.manufacturer])
    ).values()
  ).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));

  const toggleCategory = (categoryName) => {
    setSelectedCategories(prev => {
      if (prev.includes(categoryName)) {
        return prev.filter(cat => cat !== categoryName);
      } else {
        return [...prev, categoryName];
      }
    });
  };

  const clearCategoryFilters = () => {
    setSelectedCategories([]);
  };

  const filteredAppliances = appliances.filter(appliance => {
    // Фильтр по поиску
    const matchesSearch = searchTerm === '' || 
      appliance.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (appliance.description && appliance.description.toLowerCase().includes(searchTerm.toLowerCase()));

    // Фильтр по категориям
    let matchesCategories = true;
    if (selectedCategories.length > 0) {
      const applianceCategories = appliance.categories?.map(c => c.name || c) || 
                                 (appliance.category ? [appliance.category] : []);
      matchesCategories = selectedCategories.some(selectedCat => 
        applianceCategories.includes(selectedCat)
      );
    }

    // Фильтр по цене
    let matchesPrice = true;
    if (priceFrom || priceTo) {
      const appliancePrice = parseFloat(appliance.price) || 0;
      if (priceFrom && appliancePrice < parseFloat(priceFrom)) {
        matchesPrice = false;
      }
      if (priceTo && appliancePrice > parseFloat(priceTo)) {
        matchesPrice = false;
      }
    }

    const matchesManufacturer =
      !selectedManufacturer ||
      String(appliance.manufacturer?.id || '') === selectedManufacturer;

    return matchesSearch && matchesCategories && matchesPrice && matchesManufacturer;
  }).sort((a, b) => {
    // Сортировка
    if (sortBy === 'name') {
      return (a.name || '').localeCompare(b.name || '', 'ru');
    } else if (sortBy === 'price-asc') {
      const priceA = parseFloat(a.price) || 0;
      const priceB = parseFloat(b.price) || 0;
      return priceA - priceB;
    } else if (sortBy === 'price-desc') {
      const priceA = parseFloat(a.price) || 0;
      const priceB = parseFloat(b.price) || 0;
      return priceB - priceA;
    }
    return 0;
  });

  // Сбрасываем страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategories, priceFrom, priceTo, sortBy, selectedManufacturer]);

  // Вычисляем приборы для текущей страницы
  const paginatedAppliances = filteredAppliances.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const handleApplianceClick = async (appliance) => {
    try {
      // Загружаем полную информацию о приборе
      const response = await applianceAPI.getById(appliance.id);
      setSelectedAppliance(response.data);
      setShowModal(true);
    } catch (err) {
      // Если не удалось загрузить, используем данные из списка
      setSelectedAppliance(appliance);
      setShowModal(true);
    }
  };

  const handleImageClick = (e, imageUrl, applianceName) => {
    e.stopPropagation(); // Предотвращаем открытие модального окна прибора
    setSelectedImageUrl(imageUrl);
    setSelectedImageAlt(applianceName);
    setShowImageModal(true);
  };

  if (loading) {
    return (
      <div className="appliances-page fade-in">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Загрузка каталога...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="appliances-page fade-in">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="appliances-page fade-in">
      <div className="appliances-header">
        <div className="header-content">
          <h1>Каталог электроприборов</h1>
          <p className="header-subtitle">Выберите прибор для просмотра подробной информации</p>
        </div>
        {isAdmin() && (
          <div className="admin-actions">
            <Link to="/admin/appliances" className="admin-link-btn">
              Управление приборами
            </Link>
          </div>
        )}
      </div>

      <div className="appliances-filters-section">
        <div className="search-container">
          <div className="search-wrapper">
            <input
              type="text"
              placeholder="Поиск по названию или описанию..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
            {availableCategories.length > 0 && (
              <button
                className={`category-filter-btn ${selectedCategories.length > 0 ? 'active' : ''}`}
                onClick={() => setShowCategoryFilter(!showCategoryFilter)}
              >
                Категории
                {selectedCategories.length > 0 && (
                  <span className="filter-count">{selectedCategories.length}</span>
                )}
              </button>
            )}
          </div>
        </div>
        <div className="filters-row" style={{ display: 'flex', gap: '1rem', marginTop: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <div className="price-filter" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Цена:</label>
            <input
              type="number"
              placeholder="От"
              value={priceFrom}
              onChange={(e) => setPriceFrom(e.target.value)}
              min="0"
              step="0.01"
              style={{ width: '100px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <span>-</span>
            <input
              type="number"
              placeholder="До"
              value={priceTo}
              onChange={(e) => setPriceTo(e.target.value)}
              min="0"
              step="0.01"
              style={{ width: '100px', padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px' }}
            />
          </div>
          <div className="sort-filter" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Сортировка:</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer' }}
            >
              <option value="name">По алфавиту</option>
              <option value="price-asc">По цене (возрастание)</option>
              <option value="price-desc">По цене (убывание)</option>
            </select>
          </div>
          <div className="manufacturer-filter" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem', fontWeight: '500' }}>Изготовитель:</label>
            <select
              value={selectedManufacturer}
              onChange={(e) => setSelectedManufacturer(e.target.value)}
              style={{ padding: '0.5rem', border: '1px solid #ddd', borderRadius: '4px', cursor: 'pointer', minWidth: '220px' }}
            >
              <option value="">Все изготовители</option>
              {availableManufacturers.map((manufacturer) => (
                <option key={manufacturer.id} value={String(manufacturer.id)}>
                  {manufacturer.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {showCategoryFilter && availableCategories.length > 0 && (
          <div className="category-filter-dropdown">
            <div className="filter-header">
              <h4>Фильтр по категориям</h4>
              {selectedCategories.length > 0 && (
                <button onClick={clearCategoryFilters} className="clear-filters-btn">
                  Очистить все
                </button>
              )}
            </div>
            <div className="category-checkboxes">
              {availableCategories.map((category) => (
                <label key={category.name} className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category.name)}
                    onChange={() => toggleCategory(category.name)}
                  />
                  <span className="checkbox-label">
                    {category.name}
                    <span className="category-count">({category.count})</span>
                  </span>
                </label>
              ))}
            </div>
            {selectedCategories.length > 0 && (
              <div className="selected-categories">
                <span className="selected-label">Выбрано:</span>
                <div className="selected-tags">
                  {selectedCategories.map(cat => (
                    <span key={cat} className="selected-tag">
                      {cat}
                      <button onClick={() => toggleCategory(cat)} className="remove-tag">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="results-info">
        <p>
          Найдено приборов: <strong>{filteredAppliances.length}</strong>
          {selectedCategories.length > 0 && (
            <span className="filter-info">
              {' '}по категориям: {selectedCategories.join(', ')}
            </span>
          )}
        </p>
      </div>

      <div className="appliances-grid">
        {filteredAppliances.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"></div>
            <h3>Приборы не найдены</h3>
            <p>Попробуйте изменить параметры поиска или фильтры</p>
          </div>
        ) : (
          paginatedAppliances.map((appliance) => {
            const imageUrl = getImageUrl(appliance.imageUrl);
            const applianceCategories = appliance.categories?.map(c => c.name || c) || 
                                       (appliance.category ? [appliance.category] : []);
            
            return (
              <div 
                key={appliance.id} 
                className="appliance-card"
                onClick={() => handleApplianceClick(appliance)}
              >
                <div className="appliance-image-container">
                  {imageUrl ? (
                    <>
                      <img 
                        src={imageUrl} 
                        alt={appliance.name} 
                        className="appliance-image"
                        onClick={(e) => handleImageClick(e, imageUrl, appliance.name)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const placeholder = e.target.parentElement.querySelector('.appliance-image-placeholder');
                          if (placeholder) {
                            placeholder.style.display = 'flex';
                          }
                        }}
                      />
                      <div className="appliance-image-placeholder" style={{ display: 'none' }}>
                      </div>
                      <div className="image-zoom-hint" title="Нажмите для просмотра в полном размере">
                        🔍
                      </div>
                    </>
                  ) : (
                    <div className="appliance-image-placeholder">
                    </div>
                  )}
                </div>
                <div className="appliance-content">
                  <div className="appliance-card-title-row">
                    <h3>{appliance.name}</h3>
                    {appliance.manufacturer?.name && (
                      <span className="appliance-card-manufacturer" title="Изготовитель">
                        {appliance.manufacturer.name}
                      </span>
                    )}
                  </div>
                  {appliance.description && (
                    <p className="appliance-description">
                      {appliance.description.length > 100 
                        ? appliance.description.substring(0, 100) + '...' 
                        : appliance.description}
                    </p>
                  )}
                  <div className="appliance-specs">
                    {appliance.powerConsumption && (
                      <div className="spec-item">
                        <span className="spec-label">Мощность:</span>
                        <span className="spec-value">{appliance.powerConsumption} Вт</span>
                      </div>
                    )}
                    {appliance.voltage && (
                      <div className="spec-item">
                        <span className="spec-label">Напряжение:</span>
                        <span className="spec-value">{appliance.voltage} В</span>
                      </div>
                    )}
                    {appliance.price && (
                      <div className="spec-item">
                        <span className="spec-label">Цена:</span>
                        <span className="spec-value" style={{ color: '#28a745', fontWeight: 'bold' }}>
                          {parseFloat(appliance.price).toFixed(2)} BYN
                        </span>
                      </div>
                    )}
                    {applianceCategories.length > 0 && (
                      <div className="spec-item categories-item">
                        <span className="spec-label">Категории:</span>
                        <div className="categories-badges-inline">
                          <span className="category-badge">
                            {applianceCategories[0]}
                          </span>
                          {applianceCategories.length > 1 && (
                            <span className="category-badge more" title={`Еще ${applianceCategories.length - 1} категорий: ${applianceCategories.slice(1).join(', ')}`}>
                              ...
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="view-details">
                    <span>Нажмите для просмотра →</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {filteredAppliances.length > 0 && (
        <Pagination
          currentPage={currentPage}
          totalPages={Math.ceil(filteredAppliances.length / itemsPerPage)}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={filteredAppliances.length}
        />
      )}

      <ApplianceCardModal
        appliance={selectedAppliance}
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setSelectedAppliance(null);
        }}
      />
      <ImageModal
        show={showImageModal}
        imageUrl={selectedImageUrl}
        alt={selectedImageAlt}
        onClose={() => {
          setShowImageModal(false);
          setSelectedImageUrl(null);
          setSelectedImageAlt('');
        }}
      />
    </div>
  );
};

export default Appliances;
