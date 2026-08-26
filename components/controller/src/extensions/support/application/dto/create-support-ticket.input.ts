import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';
import { SupportAttachmentInputDTO } from './support-attachment.input';

/**
 * Вход `createSupportTicket`.
 *
 * Автор нигде не принимается аргументом — подставляется из актора резолвером.
 * **Приоритета здесь нет и быть не должно**: обращение заводится со значением
 * по умолчанию, меняет его оператор отдельной командой (спецификация,
 * раздел 3). Кооператива тоже нет — берётся из настроек контура.
 */
@InputType('CreateSupportTicketInput')
export class CreateSupportTicketInputDTO {
  @Field(() => SupportTicketKind, { description: 'Вид обращения.' })
  @IsEnum(SupportTicketKind)
  kind!: SupportTicketKind;

  @Field(() => String, { description: 'Тема обращения.' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  subject!: string;

  @Field(() => String, {
    description: 'Первый текст обращения — он же первая запись в ленте переписки.',
  })
  @IsNotEmpty()
  @IsString()
  body!: string;

  @Field(() => [SupportAttachmentInputDTO], { nullable: true, description: 'Файлы, приложенные к первому сообщению.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportAttachmentInputDTO)
  attachments?: SupportAttachmentInputDTO[];
}
