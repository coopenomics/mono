import { CoreBaseline1790197276751 } from './1790197276751-baseline';
import type { MigrationInterface } from 'typeorm';

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
export const coreDatabaseMigrations: ReadonlyArray<new () => MigrationInterface> = [CoreBaseline1790197276751];
