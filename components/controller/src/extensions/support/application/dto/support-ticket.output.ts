import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportTicketPriority } from '../../domain/enums/support-ticket-priority.enum';
import { SupportResponsibilityZone } from '../../domain/enums/support-responsibility-zone.enum';
import type {
  SupportTicketCardView,
  SupportTicketListItemView,
} from '../services/support-queries.types';

/**
 * Строка списка обращений — и очереди совета, и «моих обращений».
 *
 * Собирается из вида ответа через `fromView`: слой чтений отдаёт вид, резолвер
 * превращает его в DTO. Тот же приём, что у смет расходов, где сервис отдаёт
 * доменную сущность, а `fromDomain` собирает из неё DTO.
 *
 * Превью последнего сообщения в строке нет намеренно: первый текст обращения —
 * это первая запись ленты, а не колонка обращения, поэтому превью потребовало
 * бы соединения таблиц на каждую строку списка. Темы для узнавания достаточно.
 */
@ObjectType('SupportTicketListItem', { description: 'Обращение в поддержку: строка списка.' })
export class SupportTicketListItemOutputDTO {
  @Field(() => String, { description: 'Идентификатор обращения.' })
  id!: string;

  @Field(() => String, {
    description: 'Номер обращения, который видит пайщик. Строка, а не число: номера выдаёт последовательность базы и растут они без ограничения сверху.',
  })
  number!: string;

  @Field(() => SupportTicketKind, { description: 'Вид обращения.' })
  kind!: SupportTicketKind;

  @Field(() => SupportTicketStatus, { description: 'Текущий статус обращения.' })
  status!: SupportTicketStatus;

  @Field(() => SupportTicketPriority, { description: 'Приоритет обращения.' })
  priority!: SupportTicketPriority;

  @Field(() => String, { description: 'Тема обращения.' })
  subject!: string;

  @Field(() => String, { description: 'Пайщик, обратившийся в поддержку.' })
  author_username!: string;

  @Field(() => [String], {
    description: 'Члены совета, работающие с обращением. Сегодня в списке не больше одного; список — потому что к обращению можно будет подключать нескольких.',
  })
  council_side!: string[];

  @Field(() => Boolean, { description: 'Обращение эскалировано председателю.' })
  escalated!: boolean;

  @Field(() => Int, { description: 'Сколько раз обращение возвращалось в работу.' })
  reopen_count!: number;

  @Field(() => Date, { description: 'Время последнего сообщения в обращении.' })
  last_message_at!: Date;

  @Field(() => Date, { description: 'Время создания обращения.' })
  created_at!: Date;

  @Field(() => Int, { description: 'Число записей в переписке обращения.' })
  message_count!: number;

  @Field(() => Boolean, { description: 'К обращению приложен хотя бы один файл.' })
  has_attachments!: boolean;

  static fromView(view: SupportTicketListItemView): SupportTicketListItemOutputDTO {
    const dto = new SupportTicketListItemOutputDTO();
    dto.id = view.id;
    dto.number = view.number;
    dto.kind = view.kind;
    dto.status = view.status;
    dto.priority = view.priority;
    dto.subject = view.subject;
    dto.author_username = view.authorUsername;
    dto.council_side = view.councilSide;
    dto.escalated = view.escalated;
    dto.reopen_count = view.reopenCount;
    dto.last_message_at = view.lastMessageAt;
    dto.created_at = view.createdAt;
    dto.message_count = view.messageCount;
    dto.has_attachments = view.hasAttachments;
    return dto;
  }
}

/**
 * Карточка обращения — всё из строки списка плюс четыре поля.
 *
 * Переписки здесь нет: она растёт неограниченно и листается своим запросом.
 * Поля «что мне здесь можно» тоже нет — права выводит клиент, а решает сервер;
 * третье место с теми же правилами разошлось бы с двумя первыми.
 */
@ObjectType('SupportTicket', { description: 'Обращение в поддержку: карточка.' })
export class SupportTicketOutputDTO extends SupportTicketListItemOutputDTO {
  @Field(() => Date, { nullable: true, description: 'Когда обращение помечено решённым.' })
  resolved_at!: Date | null;

  @Field(() => Date, {
    nullable: true,
    description: 'Когда обращение закроется само, если пайщик не возразит. Пусто, если отсчёт не идёт: обращение не решено, возвращено в работу или уже закрыто.',
  })
  auto_close_at!: Date | null;

  @Field(() => Date, { nullable: true, description: 'Когда обращение эскалировано председателю.' })
  escalated_at!: Date | null;

  @Field(() => SupportResponsibilityZone, { description: 'Зона ответственности по обращению.' })
  responsibility_zone!: SupportResponsibilityZone;

  static fromCardView(view: SupportTicketCardView): SupportTicketOutputDTO {
    const dto = Object.assign(
      new SupportTicketOutputDTO(),
      SupportTicketListItemOutputDTO.fromView(view)
    );
    dto.resolved_at = view.resolvedAt;
    dto.auto_close_at = view.autoCloseAt;
    dto.escalated_at = view.escalatedAt;
    dto.responsibility_zone = view.responsibilityZone;
    return dto;
  }
}
