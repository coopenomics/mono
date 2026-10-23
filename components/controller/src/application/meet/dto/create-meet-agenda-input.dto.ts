import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/create-annual-meet-input-domain.interface';
import { AgendaGeneralMeetPointInputDTO } from './agenda-meet-point-input.dto';
import { AnnualGeneralMeetingAgendaSignedDocumentInputDTO } from '~/application/document/documents-dto/annual-general-meeting-agenda-document.dto';

/** Согласовано с лимитом на desktop (повестка / форма собрания) */
const MEET_DETAILS_MAX_LEN = 10_000;

@InputType('CreateAnnualGeneralMeetInput')
export class CreateAnnualGeneralMeetInputDTO implements CreateAnnualGeneralMeetInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('meet.createMeetAgendaInput.coopnameRequired') })
  @IsString({ message: validationMessage('meet.createMeetAgendaInput.coopnameMustBeString') })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта инициатора' })
  @IsNotEmpty({ message: validationMessage('meet.createMeetAgendaInput.initiatorRequired') })
  @IsString({ message: validationMessage('meet.createMeetAgendaInput.initiatorMustBeString') })
  initiator!: string;

  @Field(() => String, { description: 'Имя аккаунта председателя' })
  @IsNotEmpty({ message: validationMessage('meet.createMeetAgendaInput.chairmanRequired') })
  @IsString({ message: validationMessage('meet.createMeetAgendaInput.chairmanMustBeString') })
  presider!: string;

  @Field(() => String, { description: 'Имя аккаунта секретаря' })
  @IsNotEmpty({ message: validationMessage('meet.createMeetAgendaInput.secretaryRequired') })
  @IsString({ message: validationMessage('meet.createMeetAgendaInput.secretaryMustBeString') })
  secretary!: string;

  @Field(() => [AgendaGeneralMeetPointInputDTO], { description: 'Повестка собрания' })
  @IsArray({ message: validationMessage('meet.createMeetAgendaInput.agendaMustBeArray') })
  @ValidateNested({ each: true })
  @Type(() => AgendaGeneralMeetPointInputDTO)
  agenda!: AgendaGeneralMeetPointInputDTO[];

  @Field(() => Date, { description: 'Время открытия собрания' })
  @IsNotEmpty({ message: validationMessage('meet.createMeetAgendaInput.openTimeRequired') })
  open_at!: Date;

  @Field(() => Date, { description: 'Время закрытия собрания' })
  @IsNotEmpty({ message: validationMessage('meet.createMeetAgendaInput.closeTimeRequired') })
  close_at!: Date;

  @Field(() => AnnualGeneralMeetingAgendaSignedDocumentInputDTO, { description: 'Предложение повестки собрания' })
  proposal!: AnnualGeneralMeetingAgendaSignedDocumentInputDTO;

  @Field(() => String, {
    nullable: true,
    description: 'Дополнительная информация о формате собрания (ссылка, как участвовать и т.д.)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(MEET_DETAILS_MAX_LEN)
  details?: string | null;
}
