import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { ACCOUNT_DATA_PORT, AccountDataPort } from '~/domain/account/ports/account-data.port';
import config from '~/config/config';
import { SovietContract } from 'cooptypes';
import type { ActionDomainInterface } from '~/domain/parser/interfaces/action-domain.interface';
import { Workflows } from '@coopenomics/notifications';
import { NOTIFICATION_PORT, INotificationPort } from '@coopenomics/innercoop';
import { SOVIET_BLOCKCHAIN_PORT, SovietBlockchainPort } from '~/domain/common/ports/soviet-blockchain.port';

/**
 * Сервис для отправки уведомлений о новых вопросах на повестке совета
 *
 * Подписывается на действие soviet::createagenda и отправляет уведомления
 * всем членам совета о новом вопросе
 */
@Injectable()
export class AgendaNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT)
    private readonly notificationPort: INotificationPort,
    @Inject(ACCOUNT_DATA_PORT)
    private readonly accountPort: AccountDataPort,
    @Inject(SOVIET_BLOCKCHAIN_PORT)
    private readonly sovietPort: SovietBlockchainPort,
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(AgendaNotificationService.name);
  }

  /**
   * Номер вопроса в повестке по хэшу действия: контракт пишет этот хэш в
   * решение. Вопроса в таблице нет (цепь не ответила) — номера нет, и
   * оповещение ведёт на повестку целиком.
   */
  private async questionIdOf(coopname: string, hash: string): Promise<string | null> {
    try {
      const target = String(hash).toUpperCase();
      const decision = (await this.sovietPort.getDecisions(coopname)).find((d) => String(d.hash).toUpperCase() === target);
      return decision ? String(decision.id) : null;
    } catch (error: any) {
      this.logger.warn(`Номер вопроса по хэшу ${hash} не найден: ${error.message}`);
      return null;
    }
  }

  async onModuleInit() {
    this.logger.log('AgendaNotificationService инициализирован');
  }

  /** Оповещает членов совета по одному; возвращает число отправленных оповещений. */
  private async notifyCouncil(
    members: Awaited<ReturnType<AccountDataPort['getAccounts']>>['items'],
    coopname: string,
    payload: Workflows.NewAgenda.IPayload
  ): Promise<number> {
    let sentCount = 0;
    for (const member of members) {
      const memberEmail = member.provider_account?.email;
      const memberSubscriberId = member.provider_account?.subscriber_id?.trim();
      if (!memberSubscriberId) {
        this.logger.warn(`subscriber_id члена совета ${member.username} не найден, пропускаем`);
        continue;
      }
      if (!memberEmail) {
        this.logger.warn(`Email члена совета ${member.username} не найден, пропускаем`);
        continue;
      }

      try {
        await this.notificationPort.notify({
          coopname,
          workflowId: Workflows.NewAgenda.id,
          to: {
            subscriberId: memberSubscriberId,
            email: memberEmail,
            username: member.username,
          },
          payload,
        });
        sentCount++;
      } catch (error: any) {
        this.logger.error(`Ошибка отправки уведомления члену совета ${member.username}: ${error.message}`);
      }
    }
    return sentCount;
  }

  /**
   * Обработчик действия soviet::createagenda
   * Отправляет уведомления всем членам совета о новом вопросе на повестке
   */
  @OnEvent(`action::${SovietContract.contractName.production}::${SovietContract.Actions.Decisions.CreateAgenda.actionName}`)
  async handleCreateAgenda(actionData: ActionDomainInterface): Promise<void> {
    try {
      const action = actionData.data as SovietContract.Interfaces.ICreateagenda;
      // Проверяем что это наш кооператив
      if (action.coopname !== config.coopname) {
        return;
      }

      // Номер вопроса — как на столе совета; по нему же строится прямая ссылка.
      const questionId = await this.questionIdOf(action.coopname, action.hash);
      const agendaId = questionId ?? action.hash.substring(0, 4);
      const agendaUrl = `${config.frontend_url}/${action.coopname}/soviet/agenda`;

      this.logger.debug(`Обработка создания нового вопроса на повестке для решения ${agendaId}`);

      // Получаем членов совета (chairman и member) через порт
      const chairmen = await this.accountPort.getAccounts({ role: 'chairman' }, { page: 1, limit: 10, sortOrder: 'ASC' });
      const members = await this.accountPort.getAccounts({ role: 'member' }, { page: 1, limit: 100, sortOrder: 'ASC' });
      const allCouncilMembers = [...chairmen.items, ...members.items];

      if (allCouncilMembers.length === 0) {
        this.logger.warn('Члены совета не найдены, пропускаем отправку уведомлений');
        return;
      }

      // Получаем кооператив для получения short_name
      const coop = await this.accountPort.getAccount(config.coopname);
      const coopShortName = coop.private_account?.organization_data?.short_name || config.coopname;

      // Получаем отображаемое имя автора вопроса
      const authorName = await this.accountPort.getDisplayName(action.username);

      // Формируем данные для workflow
      const payload: Workflows.NewAgenda.IPayload = {
        coopname: action.coopname,
        coopShortName,
        itemTitle: `№${agendaId}`,
        itemDescription: ``,
        authorName,
        decision_id: agendaId,
        // Ссылка ведёт на страницу этого вопроса; без номера — на повестку.
        agendaUrl: questionId ? `${agendaUrl}/${questionId}` : agendaUrl,
      };

      const sentCount = await this.notifyCouncil(allCouncilMembers, action.coopname, payload);

      if (sentCount === 0) {
        this.logger.warn('Не удалось отправить уведомления ни одному члену совета');
        return;
      }
      this.logger.log(`Уведомления отправлены ${sentCount} членам совета о новом вопросе на повестке (решение ${agendaId})`);
    } catch (error: any) {
      this.logger.error(`Ошибка при обработке создания вопроса на повестке: ${error.message}`, error.stack);
    }
  }
}
