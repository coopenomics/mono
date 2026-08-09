// application/meet/services/meet-event.service.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MeetInteractor } from '../interactors/meet.interactor';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import type { MeetDecisionDomainInterface } from '~/domain/meet/interfaces/meet-decision-domain.interface';
import { MeetContract } from 'cooptypes';
import type { IAction } from '~/types';
import { DomainToBlockchainUtils } from '@coopenomics/extension-kit';

/**
 * Сервис обработки событий собраний
 * Подписывается на события из внутренней шины и вызывает соответствующий интерактор
 */
@Injectable()
export class MeetEventService {
  constructor(private readonly meetInteractor: MeetInteractor, private readonly logger: WinstonLoggerService) {
    this.logger.setContext(MeetEventService.name);
  }

  /**
   * Обработчик события решения собрания из блокчейна
   */
  @OnEvent(`action::${MeetContract.contractName.production}::${MeetContract.Actions.NewDecision.actionName}`)
  async handleMeetDecision(event: IAction): Promise<void> {
    try {
      // Преобразуем блокчейн-документ в формат ISignedDocument
      const decisionDocument = DomainToBlockchainUtils.convertChainDocumentToSignedDocument2(event.data.decision);

      // Нормализуем числовые значения
      const decisionData: MeetDecisionDomainInterface = {
        ...event.data,
        signed_ballots: Number(event.data.signed_ballots),
        quorum_percent: Number(event.data.quorum_percent),
        results: event.data.results.map((item: any) => ({
          ...item,
          question_id: Number(item.question_id),
          number: Number(item.number),
          votes_for: Number(item.votes_for),
          votes_against: Number(item.votes_against),
          votes_abstained: Number(item.votes_abstained),
        })),
        decision: decisionDocument, // Документ решения из блокчейна
      };

      // Используем интерактор для сохранения данных о завершенном собрании
      await this.meetInteractor.processMeetDecision({
        action: event,
        decisionData,
      });

      this.logger.info(`Processed meet decision for ${event.data.hash}`);
    } catch (error: any) {
      this.logger.error(`Error processing meet decision: ${error.message}`, error.stack);
    }
  }
}
