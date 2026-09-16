import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

type StoredPackage = {
  id: string;
  size: number;
  is_default?: boolean;
  quantity_available?: number;
  quantity_blocked?: number;
  quantity_consumed?: number;
};

type OfferRow = {
  id: string;
  packages: StoredPackage[] | null;
  quantity_available: string | number;
  quantity_blocked: string | number;
  quantity_consumed: string | number;
};

/**
 * Остаток по упаковкам (решение владельца 08.09.2026, Стол заказов).
 *
 * До этого остаток предложения при отпуске упаковкой вёлся одним котлом в
 * базовых единицах: десять литров можно было разобрать и двадцатью бутылками
 * по 0,5, и десятью по литру. Теперь свободное, заблокированное и выданное
 * ведутся на каждой упаковке в упаковках, а счётчики предложения — их сумма.
 *
 * Котёл существующих предложений делить не по чему: система не знает, в
 * каких бутылках он лежит. Поэтому весь котёл отдаётся упаковке по умолчанию
 * (целым числом упаковок), остальные упаковки получают ноль — поставщик
 * поправит остаток в форме предложения. Упаковки, уже получившие счётчики,
 * не трогаются: миграцию можно перезапускать.
 *
 * Заказам, оформленным упаковкой до появления `package_id`, идентификатор
 * дозаполняется по содержимому упаковки — иначе их отмена не вернула бы штуки
 * на упаковку. Колонка добавляется здесь же, потому что миграции идут до
 * синхронизации схемы приложением.
 */
export default {
  name: 'offer package counters',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const qr = dataSource.createQueryRunner();
    await qr.connect();
    try {
      await qr.query(`ALTER TABLE marketplace_order ADD COLUMN IF NOT EXISTS package_id varchar(64) NULL`);

      const offers = (await qr.query(
        `SELECT id, packages, quantity_available, quantity_blocked, quantity_consumed
           FROM marketplace_offer
          WHERE sale_form = 'packaged' AND jsonb_array_length(COALESCE(packages, '[]'::jsonb)) > 0`
      )) as OfferRow[];

      let seeded = 0;
      for (const offer of offers) {
        const packages = offer.packages ?? [];
        if (packages.every((p) => p.quantity_available !== undefined)) continue;
        const target = packages.find((p) => p.is_default) ?? packages[0];
        const next = packages.map((p) => ({
          ...p,
          quantity_available: p.quantity_available ?? (p === target ? wholePackages(offer.quantity_available, p.size) : 0),
          quantity_blocked: p.quantity_blocked ?? (p === target ? wholePackages(offer.quantity_blocked, p.size) : 0),
          quantity_consumed: p.quantity_consumed ?? (p === target ? wholePackages(offer.quantity_consumed, p.size) : 0),
        }));
        await qr.query(`UPDATE marketplace_offer SET packages = $2::jsonb WHERE id = $1`, [
          offer.id,
          JSON.stringify(next),
        ]);
        seeded += 1;
      }

      const backfilled = (await qr.query(
        `UPDATE marketplace_order ord
            SET package_id = p->>'id'
           FROM marketplace_offer o, jsonb_array_elements(COALESCE(o.packages, '[]'::jsonb)) p
          WHERE ord.offer_id = o.id
            AND ord.package_id IS NULL
            AND ord.package_size > 0
            AND (p->>'size')::numeric = ord.package_size
        RETURNING ord.id`
      )) as unknown[];

      logger.info(
        `Остаток по упаковкам: счётчики заведены у ${seeded} предложений из ${offers.length} упаковочных; ` +
          `упаковка дозаполнена у ${backfilled.length} заказов`
      );
      return true;
    } catch (error) {
      logger.error(`offer package counters failed: ${(error as Error).message}`);
      throw error;
    } finally {
      await qr.release();
    }
  },

  async down({ logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    // Счётчики упаковок и упаковка заказа — данные, которых раньше не было;
    // прежний код их не читает и им не мешают. Снимать нечего.
    logger.info('offer package counters: down — ничего не делаем');
    return true;
  },
};

/** Целое число упаковок в базовом количестве; остаток от деления пропадает. */
function wholePackages(baseQuantity: string | number, size: number): number {
  const qty = Number(baseQuantity);
  if (!(size > 0) || !Number.isFinite(qty) || qty <= 0) return 0;
  return Math.floor(qty / size + 1e-9);
}
