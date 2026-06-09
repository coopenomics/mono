import { Field, ID, ObjectType } from '@nestjs/graphql';

/**
 * Баланс программного кошелька организации на бэкенде кооператива-оператора
 * платформы (хаба): главный кошелёк и программные кошельки, включая ЦПП оператора.
 */
@ObjectType('OperatorWallet')
export class OperatorWalletDTO {
  @Field(() => ID, { description: 'Идентификатор программы у оператора' })
  program_id!: string;

  @Field(() => String, { nullable: true, description: 'Тип программы' })
  program_type!: string | null;

  @Field(() => String, { description: 'Доступный баланс (формат: "100.0000 RUB")' })
  available!: string;

  @Field(() => String, { description: 'Заблокированный баланс (формат: "100.0000 RUB")' })
  blocked!: string;

  @Field(() => String, { description: 'Паевой взнос (формат: "100.0000 RUB")' })
  membership_contribution!: string;
}
