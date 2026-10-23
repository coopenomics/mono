
/**
 * TypeORM-сущность ячейки хранения склада КУ (Эпик 19).
 *
 * Координаты `(section, level)` уникальны в пределах участка — две ячейки с
 * одним адресом на одном складе физически невозможны. Отдельно уникален `code`:
 * оператор ищет ячейку по адресу, и адрес не должен быть двусмысленным.
 *
 * Hot-path индексы:
 *   - `(coopname, braname, is_active)` — сетка склада своего КУ;
 *   - `(coopname, braname, section, level)` unique — координатный адрес;
 *   - `(coopname, braname, code)` unique — поиск по человекочитаемому адресу.
 */
export class MarketplaceStorageCellEntity {
  public id!: string;

  public coopname!: string;

  public braname!: string;

  // Координата-столбец: секция/стеллаж.
  public section!: string;

  // Координата-строка: ярус, нумерация с 1.
  public level!: number;

  // Человекочитаемый адрес; у перенесённых полок сохраняет исходную подпись.
  public code!: string;

  public label!: string | null;

  public is_active!: boolean;

  public created_at!: Date;

  public updated_at!: Date;
}
