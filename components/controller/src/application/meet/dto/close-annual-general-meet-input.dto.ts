import { Field, InputType } from '@nestjs/graphql';
import { IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SignedDigitalDocumentInputDTO } from '@coopenomics/extension-kit';
import { CloseAnnualGeneralMeetInputDomainInterface } from '~/domain/meet/interfaces/close-annual-general-meet-input-domain.interface';

@InputType('CloseAnnualGeneralMeetInput', { description: 'Входные данные для закрытия ежегодного общего собрания' })
export class CloseAnnualGeneralMeetInputDTO implements CloseAnnualGeneralMeetInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Хеш собрания, которое необходимо закрыть' })
  @IsString()
  hash!: string;

  @Field(() => SignedDigitalDocumentInputDTO, { description: 'Подписанный документ с решением собрания' })
  @ValidateNested()
  @Type(() => SignedDigitalDocumentInputDTO)
  meet_decision!: SignedDigitalDocumentInputDTO;
}
