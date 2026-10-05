import type { Kysely } from 'kysely';
import type { DB } from './database.types';

/** Токен общий с расширениями — живёт в каркасе расширения. */
export { KYSELY } from '@coopenomics/extension-kit';

/** Kysely со всеми таблицами основной базы — для хранилищ ядра. */
export type Database = Kysely<DB>;
