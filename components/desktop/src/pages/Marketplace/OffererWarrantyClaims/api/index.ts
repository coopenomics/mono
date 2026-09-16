import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { BaseBadgeVariant } from 'src/shared/ui/base';

/**
 * Раздел «Гарантийные возвраты» стола поставщика (99D-13): претензии по
 * имуществу, которое пайщик вернул по гарантии, а совет отменил сделку. По
 * умолчанию поставщик не согласен — сумма лежит на кошельке непризнанных;
 * «Согласен» переводит её в долг, который гасится из следующих выплат;
 * «Не согласен» лишь показывает контакты участка.
 */
export type MarketplaceSupplierClaimView =
  Queries.Marketplace.ListSupplierClaims.IOutput['marketplaceListSupplierClaims'][number];

export type MarketplaceSupplierClaimSummaryView =
  Queries.Marketplace.SupplierClaimSummary.IOutput['marketplaceSupplierClaimSummary'];

export type MarketplaceSupplierClaimResultView =
  Mutations.Marketplace.AdmitSupplierClaim.IOutput['marketplaceAdmitSupplierClaim'];

const CLAIM_STATUS_LABELS: Record<Zeus.MarketplaceSupplierClaimStatus, string> = {
  [Zeus.MarketplaceSupplierClaimStatus.PENDING]: 'Не признана',
  [Zeus.MarketplaceSupplierClaimStatus.ADMITTED]: 'Признана — удерживается из выплат',
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
