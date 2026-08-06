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
  // Заказчику не важно, кто именно решает (председатель КУ, не совет) —
  // достаточно факта «на рассмотрении»; уточнение роли только путает
  // (см. review 2026-07-27: «со вето путать не надо»).
  [Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW]: 'На рассмотрении',
  [Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT]: 'Очный визит одобрен',
  [Zeus.MarketplaceReturnClaimStatus.ACCEPTED_AT_VISIT]: 'Возврат принят',
  [Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY]: 'Отказано удалённо',
  [Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT]: 'Отказано на месте',
};

export function returnClaimStatusLabel(status: MarketplaceReturnClaimView['status']): string {
  return RETURN_CLAIM_STATUS_LABELS[status] ?? status;
}

export function returnClaimStatusVariant(status: MarketplaceReturnClaimView['status']): BaseBadgeVariant {
  switch (status) {
    case Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW:
      return 'info';
    case Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT:
      return 'warn';
    case Zeus.MarketplaceReturnClaimStatus.ACCEPTED_AT_VISIT:
      return 'pos';
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_REMOTELY:
    case Zeus.MarketplaceReturnClaimStatus.REJECTED_AT_VISIT:
      return 'neg';
    default:
      return 'neutral';
  }
}

/** Статусы заявления, которые считаются «открытыми» — по ним новое заявление подать нельзя. */
export const OPEN_RETURN_CLAIM_STATUSES = new Set<MarketplaceReturnClaimView['status']>([
  Zeus.MarketplaceReturnClaimStatus.PENDING_CHAIRMAN_REVIEW,
  Zeus.MarketplaceReturnClaimStatus.APPROVED_FOR_VISIT,
]);

// Гуманизация решений из decision_log — используется и в деталях заявления,
// и в хронологии заказа (DRY: один источник вместо двух локальных карт).
const RETURN_CLAIM_DECISION_LABELS: Record<string, string> = {
  approve_visit: 'Председатель пригласил на очный осмотр',
  reject_remote: 'Отказано удалённо',
  accept_at_visit: 'Возврат принят на очном осмотре',
  reject_at_visit: 'Отказано на очном осмотре',
};

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
