import { Field, ObjectType } from '@nestjs/graphql';

/** Вид обеспечения из реестра контракта с остатком пайщика на кошельке-источнике. */
@ObjectType('DebtCollateralOption', { description: 'Обеспечение, под которое пайщик может взять заём' })
export class CollateralOptionDTO {
  @Field(() => String, { description: 'Ключ обеспечения для заявления' })
  key!: string;

  @Field(() => String, { description: 'Наименование обеспечения для документов' })
  human_name!: string;

  @Field(() => String, { description: 'Кошелёк пайщика, с которого берётся обеспечение' })
  source_wallet!: string;

  @Field(() => String, { description: 'Кошелёк обеспечения на время займа' })
  pledge_wallet!: string;

  @Field(() => String, { description: 'Доступный остаток пайщика на кошельке-источнике' })
  available!: string;

  @Field(() => String, { description: 'Тип основания договора: договор об участии или оферта' })
  basis_type!: string;

  @Field(() => Boolean, { description: 'Договор-основание пайщиком подписан' })
  basis_signed!: boolean;

  @Field(() => String, { description: 'Контракт программы-владельца обеспечения' })
  owner_contract!: string;
}
