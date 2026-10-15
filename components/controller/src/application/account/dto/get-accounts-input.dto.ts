import { InputType, Field, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsOptional } from 'class-validator';
import { AccountVerificationFilter } from '~/domain/account/utils/account-verification-filter';

registerEnumType(AccountVerificationFilter, {
  name: 'AccountVerificationFilter',
  description: 'Отбор реестра пайщиков по уровню верификации',
});

@InputType('GetAccountsInput')
export class GetAccountsInputDTO {
  @Field({ nullable: true })
  role?: string;

  @Field(() => AccountVerificationFilter, {
    nullable: true,
    description: 'Отбор по уровню верификации: паспорт сверен, не сверен, нет ни одного уровня',
  })
  @IsOptional()
  @IsEnum(AccountVerificationFilter)
  verification?: AccountVerificationFilter;
}
