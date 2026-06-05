import { Mutations } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Эпик 3 / модерация offer'ов: write-мутации одобрения/отклонения предложения.
 * Backend Resolver: `marketplace-moderation.resolver.ts`
 * (Mutation.marketplaceApproveOffer / marketplaceRejectOffer).
 *
 * Вынесено из страницы «Модерация» в feature, т.к. используется в двух местах:
 * на карточке в ленте модерации и на полной странице предложения (стол
 * администратора) — DRY.
 */

/** Председатель одобряет предложение (статус → ACTIVE, попадает в каталог). */
export async function approveOffer(offer_id: string) {
  const { [Mutations.Marketplace.ApproveOffer.name]: result } = await client.Mutation(
    Mutations.Marketplace.ApproveOffer.mutation,
    { variables: { input: { offer_id } } },
  );
  return result;
}

/**
 * Председатель отклоняет предложение с обязательной причиной (≤1000): статус →
 * REJECTED, причина сохраняется в reject_reason и видна поставщику в «Мои
 * предложения».
 */
export async function rejectOffer(offer_id: string, reason: string) {
  const { [Mutations.Marketplace.RejectOffer.name]: result } = await client.Mutation(
    Mutations.Marketplace.RejectOffer.mutation,
    { variables: { input: { offer_id, reason } } },
  );
  return result;
}
