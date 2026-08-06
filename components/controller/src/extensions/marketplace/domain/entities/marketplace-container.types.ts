/**
 * Бокс (контейнер) — тара кооперативного участка, в которую складывают
 * имущество. У каждого бокса свой QR-код; бокс может стоять в ячейке склада,
 * а может не стоять нигде — наполненный бокс в углу это нормальное состояние,
 * а не незавершённая операция.
 *
 * Габариты и объём живут на **типе** бокса, а не на самом боксе: тара
 * закупается одинаковыми партиями, и потребный объём транспорта считается
 * агрегацией по типам, а не суммированием полей полусотни карточек.
 */
export interface MarketplaceContainerTypeProps {
  id: string;
  coopname: string;
  /** Название типа: «Ящик 600×400×300». */
  name: string;
  length_cm: number;
  width_cm: number;
  height_cm: number;
  /** Полезный объём в литрах (numeric-строка). */
  volume_m3: string;
  /** Предельная загрузка в килограммах; NULL — не нормируется. */
  max_weight_kg: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface MarketplaceContainerProps {
  id: string;
  coopname: string;
  /** Кооперативный участок, за которым числится бокс. */
  braname: string;
  /** Код бокса — то, что закодировано в QR и напечатано на этикетке. */
  code: string;
  /** Подпись оператора: «Молочка», «Заказ Ивановой». NULL — достаточно кода. */
  label: string | null;
  container_type_id: string;
  /** Ячейка, в которой стоит бокс; NULL — бокс не размещён. */
  cell_id: string | null;
  /** Выведенный из оборота бокс не предлагается при размещении. */
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

/** Префикс кодов боксов — отличает адрес тары от адреса ячейки на этикетке. */
export const MARKETPLACE_CONTAINER_CODE_PREFIX = 'BX';

/** Разрядность номера в коде бокса: BX-0001. */
const CONTAINER_CODE_DIGITS = 4;

/** Код бокса из порядкового номера: 1 → «BX-0001». */
export function buildContainerCode(sequence: number): string {
  return `${MARKETPLACE_CONTAINER_CODE_PREFIX}-${String(sequence).padStart(CONTAINER_CODE_DIGITS, '0')}`;
}

/** Порядковый номер из кода бокса; NULL — код заведён вручную не по схеме. */
export function parseContainerCodeSequence(code: string): number | null {
  const match = new RegExp(`^${MARKETPLACE_CONTAINER_CODE_PREFIX}-(\\d+)$`).exec(code.trim());
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Полезный объём в кубометрах из габаритов в сантиметрах.
 *
 * Сантиметры, потому что в них тару меряют на месте: «ящик сто на сто на
 * тридцать». Миллиметры — язык каталогов поставщиков тары, а не кладовщика с
 * рулеткой, и на них легко ошибиться на порядок.
 *
 * Объём — в кубометрах: он нужен ровно для одного, прикинуть какая машина
 * увезёт партию боксов между участками. Перевозку считают кубами («нужно 10
 * кубов»). Четыре знака после запятой — чтобы и мелкая коробка не схлопнулась
 * в ноль.
 */
export function computeVolumeM3(length_cm: number, width_cm: number, height_cm: number): string {
  const m3 = (length_cm * width_cm * height_cm) / 1_000_000;
  return m3.toFixed(4);
}
