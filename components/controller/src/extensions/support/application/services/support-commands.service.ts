import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { platformSettings } from '@coopenomics/extension-kit';
import { USER_DIRECTORY_PORT, type IUserDirectoryPort } from '@coopenomics/innercoop';
import {
  SUPPORT_TICKET_REPOSITORY,
  type SupportLedgerEntryDraft,
  type SupportTicketChanges,
  type SupportTicketRepository,
} from '../../domain/repositories/support-ticket.repository';
import type { SupportTicketDomainEntity } from '../../domain/entities/support-ticket.entity';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportTicketPriority } from '../../domain/enums/support-ticket-priority.enum';
import { SupportResponsibilityZone } from '../../domain/enums/support-responsibility-zone.enum';
import { SupportMessageAuthorRole } from '../../domain/enums/support-message-author-role.enum';
import { SupportSystemEvent } from '../../domain/enums/support-system-event.enum';
import { SupportAttachmentsService } from './support-attachments.service';
import {
  SUPPORT_TICKET_AUTHOR_REPLIED_EVENT,
  SUPPORT_TICKET_AUTHOR_STATUS_CHANGED_EVENT,
  type SupportTicketAuthorRepliedEvent,
  type SupportTicketAuthorStatusChangedEvent,
} from '../events/support-notification.events';
import type {
  AssignSupportTicketInput,
  ChangeSupportTicketPriorityInput,
  CreateSupportTicketInput,
  EscalateSupportTicketInput,
  ReplySupportTicketInput,
  ResolveSupportTicketInput,
  SupportActor,
} from './support-commands.types';

/** Роли, составляющие совет. Оператор в первой версии — это член совета. */
const COUNCIL_ROLES: ReadonlyArray<string> = ['chairman', 'member'];

/** Статусы, из которых обращение уже не ведут: назначать оператора в них нельзя. */
const TERMINAL_STATUSES: ReadonlyArray<SupportTicketStatus> = [
  SupportTicketStatus.RESOLVED,
  SupportTicketStatus.CLOSED,
];

/**
 * Ответ пайщику и про несуществующее обращение, и про чужое.
 *
 * Текст один на оба случая намеренно и вынесен в константу, чтобы формулировки
 * не разошлись при правке: если чужое обращение отвечает «нет прав», а
 * несуществующее — «не найдено», разница ответов сама по себе сообщает, что
 * обращение с таким идентификатором существует. Перебором это превращается в
 * список чужих обращений, ничего не показывая напрямую.
 */
const TICKET_NOT_FOUND_MESSAGE = 'Обращение не найдено.';

/**
 * Шесть команд стола поддержки.
 *
 * Что здесь есть и чего нет:
 *
 * - **Кооператив не принимается аргументом ни одной командой** — берётся из
 *   настроек контура. Область видимости задаёт сервер, подменить кооператив
 *   запросом невозможно в принципе, а не «потому что мы проверили».
 * - **Ручного закрытия среди команд нет** и не будет: единственный путь в
 *   статус «закрыто» — фоновый таймер. Ожидание перед закрытием существует
 *   ради пайщика, и команда, снимающая его решением другой стороны, отменяла
 *   бы сам смысл разделения «решено» и «закрыто».
 * - **Возврата в работу отдельной командой тоже нет**: это следствие сообщения
 *   автора, а не самостоятельное действие.
 *
 * Транзакция и события. Всё, что команда пишет, уходит в репозиторий одним
 * вызовом и одной транзакцией; события излучаются только ПОСЛЕ её фиксации.
 * Обратный порядок означал бы уведомление о состоянии, которого в базе может
 * и не оказаться.
 */
@Injectable()
export class SupportCommandsService {
  constructor(
    @Inject(SUPPORT_TICKET_REPOSITORY) private readonly tickets: SupportTicketRepository,
    @Inject(USER_DIRECTORY_PORT) private readonly users: IUserDirectoryPort,
    private readonly attachments: SupportAttachmentsService,
    private readonly events: EventEmitter2
  ) {}

  // ── Команды пайщика ─────────────────────────────────────────────────

  async createSupportTicket(
    input: CreateSupportTicketInput,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    const subject = input.subject?.trim();
    const body = input.body?.trim();
    if (!subject) throw new BadRequestException('Тема обращения не может быть пустой.');
    if (!body) throw new BadRequestException('Текст обращения не может быть пустым.');

    // Обращения ещё нет, конфликтовать вложению не с чем — поэтому null.
    const drafts = await this.attachments.prepare(null, input.attachments ?? [], actor.username);

    const now = new Date();
    const { ticket, message } = await this.tickets.createWithFirstMessage(
      {
        coopname: platformSettings().coopname,
        kind: input.kind,
        status: SupportTicketStatus.NEW,
        // Приоритет не приходит от автора: всем — значение по умолчанию.
        priority: SupportTicketPriority.NORMAL,
        subject,
        authorUsername: actor.username,
        assigneeUsername: null,
        responsibilityZone: SupportResponsibilityZone.COOPERATIVE,
        lastMessageAt: now,
        resolvedAt: null,
        escalatedAt: null,
        reopenCount: 0,
      },
      {
        message: {
          authorUsername: actor.username,
          authorRole: SupportMessageAuthorRole.MEMBER,
          body,
          systemEvent: null,
          payload: null,
        },
        attachments: drafts,
      }
    );

    // Событие излучается и здесь: правило механическое — добавлена
    // человеческая запись, значит факт произошёл. Письма из него не выйдет,
    // слушатель гасит отправку, когда инициатор совпадает с автором
    // обращения, а на создании это всегда так.
    this.emitReplied(ticket, message.id, actor.username, message.authorRole);
    return ticket;
  }

  async replySupportTicket(
    input: ReplySupportTicketInput,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    const body = input.body?.trim();
    if (!body) throw new BadRequestException('Текст сообщения не может быть пустым.');

    const ticket = await this.getTicketOrFail(input.ticket_id);
    const isAuthor = ticket.authorUsername === actor.username;
    if (!isAuthor && !this.isCouncil(actor)) {
      // Пайщику чужое обращение неотличимо от несуществующего: тот же тип
      // ответа и тот же текст, что у пропавшего идентификатора. Обращения
      // пайщиков закрыты друг от друга, и сам факт существования — тоже часть
      // закрытого (спецификация, раздел 2; на командах правило то же).
      // Для совета развилки нет: ему доступно любое обращение кооператива.
      throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    }

    const drafts = await this.attachments.prepare(ticket.id, input.attachments ?? [], actor.username);

    const now = new Date();
    const entries: SupportLedgerEntryDraft[] = [
      {
        message: {
          authorUsername: actor.username,
          // Роль пишется снимком: автор, позже вошедший в совет, не должен
          // задним числом превратить свои прежние реплики в ответы оператора.
          authorRole: isAuthor ? SupportMessageAuthorRole.MEMBER : SupportMessageAuthorRole.OPERATOR,
          body,
          systemEvent: null,
          payload: null,
        },
        attachments: drafts,
      },
    ];
    const changes: SupportTicketChanges = { lastMessageAt: now };

    // Возврат в работу — не команда, а следствие: обращение возвращается само,
    // когда пишет его автор. Условие — совпадение имён, роль записи в нём НЕ
    // участвует: иначе автор, успевший войти в совет, не смог бы переоткрыть
    // собственное обращение.
    const reopens = isAuthor && TERMINAL_STATUSES.includes(ticket.status);
    if (reopens) {
      const previousStatus = ticket.status;
      const restored = ticket.assigneeUsername
        ? SupportTicketStatus.IN_PROGRESS
        : SupportTicketStatus.NEW;

      changes.status = restored;
      // Отсчёт автозакрытия обнуляется: обращение снова живое.
      changes.resolvedAt = null;
      changes.reopenCount = ticket.reopenCount + 1;

      entries.push({
        message: {
          authorUsername: actor.username,
          authorRole: SupportMessageAuthorRole.SYSTEM,
          body: null,
          systemEvent: SupportSystemEvent.REOPENED,
          payload: { previous_status: previousStatus },
        },
        attachments: [],
      });
    }

    const result = await this.tickets.appendAndUpdate(ticket.id, entries, changes);

    // Записи возвращаются в том порядке, в каком переданы: первая — сообщение
    // человека, вторая (если есть) — системная отметка о возврате в работу.
    this.emitReplied(result.ticket, result.messages[0].id, actor.username, entries[0].message.authorRole);
    if (reopens) {
      this.emitStatusChanged(result.ticket, result.messages[1].id, ticket.status, actor.username);
    }
    return result.ticket;
  }

  // ── Команды оператора ───────────────────────────────────────────────

  async assignSupportTicket(
    input: AssignSupportTicketInput,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    this.assertCouncil(actor, 'Брать обращения в работу и назначать оператора может только совет кооператива.');

    const ticket = await this.getTicketOrFail(input.ticket_id);

    if (TERMINAL_STATUSES.includes(ticket.status)) {
      // Решение 20.08.2026: спецификация описывает только переход NEW →
      // IN_PROGRESS и про терминальные статусы молчит. Выбран отказ, чтобы
      // решённое обращение не оживало действием совета: возврат в работу —
      // право автора и происходит только его сообщением.
      throw new BadRequestException(
        'Назначить оператора можно только обращению, которое ещё ведут. Решённое обращение возвращает в работу его автор.'
      );
    }

    // Повторное взятие в работу тем же оператором — молчаливое «ничего не
    // делаем» с возвратом текущего состояния. Иначе двойной клик пишет вторую
    // запись в ленту и шлёт пайщику второе письмо об одном событии.
    if (ticket.assigneeUsername === input.assignee_username && ticket.status === SupportTicketStatus.IN_PROGRESS) {
      return ticket;
    }

    // Оператором может быть только член совета. Без этой проверки обращение
    // числилось бы взятым в работу за пайщиком, который его никогда не увидит:
    // очередь оператора собирается по роли, и в его стол обращение не попадёт.
    // Роль спрашиваем у справочника пользователей — своей копии состава совета
    // расширение не держит. Проверка стоит после молчаливого повтора намеренно:
    // повтор ничего не меняет и не должен ходить в справочник, а назначенного
    // ранее оператора команда не обязана перепроверять.
    await this.assertAssigneeIsCouncil(input.assignee_username);

    const now = new Date();
    const changes: SupportTicketChanges = {
      assigneeUsername: input.assignee_username,
      lastMessageAt: now,
    };
    const statusChanges = ticket.status === SupportTicketStatus.NEW;
    if (statusChanges) changes.status = SupportTicketStatus.IN_PROGRESS;

    const result = await this.tickets.appendAndUpdate(
      ticket.id,
      [
        {
          message: {
            authorUsername: actor.username,
            authorRole: SupportMessageAuthorRole.SYSTEM,
            body: null,
            systemEvent: SupportSystemEvent.ASSIGNED,
            // Имя оператора пишется как есть. Обезличивание — шаг выдачи, а не
            // записи: решение о нём объявлено временным, и обезличенную запись
            // после его отмены восстанавливать было бы неоткуда.
            payload: { assignee_username: input.assignee_username },
          },
          attachments: [],
        },
      ],
      changes
    );

    if (statusChanges) {
      this.emitStatusChanged(result.ticket, result.messages[0].id, ticket.status, actor.username);
    }
    return result.ticket;
  }

  async changeSupportTicketPriority(
    input: ChangeSupportTicketPriorityInput,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    this.assertCouncil(actor, 'Менять приоритет обращения может только совет кооператива.');

    const ticket = await this.getTicketOrFail(input.ticket_id);

    // Приоритет не изменился — писать в ленту «изменён с обычного на обычный»
    // незачем. Тот же приём, что у повторов терминальных переходов.
    if (ticket.priority === input.priority) return ticket;

    const result = await this.tickets.appendAndUpdate(
      ticket.id,
      [
        {
          message: {
            authorUsername: actor.username,
            authorRole: SupportMessageAuthorRole.SYSTEM,
            body: null,
            systemEvent: SupportSystemEvent.PRIORITY_CHANGED,
            payload: { from: ticket.priority, to: input.priority },
          },
          attachments: [],
        },
      ],
      { priority: input.priority, lastMessageAt: new Date() }
    );

    // Событие не излучается: приоритет пайщику не показывается, уведомлять
    // его не о чем (спецификация, раздел 7).
    return result.ticket;
  }

  async resolveSupportTicket(
    input: ResolveSupportTicketInput,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    this.assertCouncil(actor, 'Помечать обращение решённым может только совет кооператива.');

    const ticket = await this.getTicketOrFail(input.ticket_id);

    // Повторная пометка «решено» не двигает отсчёт автозакрытия и не шлёт
    // второго письма — молчаливо возвращаем текущее состояние.
    if (ticket.status === SupportTicketStatus.RESOLVED) return ticket;

    // Решить можно только то, что в работе: обращение, которого никто не брал,
    // решённым быть не может. Из NEW — отказ, оператор сначала берёт его.
    if (ticket.status !== SupportTicketStatus.IN_PROGRESS) {
      throw new BadRequestException(
        'Пометить решённым можно только обращение, взятое в работу.'
      );
    }

    const now = new Date();
    const comment = input.comment?.trim();
    const entries: SupportLedgerEntryDraft[] = [];

    // Решение с комментарием — одно действие человека: две записи в ленте
    // одной транзакцией, но уведомление одно, о смене статуса.
    if (comment) {
      entries.push({
        message: {
          authorUsername: actor.username,
          authorRole: SupportMessageAuthorRole.OPERATOR,
          body: comment,
          systemEvent: null,
          payload: null,
        },
        attachments: [],
      });
    }
    entries.push({
      message: {
        authorUsername: actor.username,
        authorRole: SupportMessageAuthorRole.SYSTEM,
        body: null,
        systemEvent: SupportSystemEvent.RESOLVED,
        payload: null,
      },
      attachments: [],
    });

    const result = await this.tickets.appendAndUpdate(ticket.id, entries, {
      status: SupportTicketStatus.RESOLVED,
      // Отсчёт автозакрытия начинается отсюда.
      resolvedAt: now,
      lastMessageAt: now,
    });

    // Ровно одно событие, даже когда записей в ленту ушло две: одно действие
    // человека не превращается в два письма пайщику. Различителем берётся
    // системная запись о решении — она в списке последняя, комментарий
    // оператора, если он был, идёт перед ней.
    const resolvedEntry = result.messages[result.messages.length - 1];
    this.emitStatusChanged(result.ticket, resolvedEntry.id, ticket.status, actor.username);
    return result.ticket;
  }

  async escalateSupportTicket(
    input: EscalateSupportTicketInput,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    this.assertCouncil(actor, 'Эскалировать обращение председателю может только совет кооператива.');

    const ticket = await this.getTicketOrFail(input.ticket_id);

    // РЕШЕНИЕ 20.08.2026 — НЕ «чинить» обратно по спецификации.
    //
    // Спецификация (раздел 3) описывает повторную эскалацию двумя взаимно
    // исключающими способами: в одном абзаце — «то же для повторной
    // эскалации», то есть молчаливый повтор, в соседнем — «эскалировать
    // второй раз нельзя, отказ с понятным текстом». Противоречие вынесено
    // председателю 20.08.2026, выбран молчаливый повтор: он единообразен с
    // остальными повторами терминальных переходов и делает двойной клик
    // безопасным. Отказ вернул бы ошибку на ровном месте.
    //
    // Если этот код когда-нибудь захотят «привести в соответствие» со вторым
    // абзацем спецификации — сначала перечитать это решение.
    if (ticket.escalatedAt) return ticket;

    const now = new Date();
    const reason = input.reason?.trim() || null;

    const result = await this.tickets.appendAndUpdate(
      ticket.id,
      [
        {
          message: {
            authorUsername: actor.username,
            authorRole: SupportMessageAuthorRole.SYSTEM,
            body: null,
            systemEvent: SupportSystemEvent.ESCALATED,
            payload: reason ? { reason } : null,
          },
          attachments: [],
        },
      ],
      // Статус эскалация не меняет: она про то, что дело подняли к
      // председателю, а не про этап работы над ним.
      { escalatedAt: now, lastMessageAt: now }
    );

    // Событие не излучается: отметка эскалации автору не показывается вовсе —
    // для него это внутренняя маршрутизация внутри совета, а не событие его
    // обращения (спецификация, раздел 5). Статус при этом не изменился.
    return result.ticket;
  }

  // ── Общее ───────────────────────────────────────────────────────────

  private isCouncil(actor: SupportActor): boolean {
    return COUNCIL_ROLES.includes(actor.role);
  }

  /**
   * Явная проверка роли в коде.
   *
   * Одного декоратора на резолвере мало: `RolesGuard` пропускает запрос, когда
   * в данных стоит имя самого запрашивающего, — это сделано для операций, где
   * пайщик действует за себя. В командах оператора такое послабление ломало бы
   * ограничение: пайщик, назначающий оператором себя, прошёл бы guard. В
   * расходах на это уже наступали, там роль тоже проверяется кодом.
   */
  private assertCouncil(actor: SupportActor, message: string): void {
    if (!this.isCouncil(actor)) throw new ForbiddenException(message);
  }

  /**
   * Назначаемый оператор обязан состоять в совете.
   *
   * Порт справочника сообщает роль, но решение принимает вызывающий — сам порт
   * прав не проверяет. Поэтому сравнение с составом совета живёт здесь.
   */
  private async assertAssigneeIsCouncil(username: string): Promise<void> {
    const assignee = await this.users.findByUsername(username);
    if (!assignee) {
      throw new BadRequestException(`Пайщик ${username} не найден в кооперативе.`);
    }
    if (!COUNCIL_ROLES.includes(assignee.role)) {
      throw new BadRequestException(
        'Оператором обращения может быть только член совета кооператива.'
      );
    }
  }

  private async getTicketOrFail(id: string): Promise<SupportTicketDomainEntity> {
    const ticket = await this.tickets.findById(id);
    if (!ticket) throw new NotFoundException(TICKET_NOT_FOUND_MESSAGE);
    return ticket;
  }

  private emitReplied(
    ticket: SupportTicketDomainEntity,
    messageId: string,
    authorUsername: string,
    authorRole: SupportMessageAuthorRole
  ): void {
    const payload: SupportTicketAuthorRepliedEvent = {
      coopname: ticket.coopname,
      ticket_id: ticket.id,
      message_id: messageId,
      ticket_number: ticket.number,
      subject: ticket.subject,
      author_username: authorUsername,
      author_role: authorRole,
    };
    this.events.emit(SUPPORT_TICKET_AUTHOR_REPLIED_EVENT, payload);
  }

  private emitStatusChanged(
    ticket: SupportTicketDomainEntity,
    messageId: string,
    previousStatus: SupportTicketStatus,
    initiatorUsername: string | null
  ): void {
    const payload: SupportTicketAuthorStatusChangedEvent = {
      coopname: ticket.coopname,
      ticket_id: ticket.id,
      message_id: messageId,
      ticket_number: ticket.number,
      subject: ticket.subject,
      previous_status: previousStatus,
      status: ticket.status,
      initiator_username: initiatorUsername,
    };
    this.events.emit(SUPPORT_TICKET_AUTHOR_STATUS_CHANGED_EVENT, payload);
  }
}
