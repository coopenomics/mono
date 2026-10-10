import { CoreBaseline1790197276751 } from './1790197276751-baseline';
import { PaymentsQuantityNumeric1790316882052 } from './1790316882052-payments-quantity-numeric';
import { RoleAssignments1791538523720 } from './1791538523720-role-assignments';
import type { SchemaMigrationClass } from '@coopenomics/extension-kit';

/**
 * Миграции таблиц ядра — в порядке появления (метка времени в имени класса).
 *
 * Список явный, а не глоб по каталогу: в собранном `dist` рядом с `.js` лежат
 * `.d.ts`, и глоб `*.{ts,js}` подхватил бы объявления типов. Новую миграцию
 * `pnpm schema:generate` дописывает сюда сама.
 *
 * Миграции таблиц расширений объявляются в их записях реестра
 * (`databaseMigrations`) и идут той же лентой.
 */
export const coreDatabaseMigrations: ReadonlyArray<SchemaMigrationClass> = [
  CoreBaseline1790197276751,
  PaymentsQuantityNumeric1790316882052,
  RoleAssignments1791538523720,
];
