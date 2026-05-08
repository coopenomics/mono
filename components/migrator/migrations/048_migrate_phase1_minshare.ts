/**
 * Phase 1 ускоренный инкремент (Эпик 3 / story 3.6; ADR-008): миграция
 * минимальных паевых взносов w.reg.minshr per-coop из soviet::participants
 * в ledger2::userwallets через ledger2::migrate3.
 *
 * ВАЖНО: запускается ТОЛЬКО ПОСЛЕ ledger2::migrate (бухгалтерский транзит
 * legacy → L2). Если migrate не выполнен — миграция падает с явной ошибкой,
 * чтобы не перезаписать L3 поверх свежих apply'ев и не сломать инвариант
 * Σ L3 == L2.
 *
 * Логика:
 *   0. Проверяем `ledger2::meta`: запись должна существовать и
 *      `migrated=true` — иначе ledger2::migrate ещё не отработал.
 *   1. Для каждого coop из registrator::coops:
 *      a. Читаем soviet::participants[scope=coopname] со status=accepted
 *      b. Для каждого пайщика — пишем L3 на сумму, ЗАФИКСИРОВАННУЮ на самом
 *         пайщике (`participant.minimum_amount`), а НЕ на текущий coop.minimum.
 *         coop.minimum мог измениться после вступления (повышение/понижение),
 *         но фактический взнос пайщика, попавший в legacy::accounts[80],
 *         равен `participant.minimum_amount`.
 *      c. ledger2::migrate3(coopname, w.reg.minshr, username,
 *                          available=p.minimum_amount, blocked=0)
 *
 * Кандидаты со status=payed (заплатили gateway, но не приняты советом) сюда
 * НЕ попадают — их деньги добавятся естественным confirmreg через
 * apply(PUT_MINSHARE)+apply(PAY_ENTRANCE).
 *
 * Особенность ADR-008: w.reg.minshr — USER_SHARED, исключённый из cross-contract
 * проверки соглашений (сразу при регистрации, до подписания ЦК-соглашения).
 *
 * w.reg.entry (вступительные, COOPERATIVE) НЕ затрагивается этой миграцией —
 * он агрегатный (без L3-разбивки) и заполнен Эпиком 1 миграцией legacy::accounts.
 *
 * Идемпотентно: ledger2::migrate3 устанавливает значение (не +=).
 */

import { Ledger2Contract, SovietContract } from 'cooptypes';
import type { Migration } from '../src/migration_interface';
import { api, rpc } from '../src/eos';
import { listCoops } from '../src/utils/listCoops';
import { fetchAllRows } from '../src/utils/fetchAllRows';

const W_REG_MINSHR = 'w.reg.minshr';
const BATCH = 50;

interface ILedger2MetaRow {
  id: number;
  migrated: number | boolean;
  migrated_coops: number;
  last_migrated_coop_index: number;
  migrated_at: string;
}

async function isLedger2MigrateDone(): Promise<boolean> {
  const rows = await rpc.get_table_rows({
    json: true,
    code: Ledger2Contract.contractName.production,
    scope: Ledger2Contract.contractName.production,
    table: 'meta',
    limit: 1,
  });
  const row = rows.rows[0] as ILedger2MetaRow | undefined;
  if (!row) return false;
  return row.migrated === true || row.migrated === 1;
}

function zeroOf(asset: string): string {
  // "100.0000 RUB" → "0.0000 RUB"
  const [amount, sym] = asset.split(' ');
  const decimals = (amount.split('.')[1] || '').length;
  return `${(0).toFixed(decimals)} ${sym}`;
}

export class MigratePhase1Minshare implements Migration {
  async run(): Promise<void> {
    // Гейт: ledger2::migrate должен быть полностью выполнен. Иначе мы рискуем
    // перезаписать L3 поверх свежих apply'ев confirmreg/etc и сломать инвариант
    // Σ L3 == L2.
    const migrateDone = await isLedger2MigrateDone();
    if (!migrateDone) {
      throw new Error(
        '[048] ledger2::migrate ещё не выполнен (meta пустая или migrated=false). ' +
        'Запусти `cleos push action ledger2 migrate ...` до конца, потом повтори 048.'
      );
    }

    const coops = await listCoops();
    console.log(`[048] Кооперативов найдено: ${coops.length}`);

    let totalMigrated = 0;

    for (const coopname of coops) {
      const participants = await fetchAllRows<SovietContract.Tables.Participants.IParticipants>({
        code: SovietContract.contractName.production,
        scope: coopname,
        table: SovietContract.Tables.Participants.tableName,
      });

      const accepted = participants.filter((p) => p.status === 'accepted');
      if (accepted.length === 0) {
        console.log(`[048] ${coopname}: нет accepted-пайщиков — пропуск`);
        continue;
      }

      console.log(`[048] ${coopname}: accepted-пайщиков ${accepted.length}`);

      // L3 пишем по фактическому минимуму ПАЙЩИКА (зафиксирован при addpartcpnt),
      // а не по текущему coop.minimum: minimum мог быть повышен/понижен после
      // вступления, но реальный взнос на legacy::accounts[80] = p.minimum_amount.
      const actions = accepted.map((p) => ({
        account: Ledger2Contract.contractName.production,
        name: Ledger2Contract.Actions.Migrate3.actionName,
        authorization: [{ actor: coopname, permission: 'active' }],
        data: {
          coopname,
          wallet_name: W_REG_MINSHR,
          username: p.username,
          available: p.minimum_amount,
          blocked: zeroOf(p.minimum_amount),
        },
      }));

      for (let i = 0; i < actions.length; i += BATCH) {
        const chunk = actions.slice(i, i + BATCH);
        await api.transact(
          { actions: chunk },
          { blocksBehind: 3, expireSeconds: 30 }
        );

        totalMigrated += chunk.length;
        console.log(`[048] ${coopname}: ${chunk.length} actions → ${W_REG_MINSHR}`);
      }
    }

    console.log(`[048] Готово: всего L3-записей w.reg.minshr создано ${totalMigrated}`);
  }
}
