export { default as CodeScanner } from './CodeScanner.vue';

/**
 * Линейные (1D) форматы штрих-кодов имущества + QR на всякий случай. Единый
 * набор для всех мест, где сканируется штрих-код имущества (привязка на складе,
 * сверка на возврате) — чтобы не расходились по страницам.
 */
export const BARCODE_FORMATS = [
  'ean_13',
  'ean_8',
  'upc_a',
  'upc_e',
  'code_128',
  'code_39',
  'itf',
  'codabar',
  'qr_code',
];
