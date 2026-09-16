// infrastructure/blockchain/chain-retry.ts

/**
 * Повтор транзакций, срезанных лимитами времени и полосы цепи COOPOS.
 *
 * Узел отбивает транзакцию, которая не уложилась в отведённое ей процессорное
 * время или в остаток текущего блока. Стоимость действия здесь — wall-time, а не
 * детерминированная величина: на загруженной машине то же самое действие стоит
 * дороже и в лимит не влезает, а на свободной проходит. По существу это не отказ
 * — цепь такую транзакцию не применяет (`producer_plugin::handle_push_result`:
 * «COULD NOT FIT … RETRYING»), в блок она не попадает и следов не оставляет,
 * поэтому повтор безопасен и дублей не даёт. Тот же приём уже стоит в `boot`
 * (`components/boot/src/blockchain/index.ts`) — там он спасает установку крупных
 * WASM'ов; здесь тот же случай, только вместо развёртывания — обычная операция
 * пайщика, которому незачем видеть красную ошибку из-за пика нагрузки.
 *
 * Повторяются только те коды, которыми узел говорит «не влезли»: группа
 * `resource_exhausted_exception` по CPU и NET. RAM-исчерпание (3080001) сюда не
 * входит — это настоящая нехватка ресурса аккаунта, её повтор не лечит.
 */

/**
 * Коды исключений COOPOS, означающие «транзакция не уложилась в лимит»
 * (`libraries/chain/include/eosio/chain/exceptions.hpp`, группа 3080xxx).
 * Имена приведены как их отдаёт узел в `error.name`.
 */
export const CHAIN_EXHAUSTION_CODES = new Map<number, string>([
  [3080002, 'tx_net_usage_exceeded'],
  [3080003, 'block_net_usage_exceeded'],
  [3080004, 'tx_cpu_usage_exceeded'],
  [3080005, 'block_cpu_usage_exceeded'],
  [3080006, 'deadline_exception'],
  [3080007, 'greylist_net_usage_exceeded'],
  [3080008, 'greylist_cpu_usage_exceeded'],
  [3081001, 'leeway_deadline_exception'],
]);

/**
 * Тексты, по которым ошибка опознаётся, когда кода под рукой нет.
 *
 * Код теряется по дороге: `@wharfkit/session` в своём `catch` подменяет APIError
 * на `new Error(json.error.details[0].message)` — до нас доходит только строка
 * первой детали, без `code` и `name`. Поэтому текстовые образцы взяты дословно
 * из мест, где COOPOS эти исключения бросает: `transaction_context.cpp`
 * (`checktime`, `check_net_usage`, `validate_account_cpu_usage`) и
 * `resource_limits.cpp` (`add_transaction_usage`).
 */
const EXHAUSTION_PATTERNS: RegExp[] = [
  // billed CPU time (… us) is greater than the maximum billable CPU time for the transaction (… us)
  // billed CPU time (… us) is greater than the billable CPU time left in the block (… us)
  /billed CPU time/i,
  // transaction <id> was executing for too long <N>us
  /was executing for too long/i,
  // not enough time left in block to complete executing transaction <N>us
  /not enough time left in block/i,
  // not enough space left in block: <net_usage> > <net_limit>
  /not enough space left in block/i,
  // deadline exceeded <N>us
  /deadline exceeded/i,
  // the transaction was unable to complete by deadline, but it is possible it could have succeeded…
  /unable to complete by deadline/i,
  // authorizing account '<n>' has insufficient objective cpu resources for this transaction
  /insufficient objective cpu resources/i,
  // authorizing account '<n>' has insufficient net resources for this transaction
  /insufficient net resources/i,
  // Block has insufficient cpu resources / Block has insufficient net resources
  /block has insufficient (cpu|net) resources/i,
  // transaction net usage is too high / greylisted transaction net usage is too high
  /transaction net usage is too high/i,
  // what-строки исключений: «Transaction exceeded the current CPU usage limit imposed on the transaction» и её сёстры
  /exceeded the current (cpu|network|greylisted account (cpu|network)) usage limit/i,
  /is too much for the remaining allowable usage/i,
  /transaction took too long/i,
  // имена исключений, если библиотека протащила их в текст
  /\b(tx|block|greylist)_(cpu|net)_usage_exceeded\b/i,
  /\b(leeway_)?deadline_exception\b/i,
];

/** Ошибка узла, как её отдаёт nodeos (через APIError @wharfkit/antelope или сырой ответ). */
interface NodeosError {
  code?: number;
  name?: string;
  what?: string;
  details?: Array<{ message?: string }>;
}

function nodeosError(e: unknown): NodeosError | undefined {
  const err = e as { error?: NodeosError; response?: { json?: { error?: NodeosError } } } | null;
  return err?.error ?? err?.response?.json?.error;
}

/** Весь текст, в котором может оказаться причина: message + what + первая деталь. */
function errorText(e: unknown): string {
  const err = nodeosError(e);
  const parts = [
    (e as { message?: unknown } | null)?.message,
    err?.name,
    err?.what,
    ...(err?.details ?? []).map((d) => d?.message),
  ];
  const text = parts.filter((p) => typeof p === 'string' && p.length > 0).join(' | ');
  return text.length > 0 ? text : String(e);
}

/**
 * Причина «не влезли» человеческим текстом — или `null`, если ошибка другого рода.
 *
 * Если узел назвал код — верим коду и текст не гадаем: ассерт контракта со словом
 * «deadline» в сообщении повторять нельзя, он детерминированный и повтор его не
 * вылечит. Текстовый разбор включается только там, где кода не осталось.
 */
export function chainExhaustionReason(e: unknown): string | null {
  const err = nodeosError(e);
  if (typeof err?.code === 'number') {
    const name = CHAIN_EXHAUSTION_CODES.get(err.code);
    return name ? `${name} (${err.code})` : null;
  }

  const text = errorText(e);
  return EXHAUSTION_PATTERNS.some((p) => p.test(text)) ? text.slice(0, 300) : null;
}

/** Срезала ли эту транзакцию нехватка CPU/NET (то есть стоит ли её переотправить). */
export function isChainExhaustionError(e: unknown): boolean {
  return chainExhaustionReason(e) !== null;
}

export interface ChainRetryOptions {
  /** Сколько повторов делать после первой отправки. */
  attempts: number;
  /** Пауза перед первым повтором; перед каждым следующим удваивается. */
  delayMs: number;
  onRetry?: (info: { attempt: number; attempts: number; delayMs: number; reason: string }) => void;
  /** Источник пауз — вынесен для детерминизма тестов. */
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Отправить транзакцию, переотправляя её, пока цепь отвечает «не влезли».
 *
 * Ошибка любого другого рода (ассерт контракта, отсутствие прав, сеть) уходит
 * вызывающему сразу и без повторов: повтор её не вылечит, а пайщику нужен ответ,
 * а не ожидание. Исчерпав повторы, бросаем последнюю ошибку как есть — пусть
 * выше решают, что показать.
 */
export async function retryOnChainExhaustion<T>(send: () => Promise<T>, options: ChainRetryOptions): Promise<T> {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  for (let retry = 0; ; retry++) {
    try {
      return await send();
    } catch (e) {
      const reason = chainExhaustionReason(e);
      if (reason === null || retry >= options.attempts) throw e;

      const delayMs = options.delayMs * 2 ** retry;
      options.onRetry?.({ attempt: retry + 1, attempts: options.attempts, delayMs, reason });
      await sleep(delayMs);
    }
  }
}
