import { Field, InputType } from '@nestjs/graphql';
import { IsString, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';
import type { CreateMembershipExitInputDomainInterface } from '~/domain/account/interfaces/create-membership-exit-input.interface';
import { MembershipExitApplicationSignedDocumentInputDTO } from '~/application/document/documents-dto/membership-exit-application-document.dto';

/**
 * DTO подачи заявления на выход пайщика из кооператива.
 */
@InputType('CreateMembershipExitInput')
export class CreateMembershipExitInputDTO implements CreateMembershipExitInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Имя пайщика, выходящего из кооператива' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'Хеш процесса выхода (генерируется на клиенте)' })
  @IsString()
  exit_hash!: string;

  @Field(() => MembershipExitApplicationSignedDocumentInputDTO, {
    description: 'Подписанное пайщиком заявление о выходе из кооператива',
  })
  @ValidateNested()
  @IsNotEmpty({ message: 'Поле "statement" обязательно для заполнения.' })
  @Type(() => MembershipExitApplicationSignedDocumentInputDTO)
  statement!: MembershipExitApplicationSignedDocumentInputDTO;
}
