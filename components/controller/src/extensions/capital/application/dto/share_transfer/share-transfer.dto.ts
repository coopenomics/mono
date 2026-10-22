import { Field, ObjectType } from '@nestjs/graphql';

/** Одна трансляция паевого взноса в истории. */
@ObjectType('CapitalShareTransfer', { description: 'Трансляция паевого взноса из Благороста в Цифровой Кошелёк' })
export class ShareTransferDTO {
  @Field(() => String, { description: 'Идентификатор записи' })
  _id!: string;

  @Field(() => String, { description: 'Пайщик' })
  username!: string;

  @Field(() => String, { description: 'ФИО пайщика или название организации' })
  display_name!: string;

  @Field(() => String, { description: 'Сумма трансляции, с валютой' })
  amount!: string;

  @Field(() => String, { description: 'Хэш заявления о трансляции в реестре документов' })
  statement_hash!: string;

  @Field(() => String, { description: 'Транзакция цепи' })
  transaction_id!: string;

  @Field(() => Date, { description: 'Дата трансляции' })
  created_at!: Date;
}
