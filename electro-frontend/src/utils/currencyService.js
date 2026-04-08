// Сервис для работы с валютами
// Использует API Национального банка Республики Беларусь для получения актуального курса

const CURRENCY_API_URL = 'https://api.nbrb.by/exrates/rates/USD?parammode=2&periodicity=0';

// Кэш для курса валют (обновляется раз в час)
let exchangeRateCache = {
  rate: null,
  timestamp: null,
  ttl: 3600000 // 1 час в миллисекундах
};

/**
 * Получает актуальный курс доллара США к белорусскому рублю
 * @returns {Promise<number>} Курс обмена (1 USD = X BYN)
 */
export const getExchangeRate = async () => {
  const now = Date.now();
  
  // Проверяем кэш
  if (exchangeRateCache.rate && exchangeRateCache.timestamp && 
      (now - exchangeRateCache.timestamp) < exchangeRateCache.ttl) {
    return exchangeRateCache.rate;
  }

  try {
    const response = await fetch(CURRENCY_API_URL, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      // Добавляем режим CORS для работы с внешним API
      mode: 'cors',
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Проверяем структуру ответа
    if (!data || !data.Cur_OfficialRate) {
      throw new Error('Неверный формат ответа от API');
    }
    
    // Курс за 1 единицу валюты (Cur_Scale обычно 1 для USD)
    const rate = data.Cur_OfficialRate / (data.Cur_Scale || 1);
    
    // Обновляем кэш
    exchangeRateCache = {
      rate: rate,
      timestamp: now
    };
    
    return rate;
  } catch (error) {
    console.error('Ошибка получения курса валют:', error);
    
    // Если есть старый курс в кэше, используем его
    if (exchangeRateCache.rate) {
      console.warn('Используется устаревший курс валют из кэша');
      return exchangeRateCache.rate;
    }
    
    // Если кэша нет, используем примерный курс (обновляется вручную)
    // Актуальный курс можно посмотреть на сайте НБРБ
    console.warn('Используется примерный курс валют: 1 USD = 3.25 BYN');
    const fallbackRate = 3.25;
    
    // Сохраняем fallback в кэш, чтобы не запрашивать постоянно
    exchangeRateCache = {
      rate: fallbackRate,
      timestamp: now
    };
    
    return fallbackRate;
  }
};

/**
 * Конвертирует сумму из BYN в USD
 * @param {number} amountBYN - Сумма в белорусских рублях
 * @returns {Promise<number>} Сумма в долларах США
 */
export const convertBYNtoUSD = async (amountBYN) => {
  const rate = await getExchangeRate();
  return amountBYN / rate;
};

/**
 * Конвертирует сумму из USD в BYN
 * @param {number} amountUSD - Сумма в долларах США
 * @returns {Promise<number>} Сумма в белорусских рублях
 */
export const convertUSDtoBYN = async (amountUSD) => {
  const rate = await getExchangeRate();
  return amountUSD * rate;
};

/**
 * Форматирует сумму в белорусских рублях
 * @param {number} amount - Сумма
 * @returns {string} Отформатированная строка
 */
export const formatBYN = (amount) => {
  return new Intl.NumberFormat('ru-BY', {
    style: 'currency',
    currency: 'BYN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

/**
 * Форматирует сумму в долларах США
 * @param {number} amount - Сумма
 * @returns {string} Отформатированная строка
 */
export const formatUSD = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

