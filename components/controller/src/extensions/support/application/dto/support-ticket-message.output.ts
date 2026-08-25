import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { SupportMessageAuthorRole } from '../../domain/enums/support-message-author-role.enum';
import { SupportSystemEvent } from '../../domain/enums/support-system-event.enum';
import { SupportTicketAttachmentOutputDTO } from './support-ticket-attachment.output';
import type { SupportTicketMessageView } from '../services/support-queries.types';

/**
 * Запись переписки обращения — сообщение человека или системное событие.
 *
 * Текста системных записей здесь нет и не будет: наружу идут вид события и его
 * детали, а формулировку («обращение взято в работу») собирает интерфейс.
 * Поэтому список видов событий — часть договора с интерфейсом: появился новый
 * вид, интерфейс обязан знать, как его назвать.
 */
@ObjectType('SupportTicketMessage', { description: 'Запись переписки обращения.' })
export class SupportTicketMessageOutputDTO {
  @Field(() => String, { description: 'Идентификатор записи.' })
  id!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Кто написал. Пусто у действий самой системы — например, у автоматического закрытия.',
  })
  author_username!: string | null;

  @Field(() => SupportMessageAuthorRole, {
    description: 'Кем написана запись: пайщиком, советом или системой. Записывается в момент записи и потом не меняется.',
  })
  author_role!: SupportMessageAuthorRole;

  @Field(() => String, { nullable: true, description: 'Текст сообщения. Пусто у системных записей.' })
  body!: string | null;

  @Field(() => SupportSystemEvent, {
    nullable: true,
    description: 'Вид системного события. Пусто у сообщений, написанных человеком.',
  })
  system_event!: SupportSystemEvent | null;

  @Field(() => GraphQLJSON, {
    nullable: true,
    description: 'Детали системного события — например, прежний и новый приоритет. Состав зависит от вида события; часть деталей остаётся внутри совета и наружу не идёт.',
  })
  payload!: Record<string, unknown> | null;

  @Field(() => Date, { description: 'Когда запись добавлена.' })
  created_at!: Date;

  @Field(() => [SupportTicketAttachmentOutputDTO], { description: 'Файлы, приложенные к записи.' })
  attachments!: SupportTicketAttachmentOutputDTO[];

  static fromView(view: SupportTicketMessageView): SupportTicketMessageOutputDTO {
    const dto = new SupportTicketMessageOutputDTO();
    dto.id = view.id;
    dto.author_username = view.authorUsername;
    dto.author_role = view.authorRole;
    dto.body = view.body;
    dto.system_event = view.systemEvent;
    dto.payload = view.payload;
    dto.created_at = view.createdAt;
    dto.attachments = view.attachments.map(SupportTicketAttachmentOutputDTO.fromView);
    return dto;
  }
}
