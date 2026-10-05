import type { SchemaMigration as MigrationInterface, SchemaQueryRunner as QueryRunner } from '@coopenomics/extension-kit';

/**
 * Таблицы первой версии Стола заказов убраны: заявки на товар с картинками и
 * значениями характеристик, характеристики, словари и их значения.
 *
 * Операции, которые их читали (заявки, характеристики, дерево внешнего
 * справочника), убраны вместе с сервисами: рабочий стол ими не пользовался,
 * обёрток в SDK не было, записи в эти таблицы узел не вёл (C28-87, решение
 * владельца от 03.10.2026, удаление таблиц подтверждено им 04.10.2026).
 * Категории и типы товаров остаются — по ним кооператив ведёт список
 * доступных категорий.
 *
 * Порядок — от зависимых таблиц к тем, на кого они ссылаются.
 */
const UP: readonly string[] = [
  'DROP TABLE IF EXISTS "marketplace_request_attribute_values"',
  'DROP TABLE IF EXISTS "marketplace_request_images"',
  'DROP TABLE IF EXISTS "marketplace_requests"',
  'DROP TABLE IF EXISTS "category_type_attributes"',
  'DROP TABLE IF EXISTS "dictionary_values"',
  'DROP TABLE IF EXISTS "attributes"',
  'DROP TABLE IF EXISTS "dictionaries"',
  'DROP TYPE IF EXISTS "public"."marketplace_request_images_image_type_enum"',
  'DROP TYPE IF EXISTS "public"."marketplace_requests_type_enum"',
  'DROP TYPE IF EXISTS "public"."marketplace_requests_status_enum"',
];

export class MarketplaceDropFirstVersionCatalog1791028868299 implements MigrationInterface {
  name = 'MarketplaceDropFirstVersionCatalog1791028868299';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    throw new Error(
      'MarketplaceDropFirstVersionCatalog1791028868299 не откатывается: сущностей и кода этих таблиц в узле больше нет'
    );
  }
}
