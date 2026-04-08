/**
 * Утилиты для валидации и расчетов согласно ТКП 339-2022
 * Основано на: ТКП 339-2022 "Электроустановки жилых и общественных зданий"
 */

// Нормы ТКП 339 для расчета минимального количества розеток
// Минимальное количество розеток на 1 м² площади помещения
export const TKP339_NORMS = {
  // Жилые помещения
  'жилая комната': { minOutletsPerSqm: 0.1, minOutlets: 3 }, // Минимум 3 розетки на комнату
  'спальня': { minOutletsPerSqm: 0.1, minOutlets: 3 },
  'гостиная': { minOutletsPerSqm: 0.1, minOutlets: 4 },
  'детская': { minOutletsPerSqm: 0.1, minOutlets: 3 },
  
  // Кухня
  'кухня': { minOutletsPerSqm: 0.15, minOutlets: 4 }, // На кухне больше розеток
  
  // Ванные и санузлы (п. 8.5.6 - ограничения)
  'ванная': { minOutletsPerSqm: 0.05, minOutlets: 0 }, // В ванной только в зоне 3
  'санузел': { minOutletsPerSqm: 0.05, minOutlets: 0 },
  'туалет': { minOutletsPerSqm: 0.05, minOutlets: 0 },
  
  // Прихожие и коридоры
  'прихожая': { minOutletsPerSqm: 0.08, minOutlets: 2 },
  'коридор': { minOutletsPerSqm: 0.08, minOutlets: 2 },
  
  // Другие помещения
  'балкон': { minOutletsPerSqm: 0.1, minOutlets: 1 },
  'лоджия': { minOutletsPerSqm: 0.1, minOutlets: 1 },
  'кладовка': { minOutletsPerSqm: 0.05, minOutlets: 1 },
  
  // По умолчанию
  'default': { minOutletsPerSqm: 0.1, minOutlets: 2 }
};

// Зоны безопасности в ванных комнатах (п. 8.5.5)
export const BATHROOM_ZONES = {
  ZONE_0: { // Внутренний объем ванны/поддона
    description: 'Внутренний объем ванны/поддона',
    ipRating: 'IPX7',
    allowed: ['Приборы до 12В (источник вне зоны)'],
    prohibited: ['Розетки', 'Выключатели', 'Распределительные коробки']
  },
  ZONE_1: { // Вертикальная плоскость над ванной
    description: 'Вертикальная плоскость над ванной',
    ipRating: 'IPX5',
    allowed: ['Водонагреватели'],
    prohibited: ['Розетки', 'Выключатели', 'Распределительные коробки']
  },
  ZONE_2: { // 60 см от края ванны/душа
    description: '60 см от края ванны/душа',
    ipRating: 'IPX4', // В общественных банях - IPX5
    allowed: ['Водонагреватели', 'Светильники класса защиты 2'],
    prohibited: ['Розетки', 'Выключатели', 'Распределительные коробки']
  },
  ZONE_3: { // 240 см от края зоны 2
    description: '240 см от края зоны 2 (дальше 60 см от ванны)',
    ipRating: 'IPX1', // В общественных банях - IPX5
    allowed: ['Розетки через УЗО 30мА или разделительный трансформатор'],
    prohibited: []
  }
};

// Минимальные сечения кабелей (п. 8.4.4, Таблица 8.1)
export const MIN_CABLE_SECTIONS = {
  LIGHTING: 1.5, // мм² для осветительных цепей (медь)
  OUTLETS: 2.5,  // мм² для розеточных групп (медь)
  STOVE: 6.0,    // мм² для электроплит (медь)
  ALUMINUM: 2.5  // мм² минимум для алюминия (только инженерное оборудование)
};

/**
 * Расчет минимального количества розеток для помещения
 * @param {string} roomTypeName - Название типа помещения
 * @param {number} area - Площадь помещения в м²
 * @returns {number} Минимальное количество розеток
 */
export const calculateMinOutlets = (roomTypeName, area) => {
  if (!roomTypeName || !area || area <= 0) {
    return 2; // Минимум 2 розетки по умолчанию
  }
  
  const roomNameLower = roomTypeName.toLowerCase();
  
  // Ищем подходящую норму
  let norm = TKP339_NORMS.default;
  for (const [key, value] of Object.entries(TKP339_NORMS)) {
    if (key !== 'default' && roomNameLower.includes(key)) {
      norm = value;
      break;
    }
  }
  
  // Расчет: площадь * норма на м², но не меньше минимального значения
  const calculated = Math.ceil(area * norm.minOutletsPerSqm);
  return Math.max(calculated, norm.minOutlets);
};

/**
 * Валидация площади помещения
 * @param {number} area - Площадь помещения
 * @param {number} minArea - Минимальная площадь (по умолчанию 1 м²)
 * @param {number} maxArea - Максимальная площадь (опционально)
 * @returns {string|null} Сообщение об ошибке или null если валидно
 */
export const validateRoomArea = (area, minArea = 1, maxArea = null) => {
  if (!area || area <= 0) {
    return 'Площадь помещения должна быть больше 0';
  }
  
  if (area < minArea) {
    return `Площадь помещения должна быть не менее ${minArea} м²`;
  }
  
  if (maxArea !== null && area > maxArea) {
    return `Площадь помещения не должна превышать ${maxArea} м²`;
  }
  
  return null;
};

/**
 * Валидация конфигурации розеточных групп
 * @param {Array} socketGroupsConfig - Массив конфигураций групп [{ socketsCount: 2 }, ...]
 * @param {number} minOutlets - Минимальное требуемое количество розеток
 * @returns {string|null} Сообщение об ошибке или null если валидно
 */
export const validateSocketGroups = (socketGroupsConfig, minOutlets) => {
  if (!socketGroupsConfig || !Array.isArray(socketGroupsConfig) || socketGroupsConfig.length === 0) {
    return 'Необходимо добавить хотя бы одну розеточную группу';
  }
  
  const totalSockets = socketGroupsConfig.reduce((sum, group) => {
    const count = group.socketsCount || 0;
    if (count < 2 || count > 4) {
      return sum; // Невалидная группа не учитывается
    }
    return sum + count;
  }, 0);
  
  if (totalSockets < minOutlets) {
    return `Минимальное количество розеток: ${minOutlets}. Текущее: ${totalSockets}`;
  }
  
  // Проверка на валидность групп (2-4 розетки в группе)
  const invalidGroups = socketGroupsConfig.filter(group => {
    const count = group.socketsCount || 0;
    return count < 2 || count > 4;
  });
  
  if (invalidGroups.length > 0) {
    return 'В каждой розеточной группе должно быть от 2 до 4 розеток';
  }
  
  return null;
};

/**
 * Проверка требования УЗО для типа помещения (п. 8.7.4)
 * @param {string} roomTypeName - Название типа помещения
 * @returns {Object|false} Объект с требованиями УЗО или false
 */
export const requiresRCD = (roomTypeName) => {
  if (!roomTypeName) {
    return false;
  }
  
  const roomNameLower = roomTypeName.toLowerCase();
  
  // Ванные, душевые, санузлы - обязательное УЗО 30мА (п. 8.7.4, 8.5.6)
  // Для отдельных сантехкабин рекомендуется 10мА
  if (roomNameLower.includes('ванн') || 
      roomNameLower.includes('душ') || 
      roomNameLower.includes('санузел') ||
      roomNameLower.includes('туалет')) {
    return {
      required: true,
      current: 30, // мА (п. 8.7.14)
      preferred: 10, // мА (рекомендация для отдельных сантехкабин)
      reason: 'ТКП 339-2022 п. 8.7.4, 8.5.6: Для ванных и душевых обязательно УЗО не более 30мА'
    };
  }
  
  // Кухни - рекомендуется УЗО 30мА (для розеточных групп)
  if (roomNameLower.includes('кухн')) {
    return {
      required: false,
      recommended: true,
      current: 30,
      reason: 'ТКП 339-2022 п. 8.7.4: Для розеточных групп рекомендуется УЗО 30мА'
    };
  }
  
  // Балконы, лоджии с розетками - рекомендуется УЗО (наружные установки)
  if (roomNameLower.includes('балкон') || roomNameLower.includes('лоджия')) {
    return {
      required: false,
      recommended: true,
      current: 30,
      reason: 'ТКП 339-2022 п. 8.7.4: Для наружных установок рекомендуется УЗО 30мА'
    };
  }
  
  return false;
};

/**
 * Расчет тока утечки по формуле ТКП 339-2022 (п. 8.7.14)
 * I_утечки = 0.4 мА на 1 А нагрузки + 10 мкА на 1 м длины фазного провода
 * @param {number} totalCurrent - Общий ток нагрузки в А
 * @param {number} cableLength - Длина кабеля в м
 * @returns {number} Ток утечки в мА
 */
export const calculateLeakageCurrent = (totalCurrent, cableLength) => {
  const leakageFromCurrent = (totalCurrent || 0) * 0.4; // мА
  const leakageFromLength = (cableLength || 0) * 0.01; // мА (10 мкА = 0.01 мА)
  return leakageFromCurrent + leakageFromLength;
};

/**
 * Выбор номинала УЗО (п. 8.7.14)
 * Номинальный диф. ток ≥ 3 × I_утечки
 * @param {number} leakageCurrent - Расчетный ток утечки в мА
 * @returns {Object} { rating: number, reason: string }
 */
export const selectRCDRating = (leakageCurrent) => {
  const STANDARD_RCD_RATINGS = [10, 30, 100, 300]; // мА
  const minRequired = leakageCurrent * 3;
  
  for (const rating of STANDARD_RCD_RATINGS) {
    if (rating >= minRequired) {
      return {
        rating,
        reason: `ТКП 339-2022 п. 8.7.14: Номинал УЗО (${rating}мА) ≥ 3 × I_утечки (${leakageCurrent.toFixed(2)}мА)`
      };
    }
  }
  
  // Если не подошел ни один стандартный, возвращаем максимальный
  return {
    rating: STANDARD_RCD_RATINGS[STANDARD_RCD_RATINGS.length - 1],
    reason: `ТКП 339-2022: Использован максимальный номинал УЗО (300мА)`
  };
};

/**
 * Проверка требования отдельной линии для прибора
 * @param {string} applianceName - Название прибора
 * @param {number} powerConsumption - Потребляемая мощность в Вт
 * @returns {boolean} true если требуется отдельная линия
 */
export const requiresSeparateLine = (applianceName, powerConsumption) => {
  if (!applianceName) {
    return false;
  }
  
  const nameLower = applianceName.toLowerCase();
  const powerKw = (powerConsumption || 0) / 1000;
  
  // Приборы мощностью более 2 кВт требуют отдельной линии
  if (powerKw >= 2.0) {
    return true;
  }
  
  // Специфичные приборы, требующие отдельной линии независимо от мощности
  const highPowerAppliances = [
    'плита',
    'электроплита',
    'варочная панель',
    'духовой шкаф',
    'водонагреватель',
    'бойлер',
    'стиральная машина',
    'посудомоечная машина',
    'кондиционер',
    'сплит-система',
    'теплый пол',
    'электроотопление',
    'проточный водонагреватель'
  ];
  
  for (const appliance of highPowerAppliances) {
    if (nameLower.includes(appliance)) {
      return true;
    }
  }
  
  return false;
};

/**
 * Генерация рекомендаций и предупреждений по ТКП 339
 * @param {Object} roomsConfig - Конфигурация комнат { roomId: { appliances: [], socketGroupsConfig: [], ... } }
 * @param {Array} roomTypes - Массив типов помещений
 * @param {Array} appliances - Массив всех доступных приборов
 * @param {Object} step1Data - Данные шага 1 (projectType, area, groundingSystem, inputVoltage, inputPhaseCount)
 * @param {Object} projectData - Данные проекта (groundingSystem, inputVoltage, inputPhaseCount, penConductorSection)
 * @returns {Object} { recommendations: [], warnings: [] }
 */
export const generateRecommendations = (roomsConfig = {}, roomTypes = [], appliances = [], step1Data = {}, projectData = {}) => {
  const recommendations = [];
  const warnings = [];

  // Валидация параметров проекта
  const projectGrounding = projectData.groundingSystem || step1Data.groundingSystem;
  const projectType = step1Data.projectType || projectData.projectType;
  const inputVoltage = projectData.inputVoltage || step1Data.inputVoltage;
  const inputPhaseCount = projectData.inputPhaseCount || step1Data.inputPhaseCount;

  if (projectGrounding) {
    const groundingValidation = validateGroundingSystem(projectGrounding, projectType);
    if (!groundingValidation.valid) {
      warnings.push({
        room: 'Общие параметры проекта',
        message: groundingValidation.errors.join(' ')
      });
    }
  }

  if (inputVoltage && inputPhaseCount) {
    const voltageValidation = validateInputVoltage(inputVoltage, inputPhaseCount);
    if (!voltageValidation.valid) {
      warnings.push({
        room: 'Общие параметры проекта',
        message: voltageValidation.errors.join(' ')
      });
    }
  }

  if (inputPhaseCount === 3 && projectData.penConductorSection) {
    const penValidation = validatePENConductorSection(projectData.penConductorSection, inputPhaseCount);
    if (!penValidation.valid) {
      warnings.push({
        room: 'Вводное оборудование',
        message: penValidation.errors.join(' ')
      });
    }
  }
  
  // Проходим по всем комнатам
  Object.entries(roomsConfig).forEach(([roomId, config]) => {
    const roomType = roomTypes.find(rt => rt.id === config.roomTypeId);
    if (!roomType) return;
    
    const roomName = roomType.name;
    const roomNameLower = roomName.toLowerCase();
    
    // Проверка УЗО для ванных
    const rcdRequirement = requiresRCD(roomName);
    if (rcdRequirement && rcdRequirement.required) {
      warnings.push({
        room: roomName,
        message: `Требуется обязательная установка УЗО ${rcdRequirement.current}мА (предпочтительно ${rcdRequirement.preferred}мА). ${rcdRequirement.reason}`
      });
    } else if (rcdRequirement && rcdRequirement.recommended) {
      recommendations.push({
        message: `${roomName}: Рекомендуется установка УЗО ${rcdRequirement.current}мА. ${rcdRequirement.reason}`
      });
    }
    
    // Проверка приборов на требование отдельной линии
    if (config.appliances && Array.isArray(config.appliances)) {
      config.appliances.forEach(applianceRef => {
        const appliance = appliances.find(a => a.id === applianceRef.id);
        if (appliance) {
          const quantity = applianceRef.quantity || 1;
          const totalPower = (appliance.powerConsumption || 0) * quantity;
          
          if (requiresSeparateLine(appliance.name, totalPower)) {
            warnings.push({
              room: roomName,
              appliance: appliance.name,
              message: `Прибор "${appliance.name}" (${(totalPower / 1000).toFixed(1)} кВт) требует отдельной линии питания согласно ТКП 339-2011`
            });
          }
        }
      });
    }
    
    // Проверка розеток в ванных (п. 8.5.5, 8.5.6)
    if (roomNameLower.includes('ванн') || roomNameLower.includes('душ')) {
      if (config.socketGroupsConfig && config.socketGroupsConfig.length > 0) {
        warnings.push({
          room: roomName,
          message: 'ТКП 339-2022 п. 8.5.6: В ванных комнатах установка розеток в зонах 0, 1, 2 запрещена. В зоне 3 (дальше 60 см от края ванны/душа) допускается установка розеток с защитой IP44 и выше и обязательным УЗО 30мА (предпочтительно 10мА) или через разделительный трансформатор.'
        });
      }
    }
    
    // Проверка электроплит и отопления (п. 8.6.4)
    if (config.appliances && Array.isArray(config.appliances)) {
      let totalHeatingPower = 0;
      config.appliances.forEach(applianceRef => {
        const appliance = appliances.find(a => a.id === applianceRef.id);
        if (appliance) {
          const nameLower = appliance.name.toLowerCase();
          if (nameLower.includes('плит') || 
              nameLower.includes('отоплен') || 
              nameLower.includes('водонагревател') ||
              nameLower.includes('бойлер')) {
            const quantity = applianceRef.quantity || 1;
            totalHeatingPower += (appliance.powerConsumption || 0) * quantity;
          }
        }
      });
      
      if (totalHeatingPower > 5000) {
        warnings.push({
          room: roomName,
          message: `ТКП 339-2022 п. 8.6.4: Суммарная мощность электроотопления и ГВС (${(totalHeatingPower / 1000).toFixed(1)} кВт) превышает 5 кВт. Требуется отдельный расчетный счетчик (подразумевает отдельный ввод).`
        });
      }
    }
  });
  
  return {
    recommendations,
    warnings
  };
};

/**
 * Определение требуемого IP-рейтинга для розеток в зависимости от типа помещения (п. 8.5.5)
 * @param {string} roomTypeName - Название типа помещения
 * @param {number} distanceFromBath - Расстояние от ванны/душа в см (для ванных)
 * @returns {string} Требуемый IP-рейтинг (например, "IP44", "IP54", "IP65")
 */
export const getRequiredIPRatingForOutlet = (roomTypeName, distanceFromBath = null) => {
  if (!roomTypeName) {
    return 'IP20'; // По умолчанию для сухих помещений
  }
  
  const roomNameLower = roomTypeName.toLowerCase();
  
  // Ванные комнаты (п. 8.5.5, 8.5.6)
  if (roomNameLower.includes('ванн') || roomNameLower.includes('душ')) {
    if (distanceFromBath !== null) {
      if (distanceFromBath <= 60) {
        // Зона 2 - запрещены розетки
        return null; // Розетки запрещены
      } else if (distanceFromBath <= 240) {
        // Зона 3 - IPX1 (в общественных банях - IPX5)
        return 'IP44'; // Минимум для зоны 3
      }
    }
    // По умолчанию для ванных (зона 3)
    return 'IP44';
  }
  
  // Балконы, лоджии - наружные установки
  if (roomNameLower.includes('балкон') || roomNameLower.includes('лоджия')) {
    return 'IP54'; // Защита от брызг
  }
  
  // Кухни - рекомендуется защита от брызг
  if (roomNameLower.includes('кухн')) {
    return 'IP44'; // Рекомендуется для кухонь
  }
  
  // Сухие помещения
  return 'IP20';
};

/**
 * Определение требуемого IP-рейтинга для выключателей (п. 8.5.5, 8.5.6, 8.5.10)
 * @param {string} roomTypeName - Название типа помещения
 * @param {number} distanceFromBath - Расстояние от ванны/душа в см
 * @returns {string} Требуемый IP-рейтинг
 */
export const getRequiredIPRatingForSwitch = (roomTypeName, distanceFromBath = null) => {
  if (!roomTypeName) {
    return 'IP20';
  }
  
  const roomNameLower = roomTypeName.toLowerCase();
  
  // В ванных выключатели запрещены в зонах 0, 1, 2
  // Допускаются выключатели со шнуром (под потолком) в зонах 1 и 2
  if (roomNameLower.includes('ванн') || roomNameLower.includes('душ')) {
    if (distanceFromBath !== null && distanceFromBath <= 60) {
      return null; // Запрещены в зонах 0, 1, 2
    }
    return 'IP44'; // Для зоны 3
  }
  
  // Балконы, лоджии
  if (roomNameLower.includes('балкон') || roomNameLower.includes('лоджия')) {
    return 'IP54';
  }
  
  return 'IP20';
};

/**
 * Определение требуемого IP-рейтинга для светильников (п. 8.5.5)
 * @param {string} roomTypeName - Название типа помещения
 * @param {number} distanceFromBath - Расстояние от ванны/душа в см
 * @returns {string} Требуемый IP-рейтинг
 */
export const getRequiredIPRatingForLight = (roomTypeName, distanceFromBath = null) => {
  if (!roomTypeName) {
    return 'IP20';
  }
  
  const roomNameLower = roomTypeName.toLowerCase();
  
  // Ванные комнаты
  if (roomNameLower.includes('ванн') || roomNameLower.includes('душ')) {
    if (distanceFromBath !== null) {
      if (distanceFromBath <= 60) {
        // Зона 2 - светильники класса защиты 2
        return 'IP44'; // Минимум для зоны 2
      }
    }
    return 'IP44';
  }
  
  // Кухни (п. 8.5.4) - требуется защитное стекло или решетка
  if (roomNameLower.includes('кухн')) {
    return 'IP44'; // Защита от брызг
  }
  
  // Балконы, лоджии
  if (roomNameLower.includes('балкон') || roomNameLower.includes('лоджия')) {
    return 'IP54';
  }
  
  return 'IP20';
};

/**
 * Выбор номинала розетки на основе нагрузки (п. 8.5.8)
 * @param {number} powerConsumption - Потребляемая мощность в Вт
 * @param {number} voltage - Напряжение в В (по умолчанию 230В)
 * @returns {number} Номинал розетки в А (10, 16, 20, 25)
 */
export const selectOutletRating = (powerConsumption, voltage = 230) => {
  if (!powerConsumption || powerConsumption <= 0) {
    return 16; // Стандарт для розеток (п. 8.5.8 - минимум 10А)
  }
  
  const current = powerConsumption / voltage;
  
  // Стандартные номиналы розеток
  if (current <= 10) {
    return 10; // Минимум по п. 8.5.8
  } else if (current <= 16) {
    return 16; // Стандарт для бытовых розеток
  } else if (current <= 20) {
    return 20; // Для более мощных приборов
  } else {
    return 25; // Для специальных случаев (не для бытовых розеток)
  }
};

/**
 * Автоматический выбор параметров электрического символа на основе требований ТКП 339
 * @param {string} symbolType - Тип символа: "outlet", "switch", "light"
 * @param {string} roomTypeName - Название типа помещения
 * @param {Object} options - Дополнительные параметры
 * @param {number} options.powerConsumption - Мощность для розеток/светильников (Вт)
 * @param {number} options.distanceFromBath - Расстояние от ванны в см (для ванных)
 * @param {number} options.current - Ток нагрузки в А
 * @returns {Object} Параметры для выбора символа { ipRating, rating, requiresRCD, ... }
 */
export const selectElectricalSymbolParams = (symbolType, roomTypeName, options = {}) => {
  const { powerConsumption, distanceFromBath, current } = options;
  const result = {
    ipRating: 'IP20',
    rating: null,
    requiresRCD: false,
    rcdRating: null,
    requiresSeparateLine: false,
    warnings: [],
    recommendations: []
  };
  
  if (!symbolType || !roomTypeName) {
    return result;
  }
  
  const roomNameLower = roomTypeName.toLowerCase();
  const isBathroom = roomNameLower.includes('ванн') || roomNameLower.includes('душ');
  
  // Определение IP-рейтинга
  if (symbolType === 'outlet') {
    result.ipRating = getRequiredIPRatingForOutlet(roomTypeName, distanceFromBath);
    if (!result.ipRating) {
      result.warnings.push('ТКП 339-2022 п. 8.5.6: Установка розеток в зонах 0, 1, 2 ванных комнат запрещена');
      return result;
    }
    
    // Номинал розетки
    if (powerConsumption) {
      result.rating = selectOutletRating(powerConsumption);
    } else if (current) {
      result.rating = selectOutletRating(current * 230);
    } else {
      result.rating = 16; // Стандарт
    }
    
    // Требование УЗО (п. 8.7.4)
    const rcdReq = requiresRCD(roomTypeName);
    if (rcdReq) {
      result.requiresRCD = true;
      result.rcdRating = rcdReq.current;
      if (rcdReq.required) {
        result.warnings.push(`ТКП 339-2022 п. 8.7.4: Обязательно УЗО ${rcdReq.current}мА`);
      } else {
        result.recommendations.push(`ТКП 339-2022: Рекомендуется УЗО ${rcdReq.current}мА`);
      }
    }
    
    // Проверка на отдельную линию
    if (powerConsumption && requiresSeparateLine('', powerConsumption)) {
      result.requiresSeparateLine = true;
      result.warnings.push(`ТКП 339-2022: Требуется отдельная линия для мощности ${(powerConsumption / 1000).toFixed(1)} кВт`);
    }
    
  } else if (symbolType === 'switch') {
    result.ipRating = getRequiredIPRatingForSwitch(roomTypeName, distanceFromBath);
    if (!result.ipRating && isBathroom) {
      result.warnings.push('ТКП 339-2022 п. 8.5.6, 8.5.10: Выключатели в зонах 0, 1, 2 запрещены. Допускаются выключатели со шнуром в зонах 1 и 2');
    }
    
  } else if (symbolType === 'light') {
    result.ipRating = getRequiredIPRatingForLight(roomTypeName, distanceFromBath);
    
    if (roomNameLower.includes('кухн')) {
      result.recommendations.push('ТКП 339-2022 п. 8.5.4: Светильники над рабочими местами должны иметь защитное стекло или решетки');
    }
  }
  
  return result;
};

/**
 * Проверка возможности установки розетки в ванной комнате (п. 8.5.6)
 * @param {number} distanceFromBath - Расстояние от края ванны/душа в см
 * @returns {Object} { allowed: boolean, zone: string, requirements: string[] }
 */
export const checkBathroomOutletPlacement = (distanceFromBath) => {
  if (distanceFromBath === null || distanceFromBath === undefined) {
    return {
      allowed: false,
      zone: 'UNKNOWN',
      requirements: ['Необходимо указать расстояние от ванны/душа']
    };
  }
  
  if (distanceFromBath <= 60) {
    return {
      allowed: false,
      zone: 'ZONE_2',
      requirements: [
        'ТКП 339-2022 п. 8.5.6: Установка розеток в зонах 0, 1, 2 запрещена',
        'Разрешены только в зоне 3 (дальше 60 см от края ванны/душа)'
      ]
    };
  }
  
  if (distanceFromBath <= 240) {
    return {
      allowed: true,
      zone: 'ZONE_3',
      requirements: [
        'ТКП 339-2022 п. 8.5.6: Розетки разрешены в зоне 3',
        'Требуется: IP44 или выше, УЗО 30мА (предпочтительно 10мА) или разделительный трансформатор'
      ]
    };
  }
  
  return {
    allowed: true,
    zone: 'OUTSIDE_ZONES',
    requirements: [
      'Розетка вне зон безопасности',
      'Рекомендуется: IP44, УЗО 30мА'
    ]
  };
};

/**
 * Валидация системы заземления (п. 8.2.1)
 * Для жилых зданий не допускается TN-C внутри здания
 */
export const validateGroundingSystem = (groundingSystem, projectType) => {
  if (!groundingSystem) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];
  const warnings = [];

  if (projectType && (projectType.includes('apartment') || projectType.includes('house') || projectType.includes('dacha'))) {
    if (groundingSystem === 'TN-C') {
      errors.push('ТКП 339-2022 п. 8.2.1: Система заземления TN-C не допускается внутри жилого здания. Разрешены только TN-S или TN-C-S.');
    }
  }

  return { valid: errors.length === 0, errors, warnings };
};

/**
 * Валидация напряжения сети (п. 8.2.1)
 */
export const validateInputVoltage = (inputVoltage, inputPhaseCount) => {
  if (!inputVoltage || !inputPhaseCount) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];

  if (inputPhaseCount === 1 && inputVoltage !== 230) {
    errors.push('ТКП 339-2022 п. 8.2.1: Для однофазной сети должно быть указано напряжение 230 В.');
  }

  if (inputPhaseCount === 3 && inputVoltage !== 400) {
    errors.push('ТКП 339-2022 п. 8.2.1: Для трехфазной сети должно быть указано напряжение 400 В.');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Валидация сечения PEN-проводника (п. 8.4.14)
 */
export const validatePENConductorSection = (penSection, inputPhaseCount, conductorMaterial = 'медь') => {
  if (!penSection || !inputPhaseCount || inputPhaseCount !== 3) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];
  const isAluminum = conductorMaterial.toLowerCase().includes('алюминий') || conductorMaterial.toLowerCase().includes('aluminum');

  if (isAluminum) {
    if (penSection < 16) {
      errors.push('ТКП 339-2022 п. 8.4.14: Сечение PEN-проводника для трехфазного ввода должно быть не менее 16 мм² (алюминий).');
    }
  } else {
    if (penSection < 10) {
      errors.push('ТКП 339-2022 п. 8.4.14: Сечение PEN-проводника для трехфазного ввода должно быть не менее 10 мм² (медь).');
    }
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Расчет сечения заземляющего проводника PE (п. 8.4.14)
 */
export const calculatePESection = (phaseSection) => {
  if (!phaseSection || phaseSection <= 0) {
    return 2.5; // Минимум по умолчанию
  }

  if (phaseSection <= 16) {
    return phaseSection; // PE = S
  } else if (phaseSection <= 35) {
    return 16; // PE = 16 мм²
  } else {
    return Math.ceil(phaseSection / 2); // PE >= S/2
  }
};

/**
 * Валидация материала жил для внутренней проводки (п. 8.4.4)
 */
export const validateConductorMaterial = (section, material, circuitType) => {
  if (!section || !material) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];
  const isAluminum = material.toLowerCase().includes('алюминий') || material.toLowerCase().includes('aluminum');
  const isGroupCircuit = circuitType === 'outlet' || circuitType === 'light';

  if (isGroupCircuit && isAluminum && section < 16) {
    errors.push('ТКП 339-2022 п. 8.4.4: Для групповых сетей внутри жилых помещений при сечении менее 16 мм² материал жил должен быть только медь. Алюминий допускается только для сечений 16 мм² и выше.');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Валидация запрещенных помещений для розеток и выключателей (п. 8.5.10, 8.5.6)
 */
export const validateProhibitedRoomsForSockets = (roomTypeName, pointType) => {
  if (!roomTypeName || !pointType) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];
  const roomNameLower = roomTypeName.toLowerCase();
  const isProhibited = roomNameLower.includes('саун') || 
                       roomNameLower.includes('парилк') ||
                       roomNameLower.includes('моечн') ||
                       (roomNameLower.includes('стиральн') && roomNameLower.includes('прачечн'));

  if (isProhibited && (pointType === 'outlet' || pointType === 'switch')) {
    errors.push('ТКП 339-2022 п. 8.5.10, 8.5.6: Запрещено размещать выключатели и розетки внутри саун (парилок), моечных помещений бань, стиральных помещений прачечных.');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Валидация расстояния до газопровода (п. 8.5.7)
 */
export const validateDistanceToGasPipe = (distance) => {
  if (!distance || distance === null) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];

  if (distance < 0.5) {
    errors.push('ТКП 339-2022 п. 8.5.7: Расстояние от розетки/выключателя/щитка до газовой трубы должно быть не менее 0,5 м.');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Валидация высоты установки в детских учреждениях (п. 8.5.9)
 */
export const validateHeightForChildrenInstitutions = (projectType, height) => {
  if (!projectType || !height) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];
  const isChildrenInstitution = projectType && 
                                (projectType.includes('детск') || 
                                 projectType.includes('школ') ||
                                 projectType.includes('kindergarten') ||
                                 projectType.includes('school'));

  if (isChildrenInstitution && height < 1.8) {
    errors.push('ТКП 339-2022 п. 8.5.9: Высота установки розеток и выключателей в детских учреждениях должна быть не менее 1,8 м от пола.');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Валидация электропроводки на чердаках (п. 8.4.10)
 */
export const validateAtticWiring = (roomTypeName, wiringType, conductorMaterial) => {
  if (!roomTypeName || !wiringType) {
    return { valid: true, errors: [], warnings: [] };
  }

  const warnings = [];
  const roomNameLower = roomTypeName.toLowerCase();
  const isAttic = roomNameLower.includes('чердак') || roomNameLower.includes('attic');

  if (isAttic && wiringType.toLowerCase() === 'open') {
    const isAluminum = conductorMaterial && (conductorMaterial.toLowerCase().includes('алюминий') || conductorMaterial.toLowerCase().includes('aluminum'));
    if (isAluminum) {
      warnings.push('ТКП 339-2022 п. 8.4.10: Проводка на чердаках должна быть в металлических трубах или защитных оболочках. Кабель с алюминиевой жилой допускается только в стальных трубах или скрыто в несгораемых стенах.');
    } else {
      warnings.push('ТКП 339-2022 п. 8.4.10: Для открытой проводки на чердаках рекомендуется использование металлических труб или защитных оболочек.');
    }
  }

  return { valid: true, errors: [], warnings };
};

/**
 * Валидация номинала УЗО относительно автомата (п. 8.7.8)
 */
export const validateRCDRatingAgainstBreaker = (rcdRating, breakerRating) => {
  if (!rcdRating || !breakerRating) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];
  const warnings = [];

  if (rcdRating < breakerRating) {
    errors.push(`ТКП 339-2022 п. 8.7.8: Номинальный ток УЗО (${rcdRating} А) должен быть больше или равен номинальному току вышестоящего автомата (${breakerRating} А).`);
  } else if (rcdRating === breakerRating) {
    warnings.push('ТКП 339-2022 п. 8.7.8: Рекомендуется выбирать номинал УЗО на ступень выше номинала автомата для обеспечения селективности.');
  }

  return { valid: errors.length === 0, errors, warnings };
};

/**
 * Валидация запрета УЗО в системах TN-C (п. 4.3.5.5)
 */
export const validateRCDInTNCSystem = (groundingSystem, hasRCD) => {
  if (!groundingSystem || !hasRCD) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];

  if (groundingSystem === 'TN-C' && hasRCD) {
    errors.push('ТКП 339-2022 п. 4.3.5.5: Применение УЗО запрещено в системах TN-C (приведет к ложным срабатываниям или отказу защиты).');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Валидация тока утечки для предотвращения ложных срабатываний (п. 8.7.14)
 */
export const validateLeakageCurrent = (calculatedLeakage, rcdRating) => {
  if (!calculatedLeakage || !rcdRating) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];
  const maxAllowedLeakage = rcdRating * 0.33;

  if (calculatedLeakage > maxAllowedLeakage) {
    errors.push(`ТКП 339-2022 п. 8.7.14: Суммарный расчетный ток утечки (${calculatedLeakage.toFixed(2)} мА) превышает 1/3 от номинального отключающего тока УЗО (${maxAllowedLeakage.toFixed(2)} мА). Возможны ложные срабатывания.`);
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Валидация класса точности счетчика (п. 8.6.2)
 */
export const validateMeterAccuracyClass = (projectType, accuracyClass) => {
  if (!accuracyClass) {
    return { valid: true, errors: [], warnings: [] };
  }

  const errors = [];

  if (accuracyClass > 1.0) {
    errors.push('ТКП 339-2022 п. 8.6.2: Для жилых домов класс точности счетчика активной энергии должен быть не ниже 1.0 (для электронных). Индукционные с классом 2.0 допускаются только для объектов до 3,5 кВт или временных.');
  }

  return { valid: errors.length === 0, errors, warnings: [] };
};

/**
 * Проверка необходимости противопожарного УЗО (п. 8.7.16)
 */
export const requiresFireRCD = (projectType) => {
  if (!projectType) {
    return false;
  }

  const isHouse = projectType.includes('house') || projectType.includes('дом');
  return isHouse;
};
