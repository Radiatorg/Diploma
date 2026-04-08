/**
 * Утилита для автоматического выбора электрических символов
 * на основе требований ТКП 339-2022 и расчетов
 */

import {
  selectElectricalSymbolParams,
  getRequiredIPRatingForOutlet,
  getRequiredIPRatingForSwitch,
  getRequiredIPRatingForLight,
  selectOutletRating,
  checkBathroomOutletPlacement
} from './tkp339Validations';

/**
 * Автоматический выбор электрического символа из доступных
 * @param {Array} availableSymbols - Массив доступных символов из базы данных
 * @param {string} symbolType - Тип символа: "outlet", "switch", "light"
 * @param {string} roomTypeName - Название типа помещения
 * @param {Object} options - Дополнительные параметры
 * @param {number} options.powerConsumption - Мощность в Вт
 * @param {number} options.distanceFromBath - Расстояние от ванны в см
 * @param {number} options.current - Ток в А
 * @returns {Object|null} Выбранный символ или null
 */
export const selectBestElectricalSymbol = (availableSymbols, symbolType, roomTypeName, options = {}) => {
  if (!availableSymbols || !Array.isArray(availableSymbols) || availableSymbols.length === 0) {
    return null;
  }
  
  if (!symbolType || !roomTypeName) {
    // Если параметры не указаны, возвращаем первый символ нужного типа
    return availableSymbols.find(s => s.type === symbolType) || null;
  }
  
  // Получаем требования ТКП 339
  const requirements = selectElectricalSymbolParams(symbolType, roomTypeName, options);
  
  // Фильтруем символы по типу
  const symbolsOfType = availableSymbols.filter(s => s.type === symbolType);
  if (symbolsOfType.length === 0) {
    return null;
  }
  
  // Если IP-рейтинг не требуется (запрещено), возвращаем null
  if (!requirements.ipRating) {
    return null;
  }
  
  // Сортируем символы по приоритету:
  // 1. Соответствие IP-рейтингу (точное совпадение или выше)
  // 2. Соответствие номиналу (для розеток)
  // 3. Наличие цены (для сметы)
  // 4. Активность
  
  const scoredSymbols = symbolsOfType
    .filter(s => s.active !== false)
    .map(symbol => {
      let score = 0;
      
      // Проверка IP-рейтинга
      if (symbol.ipRating) {
        const symbolIP = parseIPRating(symbol.ipRating);
        const requiredIP = parseIPRating(requirements.ipRating);
        
        if (symbolIP.first >= requiredIP.first && symbolIP.second >= requiredIP.second) {
          score += 100; // Полное соответствие
          // Бонус за точное совпадение
          if (symbolIP.first === requiredIP.first && symbolIP.second === requiredIP.second) {
            score += 50;
          }
        } else {
          score -= 1000; // Не соответствует требованиям
        }
      } else {
        // Если IP не указан, предполагаем минимальный
        score += 10;
      }
      
      // Для розеток проверяем номинал
      if (symbolType === 'outlet' && requirements.rating) {
        const symbolRating = extractRatingFromName(symbol.name);
        if (symbolRating) {
          if (symbolRating >= requirements.rating) {
            score += 50;
            // Бонус за точное совпадение
            if (symbolRating === requirements.rating) {
              score += 25;
            }
          } else {
            score -= 500; // Номинал меньше требуемого
          }
        }
      }
      
      // Бонус за наличие цены (важно для сметы)
      if (symbol.price && symbol.price > 0) {
        score += 10;
      }
      
      // Бонус за наличие модели
      if (symbol.model) {
        score += 5;
      }
      
      return { symbol, score };
    })
    .filter(item => item.score > 0) // Убираем несоответствующие
    .sort((a, b) => b.score - a.score); // Сортируем по убыванию score
  
  // Возвращаем символ с наивысшим score
  if (scoredSymbols.length > 0) {
    return scoredSymbols[0].symbol;
  }
  
  // Если ничего не подошло, возвращаем первый доступный
  return symbolsOfType[0] || null;
};

/**
 * Парсинг IP-рейтинга (например, "IP44" -> { first: 4, second: 4 })
 * @param {string} ipRating - IP-рейтинг в формате "IP44", "IPX5" и т.д.
 * @returns {Object} { first: number, second: number }
 */
const parseIPRating = (ipRating) => {
  if (!ipRating || typeof ipRating !== 'string') {
    return { first: 0, second: 0 };
  }
  
  const match = ipRating.toUpperCase().match(/IP(\d|X)(\d|X)/);
  if (!match) {
    return { first: 0, second: 0 };
  }
  
  return {
    first: match[1] === 'X' ? 0 : parseInt(match[1], 10),
    second: match[2] === 'X' ? 0 : parseInt(match[2], 10)
  };
};

/**
 * Извлечение номинала из названия (например, "Розетка 16А" -> 16)
 * @param {string} name - Название символа
 * @returns {number|null} Номинал в А или null
 */
const extractRatingFromName = (name) => {
  if (!name) {
    return null;
  }
  
  const match = name.match(/(\d+)\s*[АA]/i);
  if (match) {
    return parseInt(match[1], 10);
  }
  
  return null;
};

/**
 * Получение рекомендаций по выбору символа
 * @param {string} symbolType - Тип символа
 * @param {string} roomTypeName - Название типа помещения
 * @param {Object} options - Дополнительные параметры
 * @returns {Object} { recommended: Object, alternatives: Array, warnings: Array }
 */
export const getSymbolRecommendations = (symbolType, roomTypeName, options = {}) => {
  const requirements = selectElectricalSymbolParams(symbolType, roomTypeName, options);
  
  return {
    requirements: {
      ipRating: requirements.ipRating,
      rating: requirements.rating,
      requiresRCD: requirements.requiresRCD,
      rcdRating: requirements.rcdRating,
      requiresSeparateLine: requirements.requiresSeparateLine
    },
    warnings: requirements.warnings,
    recommendations: requirements.recommendations
  };
};

/**
 * Проверка соответствия символа требованиям ТКП 339
 * @param {Object} symbol - Символ из базы данных
 * @param {string} roomTypeName - Название типа помещения
 * @param {Object} options - Дополнительные параметры
 * @returns {Object} { valid: boolean, issues: Array, recommendations: Array }
 */
export const validateSymbolCompliance = (symbol, roomTypeName, options = {}) => {
  const issues = [];
  const recommendations = [];
  
  if (!symbol || !symbol.type) {
    return { valid: false, issues: ['Символ не указан'], recommendations: [] };
  }
  
  const requirements = selectElectricalSymbolParams(symbol.type, roomTypeName, options);
  
  // Проверка IP-рейтинга
  if (requirements.ipRating) {
    if (!symbol.ipRating) {
      issues.push(`Требуется указать IP-рейтинг. Минимум: ${requirements.ipRating}`);
    } else {
      const symbolIP = parseIPRating(symbol.ipRating);
      const requiredIP = parseIPRating(requirements.ipRating);
      
      if (symbolIP.first < requiredIP.first || symbolIP.second < requiredIP.second) {
        issues.push(`IP-рейтинг ${symbol.ipRating} не соответствует требованиям (минимум ${requirements.ipRating})`);
      }
    }
  }
  
  // Проверка номинала для розеток
  if (symbol.type === 'outlet' && requirements.rating) {
    const symbolRating = extractRatingFromName(symbol.name);
    if (!symbolRating) {
      recommendations.push(`Рекомендуется указать номинал розетки в названии (минимум ${requirements.rating}А)`);
    } else if (symbolRating < requirements.rating) {
      issues.push(`Номинал розетки ${symbolRating}А меньше требуемого ${requirements.rating}А`);
    }
  }
  
  // Проверка УЗО
  if (requirements.requiresRCD) {
    recommendations.push(`Требуется подключение через УЗО ${requirements.rcdRating}мА`);
  }
  
  // Проверка отдельной линии
  if (requirements.requiresSeparateLine) {
    recommendations.push('Требуется отдельная линия питания');
  }
  
  return {
    valid: issues.length === 0,
    issues,
    recommendations: [...recommendations, ...requirements.recommendations],
    warnings: requirements.warnings
  };
};


