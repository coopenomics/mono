import { ObjectType, Field, Int, Float } from '@nestjs/graphql';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности ProgramWallet
 */
@ObjectType('CapitalProgramWallet', {
  description: 'Программный кошелек в системе CAPITAL',
})
export class ProgramWalletOutputDTO extends BaseOutputDTO {
  @Field(() => Int, {
    nullable: true,
    description: 'ID в блокчейне',
  })
  id?: number;

  @Field(() => Int, {
    nullable: true,
    description: 'Номер блока последнего обновления',
  })
  block_num?: number;

  @Field(() => Boolean, {
    description: 'Существует ли запись в блокчейне',
    defaultValue: false,
  })
  present!: boolean;

  @Field(() => String, {
    description: 'Имя пользователя',
  })
  username!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Название кооператива',
  })
  coopname?: string;

  @Field(() => Float, {
    nullable: true,
    description: 'Последний программный CRPS',
  })
  last_program_crps?: number;

  @Field(() => Float, {
    nullable: true,
    description: 'Доступный капитал',
  })
  capital_available?: number;
}
