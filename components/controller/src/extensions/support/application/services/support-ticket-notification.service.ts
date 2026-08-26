import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Workflows } from '@coopenomics/notifications';
import { platformSettings } from '@coopenomics/extension-kit';
import {
  LOGGER_PORT,
  type ILoggerPort,
  NOTIFICATION_PORT,
  type INotificationPort,
} from '@coopenomics/innercoop';
import {
  SUPPORT_TICKET_REPOSITORY,
  type SupportTicketRepository,
} from '../../domain/repositories/support-ticket.repository';
import type { SupportTicketDomainEntity } from '../../domain/entities/support-ticket.entity';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import {
  SUPPORT_TICKET_AUTHOR_REPLIED_EVENT,
  SUPPORT_TICKET_AUTHOR_STATUS_CHANGED_EVENT,
  SUPPORT_TICKET_PARTICIPANT_ADDED_EVENT,
  type SupportTicketAuthorRepliedEvent,
  type SupportTicketAuthorStatusChangedEvent,
  type SupportTicketParticipantAddedEvent,
} from '../events/support-notification.events';

/** Человеческое название статуса для письма. Показывается пайщику как есть. */
const STATUS_LABELS: Readonly<Record<SupportTicketStatus, string>> = {
  [SupportTicketStatus.NEW]: 'ожидает оператора',
  [SupportTicketStatus.IN_PROGRESS]: 'в работе',
  [SupportTicketStatus.RESOLVED]: 'решено',
  [SupportTicketStatus.CLOSED]: 'закрыто',
};

/**
 * Отправка уведомлений по событиям стола.
 *
 * Слушает все три события стола и зовёт Центр уведомлений. Своей очереди и своих
 * повторов не заводит: `notifyUser` пишет строки в транзакционный outbox, а
 * доставку разбирает фоновый обработчик — успешный вызов означает «принято к
 * доставке», а не «доставлено».
 *
 * **Почему получатель ищется здесь, а не приходит в событии.** Событие — это
 * факт домена, он произошёл независимо от того, кому о нём писать. Адресата
 * определяет слушатель (спецификация, раздел 7), и обращение он читает сам:
 * автор обращения в состав события не входит.
 *
 * У подключения к обращению получатель всё же приходит событием, и это не
 * исключение из правила, а то же правило: подключённый — не «кому писать про
 * факт», а сам факт. Обращение о нём ничего не знает, вычитывать оттуда нечего.
 *
 * **Почему учётные данные не берутся портом.** Спецификация предписывала
 * доставать `subscriber_id` и почту через порт учётных записей. С тех пор у
 * порта уведомлений появилась операция `notifyUser`, которая делает ровно это
 * внутри ядра — «перевод имени в подписчика требует доступа к учётным записям,
 * а расширению для одного уведомления заводить его незачем». Поэтому порт
 * учётных записей здесь не нужен, а заявка расширения не растёт.
 *
 * **Ошибки не всплывают.** Сбой доставки не должен ронять операцию, которая
 * уже зафиксирована в базе: событие излучается после фиксации транзакции, и
 * откатывать нечего. Всё, что может сделать слушатель, — записать в журнал.
 */
@Injectable()
export class SupportTicketNotificationService implements OnModuleInit {
  constructor(
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort,
    @Inject(SUPPORT_TICKET_REPOSITORY) private readonly tickets: SupportTicketRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(SupportTicketNotificationService.name);
  }

  onModuleInit(): void {
    this.logger.log(
      'Уведомления стола поддержки подключены: ответ в обращении, смена статуса и подключение к обращению'
    );
  }

  @OnEvent(SUPPORT_TICKET_AUTHOR_REPLIED_EVENT)
  async handleReplied(event: SupportTicketAuthorRepliedEvent): Promise<void> {
    try {
      const ticket = await this.loadTicket(event.ticket_id);
      if (!ticket) return;

      // Собственная реплика автора письма ему не порождает. Сюда попадает и
      // создание обращения: там автор сообщения всегда совпадает с автором
      // обращения, поэтому отдельной проверки на создание не нужно.
      if (event.author_username === ticket.authorUsername) return;

      const payload: Workflows.SupportTicketReplied.IPayload = {
        ticketNumber: ticket.number,
        subject: ticket.subject,
        ticketUrl: this.buildTicketUrl(event.coopname, ticket.id),
        // В тексте письма не показывается: поле нужно ключу подавления
        // повторов, чтобы второй ответ на то же обращение не был принят за
        // дубль первого. Подробности — в описании типа уведомления.
        messageId: event.message_id,
      };

      await this.notifications.notifyUser(
        ticket.authorUsername,
        Workflows.SupportTicketReplied.id,
        payload
      );
      this.logger.log(`Уведомление об ответе принято к доставке: обращение № ${ticket.number}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Уведомление об ответе не отправлено (обращение ${event.ticket_id}): ${message}`);
    }
  }

  @OnEvent(SUPPORT_TICKET_AUTHOR_STATUS_CHANGED_EVENT)
  async handleStatusChanged(event: SupportTicketAuthorStatusChangedEvent): Promise<void> {
    try {
      const ticket = await this.loadTicket(event.ticket_id);
      if (!ticket) return;

      // Переход, вызванный самим автором, ему не сообщается: возврат обращения
      // в работу он совершил своим же сообщением. У автозакрытия инициатора
      // нет — поле пустое, и уведомление уходит всегда.
      if (event.initiator_username && event.initiator_username === ticket.authorUsername) return;

      const payload: Workflows.SupportTicketStatusChanged.IPayload = {
        ticketNumber: ticket.number,
        subject: ticket.subject,
        status: event.status,
        statusLabel: STATUS_LABELS[event.status],
        ticketUrl: this.buildTicketUrl(event.coopname, ticket.id),
        // См. комментарий выше: различитель события, в тексте письма его нет.
        messageId: event.message_id,
      };

      await this.notifications.notifyUser(
        ticket.authorUsername,
        Workflows.SupportTicketStatusChanged.id,
        payload
      );
      this.logger.log(
        `Уведомление о смене статуса принято к доставке: обращение № ${ticket.number}, статус ${event.status}`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Уведомление о смене статуса не отправлено (обращение ${event.ticket_id}): ${message}`
      );
    }
  }

  /**
   * **Единственное уведомление стола, которое идёт не автору обращения.**
   *
   * Получатель приходит прямо в событии, а не вычитывается из обращения: кого
   * подключили — это и есть суть события, обращение об этом ничего не знает.
   * Остальные два уведомления адресуются автору, и его слушатель достаёт сам.
   */
  @OnEvent(SUPPORT_TICKET_PARTICIPANT_ADDED_EVENT)
  async handleParticipantAdded(event: SupportTicketParticipantAddedEvent): Promise<void> {
    try {
      // Подключивший самого себя письма о своём же действии не получает — то
      // же правило, что у двух других уведомлений, только сравнивается не с
      // автором обращения, а с подключённым.
      if (event.initiator_username === event.participant_username) return;

      const ticket = await this.loadTicket(event.ticket_id);
      if (!ticket) return;

      const payload: Workflows.SupportTicketParticipantAdded.IPayload = {
        ticketNumber: ticket.number,
        subject: ticket.subject,
        ticketUrl: this.buildTicketUrl(event.coopname, ticket.id),
        // В тексте письма не показывается: различитель для ключа подавления
        // повторов. Берётся идентификатор записи подключения, а не пара
        // «обращение и человек», — иначе повторное подключение после
        // отключения молча не дошло бы, повторив ключ первого.
        participationId: event.participation_id,
      };

      await this.notifications.notifyUser(
        event.participant_username,
        Workflows.SupportTicketParticipantAdded.id,
        payload
      );
      this.logger.log(
        `Уведомление о подключении принято к доставке: обращение № ${ticket.number}, участник ${event.participant_username}`
      );
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Уведомление о подключении не отправлено (обращение ${event.ticket_id}): ${message}`
      );
    }
  }

  private async loadTicket(ticketId: string): Promise<SupportTicketDomainEntity | null> {
    const ticket = await this.tickets.findById(ticketId);
    if (!ticket) {
      // Не ошибка доставки, а расхождение состояния: событие пришло на
      // обращение, которого в базе нет. Молчать нельзя — писать некому.
      this.logger.warn(`Уведомление пропущено: обращение ${ticketId} не найдено`);
    }
    return ticket;
  }

  /** Ссылка на карточку обращения на столе пайщика (маршрут `/:coopname/support/:id`). */
  private buildTicketUrl(coopname: string, ticketId: string): string {
    return `${platformSettings().frontendUrl}/${coopname}/support/${ticketId}`;
  }
}
