import { pluralize, pluralizeDays } from 'src/shared/lib/utils';
import { t } from 'src/shared/i18n';

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

/** Курс платформы: 1 AXON = 10 ₽ (тот же, по которому считает калькулятор лендинга). */
export const AXON_PRICE_RUB = 10;

/** Регистрация пайщика в рублях — для витрин, где цены показываются деньгами. */
export const MEMBER_PRICE_RUB = AXON_PER_MEMBER * AXON_PRICE_RUB;

/** Пакет документов в рублях. */
export const DOCUMENT_PACKAGE_PRICE_RUB = AXON_PER_DOCUMENT_PACKAGE * AXON_PRICE_RUB;

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
    { key: 'days', value: days, label: t('axon.capacity.daysOfWork', { days: pluralizeDays(days) }) },
    { key: 'members', value: members, label: pluralize(members, [t('axon.capacity.memberOne'), t('axon.capacity.memberFew'), t('axon.capacity.memberMany')]) },
    {
      key: 'documents',
      value: documents,
      label: t('axon.capacity.documentPackages', { packages: pluralize(documents, [t('axon.capacity.packageOne'), t('axon.capacity.packageFew'), t('axon.capacity.packageMany')]) }),
    },
  ];
}

/** Пояснение к показателям — раскрывается подсказкой, в строку не помещается. */
export const AXON_CAPACITY_HINT =
  t('axon.capacity.hintIndependent') +
  t('axon.capacity.hintNodeRent', { quota: AXON_MIN_DAILY_QUOTA }) +
  t('axon.capacity.hintMemberRegistration', { price: AXON_PER_MEMBER }) +
  t('axon.capacity.hintDocumentPackage', { price: AXON_PER_DOCUMENT_PACKAGE });
