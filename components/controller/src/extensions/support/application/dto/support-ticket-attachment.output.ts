import { Field, Int, ObjectType } from '@nestjs/graphql';
import type {
  SupportAttachmentView,
  SupportAttachmentWithUrlView,
} from '../services/support-queries.types';

/**
 * Файл, приложенный к записи переписки.
 *
 * **Ссылки на скачивание здесь нет.** Она живёт минуты и выдаётся отдельным
 * запросом по идентификатору файла: к моменту, когда пользователь долистает
 * список, выданная пачкой ссылка была бы уже мертва. Ключ объекта в хранилище
 * и контрольная сумма наружу тоже не идут — это внутреннее устройство.
 */
@ObjectType('SupportTicketAttachment', { description: 'Файл, приложенный к обращению.' })
export class SupportTicketAttachmentOutputDTO {
  @Field(() => String, { description: 'Идентификатор файла.' })
  id!: string;

  @Field(() => String, { nullable: true, description: 'Исходное имя файла — как его назвал отправитель.' })
  original_filename!: string | null;

  @Field(() => String, { description: 'Тип файла, определённый по содержимому.' })
  mime_type!: string;

  @Field(() => Int, { description: 'Размер файла в байтах.' })
  size_bytes!: number;

  @Field(() => String, { description: 'Кто приложил файл.' })
  uploaded_by_username!: string;

  @Field(() => Date, { description: 'Когда файл приложен.' })
  uploaded_at!: Date;

  static fromView(view: SupportAttachmentView): SupportTicketAttachmentOutputDTO {
    const dto = new SupportTicketAttachmentOutputDTO();
    dto.id = view.id;
    dto.original_filename = view.originalFilename;
    dto.mime_type = view.mimeType;
    dto.size_bytes = view.sizeBytes;
    dto.uploaded_by_username = view.uploadedByUsername;
    dto.uploaded_at = view.uploadedAt;
    return dto;
  }
}

/** Тот же файл вместе со ссылкой на скачивание — ответ отдельного запроса. */
@ObjectType('SupportTicketAttachmentWithUrl', {
  description: 'Файл обращения вместе со ссылкой на скачивание.',
})
export class SupportTicketAttachmentWithUrlOutputDTO extends SupportTicketAttachmentOutputDTO {
  @Field(() => String, {
    description: 'Ссылка на скачивание. Действует ограниченное время, поэтому запрашивается непосредственно перед открытием файла.',
  })
  url!: string;

  static fromUrlView(view: SupportAttachmentWithUrlView): SupportTicketAttachmentWithUrlOutputDTO {
    const dto = Object.assign(
      new SupportTicketAttachmentWithUrlOutputDTO(),
      SupportTicketAttachmentOutputDTO.fromView(view)
    );
    dto.url = view.url;
    return dto;
  }
}
