import React, { useState, useEffect } from 'react';
import { getExchangeRate, formatBYN, formatUSD, convertBYNtoUSD } from '../../utils/currencyService';
import './CurrencyConverter.css';

const CurrencyConverter = ({ amountBYN, onCurrencyChange }) => {
  const [currency, setCurrency] = useState('BYN');
  const [amountUSD, setAmountUSD] = useState(0);
  const [exchangeRate, setExchangeRate] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadExchangeRate();
  }, []);

  useEffect(() => {
    if (amountBYN && exchangeRate) {
      convertAmount();
    }
  }, [amountBYN, exchangeRate, currency]);

  const loadExchangeRate = async () => {
    try {
      setLoading(true);
      const rate = await getExchangeRate();
      setExchangeRate(rate);
    } catch (error) {
      console.error('Ошибка загрузки курса валют:', error);
    } finally {
      setLoading(false);
    }
  };

  const convertAmount = async () => {
    if (currency === 'USD' && amountBYN) {
      const usdAmount = await convertBYNtoUSD(amountBYN);
      setAmountUSD(usdAmount);
    }
  };

  const handleCurrencyChange = (newCurrency) => {
    setCurrency(newCurrency);
    if (onCurrencyChange) {
      onCurrencyChange(newCurrency);
    }
  };

  if (loading) {
    return (
      <div className="currency-converter">
        <span className="currency-loading">Загрузка курса...</span>
      </div>
    );
  }

  return (
    <div className="currency-converter">
      <div className="currency-display">
        <span className="currency-amount">
          {currency === 'BYN' ? formatBYN(amountBYN || 0) : formatUSD(amountUSD || 0)}
        </span>
        <div className="currency-switcher">
          <button
            className={`currency-btn ${currency === 'BYN' ? 'active' : ''}`}
            onClick={() => handleCurrencyChange('BYN')}
            title="Белорусский рубль"
          >
            BYN
          </button>
          <button
            className={`currency-btn ${currency === 'USD' ? 'active' : ''}`}
            onClick={() => handleCurrencyChange('USD')}
            title="Доллар США"
          >
            USD
          </button>
        </div>
      </div>
      {exchangeRate && (
        <div className="exchange-rate-info">
          <small>Курс: 1 USD = {exchangeRate.toFixed(4)} BYN</small>
        </div>
      )}
    </div>
  );
};

export default CurrencyConverter;









