import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { ExpenseMechanics } from '../../domain/enums/expense-mechanics.enum';
import { ExpenseRecipientType } from '../../domain/enums/expense-recipient-type.enum';

@InputType('ExpenseItemInput')
export class ExpenseItemInputDTO {
  @Field(() => String, { description: 'Хеш строки расхода (детерминированный, из UI).' })
  @IsNotEmpty()
  @IsString()
  item_hash!: string;

  @Field(() => ExpenseMechanics, { description: 'Способ оплаты (ADVANCE / DIRECT).' })
  @IsEnum(ExpenseMechanics)
  mechanics!: ExpenseMechanics;

  @Field(() => ExpenseRecipientType, { description: 'Тип получателя.' })
  @IsEnum(ExpenseRecipientType)
  recipient_type!: ExpenseRecipientType;

  @Field(() => String, {
    description: 'Получатель: username пайщика; для организации — пустая строка (аккаунта в кооперативе нет).',
  })
  @ValidateIf((o) => o.recipient_type !== ExpenseRecipientType.ORG)
  @IsNotEmpty()
  @IsString()
  recipient!: string;

  @Field(() => String, { description: 'Описание назначения расхода.' })
  @IsString()
  description!: string;

  @Field(() => String, { description: 'Планируемая сумма (asset, eg "1000.0000 RUB").' })
  @IsNotEmpty()
  @IsString()
  planned_amount!: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Идентификатор сохранённых реквизитов получателя-пайщика — реквизиты снимаются в момент создания и прикладываются к платежу.',
  })
  @IsOptional()
  @IsString()
  payment_method_id?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Реквизиты получателя-организации (вводятся вручную).',
  })
  @IsOptional()
  @IsString()
  requisites?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Назначение платежа (для оплаты по счёту) — фиксируется в снимке для кассира.',
  })
  @IsOptional()
  @IsString()
  payment_purpose?: string;
}
