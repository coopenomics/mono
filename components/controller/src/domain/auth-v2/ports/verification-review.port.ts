import type { VerificationReview, VerificationReviewStatus } from '~/domain/auth-v2/verification/verification-review.types';

/**
 * Порт журнала верификаций личности (CoopID, задача 105-29). Хранилище —
 * coop_domain_db текущего кооператива: контроллер обслуживает один кооператив,
 * поэтому колонки coopname нет (как у `verification_rules`).
 *
 * Журнал ведёт сервер, потому что в цепи истории нет: вектор `verifications`
 * хранит только текущее состояние, а отзыв запись стирает.
 */
export const VERIFICATION_REVIEW_REPOSITORY = Symbol('VerificationReviewRepository');

/** Что записываем в момент сверки личности. */
export interface VerificationReviewDraft {
  id: string;
  username: string;
  procedure: string;
  braname: string;
  verificator: string;
  status: VerificationReviewStatus;
  photos: VerificationReview['photos'];
}

/** Отбор для журнала: без фильтров — вся история, свежие сверху. */
export interface VerificationReviewFilter {
  status?: VerificationReviewStatus;
  username?: string;
  braname?: string;
  limit?: number;
}

export interface IVerificationReviewRepository {
  create(draft: VerificationReviewDraft): Promise<VerificationReview>;
  findById(id: string): Promise<VerificationReview | null>;
  /** Последняя запись пайщика — по ней отмечаем отзыв верификации. */
  findLatestByUsername(username: string): Promise<VerificationReview | null>;
  list(filter: VerificationReviewFilter): Promise<VerificationReview[]>;
  countByStatus(status: VerificationReviewStatus): Promise<number>;
  /** Решение совета: статус, автор, причина; снимки при этом стираются из записи. */
  decide(params: {
    id: string;
    status: VerificationReviewStatus;
    decided_by: string;
    decision_reason?: string | null;
    clear_photos: boolean;
  }): Promise<VerificationReview | null>;
}
