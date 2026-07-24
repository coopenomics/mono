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

/**
 * Председатель одобряет предложение (статус → ACTIVE, попадает в каталог) и
 * устанавливает гарантийный срок возврата в днях — окно, в течение которого
 * пайщик может вернуть имущество. Срок годности (списание скоропорта) — поле
 * поставщика, задаётся отдельно при создании предложения.
 */
export async function approveOffer(offer_id: string, warranty_days: number) {
  const { [Mutations.Marketplace.ApproveOffer.name]: result } = await client.Mutation(
    Mutations.Marketplace.ApproveOffer.mutation,
    { variables: { input: { offer_id, warranty_days } } },
  );
  return result;
}

/** Председатель меняет гарантийный срок возврата уже одобренного предложения. */
export async function setOfferWarranty(offer_id: string, warranty_days: number) {
  const { [Mutations.Marketplace.SetOfferWarranty.name]: result } = await client.Mutation(
    Mutations.Marketplace.SetOfferWarranty.mutation,
    { variables: { input: { offer_id, warranty_days } } },
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
