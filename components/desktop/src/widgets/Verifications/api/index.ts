import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

export type IVerificationReviewsInput = Queries.Verification.VerificationReviews.IInput['data'];
export type IVerificationReview =
  Queries.Verification.VerificationReviews.IOutput[typeof Queries.Verification.VerificationReviews.name][number];
export type IVerificationReviewPhoto =
  Queries.Verification.VerificationReviewPhotos.IOutput[typeof Queries.Verification.VerificationReviewPhotos.name][number];
export type IApproveVerificationInput = Mutations.Verification.ApproveVerification.IInput['data'];
export type IRejectVerificationInput = Mutations.Verification.RejectVerification.IInput['data'];

/** Журнал верификаций личности: кто, где и когда сверял и чем это закончилось. */
async function listVerificationReviews(data?: IVerificationReviewsInput): Promise<IVerificationReview[]> {
  const { [Queries.Verification.VerificationReviews.name]: result } = await client.Query(
    Queries.Verification.VerificationReviews.query,
    { variables: { data: data ?? {} } },
  );
  return result;
}

/** Снимки сверки — доступны, пока совет не принял решение. */
async function getVerificationReviewPhotos(review_id: string): Promise<IVerificationReviewPhoto[]> {
  const { [Queries.Verification.VerificationReviewPhotos.name]: result } = await client.Query(
    Queries.Verification.VerificationReviewPhotos.query,
    { variables: { data: { review_id } } },
  );
  return result;
}

/** Совет подтвердил сверку: снимки удаляются, уровень остаётся. */
async function approveVerification(data: IApproveVerificationInput): Promise<void> {
  await client.Mutation(Mutations.Verification.ApproveVerification.mutation, { variables: { data } });
}

/** Совет отклонил сверку: верификация отзывается, выдача снова закрыта. */
async function rejectVerification(data: IRejectVerificationInput): Promise<void> {
  await client.Mutation(Mutations.Verification.RejectVerification.mutation, { variables: { data } });
}

export const api = {
  listVerificationReviews,
  getVerificationReviewPhotos,
  approveVerification,
  rejectVerification,
};
