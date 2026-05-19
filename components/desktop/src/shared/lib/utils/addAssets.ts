import { floorDecimalString } from './floorDecimalString';

/**
 * Суммирует два актива (IAsset) с одинаковой валютой и возвращает
 * результат с 2 знаками после запятой, обрезанный вниз (toward-zero),
 * чтобы согласоваться с `formatAsset2Digits`: пользователь никогда
 * не видит сумму больше реальной.
 *
 * @param asset1 - первый актив (например "100.0000 RUB")
 * @param asset2 - второй актив (например "50.0000 RUB")
 * @returns сумма активов с 2 знаками (например "150.00 RUB")
 */
export const addAssets = (asset1: string, asset2: string): string => {
  if (!asset1 || asset1 === '0') return asset2 || '0.00';
  if (!asset2 || asset2 === '0') return asset1 || '0.00';

  // Извлекаем числовые значения и символы валюты
  const parseAsset = (asset: string) => {
    const parts = asset.trim().split(' ');
    const cleanValue = parts[0] || asset;
    const currencySymbol = parts[1] || '';
    const numericValue = cleanValue.replace(/[^\d.-]/g, '');
    const numValue = parseFloat(numericValue);
    return { value: isNaN(numValue) ? 0 : numValue, currency: currencySymbol };
  };

  const parsed1 = parseAsset(asset1);
  const parsed2 = parseAsset(asset2);

  // Проверяем, что валюты совпадают
  if (parsed1.currency && parsed2.currency && parsed1.currency !== parsed2.currency) {
    console.warn('Attempting to add assets with different currencies:', asset1, asset2);
    return asset1; // Возвращаем первый актив в случае ошибки
  }

  const value1 = parsed1.value;
  const value2 = parsed2.value;

  const sum = value1 + value2;
  const currencySymbol = parsed1.currency || parsed2.currency;

  // Truncate вниз через строку (с запасом точности до 10 знаков, чтобы FP-шум
  // не округлил 0.29 как 0.28). Никогда не показываем сумму больше реальной.
  const formattedNumber = floorDecimalString(sum.toFixed(10), 2);

  return currencySymbol
    ? `${formattedNumber} ${currencySymbol}`
    : formattedNumber;
};
