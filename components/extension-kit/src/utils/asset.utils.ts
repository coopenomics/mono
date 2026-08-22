/**
 * Утилиты для работы с ассетами в формате "AMOUNT SYMBOL" (например, "100.0000 RUB")
 */
export class AssetUtils {
  /**
   * Парсит строку ассета и возвращает числовое значение и символ
   * @param asset Строка формата "100.0000 RUB"
   * @returns { amount: number, symbol: string } или { amount: 0, symbol: '' } если парсинг не удался
   */
  static parseAsset(asset: string | undefined): { amount: number; symbol: string } {
    if (!asset || typeof asset !== 'string') {
      return { amount: 0, symbol: '' };
    }

    // Удаляем лишние пробелы
    const trimmed = asset.trim();

    // Ищем паттерн: число (с возможной точкой) + пробел + символ
    const match = trimmed.match(/^(\d+\.?\d*)\s+([A-Z]+)$/);

    if (!match) {
      return { amount: 0, symbol: '' };
    }

    return {
      amount: parseFloat(match[1]),
      symbol: match[2],
    };
  }

  /**
   * Форматирует числовое значение и символ обратно в строку ассета
   * @param amount Числовое значение
   * @param symbol Символ валюты
   * @param precision Количество знаков после запятой (по умолчанию 4)
   * @returns Строка формата "100.0000 RUB"
   */
  static formatAsset(amount: number, symbol: string, precision = 4): string {
    if (!symbol) {
      return '0.0000';
    }
    return `${amount.toFixed(precision)} ${symbol}`;
  }

  /**
   * Складывает два ассета
   * @param asset1 Первый ассет в формате "100.0000 RUB"
   * @param asset2 Второй ассет в формате "50.0000 RUB"
   * @returns Результат сложения в формате "150.0000 RUB"
   * @throws Error если символы валют не совпадают
   */
  static addAssets(asset1: string | undefined, asset2: string | undefined): string {
    const parsed1 = this.parseAsset(asset1);
    const parsed2 = this.parseAsset(asset2);

    // Если оба ассета пустые или один из них пустой
    if (!parsed1.symbol && !parsed2.symbol) {
      return '0.0000';
    }

    if (!parsed1.symbol) {
      return asset2 || '0.0000';
    }

    if (!parsed2.symbol) {
      return asset1 || '0.0000';
    }

    // Проверяем совпадение символов валют
    if (parsed1.symbol !== parsed2.symbol) {
      throw new Error(
        `Cannot add assets with different symbols: ${parsed1.symbol} and ${parsed2.symbol}`
      );
    }

    const sum = parsed1.amount + parsed2.amount;
    return this.formatAsset(sum, parsed1.symbol);
  }

  /**
   * Складывает массив ассетов
   * @param assets Массив ассетов в формате "100.0000 RUB"
   * @returns Результат сложения в формате "150.0000 RUB"
   * @throws Error если символы валют не совпадают
   */
  static sumAssets(assets: (string | undefined)[]): string {
    if (!assets || assets.length === 0) {
      return '0.0000';
    }

    return assets.reduce((acc: string, asset: string | undefined) => {
      return this.addAssets(acc, asset);
    }, '0.0000');
  }
}
