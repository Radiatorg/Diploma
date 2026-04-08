import React, { useState, useEffect } from 'react';
import { electricalSymbolAPI } from '../../api/api';
import './ElectricalSymbolsLibrary.css';

const ElectricalSymbolsLibrary = ({ onSymbolSelect, selectedType = null }) => {
  const [symbols, setSymbols] = useState([]);
  const [filteredSymbols, setFilteredSymbols] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ type: selectedType, category: null });

  useEffect(() => {
    loadSymbols();
  }, []);

  useEffect(() => {
    filterSymbols();
  }, [symbols, filter]);

  const loadSymbols = async () => {
    try {
      const response = await electricalSymbolAPI.getAll();
      setSymbols(response.data);
    } catch (err) {
      console.error('Ошибка загрузки символов:', err);
    } finally {
      setLoading(false);
    }
  };

  const filterSymbols = () => {
    let filtered = symbols;

    if (filter.type) {
      filtered = filtered.filter(s => s.type === filter.type);
    }

    if (filter.category) {
      filtered = filtered.filter(s => s.category === filter.category);
    }

    setFilteredSymbols(filtered);
  };

  const getSymbolIcon = (symbol) => {
    if (symbol.svgPath) {
      return (
        <svg width="24" height="24" viewBox="0 0 24 24">
          <path d={symbol.svgPath} fill="currentColor" />
        </svg>
      );
    }

    // Простые геометрические фигуры вместо эмодзи
    const getDefaultIcon = (type) => {
      switch(type) {
        case 'outlet':
          return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="8" width="12" height="8" rx="1" stroke="currentColor" fill="none" strokeWidth="2"/>
              <circle cx="10" cy="12" r="1.5" fill="currentColor"/>
              <circle cx="14" cy="12" r="1.5" fill="currentColor"/>
            </svg>
          );
        case 'switch':
          return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="8" y="6" width="8" height="12" rx="2" stroke="currentColor" fill="none" strokeWidth="2"/>
              <circle cx="12" cy="12" r="2" fill="currentColor"/>
            </svg>
          );
        case 'light':
          return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="10" r="4" stroke="currentColor" fill="none" strokeWidth="2"/>
              <line x1="12" y1="14" x2="12" y2="20" stroke="currentColor" strokeWidth="2"/>
            </svg>
          );
        case 'panel':
          return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" fill="none" strokeWidth="2"/>
              <line x1="8" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="2"/>
              <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          );
        case 'junction_box':
          return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="1" stroke="currentColor" fill="none" strokeWidth="2"/>
              <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="2"/>
              <line x1="6" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="2"/>
            </svg>
          );
        default:
          return (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
              <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" fill="none" strokeWidth="2"/>
            </svg>
          );
      }
    };

    return getDefaultIcon(symbol.type);
  };

  const getSymbolColor = (type) => {
    const colors = {
      'outlet': '#4caf50',
      'switch': '#ff9800',
      'light': '#ffeb3b',
      'panel': '#2196f3',
      'junction_box': '#9c27b0'
    };
    return colors[type] || '#666';
  };

  const getSymbolDescription = (type) => {
    const descriptions = {
      'outlet': 'Розетки для подключения электроприборов',
      'switch': 'Выключатели освещения',
      'light': 'Осветительные приборы (люстры, светильники)',
      'panel': 'Распределительные щиты и панели',
      'junction_box': 'Распаячные коробки для соединения проводов'
    };
    return descriptions[type] || 'Электрический символ';
  };

  if (loading) {
    return <div className="symbols-library-loading">Загрузка...</div>;
  }

  const types = [...new Set(symbols.map(s => s.type))];
  const categories = [...new Set(symbols.map(s => s.category).filter(Boolean))];

  return (
    <div className="electrical-symbols-library">
      <div className="symbols-library-header">
        <h3>Электрические символы</h3>
        <div className="symbols-info">
          <p className="symbols-library-subtitle">
            <strong>Зачем нужны символы?</strong> Они обозначают электрические устройства на плане этажа
          </p>
          <div className="symbols-usage-guide">
            <div className="usage-step">
              <span className="step-number">1</span>
              <span>Выберите инструмент "Точка" в панели инструментов</span>
            </div>
            <div className="usage-step">
              <span className="step-number">2</span>
              <span>Выберите нужный символ из списка ниже</span>
            </div>
            <div className="usage-step">
              <span className="step-number">3</span>
              <span>Кликните на плане, чтобы разместить символ</span>
            </div>
            <div className="usage-tip">
              💡 <strong>Совет:</strong> Символы автоматически привязываются к ближайшей стене для правильного позиционирования
            </div>
          </div>
        </div>
      </div>

      <div className="symbols-library-filters">
        <div className="filter-group">
          <label>Тип символа:</label>
          <select
            value={filter.type || ''}
            onChange={(e) => setFilter({ ...filter, type: e.target.value || null })}
          >
            <option value="">Все типы</option>
            {types.map(type => (
              <option key={type} value={type}>
                {type} - {getSymbolDescription(type)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Категория:</label>
          <select
            value={filter.category || ''}
            onChange={(e) => setFilter({ ...filter, category: e.target.value || null })}
          >
            <option value="">Все категории</option>
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="symbols-library-grid">
        {filteredSymbols.map(symbol => (
          <div
            key={symbol.id}
            className="symbol-item"
            onClick={() => onSymbolSelect && onSymbolSelect(symbol)}
            style={{ borderColor: getSymbolColor(symbol.type) }}
            title={symbol.name}
          >
            <div className="symbol-icon" style={{ color: getSymbolColor(symbol.type) }}>
              {getSymbolIcon(symbol)}
            </div>
            <div className="symbol-name">{symbol.name}</div>
            <div className="symbol-type">{symbol.type}</div>
          </div>
        ))}
      </div>

      {filteredSymbols.length === 0 && (
        <div className="symbols-library-empty">
          Символов не найдено
        </div>
      )}
    </div>
  );
};

export default ElectricalSymbolsLibrary;

