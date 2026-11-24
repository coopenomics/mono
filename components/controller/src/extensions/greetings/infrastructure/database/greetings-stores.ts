import { Module, type Provider } from '@nestjs/common';
import type { Kysely } from 'kysely';
import { KYSELY, TableStore } from '@coopenomics/extension-kit';
import {
  CALENDAR_TABLE,
  GreetingCalendarRecord,
  GreetingSendRecord,
  GreetingTemplateRecord,
  SENDS_TABLE,
  TEMPLATES_TABLE,
} from './greetings.records';

export const GREETINGS_TEMPLATE_STORE = Symbol('Greetings.TEMPLATE_STORE');
export const GREETINGS_CALENDAR_STORE = Symbol('Greetings.CALENDAR_STORE');
export const GREETINGS_SEND_STORE = Symbol('Greetings.SEND_STORE');

/* eslint-disable @typescript-eslint/no-explicit-any */
export const greetingsStoreProviders: Provider[] = [
  {
    provide: GREETINGS_TEMPLATE_STORE,
    inject: [KYSELY],
    useFactory: (db: Kysely<any>) =>
      new TableStore<GreetingTemplateRecord>(db, {
        table: TEMPLATES_TABLE,
        primaryKey: ['id'],
        dates: ['period_start', 'period_end'],
        updatedAt: 'updated_at',
        sameNames: true,
        columns: ['id', 'title', 'period_start', 'period_end', 'subject', 'body', 'status', 'created_by', 'created_at', 'updated_at'],
      }),
  },
  {
    provide: GREETINGS_CALENDAR_STORE,
    inject: [KYSELY],
    useFactory: (db: Kysely<any>) =>
      new TableStore<GreetingCalendarRecord>(db, {
        table: CALENDAR_TABLE,
        primaryKey: ['username'],
        updatedAt: 'updated_at',
        sameNames: true,
        columns: ['username', 'account_type', 'birth_year', 'birth_month', 'birth_day', 'updated_at'],
      }),
  },
  {
    provide: GREETINGS_SEND_STORE,
    inject: [KYSELY],
    useFactory: (db: Kysely<any>) =>
      new TableStore<GreetingSendRecord>(db, {
        table: SENDS_TABLE,
        primaryKey: ['id'],
        updatedAt: 'updated_at',
        sameNames: true,
        columns: [
          'id',
          'username',
          'year',
          'status',
          'reason',
          'error',
          'template_id',
          'template_title',
          'subject',
          'attempts',
          'created_at',
          'updated_at',
        ],
      }),
  },
];

/** База расширения: шлюзы таблиц шаблонов, календаря и журнала. */
@Module({
  providers: [...greetingsStoreProviders],
  exports: [...greetingsStoreProviders],
})
export class GreetingsDatabaseModule {}
