import type { Kysely } from 'kysely';
import type { DB } from './database.types';

/** Запросы к основной базе кооператива через Kysely. */
export const KYSELY = Symbol.for('Controller.Database.Kysely');

export type Database = Kysely<DB>;
