import type { SchemaMigration, SchemaQueryRunner } from '@coopenomics/extension-kit';

/**
 * Журнал движения позиции склада (решение владельца 19.11.2026): приёмка,
 * размещение, маркировка, выдача, возврат, списание, перенос в остаток
 * кооператива и в будущем перемещение между участками — кто, когда, где.
 *
 * Запись ведёт триггер на `marketplace_inventory`: позицию меняют и сервисы,
 * и готовый SQL хранилища (выдача, отделение остатка, резерв), и только
 * триггер не пропускает ни одного пути. Исполнитель — из полей позиции:
 * принял (`received_by_operator_account`), промаркировал
 * (`labeled_by_operator_account`) и последнее действие
 * (`last_actor_account`, его заполняют операции места и маркировки).
 * Триггер срабатывает до записи строки и очищает `last_actor_account`:
 * исполнитель одноразовый, и следующий шаг (выдача готовым SQL) не
 * припишется прошлому исполнителю.
 * Выдачу узел дополняет при чтении данными акта выдачи.
 *
 * Уже принятым позициям журнал заполняется по их полям: приёмка, маркировка,
 * конечное состояние (выдано, списано). Индекс по позиции — журнал читается
 * только по ней; индекс по состоянию и времени — постраничный архив склада.
 */
const UP: readonly string[] = [
  `ALTER TABLE "marketplace_inventory" ADD COLUMN IF NOT EXISTS "last_actor_account" character varying(13)`,
  `CREATE TABLE IF NOT EXISTS "marketplace_inventory_movement" (
    "id" bigserial PRIMARY KEY,
    "coopname" character varying(13) NOT NULL,
    "inventory_id" uuid NOT NULL,
    "kind" character varying(32) NOT NULL,
    "status" character varying(32),
    "braname" character varying(13),
    "container_id" uuid,
    "cell_id" uuid,
    "quantity" integer,
    "barcode_value" character varying(128),
    "order_id" uuid,
    "actor_account" character varying(13),
    "at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS "ix_mkt_inventory_movement_item" ON "marketplace_inventory_movement" ("inventory_id", "at", "id")`,
  `CREATE INDEX IF NOT EXISTS "ix_mkt_inventory_status_updated" ON "marketplace_inventory" ("coopname", "status", "updated_at" DESC)`,
  `CREATE OR REPLACE FUNCTION marketplace_inventory_movement_log() RETURNS trigger AS $$
DECLARE
  k text;
  actor text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    k := CASE WHEN NEW.origin = 'WARRANTY_RETURN' THEN 'RETURNED'
              WHEN NEW.ownership = 'COOP' THEN 'TO_STOCK'
              ELSE 'RECEIVED' END;
    actor := COALESCE(NEW.last_actor_account, NEW.received_by_operator_account);
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('ISSUED', 'WRITTEN_OFF', 'RETURNED') THEN
    k := NEW.status;
    actor := NEW.last_actor_account;
  ELSIF NEW.braname IS DISTINCT FROM OLD.braname THEN
    k := 'TRANSFERRED';
    actor := NEW.last_actor_account;
  ELSIF NEW.ownership IS DISTINCT FROM OLD.ownership AND NEW.ownership = 'COOP' THEN
    k := 'TO_STOCK';
    actor := NEW.last_actor_account;
  ELSIF NEW.barcode_value IS DISTINCT FROM OLD.barcode_value THEN
    k := CASE WHEN NEW.barcode_value IS NULL THEN 'UNLABELED' ELSE 'LABELED' END;
    actor := COALESCE(NEW.labeled_by_operator_account, NEW.last_actor_account);
  ELSIF NEW.container_id IS DISTINCT FROM OLD.container_id OR NEW.cell_id IS DISTINCT FROM OLD.cell_id THEN
    k := 'PLACED';
    actor := NEW.last_actor_account;
  ELSIF NEW.reserved_order_id IS DISTINCT FROM OLD.reserved_order_id THEN
    k := CASE WHEN NEW.reserved_order_id IS NULL THEN 'RELEASED' ELSE 'RESERVED' END;
    actor := NEW.last_actor_account;
  ELSIF NEW.quantity_per_label IS DISTINCT FROM OLD.quantity_per_label THEN
    k := 'RESIZED';
    actor := NEW.last_actor_account;
  ELSE
    NEW.last_actor_account := NULL;
    RETURN NEW;
  END IF;
  INSERT INTO marketplace_inventory_movement
    (coopname, inventory_id, kind, status, braname, container_id, cell_id, quantity, barcode_value, order_id, actor_account, at)
  VALUES
    (NEW.coopname, NEW.id, k, NEW.status, NEW.braname, NEW.container_id, NEW.cell_id, NEW.quantity_per_label,
     NEW.barcode_value, COALESCE(NEW.order_id, NEW.reserved_order_id), actor,
     CASE WHEN TG_OP = 'INSERT' THEN COALESCE(NEW.received_at, now()) ELSE now() END);
  NEW.last_actor_account := NULL;
  RETURN NEW;
END
$$ LANGUAGE plpgsql`,
  `DROP TRIGGER IF EXISTS "trg_marketplace_inventory_movement" ON "marketplace_inventory"`,
  `CREATE TRIGGER "trg_marketplace_inventory_movement" BEFORE INSERT OR UPDATE ON "marketplace_inventory"
    FOR EACH ROW EXECUTE FUNCTION marketplace_inventory_movement_log()`,
  // Начальное заполнение: позициям, принятым до журнала, — приёмка, маркировка
  // и конечное состояние по их полям. Повтор миграции не дублирует записи.
  `INSERT INTO marketplace_inventory_movement (coopname, inventory_id, kind, status, braname, container_id, cell_id, quantity, barcode_value, order_id, actor_account, at)
    SELECT i.coopname, i.id, CASE WHEN i.origin = 'WARRANTY_RETURN' THEN 'RETURNED' ELSE 'RECEIVED' END, 'RECEIVED', i.braname, NULL, NULL,
           i.quantity_per_label, NULL, i.order_id, i.received_by_operator_account, i.received_at
    FROM marketplace_inventory i
    WHERE NOT EXISTS (SELECT 1 FROM marketplace_inventory_movement m WHERE m.inventory_id = i.id)`,
  `INSERT INTO marketplace_inventory_movement (coopname, inventory_id, kind, status, braname, container_id, cell_id, quantity, barcode_value, order_id, actor_account, at)
    SELECT i.coopname, i.id, 'LABELED', i.status, i.braname, i.container_id, i.cell_id, i.quantity_per_label, i.barcode_value, i.order_id,
           i.labeled_by_operator_account, i.labeled_at
    FROM marketplace_inventory i
    WHERE i.labeled_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM marketplace_inventory_movement m WHERE m.inventory_id = i.id AND m.kind = 'LABELED')`,
  `INSERT INTO marketplace_inventory_movement (coopname, inventory_id, kind, status, braname, container_id, cell_id, quantity, barcode_value, order_id, actor_account, at)
    SELECT i.coopname, i.id, i.status, i.status, i.braname, i.container_id, i.cell_id, i.quantity_per_label, i.barcode_value, i.order_id,
           NULL, i.updated_at
    FROM marketplace_inventory i
    WHERE i.status IN ('ISSUED', 'WRITTEN_OFF')
      AND NOT EXISTS (SELECT 1 FROM marketplace_inventory_movement m WHERE m.inventory_id = i.id AND m.kind = i.status)`,
];

const DOWN: readonly string[] = [
  'DROP TRIGGER IF EXISTS "trg_marketplace_inventory_movement" ON "marketplace_inventory"',
  'DROP FUNCTION IF EXISTS marketplace_inventory_movement_log()',
  'DROP INDEX IF EXISTS "ix_mkt_inventory_status_updated"',
  'DROP TABLE IF EXISTS "marketplace_inventory_movement"',
  'ALTER TABLE "marketplace_inventory" DROP COLUMN IF EXISTS "last_actor_account"',
];

export class MarketplaceInventoryMovement1795097639101 implements SchemaMigration {
  name = 'MarketplaceInventoryMovement1795097639101';

  public async up(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of UP) await queryRunner.query(sql);
  }

  public async down(queryRunner: SchemaQueryRunner): Promise<void> {
    for (const sql of DOWN) await queryRunner.query(sql);
  }
}
