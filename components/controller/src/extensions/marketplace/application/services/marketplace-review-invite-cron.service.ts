import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  MARKETPLACE_REVIEW_REPOSITORY,
  type MarketplaceReviewDomainRepository,
  type ReviewInviteCandidate,
} from '../../domain/repositories/marketplace-review.repository';
import {
  MARKETPLACE_REVIEW_INVITE_EVENT,
  type MarketplaceReviewInviteEvent,
} from '../events/marketplace-notification.events';

/**
 * Через сколько часов после получения заказа приглашать оставить отзыв:
 * заказчик успел донести имущество до дома и посмотреть на него, а получение
 * ещё свежо в памяти. Приглашение уходит в течение суток после получения.
 */
export const MARKETPLACE_REVIEW_INVITE_AFTER_HOURS = 3;

/**
 * Позже этого срока от получения приглашение не шлём: о давнем заказе оно
 * выглядит случайным письмом. Этот же срок не даёт разослать приглашения по
 * всем старым заказам при первом запуске задачи.
 */
export const MARKETPLACE_REVIEW_INVITE_WINDOW_HOURS = 48;

/** Сколько приглашений уходит за прогон — защита от лавины уведомлений. */
const REVIEW_INVITE_BATCH_LIMIT = 100;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Приглашение оставить отзыв (задача 598-61). Раз в час выбирает заказы,
 * полученные от трёх часов до двух суток назад, по которым нет ни отзыва, ни
 * отправленного приглашения, и по каждому шлёт заказчику одно уведомление со
 * ссылкой на форму отзыва.
 *
 * Отметка об отправке ставится до уведомления и только на заказ без отметки:
 * две задачи, сошедшиеся на одном заказе, пригласят заказчика один раз. Сбой
 * отправки приглашение не возвращает — навязчивость хуже пропуска.
 */
@Injectable()
export class MarketplaceReviewInviteCronService {
  constructor(
    @Inject(MARKETPLACE_REVIEW_REPOSITORY)
    private readonly reviews: MarketplaceReviewDomainRepository,
    private readonly eventBus: EventEmitter2,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(MarketplaceReviewInviteCronService.name);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async triggerHourlyInvite(): Promise<void> {
    const coopname = platformSettings().coopname;
    if (!coopname) return;
    await this.inviteReceived(coopname, new Date());
  }

  async inviteReceived(coopname: string, now: Date): Promise<{ invited: number }> {
    const receivedFrom = new Date(now.getTime() - MARKETPLACE_REVIEW_INVITE_WINDOW_HOURS * HOUR_MS);
    const receivedTo = new Date(now.getTime() - MARKETPLACE_REVIEW_INVITE_AFTER_HOURS * HOUR_MS);
    let candidates: ReviewInviteCandidate[];
    try {
      candidates = await this.reviews.listOrdersAwaitingInvite(coopname, receivedFrom, receivedTo, REVIEW_INVITE_BATCH_LIMIT);
    } catch (e) {
      this.logger.warn(`[REVIEW-INVITE] выборка заказов без отзыва упала: ${(e as Error).message}`);
      return { invited: 0 };
    }
    let invited = 0;
    for (const candidate of candidates) {
      try {
        if (!(await this.reviews.claimInvite(coopname, candidate.order_id, now))) continue;
        const event: MarketplaceReviewInviteEvent = {
          coopname,
          order_id: candidate.order_id,
          orderer_account: candidate.orderer_account,
          product_name: candidate.product_name,
        };
        this.eventBus.emit(MARKETPLACE_REVIEW_INVITE_EVENT, event);
        invited++;
      } catch (e) {
        this.logger.warn(`[REVIEW-INVITE] заказ ${candidate.order_id}: приглашение не отправлено: ${(e as Error).message}`);
      }
    }
    if (invited > 0) {
      this.logger.info(`[REVIEW-INVITE] приглашений оставить отзыв: ${invited} из ${candidates.length} (coopname=${coopname})`);
    }
    return { invited };
  }
}
