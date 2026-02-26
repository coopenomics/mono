// application/meet/services/meet-event.service.ts

import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PubSub } from 'graphql-subscriptions';
import { MeetInteractor } from '../interactors/meet.interactor';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { DomainToBlockchainUtils } from '~/shared/utils/domain-to-blockchain.utils';
import type { MeetDecisionDomainInterface } from '~/domain/meet/interfaces/meet-decision-domain.interface';
import { MeetContract } from 'cooptypes';
import type { IAction } from '~/types';
import { PUB_SUB } from '~/infrastructure/pubsub/pubsub.module';
import { SOVIET_EVENTS } from '../resolvers/meet-subscription.resolver';

/**
 * Сервис обработки событий собраний
 * Подписывается на события из внутренней шины и вызывает соответствующий интерактор
 */
@Injectable()
export class MeetEventService {
  constructor(
    private readonly meetInteractor: MeetInteractor,
    private readonly logger: WinstonLoggerService,
    @Inject(PUB_SUB) private readonly pubSub: PubSub,
  ) {
    this.logger.setContext(MeetEventService.name);
  }

  private notifySovietChanged(entity: string, action: string) {
    this.pubSub.publish(SOVIET_EVENTS.DATA_CHANGED, {
      sovietDataChanged: { entity, action },
    });
  }

  /**
   * Обработчик события решения собрания из блокчейна
   */
  @OnEvent(`action::${MeetContract.contractName.production}::${MeetContract.Actions.NewDecision.actionName}`)
  async handleMeetDecision(event: IAction): Promise<void> {
    try {
      // Преобразуем блокчейн-документ в формат ISignedDocumentDomainInterface
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
      this.notifySovietChanged('decision', 'processed');
    } catch (error: any) {
      this.logger.error(`Error processing meet decision: ${error.message}`, error.stack);
    }
  }
}
