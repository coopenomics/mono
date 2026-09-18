import { type ChainFailure, createChainFetch, describeChainFailure } from '@coopenomics/sdk';
import * as Sentry from '@sentry/vue';

/**
 * Перехват ответов узла цепи для сессий кабинета.
 *
 * Транзакции пайщика уходят в цепь прямо из браузера, а `session.transact`
 * оставляет от ответа узла одну строку подробностей — без кода исключения и без
 * тела. Поэтому отказ разбирается до того, как его увидит wharfkit, и целиком
 * попадает в журнал ошибок.
 *
 * 17.09.2026: подпись решения совета получила от узла 500, и восстановить
 * причину было нечем — в логах остался только код ответа.
 */

/**
 * Коды «транзакция не уложилась в лимит» (группа `resource_exhausted_exception`).
 * Они лечатся повтором и в журнал ошибок не идут — иначе пик нагрузки выглядел
 * бы как поломка кабинета.
 */
const EXHAUSTION_CODES = new Set([3080002, 3080003, 3080004, 3080005, 3080006, 3080007, 3080008, 3081001]);

function reportChainFailure(failure: ChainFailure): void {
  const description = describeChainFailure(failure);

  if (failure.code !== undefined && EXHAUSTION_CODES.has(failure.code)) {
    console.warn(`[chain] узел не принял транзакцию по лимиту: ${description}`);
    return;
  }

  console.error(`[chain] отказ узла: ${description}`);

  Sentry.captureException(new Error(`Узел цепи отказал: ${description}`), {
    tags: {
      chain_path: failure.path,
      chain_error_code: failure.code ? String(failure.code) : 'unknown',
      chain_error_name: failure.name ?? 'unknown',
    },
    extra: {
      http_status: failure.httpStatus,
      details: failure.details,
      response: failure.raw,
    },
  });
}

/** `fetch` для сессии цепи: разбирает отказ узла и отдаёт ответ дальше нетронутым. */
export const chainFetch = createChainFetch(reportChainFailure);
