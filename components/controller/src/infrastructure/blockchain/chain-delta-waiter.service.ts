import { Injectable } from '@nestjs/common';
import type { IDelta } from '@coopenomics/extension-kit/sync';
import type { IChainDeltaWaitPort, InnerChainDelta, InnerChainDeltaWaitQuery, InnerChainTxWait } from '@coopenomics/innercoop';
import { config } from '~/config';

interface Waiter {
  query: InnerChainDeltaWaitQuery;
  resolve: (delta: InnerChainDelta | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Ожидание изменения из цепи (ADR-009, DEC-T10). Мутация после транзакции
 * регистрирует ожидание; потребитель событий будит его, когда дельта
 * сохранена и все её слушатели отработали — значит, проекции в базе уже
 * свежие и ответ можно собирать из них. Не пришло за отведённое время —
 * `null`: мутация отвечает «ещё идёт», интерфейс догонит сам.
 *
 * Ожидания живут в памяти процесса: узел один, дельты идут через него же.
 */
@Injectable()
export class ChainDeltaWaiterService implements IChainDeltaWaitPort {
  private readonly waiters = new Map<string, Set<Waiter>>();

  blockOf(transactResult: unknown): number {
    const t = transactResult as { response?: { processed?: { block_num?: number } }; processed?: { block_num?: number } };
    return Number(t?.response?.processed?.block_num ?? t?.processed?.block_num ?? 0);
  }

  async afterTransact(transactResult: unknown, waits: InnerChainTxWait[]): Promise<boolean> {
    const minBlockNum = this.blockOf(transactResult);
    // Блок не определить (ответ узла без processed) — ждать нечего, отвечаем сразу.
    if (!minBlockNum || !waits.length) return false;
    const applied = await Promise.all(waits.map((w) => this.waitForDelta({ ...w, minBlockNum })));
    return applied.every((d) => d !== null);
  }

  waitForDelta(query: InnerChainDeltaWaitQuery): Promise<InnerChainDelta | null> {
    const timeoutMs = query.timeoutMs ?? config.blockchain.write_wait_delta_ms;
    return new Promise((resolve) => {
      const bucket = this.bucket(query.code);
      const waiter: Waiter = {
        query,
        resolve: (delta) => {
          // Таймер снимается при любом исходе — иначе ожидания копились бы в памяти.
          clearTimeout(waiter.timer);
          bucket.delete(waiter);
          resolve(delta);
        },
        timer: setTimeout(() => waiter.resolve(null), timeoutMs),
      };
      bucket.add(waiter);
    });
  }

  /** Дельта сохранена и её слушатели отработали — будим тех, кто её ждал. */
  wake(delta: IDelta): void {
    const bucket = this.waiters.get(delta.code);
    if (!bucket?.size) return;
    const inner = toInner(delta);
    for (const waiter of [...bucket]) {
      if (matches(waiter.query, inner)) waiter.resolve(inner);
    }
  }

  private bucket(code: string): Set<Waiter> {
    let bucket = this.waiters.get(code);
    if (!bucket) {
      bucket = new Set();
      this.waiters.set(code, bucket);
    }
    return bucket;
  }
}

function toInner(delta: IDelta): InnerChainDelta {
  return {
    code: delta.code,
    scope: delta.scope,
    table: delta.table,
    primary_key: String(delta.primary_key),
    block_num: Number(delta.block_num),
    present: delta.present !== false,
    value: delta.value ?? undefined,
  };
}

function matches(query: InnerChainDeltaWaitQuery, delta: InnerChainDelta): boolean {
  if (delta.block_num < query.minBlockNum) return false;
  if (query.table && query.table !== delta.table) return false;
  if (query.scope && query.scope !== delta.scope) return false;
  return query.match ? query.match(delta) : true;
}
