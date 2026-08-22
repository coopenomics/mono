import type { DataSource } from 'typeorm';

type MigrationLogger = {
  info: (message: string) => void;
  error: (message: string) => void;
  warn: (message: string) => void;
};

/**
 * Приведение чисел в журнале дельт и истории действий к канону прежнего
 * индексера.
 *
 * Зачем: parser2 декодирует данные цепи через antelope, а тот сериализует числа
 * по правилу fc — 64-битное целое становится строкой только когда само значение
 * шире 32 бит, float32/float64 строкой всегда. Прежний индексер (eosjs) писал
 * иначе: 64/128-битные целые всегда строкой, float числом. Под старый канон
 * написаны все потребители (схемы фабрики документов, GraphQL-типы) и
 * бэкфиллом перенесена вся история, поэтому первые же живые записи parser2
 * разошлись с ней: утверждение решения совета по собранию падало на валидации
 * «meet.id должно быть string». Сам parser2 исправлен с версии 1.9.0
 * (canonicalizeAbiJson в @coopenomics/coopos-ship-reader) — эта миграция
 * разово чинит то, что успело записаться в старом виде.
 *
 * Как: для каждого контракта берётся текущий ABI из цепи, и каждая строка
 * `blockchain_deltas.value` / `blockchain_actions.data` обходится по
 * объявлению её типа. Меняются только значения расходящихся типов; поля,
 * которых текущий ABI не знает (записи под старым ABI), остаются как есть.
 * Идемпотентна: канонические строки не переписываются.
 */

/** 64- и 128-битные целые: канон отдаёт их строкой всегда, не по величине. */
const WIDE_INT_TYPES = new Set(['int64', 'uint64', 'int128', 'uint128']);

/** Дробные: канон отдаёт их числом; float128 не входит — он всюду hex-строка. */
const FLOAT_TYPES = new Set(['float32', 'float64']);

interface AbiField {
  name: string;
  type: string;
}
interface AbiJson {
  types: Array<{ new_type_name: string; type: string }>;
  structs: Array<{ name: string; base: string; fields: AbiField[] }>;
  variants?: Array<{ name: string; types: string[] }>;
  tables: Array<{ name: string; type: string }>;
  actions: Array<{ name: string; type: string }>;
}

/**
 * Копия canonicalizeAbiJson из @coopenomics/coopos-ship-reader ≥0.4.0.
 * Миграция обязана быть самодостаточной: её поведение не должно меняться
 * вместе с зависимостями, а версия пакета на узле может быть любой.
 * Отличие от библиотеки — защита по typeof: здесь на входе исторические
 * данные, а не свежий вывод ABI-декодера, и значению вне схемы доверять нельзя.
 */
function canonicalize(value: unknown, typeName: string, abi: AbiJson, seenAliases: Set<string>): unknown {
  let name = typeName;

  for (;;) {
    if (name.endsWith('$')) {
      if (value === undefined) return value;
      name = name.slice(0, -1);
      continue;
    }
    if (name.endsWith('?')) {
      if (value === null || value === undefined) return value;
      name = name.slice(0, -1);
      continue;
    }
    if (name.endsWith('[]')) {
      const inner = name.slice(0, -2);
      if (!Array.isArray(value)) return value;
      return value.map((item) => canonicalize(item, inner, abi, seenAliases));
    }
    break;
  }

  const alias = abi.types.find((t) => t.new_type_name === name);
  if (alias) {
    if (seenAliases.has(name)) return value;
    const next = new Set(seenAliases);
    next.add(name);
    return canonicalize(value, alias.type, abi, next);
  }

  if (WIDE_INT_TYPES.has(name)) {
    return typeof value === 'number' || typeof value === 'string' ? String(value) : value;
  }
  if (FLOAT_TYPES.has(name)) {
    return typeof value === 'number' || typeof value === 'string' ? Number(value) : value;
  }

  const struct = abi.structs.find((s) => s.name === name);
  if (struct) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return value;
    const source = value as Record<string, unknown>;
    const out: Record<string, unknown> = { ...source };
    for (const field of collectStructFields(name, abi)) {
      if (field.name in source) {
        out[field.name] = canonicalize(source[field.name], field.type, abi, seenAliases);
      }
    }
    return out;
  }

  const variant = (abi.variants ?? []).find((v) => v.name === name);
  if (variant) {
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string') {
      return [value[0], canonicalize(value[1], value[0], abi, seenAliases)];
    }
    return value;
  }

  return value;
}

/** Поля структуры вместе с полями всей цепочки base-структур. */
function collectStructFields(structName: string, abi: AbiJson): AbiField[] {
  const fields: AbiField[] = [];
  const seen = new Set<string>();
  let current: string | undefined = structName;
  while (current && !seen.has(current)) {
    seen.add(current);
    const struct = abi.structs.find((s) => s.name === current);
    if (!struct) break;
    fields.unshift(...struct.fields);
    current = struct.base || undefined;
  }
  return fields;
}

async function fetchAbi(rpcUrl: string, account: string): Promise<AbiJson | null> {
  const response = await fetch(`${rpcUrl.replace(/\/$/, '')}/v1/chain/get_abi`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ account_name: account }),
  });
  if (!response.ok) return null;
  const data = (await response.json()) as { abi?: AbiJson };
  return data.abi ?? null;
}

const BATCH = 500;

/**
 * Проходит таблицу keyset-курсором по id и переписывает только строки,
 * чей JSON после канонизации изменился.
 */
async function normalizeTable(options: {
  dataSource: DataSource;
  logger: MigrationLogger;
  abis: Map<string, AbiJson>;
  table: string;
  contractColumn: string;
  typeColumn: string;
  payloadColumn: string;
  resolveTypeName: (abi: AbiJson, name: string) => string | null;
}): Promise<number> {
  const { dataSource, logger, abis, table, contractColumn, typeColumn, payloadColumn, resolveTypeName } = options;
  let lastId = '';
  let updated = 0;

  for (;;) {
    const rows: Array<{ id: string; contract: string; type_name: string; payload: unknown }> = await dataSource.query(
      `SELECT id, ${contractColumn} AS contract, ${typeColumn} AS type_name, ${payloadColumn} AS payload
         FROM ${table}
        WHERE ($1 = '' OR id > $1::uuid) AND ${payloadColumn} IS NOT NULL
        ORDER BY id
        LIMIT ${BATCH}`,
      [lastId]
    );
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].id;

    for (const row of rows) {
      const abi = abis.get(row.contract);
      if (!abi) continue;
      const typeName = resolveTypeName(abi, row.type_name);
      if (!typeName) continue;

      const canonical = canonicalize(row.payload, typeName, abi, new Set());
      if (JSON.stringify(canonical) === JSON.stringify(row.payload)) continue;

      await dataSource.query(`UPDATE ${table} SET ${payloadColumn} = $1::jsonb WHERE id = $2::uuid`, [
        JSON.stringify(canonical),
        row.id,
      ]);
      updated += 1;
    }
  }

  logger.info(`${table}: приведено строк — ${updated}`);
  return updated;
}

export default {
  name: 'Приведение чисел журнала дельт и истории действий к канону прежнего индексера',

  async up({ dataSource, logger }: { dataSource: DataSource; logger: MigrationLogger }): Promise<boolean> {
    const rpcUrl = process.env.BLOCKCHAIN_RPC;
    if (!rpcUrl) {
      logger.error('BLOCKCHAIN_RPC env не задан — канонизация чисел невозможна');
      return false;
    }

    try {
      const contracts: Array<{ account: string }> = await dataSource.query(
        `SELECT DISTINCT code AS account FROM blockchain_deltas
          UNION
         SELECT DISTINCT account FROM blockchain_actions`
      );

      const abis = new Map<string, AbiJson>();
      for (const { account } of contracts) {
        const abi = await fetchAbi(rpcUrl, account);
        if (abi) {
          abis.set(account, abi);
        } else {
          // Аккаунт без ABI (или цепь его не отдала) — его записи остаются как
          // есть: без схемы отличить uint64 от обычного числа невозможно.
          logger.warn(`ABI аккаунта ${account} недоступен — его записи пропущены`);
        }
      }

      await normalizeTable({
        dataSource,
        logger,
        abis,
        table: 'blockchain_deltas',
        contractColumn: 'code',
        typeColumn: '"table"',
        payloadColumn: 'value',
        resolveTypeName: (abi, name) => abi.tables.find((t) => t.name === name)?.type ?? null,
      });

      await normalizeTable({
        dataSource,
        logger,
        abis,
        table: 'blockchain_actions',
        contractColumn: 'account',
        typeColumn: 'name',
        payloadColumn: 'data',
        resolveTypeName: (abi, name) => abi.actions.find((a) => a.name === name)?.type ?? null,
      });

      return true;
    } catch (error: any) {
      logger.error(`Ошибка канонизации чисел: ${error?.message}`);
      return false;
    }
  },
};
