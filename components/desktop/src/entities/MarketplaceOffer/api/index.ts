/**
 * Эпик 16: жизненный цикл предложения Стола заказов через SDK Zeus.
 *
 * Снятие с публикации и возврат на публикацию нужны на двух столах поставщика
 * («Мои предложения» — быстрой кнопкой на карточке, редактор предложения — из
 * строки управления), поэтому мутации вынесены в общий entity-слой, а не
 * продублированы по страницам. Все GraphQL-операции идут через
 * `@coopenomics/sdk` (Mutations.Marketplace) — raw query-строки запрещены.
 */
import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { MarketplaceOfferDetailView } from '../model/types';

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

/**
 * Одно предложение по идентификатору. Карточку открывают и заказчик (страница
 * предложения каталога), и стол администратора — оверлеем поверх реестров
 * заказов, предложений и склада, поэтому запрос живёт в общем слое сущности,
 * а не в api одной страницы.
 */
export async function fetchOffer(id: string): Promise<MarketplaceOfferDetailView | null> {
  const { [Queries.Marketplace.GetOffer.name]: offer } = await client.Query(
    Queries.Marketplace.GetOffer.query,
    { variables: { id } },
  );
  return offer as MarketplaceOfferDetailView | null;
}

/**
 * Справочник категорий каталога в виде «идентификатор → название». Название
 * категории показывают карточка предложения, лента модерации и склад — все
 * трое строили эту карту у себя, поэтому она здесь.
 */
export async function fetchCategoryNames(): Promise<Record<number, string>> {
  const { [Queries.Marketplace.ListCategories.name]: list } = await client.Query(
    Queries.Marketplace.ListCategories.query,
  );
  const map: Record<number, string> = {};
  for (const c of list) map[Number(c.id)] = c.display_name;
  return map;
}
