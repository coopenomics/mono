import {
  QueryNode,
  SelectionNode,
  type KyselyPlugin,
  type PluginTransformQueryArgs,
  type PluginTransformResultArgs,
  type QueryResult,
  type RootOperationNode,
  type UnknownRow,
} from 'kysely';
import type { PendingLocalChange } from '@coopenomics/extension-kit';

export type LocalChange = PendingLocalChange;

/** Куда уходит изменение: сразу в ленту либо в очередь до фиксации транзакции. */
export type LocalChangeSink = (change: LocalChange) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyNode = any;

function tableName(node: AnyNode): string | undefined {
  const table = node?.kind === 'AliasNode' ? node.node : node;
  return table?.kind === 'TableNode' ? table.table?.identifier?.name : undefined;
}

/** Таблица, в которую пишет запрос; у чтения — пусто. */
function writtenTable(node: RootOperationNode): string | undefined {
  const any = node as AnyNode;
  if (any.kind === 'InsertQueryNode') return tableName(any.into);
  if (any.kind === 'UpdateQueryNode') return tableName(any.table);
  if (any.kind === 'DeleteQueryNode') return tableName(any.from?.froms?.[0]);
  return undefined;
}

/**
 * Сигналы ленты изменений для таблиц базы узла, записанных через Kysely
 * (C28-81) — замена подписчика TypeORM для переведённых доменов.
 *
 * Любая вставка, правка и удаление в наблюдаемой таблице порождает сигнал
 * «перечитай». Строка нужна ленте целиком (по ней определяется владелец),
 * поэтому запросу без `RETURNING` он добавляется. Сырой `sql` плагин не
 * видит — такую запись публикует её автор.
 */
export class LocalChangesPlugin implements KyselyPlugin {
  private readonly tables = new WeakMap<object, string>();

  constructor(
    private readonly isWatched: (table: string) => boolean,
    private readonly primaryKeyOf: (table: string) => string[],
    private readonly sink: LocalChangeSink
  ) {}

  transformQuery(args: PluginTransformQueryArgs): RootOperationNode {
    const table = writtenTable(args.node);
    if (!table || !this.isWatched(table)) return args.node;
    this.tables.set(args.queryId, table);
    if ((args.node as AnyNode).returning) return args.node;
    return QueryNode.cloneWithReturning(args.node as AnyNode, [SelectionNode.createSelectAll()]) as RootOperationNode;
  }

  async transformResult(args: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
    const table = this.tables.get(args.queryId);
    if (!table) return args.result;
    const keys = this.primaryKeyOf(table);
    for (const row of args.result.rows ?? []) {
      const primary_key = keys
        .map((column) => row[column])
        .filter((value) => value !== undefined && value !== null)
        .map(String)
        .join(':');
      this.sink({ table, primary_key, row });
    }
    return args.result;
  }
}
