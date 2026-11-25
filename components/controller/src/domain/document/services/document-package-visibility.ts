import type { DocumentPackageAggregateDomainInterface } from '../interfaces/document-package-aggregate-domain.interface';
import type { DocumentAggregateDomainInterface } from '../interfaces/document-domain-aggregate.interface';

/**
 * Выдача пакета документов по правам (решение владельца 17.11.2026).
 *
 * Пакет процесса в реестре один: заявление, решение совета, акты и связанные
 * документы под одним хэшем процесса. Совет видит пакет целиком. Пайщику
 * выдаются только документы, которые ему полагаются:
 *  - документ, где он субъект (`meta.username`) или подписант;
 *  - заявление пакета, если он его владелец, и решение совета по нему.
 * Остальные части пакета вырезаются до отдачи наружу — ни список реестра, ни
 * страница документа не получают чужой документ ни при каком запросе.
 *
 * Пример — пакет заказа Стола заказов: заказчик видит своё заявление о
 * возврате паевого взноса имуществом, протокол совета и акт выдачи, который
 * подписал сам; поставщик видит тот же пакет только с актом приёмки, который
 * подписал он; данные заказчика и протокол поставщику не выдаются.
 */

/** Метаданные документа агрегата: подписанная версия, иначе собранная фабрикой. */
function metaOf(aggregate: DocumentAggregateDomainInterface | null | undefined): Record<string, unknown> {
  const signed = (aggregate?.document as { meta?: unknown } | undefined)?.meta;
  const raw = (aggregate?.rawDocument as { meta?: unknown } | undefined)?.meta;
  const meta = signed ?? raw;
  return meta && typeof meta === 'object' ? (meta as Record<string, unknown>) : {};
}

/** Подписанты документа агрегата. */
function signersOf(aggregate: DocumentAggregateDomainInterface | null | undefined): string[] {
  const signatures = (aggregate?.document as { signatures?: Array<{ signer?: unknown }> } | undefined)?.signatures ?? [];
  return signatures.map((s) => String(s?.signer ?? '')).filter(Boolean);
}

/** Субъект и подписанты документа — те, кому он полагается. */
function holdersOf(aggregate: DocumentAggregateDomainInterface | null | undefined): string[] {
  const subject = metaOf(aggregate).username;
  return [...(typeof subject === 'string' && subject ? [subject] : []), ...signersOf(aggregate)];
}

/** Документ полагается пайщику: он субъект документа или его подписант. */
export function isDocumentHeldBy(aggregate: DocumentAggregateDomainInterface | null | undefined, username: string): boolean {
  return !!aggregate && holdersOf(aggregate).includes(username);
}

/**
 * Участники пакета: владелец заявления и все субъекты и подписанты документов
 * пакета. По ним реестр отбирает пакеты пайщика.
 */
export function packageParticipants(
  aggregate: DocumentPackageAggregateDomainInterface | null,
  owner: string
): string[] {
  const all = new Set<string>(owner ? [owner] : []);
  if (!aggregate) return [...all];
  const parts: Array<DocumentAggregateDomainInterface | null | undefined> = [
    aggregate.statement?.documentAggregate,
    aggregate.decision?.documentAggregate,
    ...(aggregate.acts ?? []).map((a) => a?.documentAggregate),
    ...(aggregate.links ?? []),
  ];
  for (const part of parts) for (const holder of holdersOf(part)) all.add(holder);
  return [...all];
}

/**
 * Пакет в том составе, который полагается пайщику. `owner` — владелец
 * заявления пакета (колонка `username` реестра).
 */
export function packageVisibleTo(
  aggregate: DocumentPackageAggregateDomainInterface,
  owner: string,
  username: string
): DocumentPackageAggregateDomainInterface {
  const statementAggregate = aggregate.statement?.documentAggregate;
  const ownsStatement = owner === username || isDocumentHeldBy(statementAggregate, username);
  const decisionAggregate = aggregate.decision?.documentAggregate;
  return {
    statement: ownsStatement ? aggregate.statement : null,
    // Решение совета — по заявлению: его видит тот, кому полагается заявление.
    decision: ownsStatement || isDocumentHeldBy(decisionAggregate, username) ? aggregate.decision : null,
    acts: (aggregate.acts ?? []).filter((act) => isDocumentHeldBy(act?.documentAggregate, username)),
    links: (aggregate.links ?? []).filter((link) => isDocumentHeldBy(link, username)),
  };
}
