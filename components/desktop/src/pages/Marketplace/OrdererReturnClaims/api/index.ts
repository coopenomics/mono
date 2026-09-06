import { Mutations, Queries, Zeus, type Types } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { BaseBadgeVariant } from 'src/shared/ui/base';

const DEFECT_CATEGORY_LABELS: Record<string, string> = {
  [Zeus.MarketplaceReturnClaimDefectCategory.BROKEN]: 'Повреждено / сломано',
  [Zeus.MarketplaceReturnClaimDefectCategory.EXPIRED]: 'Истёк срок годности',
  [Zeus.MarketplaceReturnClaimDefectCategory.NOT_AS_DESCRIBED]: 'Не соответствует описанию',
  [Zeus.MarketplaceReturnClaimDefectCategory.WRONG_ITEM]: 'Не тот товар',
  [Zeus.MarketplaceReturnClaimDefectCategory.OTHER]: 'Другое',
};

// Человекочитаемая метка категории дефекта; для незнакомых значений возвращаем
// исходное (а не сырой enum «BROKEN» в UI заказчика и председателя).
export function defectCategoryLabel(category?: string | null): string {
  if (!category) return '';
  return DEFECT_CATEGORY_LABELS[category] ?? category;
}

export type MarketplaceReturnClaimView =
  Queries.Marketplace.ListMyReturnClaims.IOutput['marketplaceListMyReturnClaims'][number];

// Общая гуманизация статуса заявления — используется и в списке заявлений,
// и в блоке гарантийного возврата на странице конкретного заказа (DRY:
// один источник статус→текст/цвет вместо дублирования в двух местах).
const RETURN_CLAIM_STATUS_LABELS: Record<Zeus.MarketplaceReturnClaimStatus, string> = {
  // Заказчику не важно, кто именно решает на первом шаге — достаточно факта
  // «на рассмотрении». Дальше (паевая модель) решает совет: имущество принято
  // у стойки и ждёт решения; принято советом — паевой взнос восстановлен;
  // совет отказал — имущество ждёт пайщика на участке; выдано обратно.
  [Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW]: 'На рассмотрении',
  [Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT]: 'Приглашение на участок',
  [Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY]: 'Отказано удалённо',
  [Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT]: 'Отказано на месте',
  [Zeus.MarketplaceReturnClaimStatus.PENDING_COUNCIL]: 'Имущество принято — ждём решение совета',
  [Zeus.MarketplaceReturnClaimStatus.ACCEPTED_BY_COUNCIL]: 'Совет принял — паевой взнос восстановлен',
  [Zeus.MarketplaceReturnClaimStatus.DECLINED_BY_COUNCIL]: 'Совет отказал — заберите имущество',
  [Zeus.MarketplaceReturnClaimStatus.HANDED_BACK]: 'Имущество выдано обратно',
};

export function returnClaimStatusLabel(status: MarketplaceReturnClaimView['status']): string {
  return RETURN_CLAIM_STATUS_LABELS[status] ?? status;
}

export function returnClaimStatusVariant(status: MarketplaceReturnClaimView['status']): BaseBadgeVariant {
  switch (status) {
    case Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW:
      return 'info';
    case Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT:
    case Zeus.MarketplaceReturnClaimStatus.DECLINED_BY_COUNCIL:
      return 'warn';
    case Zeus.MarketplaceReturnClaimStatus.PENDING_COUNCIL:
      return 'info';
    case Zeus.MarketplaceReturnClaimStatus.ACCEPTED_BY_COUNCIL:
      return 'pos';
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY:
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT:
      return 'neg';
    case Zeus.MarketplaceReturnClaimStatus.HANDED_BACK:
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** Статусы заявления, которые считаются «открытыми» — по ним новое заявление подать нельзя. */
export const OPEN_RETURN_CLAIM_STATUSES = new Set<MarketplaceReturnClaimView['status']>([
  Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW,
  Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT,
  Zeus.MarketplaceReturnClaimStatus.PENDING_COUNCIL,
  Zeus.MarketplaceReturnClaimStatus.DECLINED_BY_COUNCIL,
]);

// Гуманизация решений из decision_log — используется и в деталях заявления,
// и в хронологии заказа (DRY: один источник вместо двух локальных карт).
const RETURN_CLAIM_DECISION_LABELS: Record<string, string> = {
  approve_visit: 'Приглашение на участок',
  reject_remote: 'Отказано удалённо',
  accept_at_visit: 'Имущество принято у стойки — заявление в совете',
  reject_at_visit: 'Отказано на месте',
  council_authorized: 'Совет принял имущество — паевой взнос восстановлен',
  council_declined: 'Совет отказал',
  hand_back: 'Имущество выдано обратно',
};

/** Решения, которые читаются как отказ (для цвета в хронологии). */
export const RETURN_CLAIM_NEGATIVE_DECISIONS = new Set(['reject_remote', 'reject_at_visit', 'council_declined']);
/** Решения, которые читаются как успех. */
export const RETURN_CLAIM_POSITIVE_DECISIONS = new Set(['council_authorized']);

export function returnClaimDecisionLabel(decision: string): string {
  return RETURN_CLAIM_DECISION_LABELS[decision] ?? decision;
}

export type MarketplaceReturnClaimResultView =
  Mutations.Marketplace.CreateReturnClaim.IOutput['marketplaceCreateReturnClaim'];

export type MarketplaceGeneratedDocumentView = Types.Document.IGeneratedDocument;

export type IReturnClaimSignablePayloadInput =
  Queries.Marketplace.ReturnClaimSignablePayload.IInput['data'];

export type ICreateReturnClaimInput =
  Mutations.Marketplace.CreateReturnClaim.IInput['data'];

export async function listMyReturnClaims(): Promise<MarketplaceReturnClaimView[]> {
  const { [Queries.Marketplace.ListMyReturnClaims.name]: result } = await client.Query(
    Queries.Marketplace.ListMyReturnClaims.query,
    {},
  );
  return result;
}

export async function getReturnClaimSignablePayload(
  data: IReturnClaimSignablePayloadInput,
): Promise<MarketplaceGeneratedDocumentView> {
  const { [Queries.Marketplace.ReturnClaimSignablePayload.name]: result } = await client.Query(
    Queries.Marketplace.ReturnClaimSignablePayload.query,
    { variables: { data } },
  );
  return result;
}

export async function createReturnClaim(
  data: ICreateReturnClaimInput,
): Promise<MarketplaceReturnClaimResultView> {
  const { [Mutations.Marketplace.CreateReturnClaim.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateReturnClaim.mutation,
    { variables: { data } },
  );
  return result;
}
