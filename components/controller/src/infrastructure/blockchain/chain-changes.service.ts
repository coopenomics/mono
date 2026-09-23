import { Inject, Injectable } from '@nestjs/common';
import type { PubSub } from 'graphql-subscriptions';
import type { IDelta } from '@coopenomics/extension-kit/sync';
import type { IChainChangesPort, InnerChainChangesTable } from '@coopenomics/innercoop';
import { Ledger2Contract } from 'cooptypes';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { config } from '~/config';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';

/** Сигнал ленты: где и в каком блоке изменилась строка. Данных строки нет. */
export interface ChainChangeSignal {
  code: string;
  table: string;
  scope: string;
  primary_key: string;
  block_num: number;
}

/** Таблицы ядра, которые читают столы. Расширения объявляют свои через порт. */
const CORE_TABLES: InnerChainChangesTable[] = [
  {
    code: Ledger2Contract.contractName.production,
    table: Ledger2Contract.Tables.UserWallets.tableName,
    owner_field: 'username',
  },
];

/** Канал таблицы, открытой всем пайщикам кооператива. */
export function chainChangesTopic(coopname: string, code: string, table: string): string {
  return `chain:${coopname}:${code}:${table}`;
}

/** Канал строк личной таблицы, принадлежащих пайщику. */
export function chainChangesOwnerTopic(coopname: string, code: string, table: string, username: string): string {
  return `${chainChangesTopic(coopname, code, table)}:user:${username}`;
}

/** Канал совета по личной таблице — все её строки. */
export function chainChangesCouncilTopic(coopname: string, code: string, table: string): string {
  return `${chainChangesTopic(coopname, code, table)}:council`;
}

/**
 * Лента изменений цепи (см. `chain-changes.port.ts`). Потребитель зовёт
 * `publish`, когда дельта сохранена и её слушатели отработали, — сигнал
 * никогда не опережает базу, и стол по нему читает уже новое.
 */
@Injectable()
export class ChainChangesService implements IChainChangesPort {
  private readonly tables = new Map<string, InnerChainChangesTable>();

  constructor(
    private readonly logger: WinstonLoggerService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub
  ) {
    this.logger.setContext(ChainChangesService.name);
    this.declareTables(CORE_TABLES);
  }

  declareTables(tables: InnerChainChangesTable[]): void {
    for (const t of tables) this.tables.set(key(t.code, t.table), t);
  }

  /** Объявленная таблица либо `undefined`. */
  tableOf(code: string, table: string): InnerChainChangesTable | undefined {
    return this.tables.get(key(code, table));
  }

  /** Все объявленные таблицы — для подписки без перечня. */
  declared(): InnerChainChangesTable[] {
    return [...this.tables.values()];
  }

  /**
   * Опубликовать изменение строки. Необъявленная таблица и чужой кооператив —
   * молчим. Строка личной таблицы уходит владельцу и совету; снятая строка
   * значения не несёт, владельца не назвать — её видит только совет.
   * Сбой шины не должен ронять разбор цепи: ошибка — в журнал.
   */
  async publish(delta: IDelta): Promise<void> {
    const declared = this.tableOf(delta.code, delta.table);
    if (!declared || delta.scope !== config.coopname) return;

    const signal: ChainChangeSignal = {
      code: delta.code,
      table: delta.table,
      scope: String(delta.scope),
      primary_key: String(delta.primary_key),
      block_num: Number(delta.block_num),
    };
    const coopname = config.coopname;
    const topics: string[] = [];
    if (!declared.owner_field) {
      topics.push(chainChangesTopic(coopname, delta.code, delta.table));
    } else {
      const owner = (delta.value as Record<string, unknown> | undefined)?.[declared.owner_field];
      if (delta.present !== false && owner) {
        topics.push(chainChangesOwnerTopic(coopname, delta.code, delta.table, String(owner)));
      }
      topics.push(chainChangesCouncilTopic(coopname, delta.code, delta.table));
    }

    try {
      await Promise.all(topics.map((topic) => this.pubSub.publish(topic, { chainChanges: signal })));
    } catch (error: any) {
      this.logger.warn(`Лента изменений: сигнал ${delta.code}::${delta.table} не опубликован — ${error?.message ?? error}`);
    }
  }
}

function key(code: string, table: string): string {
  return `${code}::${table}`;
}
