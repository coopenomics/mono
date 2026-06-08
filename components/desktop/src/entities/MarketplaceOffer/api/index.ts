/**
 * Эпик 16: жизненный цикл предложения Стола заказов через SDK Zeus.
 *
 * Снятие с публикации и возврат на публикацию нужны на двух столах поставщика
 * («Мои предложения» — быстрой кнопкой на карточке, редактор предложения — из
 * строки управления), поэтому мутации вынесены в общий entity-слой, а не
 * продублированы по страницам. Все GraphQL-операции идут через
 * `@coopenomics/sdk` (Mutations.Marketplace) — raw query-строки запрещены.
 */
import { Mutations, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Поставщик снимает своё предложение с публикации (статус → WITHDRAWN).
 * Backend: marketplace-offer.resolver.ts → marketplaceWithdrawOffer
 * (guard 'Offer' 'delete:own', ownership проверяется в сервисе). Снятие лишь
 * убирает оффер из каталога — уже принятые/созданные заказы ведутся отдельно.
 */
export async function withdrawOffer(id: string): Promise<void> {
  await client.Mutation(Mutations.Marketplace.WithdrawOffer.mutation, {
    variables: { input: { id } },
  });
}

/**
 * Поставщик возвращает снятое предложение на публикацию. Backend:
 * marketplace-offer.resolver.ts → marketplaceRepublishOffer. Снятие не удаляет
 * и не меняет данные оферты — пересоздавать ничего не нужно. Уже одобренное
 * возвращается сразу в ACTIVE (контент тот же — модерировать нечего), ещё не
 * одобренное — в PENDING_MODERATION. Возвращаем итоговый статус для точного
 * уведомления.
 */
export async function republishOffer(
  id: string,
): Promise<Zeus.MarketplaceOfferStatus> {
  const { [Mutations.Marketplace.RepublishOffer.name]: offer } =
    await client.Mutation(Mutations.Marketplace.RepublishOffer.mutation, {
      variables: { input: { id } },
    });
  return offer.status;
}
