export interface StatStripItem {
  key: string;
  /** Material-значок; у соседних показателей значки разные. */
  icon: string;
  /** Короткая подпись над числом. */
  caption: string;
  value: string | number;
  /** Тикер — приглушённо после числа. */
  symbol?: string;
  /** Пояснение под числом: что это за деньги. */
  sub?: string;
  /** Подробность во всплывающей подсказке у подписи. */
  hint?: string;
}
