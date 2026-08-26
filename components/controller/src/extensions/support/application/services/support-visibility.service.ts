import { Injectable } from '@nestjs/common';
import type { SupportTicketDomainEntity } from '../../domain/entities/support-ticket.entity';
import type { SupportTicketMessageDomainEntity } from '../../domain/entities/support-ticket-message.entity';
import type { SupportTicketAttachmentDomainEntity } from '../../domain/entities/support-ticket-attachment.entity';
import { SupportSystemEvent } from '../../domain/enums/support-system-event.enum';
import { isCouncilRole } from '../../constants/support-access';
import { supportAutoCloseAt } from '../../constants/support-auto-close';
import type { SupportActor } from './support-actor';
import type {
  SupportAttachmentView,
  SupportTicketCardView,
  SupportTicketListItemView,
  SupportTicketMessageView,
} from './support-queries.types';

/** Агрегаты строки списка, посчитанные батчем на страницу. */
export interface SupportTicketAggregates {
  messageCount: number;
  hasAttachments: boolean;
}

/**
 * Какие детали системного события видит автор обращения — по видам, а не по
 * голым именам ключей.
 *
 * Разрешительный список, устроенный по ключу, фейл-клоузед по ключу, но не по
 * смыслу: имена вроде `from` и `to` настолько общи, что их возьмёт и следующее
 * событие — и его детали проедут наружу за компанию, потому что ключ уже
 * разрешён. Привязка к виду события снимает это: разрешение выдано конкретной
 * величине конкретного события.
 *
 * Вид, которого в таблице нет, отдаёт автору `null`. Заведёт кто-нибудь новое
 * событие с внутренним текстом — оно по умолчанию промолчит. Обратная ошибка,
 * забыть добавить вид и потерять детали в интерфейсе, видна первому же, кто
 * откроет карточку.
 */
const PAYLOAD_VISIBLE_TO_AUTHOR: Partial<Record<SupportSystemEvent, readonly string[]>> = {
  [SupportSystemEvent.ASSIGNED]: ['assignee_username'],
  [SupportSystemEvent.PRIORITY_CHANGED]: ['from', 'to'],
  [SupportSystemEvent.REOPENED]: ['previous_status'],
  [SupportSystemEvent.AUTO_CLOSED]: ['threshold_hours'],
  // ESCALATED здесь отсутствует намеренно: причина эскалации — внутренняя
  // записка совета (решение председателя от 25.08.2026). Отсутствие вида
  // означает, что наружу не идёт ничего.
};

/**
 * Что из обращения видит тот, кто его читает.
 *
 * **История решения — она объясняет, почему класс называется так и почему в
 * нём осталось так мало.**
 *
 * 18.08.2026 председатель решил обезличивать ответную сторону: автору
 * обращения не показывалось, кто именно из совета с ним работает. Правило было
 * шире, чем «скрыть имя оператора», — имя утекало по четырём каналам
 * (исполнитель в шапке, автор сообщения в ленте, исполнитель системной записи
 * с деталями события, загрузивший вложение), и все четыре закрывались здесь,
 * в одном месте.
 *
 * 25.08.2026 решение отменено. Пайщику видно, кто из совета с ним работает:
 * и исполнитель, и автор ответа, и загрузивший файл; видны и записи об
 * эскалации. Институциональность обеспечивается тоном ответа («с уважением,
 * Совет»), а не сокрытием имён.
 *
 * **Внутри совета осталась ровно одна величина — текст причины эскалации.**
 * Член совета пишет его свободной формой как внутреннюю записку, и наружу он
 * не идёт. Ради неё класс и существует.
 *
 * **Почему отмена обошлась дёшево.** Скрытие всё это время делалось на выдаче,
 * а не при записи: имена как писались в базу, так и писались. Обезличь мы
 * записи — после отмены история осталась бы безымянной навсегда, восстанавливать
 * было бы неоткуда. Это и было то решение, которое стоило принять правильно.
 */
@Injectable()
export class SupportVisibilityService {
  /**
   * Ответная сторона обращения — множеством, а не одним полем.
   *
   * Сегодня в множестве не больше одного имени (колонка исполнителя). Форма
   * списка сохранена не ради обезличивания — его больше нет, — а ради фазы
   * участников: к обращению можно будет подключать нескольких членов совета, и
   * тогда изменится только наполнение этого метода.
   */
  private councilSide(ticket: SupportTicketDomainEntity): string[] {
    return ticket.assigneeUsername ? [ticket.assigneeUsername] : [];
  }

  // ── Обращение ───────────────────────────────────────────────────────

  listItem(
    ticket: SupportTicketDomainEntity,
    aggregates: SupportTicketAggregates
  ): SupportTicketListItemView {
    return {
      id: ticket.id,
      number: ticket.number,
      kind: ticket.kind,
      status: ticket.status,
      priority: ticket.priority,
      subject: ticket.subject,
      authorUsername: ticket.authorUsername,
      councilSide: this.councilSide(ticket),
      escalated: ticket.escalatedAt !== null,
      reopenCount: ticket.reopenCount,
      lastMessageAt: ticket.lastMessageAt,
      createdAt: ticket.createdAt,
      messageCount: aggregates.messageCount,
      hasAttachments: aggregates.hasAttachments,
    };
  }

  card(
    ticket: SupportTicketDomainEntity,
    aggregates: SupportTicketAggregates
  ): SupportTicketCardView {
    return {
      ...this.listItem(ticket, aggregates),
      resolvedAt: ticket.resolvedAt,
      // Расчётное поле обеим сторонам: пайщику — «закроется через столько-то»,
      // оператору — сколько ещё ждать. Порог общий с фоновой задачей.
      autoCloseAt: supportAutoCloseAt(ticket.status, ticket.resolvedAt),
      escalatedAt: ticket.escalatedAt,
      responsibilityZone: ticket.responsibilityZone,
    };
  }

  // ── Лента ───────────────────────────────────────────────────────────

  message(
    message: SupportTicketMessageDomainEntity,
    attachments: SupportTicketAttachmentDomainEntity[],
    actor: SupportActor
  ): SupportTicketMessageView {
    return {
      id: message.id,
      authorUsername: message.authorUsername,
      authorRole: message.authorRole,
      body: message.body,
      systemEvent: message.systemEvent,
      // Единственная оставшаяся развилка на всём столе.
      payload: this.visiblePayload(message, actor),
      createdAt: message.createdAt,
      attachments: attachments.map((attachment) => this.attachment(attachment)),
    };
  }

  // ── Вложение ────────────────────────────────────────────────────────

  attachment(attachment: SupportTicketAttachmentDomainEntity): SupportAttachmentView {
    return {
      id: attachment.id,
      originalFilename: attachment.originalFilename,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      uploadedByUsername: attachment.uploadedByUsername,
      uploadedAt: attachment.uploadedAt,
    };
  }

  /**
   * Детали системного события так, как их видит спрашивающий.
   *
   * Совету — как есть. Автору обращения — только то, что разрешено виду
   * события; пусто отдаётся как `null`, а не как объект без полей: наружу
   * должно уходить «деталей нет», а не «есть объект, но пустой».
   */
  private visiblePayload(
    message: SupportTicketMessageDomainEntity,
    actor: SupportActor
  ): Record<string, unknown> | null {
    if (isCouncilRole(actor.role)) return message.payload;
    // Умолчание — в сторону молчания. Запись без вида события просеять нечем:
    // таблица разрешений построена по видам, и человеческое сообщение с
    // непустым payload'ом ушло бы наружу непросеянным. Сегодня такой записи
    // быть не может — её запрещает @Check на сущности, — но полагаться здесь
    // на ограничение из другого слоя значит держать выдачу открытой по
    // умолчанию.
    if (!message.systemEvent || !message.payload) return null;

    const allowed = PAYLOAD_VISIBLE_TO_AUTHOR[message.systemEvent];
    if (!allowed) return null;

    const visible = Object.entries(message.payload).filter(([key]) => allowed.includes(key));
    return visible.length > 0 ? Object.fromEntries(visible) : null;
  }
}
