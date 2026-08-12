import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';
import { InnerExpenseMechanics, InnerExpenseRecipientType } from '@coopenomics/innercoop';

/**
 * Строка расхода, которую capital подаёт шасси расходов.
 *
 * Форма строки — часть межрасширенческого контракта (`InnerExpenseItemInput`),
 * а вид в схеме расширение объявляет у себя: в контракте декораторов нет
 * (INV-003). Шасси показывает ту же строку под именем `ExpenseItemInput` в
 * своём разделе схемы — это его собственный вид, capital на него не ссылается,
 * иначе за пределами монолита пришлось бы тянуть чужое расширение целиком.
 */
@InputType('CapitalExpenseItemInput')
export class CapitalExpenseItemInputDTO {
  @Field(() => String, { description: 'Хеш строки расхода (детерминированный, из UI).' })
  @IsNotEmpty()
  @IsString()
  item_hash!: string;

  @Field(() => InnerExpenseMechanics, { description: 'Способ оплаты (ADVANCE / DIRECT).' })
  @IsEnum(InnerExpenseMechanics)
  mechanics!: InnerExpenseMechanics;

  @Field(() => InnerExpenseRecipientType, { description: 'Тип получателя.' })
  @IsEnum(InnerExpenseRecipientType)
  recipient_type!: InnerExpenseRecipientType;

  @Field(() => String, {
    description: 'Получатель: username пайщика; для организации — пустая строка (аккаунта в кооперативе нет).',
  })
  @ValidateIf((o) => o.recipient_type !== InnerExpenseRecipientType.ORG)
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
