import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { BaseBadgeVariant } from 'src/shared/ui/base';

/**
 * Раздел «Гарантийные возвраты» стола поставщика (99D-13): претензии по
 * имуществу, которое пайщик вернул по гарантии, а совет отменил сделку.
 * Поставщик признаёт претензию (сумма удерживается из следующих выплат) или
 * отказывает (сумма учитывается как основание для иска).
 */
export type MarketplaceSupplierClaimView =
  Queries.Marketplace.ListSupplierClaims.IOutput['marketplaceListSupplierClaims'][number];

export type MarketplaceSupplierClaimSummaryView =
  Queries.Marketplace.SupplierClaimSummary.IOutput['marketplaceSupplierClaimSummary'];

export type MarketplaceSupplierClaimResultView =
  Mutations.Marketplace.AdmitSupplierClaim.IOutput['marketplaceAdmitSupplierClaim'];

const CLAIM_STATUS_LABELS: Record<Zeus.MarketplaceSupplierClaimStatus, string> = {
  [Zeus.MarketplaceSupplierClaimStatus.PENDING]: 'Ждёт вашего ответа',
  [Zeus.MarketplaceSupplierClaimStatus.ADMITTED]: 'Признана — удерживается из выплат',
  [Zeus.MarketplaceSupplierClaimStatus.REFUSED]: 'Отказано',
};

export function supplierClaimStatusLabel(status: MarketplaceSupplierClaimView['status']): string {
  return CLAIM_STATUS_LABELS[status] ?? status;
}

export function supplierClaimStatusVariant(status: MarketplaceSupplierClaimView['status']): BaseBadgeVariant {
  switch (status) {
    case Zeus.MarketplaceSupplierClaimStatus.PENDING:
      return 'warn';
    case Zeus.MarketplaceSupplierClaimStatus.ADMITTED:
      return 'pos';
    case Zeus.MarketplaceSupplierClaimStatus.REFUSED:
      return 'neg';
    default:
      return 'neutral';
  }
}

export async function listMySupplierClaims(): Promise<MarketplaceSupplierClaimView[]> {
  const { [Queries.Marketplace.ListSupplierClaims.name]: result } = await client.Query(
    Queries.Marketplace.ListSupplierClaims.query,
    {},
  );
  return result;
}

export async function fetchSupplierClaim(claim_id: string): Promise<MarketplaceSupplierClaimView> {
  const { [Queries.Marketplace.SupplierClaim.name]: result } = await client.Query(
    Queries.Marketplace.SupplierClaim.query,
    { variables: { claim_id } },
  );
  return result;
}

export async function fetchSupplierClaimSummary(): Promise<MarketplaceSupplierClaimSummaryView> {
  const { [Queries.Marketplace.SupplierClaimSummary.name]: result } = await client.Query(
    Queries.Marketplace.SupplierClaimSummary.query,
    {},
  );
  return result;
}

export async function admitSupplierClaim(claim_id: string): Promise<MarketplaceSupplierClaimResultView> {
  const { [Mutations.Marketplace.AdmitSupplierClaim.name]: result } = await client.Mutation(
    Mutations.Marketplace.AdmitSupplierClaim.mutation,
    { variables: { data: { claim_id } } },
  );
  return result;
}

export async function refuseSupplierClaim(claim_id: string, reason: string): Promise<MarketplaceSupplierClaimResultView> {
  const { [Mutations.Marketplace.RefuseSupplierClaim.name]: result } = await client.Mutation(
    Mutations.Marketplace.RefuseSupplierClaim.mutation,
    { variables: { data: { claim_id, reason } } },
  );
  return result;
}
