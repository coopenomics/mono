import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  ACCOUNT_PASSPORT_CHANGED_EVENT,
  type AccountPassportChangedEvent,
} from '~/domain/account/interfaces/account-passport-changed.event';
import { VerificationType } from '~/domain/auth-v2/verification/verification.types';
import { VerificationOnsiteService } from './verification-onsite.service';
import { VerificationTypesService } from './verification-types.service';
import { t } from '~/i18n';

/** Причина отзыва в журнале верификаций. */
const PASSPORT_CHANGED_REASON = t('authV2.passportChangeListener.revokeReasonMessage');

/**
 * Сверка по паспорту подтверждала конкретный документ. Когда совет меняет
 * паспортные данные, сверку снимаем до записи новых — заново её ставит
 * председатель или член совета. Ошибка отзыва отменяет изменение данных
 * (событие публикуется через `emitAsync`), чтобы новый паспорт не остался
 * «проверенным».
 */
@Injectable()
export class PassportChangeListener {
  private readonly logger = new Logger(PassportChangeListener.name);

  constructor(
    private readonly verificationTypesService: VerificationTypesService,
    private readonly verificationOnsiteService: VerificationOnsiteService,
  ) {}

  @OnEvent(ACCOUNT_PASSPORT_CHANGED_EVENT)
  async onPassportChanged(event: AccountPassportChangedEvent): Promise<void> {
    const levels = await this.verificationTypesService.resolveForUsername(event.username);
    if (!levels.some((level) => level.type === VerificationType.PassportOnsite)) return;

    try {
      await this.verificationOnsiteService.unverify(event.actor, event.username, PASSPORT_CHANGED_REASON);
      this.logger.log(`Сверка паспорта ${event.username} снята после смены паспорта (${event.actor})`);
    } catch (error) {
      // Сверку провёл другой кооператив: снять её мы не вправе, и нашей
      // записи о ней нет — менять данные это не мешает.
      const message = error instanceof Error ? error.message : String(error);
      // i18n-ignore: сверка с текстом отказа контракта — у контракта пока нет кодов
    if (message.includes('проведённая вашим кооперативом, не найдена')) return;
      throw error;
    }
  }
}
