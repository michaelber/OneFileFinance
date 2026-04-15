import { isValid, parseISO, format } from 'date-fns';

export const formatAmount = (amount: number, currency: string, numberFormat: string, decimals: number = 2) => {
  const currencyCode = currency === '€' ? 'EUR' : currency === '$' ? 'USD' : currency === '£' ? 'GBP' : currency === '¥' ? 'JPY' : currency === 'CHF' ? 'CHF' : 'EUR';
  
  if (numberFormat === 'space-comma') {
    // 1 000,00 €
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount).replace('EUR', '€').replace('USD', '$');
  } else {
    // Default: $1,000.00
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(amount).replace('EUR', '€').replace('USD', '$');
  }
};

export const getDecimalSeparator = (numberFormat: string) => {
  return numberFormat === 'space-comma' ? ',' : '.';
};

export const parseAmount = (value: string | number, numberFormat: string) => {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const strValue = String(value);
  // Remove all characters except digits, minus, plus, comma, dot
  const cleaned = strValue.replace(/[^\d.,+-]/g, '');
  
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  
  let normalized = cleaned;
  if (lastComma > lastDot) {
    // Comma is decimal separator
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastDot > lastComma) {
    // Dot is decimal separator
    normalized = cleaned.replace(/,/g, '');
  } else if (lastComma !== -1) {
    // Only comma exists
    if (numberFormat === 'space-comma') {
      normalized = cleaned.replace(',', '.');
    } else {
      // Check if it looks like a thousands separator (e.g., 1,000)
      if (cleaned.length - lastComma === 4) {
        normalized = cleaned.replace(/,/g, '');
      } else {
        normalized = cleaned.replace(',', '.');
      }
    }
  }
  
  // Handle signs
  let sign = 1;
  if (normalized.includes('-')) {
    sign = -1;
    normalized = normalized.replace(/-/g, '');
  }
  normalized = normalized.replace(/\+/g, '');
  
  const parsed = parseFloat(normalized) * sign;
  return isNaN(parsed) ? 0 : parsed;
};
