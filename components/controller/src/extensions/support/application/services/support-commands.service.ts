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
import {
  SUPPORT_TICKET_PARTICIPANT_REPOSITORY,
  type SupportParticipantDraft,
  type SupportTicketParticipantRepository,
} from '../../domain/repositories/support-ticket-participant.repository';
import type { SupportTicketDomainEntity } from '../../domain/entities/support-ticket.entity';
import type { SupportTicketParticipantDomainEntity } from '../../domain/entities/support-ticket-participant.entity';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportTicketPriority } from '../../domain/enums/support-ticket-priority.enum';
import { SupportResponsibilityZone } from '../../domain/enums/support-responsibility-zone.enum';
import { SupportMessageAuthorRole } from '../../domain/enums/support-message-author-role.enum';
import { SupportSystemEvent } from '../../domain/enums/support-system-event.enum';
import { SupportAttachmentsService } from './support-attachments.service';
import { CHAIRMAN_ROLE, TICKET_NOT_FOUND_MESSAGE, isCouncilRole } from '../../constants/support-access';
import {
  SUPPORT_TICKET_AUTHOR_REPLIED_EVENT,
  SUPPORT_TICKET_AUTHOR_STATUS_CHANGED_EVENT,
  SUPPORT_TICKET_PARTICIPANT_ADDED_EVENT,
  type SupportTicketAuthorRepliedEvent,
  type SupportTicketAuthorStatusChangedEvent,
  type SupportTicketParticipantAddedEvent,
} from '../events/support-notification.events';
import type {
  AddSupportTicketParticipantInput,
  AssignSupportTicketInput,
  ChangeSupportTicketPriorityInput,
  CreateSupportTicketInput,
  EscalateSupportTicketInput,
  RemoveSupportTicketParticipantInput,
  ReplySupportTicketInput,
  ResolveSupportTicketInput,
} from './support-commands.types';
import type { SupportActor } from './support-actor';

/** Статусы, из которых обращение уже не ведут: назначать оператора в них нельзя. */
const TERMINAL_STATUSES: ReadonlyArray<SupportTicketStatus> = [
  SupportTicketStatus.RESOLVED,
  SupportTicketStatus.CLOSED,
];

/**
 * Команды стола поддержки: шесть над самим обращением и две над составом его
 * участников.
 *
 * Что здесь есть и чего нет:
 *
 * - **Кооператив не принимается аргументом ни одной командой** — берётся из
 *   настроек контура. Область видимости задаёт сервер, подменить кооператив
 *   запросом невозможно в принципе, а не «потому что мы проверили».
 * - **Участие не даёт прав и не отнимает их.** Совет читает любое обращение
 *   кооператива и пишет в любое независимо от участия; подключение меняет
 *   только адресацию уведомлений и попадание в очередь «где я участвую».
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
    @Inject(SUPPORT_TICKET_PARTICIPANT_REPOSITORY)
    private readonly participants: SupportTicketParticipantRepository,
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
    await this.assertIsCouncilMember(
      input.assignee_username,
      'Оператором обращения может быть только член совета кооператива.'
    );

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

    // Эскалация — это подключение председателя, а не переназначение на него.
    // Имена берутся из справочника: своего списка совета расширение не держит.
    // Пустой ответ — это не «эскалировать некому, но ладно»: смысл действия в
    // том, чтобы дело увидел председатель, и молча сделать вид, что оно
    // выполнено, нельзя.
    const chairmen = await this.users.findByRoles([CHAIRMAN_ROLE]);
    if (chairmen.length === 0) {
      throw new BadRequestException(
        'Эскалировать обращение некому: в кооперативе не найден председатель.'
      );
    }

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
      // председателю, а не про этап работы над ним. Отметка остаётся навсегда:
      // отключат председателя из участников — отметка не снимется, она про
      // факт, а не про текущий состав.
      { escalatedAt: now, lastMessageAt: now },
      // Одной транзакцией с отметкой и системной записью: разъехаться эти три
      // вещи не должны. Уже подключённый председатель пропускается молча и в
      // ответ не попадает — второго письма он не получит.
      chairmen.map((chairman) => ({
        participantUsername: chairman.username,
        addedByUsername: actor.username,
      }))
    );

    // Автору обращения событие не излучается: отметка эскалации для него —
    // внутренняя маршрутизация внутри совета, а не событие его обращения
    // (спецификация, раздел 5), и статус при этом не изменился. А вот
    // подключённому председателю уведомление уходит — по общему правилу для
    // всех подключений.
    this.emitParticipantsAdded(result.ticket, result.participants, actor.username);
    return result.ticket;
  }

  // ── Участники обращения ─────────────────────────────────────────────
  //
  // Участие — подписка, а не право. Совет и без него читает любое обращение
  // кооператива и пишет в любое; эти две команды меняют только то, кого
  // уведомлять и чья очередь пополнится. Если рядом появится проверка «а
  // участник ли он» в роли проверки права — это ошибка.

  async addSupportTicketParticipant(
    input: AddSupportTicketParticipantInput,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    this.assertCouncil(actor, 'Подключать участников к обращению может только совет кооператива.');

    const ticket = await this.getTicketOrFail(input.ticket_id);

    // Участником может быть только член совета — по той же причине, по которой
    // им может быть только ответственный: очередь совета собирается по роли, и
    // пайщик в неё не попадёт, сколько его ни подключай.
    await this.assertIsCouncilMember(
      input.participant_username,
      'Участником обращения может быть только член совета кооператива.'
    );

    const draft: SupportParticipantDraft = {
      participantUsername: input.participant_username,
      addedByUsername: actor.username,
    };
    const added = await this.participants.addIfAbsent(ticket.id, draft);

    // Повтор подключения — молчаливое «ничего не делаем», как все прочие
    // повторы стола: `null` означает, что человек уже был подключён, и второго
    // письма он не получает.
    if (added) this.emitParticipantsAdded(ticket, [added], actor.username);

    // Записи в ленту нет намеренно: лента — история состояний обращения, а
    // участие это подписка. Подключения и отключения замусорили бы переписку,
    // которую читает пайщик, служебными строками, к его вопросу не
    // относящимися.
    return ticket;
  }

  async removeSupportTicketParticipant(
    input: RemoveSupportTicketParticipantInput,
    actor: SupportActor
  ): Promise<SupportTicketDomainEntity> {
    this.assertCouncil(actor, 'Отключать участников обращения может только совет кооператива.');

    const ticket = await this.getTicketOrFail(input.ticket_id);

    // Отключение неподключённого — то же молчаливое «ничего не делаем».
    // Проверять роль отключаемого незачем: если он подключён, роль у него уже
    // проверяли при подключении, а если нет — отключать нечего.
    await this.participants.remove(ticket.id, input.participant_username);

    // Уведомления об отключении нет: согласовано одно уведомление про участие
    // — о подключении. В ленту, как и подключение, ничего не пишется.
    return ticket;
  }

  // ── Общее ───────────────────────────────────────────────────────────

  private isCouncil(actor: SupportActor): boolean {
    return isCouncilRole(actor.role);
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
   * Названный пайщик обязан состоять в совете.
   *
   * Одна проверка на два случая — назначаемый ответственный и подключаемый
   * участник: причина у них общая (очередь совета собирается по роли, и того,
   * кто в совет не входит, обращение просто не достигнет), а расходятся они
   * только текстом отказа, поэтому он и передаётся параметром.
   *
   * Порт справочника сообщает роль, но решение принимает вызывающий — сам порт
   * прав не проверяет. Поэтому сравнение с составом совета живёт здесь.
   */
  private async assertIsCouncilMember(username: string, rejectionMessage: string): Promise<void> {
    const user = await this.users.findByUsername(username);
    if (!user) {
      throw new BadRequestException(`Пайщик ${username} не найден в кооперативе.`);
    }
    if (!isCouncilRole(user.role)) {
      throw new BadRequestException(rejectionMessage);
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

  /**
   * По событию на каждое фактически созданное подключение.
   *
   * Приходят сюда только новые записи: уже подключённый участник в ответ
   * репозитория не попадает, и письма о нём не будет. Различителем в ключе
   * подавления повторов идёт идентификатор самой записи подключения — пара
   * «обращение и участник» на эту роль не годится, она у повторного
   * подключения та же самая.
   */
  private emitParticipantsAdded(
    ticket: SupportTicketDomainEntity,
    participants: SupportTicketParticipantDomainEntity[],
    initiatorUsername: string
  ): void {
    for (const participant of participants) {
      const payload: SupportTicketParticipantAddedEvent = {
        coopname: ticket.coopname,
        ticket_id: ticket.id,
        participation_id: participant.id,
        ticket_number: ticket.number,
        subject: ticket.subject,
        participant_username: participant.participantUsername,
        initiator_username: initiatorUsername,
      };
      this.events.emit(SUPPORT_TICKET_PARTICIPANT_ADDED_EVENT, payload);
    }
  }
}
