
/**
 * Тип тары кооператива (Эпик 19): габариты и объём одной закупленной партии
 * боксов. Отдельная сущность, потому что объём транспорта в перевозке между
 * участками считается агрегацией по типам, а не по каждому боксу.
 */
export class MarketplaceContainerTypeEntity {
  public id!: string;

  public coopname!: string;

  public name!: string;

  public length_cm!: number;

  public width_cm!: number;

  public height_cm!: number;

  // default нужен, чтобы TypeORM смог добавить NOT NULL колонку на уже
  // существующих строках (расширение работает на synchronize). Реальное
  // значение проставит миграция v15, пересчитав его из габаритов.
  public volume_m3!: string;

  public max_weight_kg!: string | null;

  public is_active!: boolean;

  public created_at!: Date;

  public updated_at!: Date;
}

/**
 * Бокс кооперативного участка (Эпик 19). Код уникален в пределах кооператива —
 * именно он кодируется в QR, и скан не должен быть двусмысленным.
 *
 * Hot-path индексы:
 *   - `(coopname, code)` unique — резолв отсканированного QR;
 *   - `(coopname, braname, is_active)` — реестр боксов своего участка;
 *   - `(coopname, cell_id)` — что стоит в ячейке (сетка склада).
 */
export class MarketplaceContainerEntity {
  public id!: string;

  public coopname!: string;

  public braname!: string;

  public code!: string;

  public label!: string | null;

  public container_type_id!: string;

  // Ячейка, в которой стоит бокс. NULL — бокс не размещён, и это штатно.
  public cell_id!: string | null;

  public is_active!: boolean;

  public created_at!: Date;

  public updated_at!: Date;
}
