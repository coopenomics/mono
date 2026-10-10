/**
 * Отзывы заказчиков о полученном имуществе. Ими пользуются столы заказчика
 * (отзыв в заказе, отзывы на странице предложения и в профиле поставщика),
 * поставщика и администратора, поэтому запросы лежат в общем слое сущностей.
 */
import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type MarketplaceReviewPage = Queries.Marketplace.ListReviews.IOutput['marketplaceListReviews'];
export type MarketplaceReviewView = MarketplaceReviewPage['items'][number];
export type MarketplaceReviewSummaryView = Queries.Marketplace.ReviewSummary.IOutput['marketplaceReviewSummary'];

export type IListReviewsFilter = NonNullable<Queries.Marketplace.ListReviews.IInput['filter']>;
export type IListReviewsOptions = NonNullable<Queries.Marketplace.ListReviews.IInput['options']>;
export type IReviewSummaryFilter = Queries.Marketplace.ReviewSummary.IInput['filter'];
export type ICreateReviewInput = Mutations.Marketplace.CreateReview.IInput['data'];
export type IUpdateMyReviewInput = Mutations.Marketplace.UpdateMyReview.IInput['data'];
export type ISetReviewStatusInput = Mutations.Marketplace.SetReviewStatus.IInput['data'];

export async function listReviews(
  filter: IListReviewsFilter,
  options: IListReviewsOptions,
): Promise<MarketplaceReviewPage> {
  const { [Queries.Marketplace.ListReviews.name]: page } = await client.Query(
    Queries.Marketplace.ListReviews.query,
    { variables: { filter, options } },
  );
  return page;
}

export async function loadReviewSummary(filter: IReviewSummaryFilter): Promise<MarketplaceReviewSummaryView> {
  const { [Queries.Marketplace.ReviewSummary.name]: summary } = await client.Query(
    Queries.Marketplace.ReviewSummary.query,
    { variables: { filter } },
  );
  return summary;
}

/** Отзыв заказчика по его заказу; null — отзыв ещё не оставлен. */
export async function loadMyReviewByOrder(order_id: string): Promise<MarketplaceReviewView | null> {
  const { [Queries.Marketplace.MyReviewByOrder.name]: review } = await client.Query(
    Queries.Marketplace.MyReviewByOrder.query,
    { variables: { order_id } },
  );
  return review ?? null;
}

export async function createReview(data: ICreateReviewInput): Promise<MarketplaceReviewView> {
  const { [Mutations.Marketplace.CreateReview.name]: review } = await client.Mutation(
    Mutations.Marketplace.CreateReview.mutation,
    { variables: { data } },
  );
  return review;
}

export async function updateMyReview(data: IUpdateMyReviewInput): Promise<MarketplaceReviewView> {
  const { [Mutations.Marketplace.UpdateMyReview.name]: review } = await client.Mutation(
    Mutations.Marketplace.UpdateMyReview.mutation,
    { variables: { data } },
  );
  return review;
}

export async function setReviewStatus(data: ISetReviewStatusInput): Promise<MarketplaceReviewView> {
  const { [Mutations.Marketplace.SetReviewStatus.name]: review } = await client.Mutation(
    Mutations.Marketplace.SetReviewStatus.mutation,
    { variables: { data } },
  );
  return review;
}
