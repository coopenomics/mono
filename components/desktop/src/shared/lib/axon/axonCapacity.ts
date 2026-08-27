import { pluralize, pluralizeDays } from 'src/shared/lib/utils';

/**
 * На что и насколько хватает баланса AXON.
 *
 * Тарифы платформы (стол «Системные ресурсы» + прайс лендинга, где цены даны в
 * рублях по курсу 1 AXON = 10 ₽):
 *   • аренда вычислительных ресурсов — минимальная квота 5 AXON в сутки;
 *   • регистрация пайщика — 20 ₽, то есть 2 AXON: сам аккаунт (1 AXON) плюс
 *     пакет его регистрационных документов (заявление и протокол решения);
 *   • пакет документов — 10 ₽, то есть 1 AXON.
 *
 * Ресурсы делят ОДИН баланс: потратил на регистрации — меньше осталось на
 * документы и аренду. Поэтому показатели считаются независимо друг от друга
 * («на что хватило бы, если тратить только на это»), а не складываются.
 */

/** Минимальная суточная квота вычислительных ресурсов. */
export const AXON_MIN_DAILY_QUOTA = 5;

/** Регистрация пайщика: аккаунт + пакет его регистрационных документов. */
export const AXON_PER_MEMBER = 2;

/** Один пакет документов. */
export const AXON_PER_DOCUMENT_PACKAGE = 1;

/** Показатель ёмкости баланса: сколько чего и в чём измеряется. */
export interface AxonCapacityMetric {
  key: 'days' | 'members' | 'documents';
  value: number;
  label: string;
}

function affordable(balance: number, price: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return Math.floor(balance / price);
}

/** Сколько суток работы узла покрывает баланс минимальными квотами. */
export function axonDaysOfWork(balance: number): number {
  return affordable(balance, AXON_MIN_DAILY_QUOTA);
}

/** Сколько регистраций пайщиков покрывает баланс. */
export function axonMembersAffordable(balance: number): number {
  return affordable(balance, AXON_PER_MEMBER);
}

/** Сколько пакетов документов покрывает баланс. */
export function axonDocumentPackagesAffordable(balance: number): number {
  return affordable(balance, AXON_PER_DOCUMENT_PACKAGE);
}

/**
 * Ёмкость баланса тремя показателями — для карточки кошелька. Пустой баланс
 * показателей не даёт: три нуля в ряд ничего не объясняют.
 */
export function axonCapacityMetrics(balance: number): AxonCapacityMetric[] {
  const days = axonDaysOfWork(balance);
  const members = axonMembersAffordable(balance);
  const documents = axonDocumentPackagesAffordable(balance);
  if (days === 0 && members === 0 && documents === 0) return [];

  return [
    { key: 'days', value: days, label: `${pluralizeDays(days)} работы` },
    { key: 'members', value: members, label: pluralize(members, ['пайщик', 'пайщика', 'пайщиков']) },
    {
      key: 'documents',
      value: documents,
      label: `${pluralize(documents, ['пакет', 'пакета', 'пакетов'])} документов`,
    },
  ];
}

/** Пояснение к показателям — раскрывается подсказкой, в строку не помещается. */
export const AXON_CAPACITY_HINT =
  'Показатели независимы: ресурсы делят один баланс. ' +
  `Аренда узла — ${AXON_MIN_DAILY_QUOTA} AXON в сутки, ` +
  `регистрация пайщика — ${AXON_PER_MEMBER} AXON (аккаунт и пакет его документов), ` +
  `пакет документов — ${AXON_PER_DOCUMENT_PACKAGE} AXON.`;
