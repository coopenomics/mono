import { pluralize, pluralizeDays } from 'src/shared/lib/utils';
import { t } from 'src/shared/i18n';

/**
 * На что и насколько хватает баланса AXON.
 *
 * Тарифы платформы (стол «Системные ресурсы» + прайс лендинга, где цены даны в
 * рублях по курсу 1 AXON = 10 ₽):
 *   • аренда вычислительных ресурсов — минимальная квота 5 AXON в сутки;
 *   • новый пайщик — 30 ₽, то есть 3 AXON: сам аккаунт (1 AXON) плюс пакет
 *     документов вступления (2 AXON);
 *   • операция, то есть пакет документов, — 20 ₽, то есть 2 AXON.
 * Ставки — из модели тарификации подписок и прайса сайта (blago.coop): по ним
 * объём тарифа в AXON переводится в новых пайщиков и операции.
 *
 * Ресурсы делят ОДИН баланс: потратил на регистрации — меньше осталось на
 * документы и аренду. Поэтому показатели считаются независимо друг от друга
 * («на что хватило бы, если тратить только на это»), а не складываются.
 */

/** Минимальная суточная квота вычислительных ресурсов. */
export const AXON_MIN_DAILY_QUOTA = 5;

/** Новый пайщик: аккаунт (1 AXON) и пакет документов вступления (2 AXON). */
export const AXON_PER_MEMBER = 3;

/** Операция — один пакет документов. */
export const AXON_PER_DOCUMENT_PACKAGE = 2;

/** Курс платформы: 1 AXON = 10 ₽ (тот же, по которому считает калькулятор лендинга). */
export const AXON_PRICE_RUB = 10;

/** Регистрация пайщика в рублях — для витрин, где цены показываются деньгами. */
export const MEMBER_PRICE_RUB = AXON_PER_MEMBER * AXON_PRICE_RUB;

/** Пакет документов в рублях. */
export const DOCUMENT_PACKAGE_PRICE_RUB = AXON_PER_DOCUMENT_PACKAGE * AXON_PRICE_RUB;

/**
 * Квант сверх тарифа (@ant 17.10.2026): когда бак AXON кооператива ниже
 * кванта, провайдер пополняет его на столько же — 5 AXON за 50 ₽. Столько узел
 * берёт из бака за одну аренду ресурсов.
 */
export const AXON_QUANT = 5;

/** Квант в рублях по курсу платформы. */
export const QUANT_PRICE_RUB = AXON_QUANT * AXON_PRICE_RUB;

/**
 * Объём тарифа на месяц в понятных величинах, как в прайсе сайта: весь объём
 * расходуется либо на новых пайщиков, либо на пакеты документов. 150 AXON — 50 новых
 * пайщиков или 75 пакетов документов, 480 — 160 или 240, 1 440 — 480 или 720.
 * Внутри объёма AXON взаимозаменяемы: реальный месяц — смесь того и другого.
 */
export function tariffVolumeBreakdown(volumeAxon: number): { members: number; operations: number } {
  const volume = Number.isFinite(volumeAxon) && volumeAxon > 0 ? volumeAxon : 0;
  return {
    members: Math.floor(volume / AXON_PER_MEMBER),
    operations: Math.floor(volume / AXON_PER_DOCUMENT_PACKAGE),
  };
}

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
