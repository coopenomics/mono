import { Field, InputType } from '@nestjs/graphql'
import { IsNotEmpty, IsString, Matches } from 'class-validator'

/**
 * Input для action `expense::overspendexp` — доплата при перерасходе (ADVANCE-механика).
 *
 * Контракт: `Ledger2::apply(OVERSPEND_COMPENSATION)` → сразу `Ledger2::apply(ADVANCE_REPORTED)`
 * одной транзакцией. Item переходит из `PAID/REPORTED` в `OVERSPENT`.
 */
@InputType('OverspendExpenseItemInput')
export class OverspendExpenseItemInputDTO {
  @Field(() => String, { description: 'Имя кооператива.' })
  @IsNotEmpty()
  @IsString()
  coopname!: string

  @Field(() => String, { description: 'Хеш сметы расхода (proposal).' })
  @IsNotEmpty()
  @IsString()
  proposal_hash!: string

  @Field(() => String, { description: 'Хеш строки расхода (item).' })
  @IsNotEmpty()
  @IsString()
  item_hash!: string

  @Field(() => String, {
    description: 'Сумма доплаты сверх planned_amount (asset, например "200.0000 RUB").',
  })
  @IsNotEmpty()
  @Matches(/^\d+\.\d{1,8} [A-Z]{1,7}$/, {
    message: 'overspend_amount должен быть в формате asset (например "200.0000 RUB").',
  })
  overspend_amount!: string
}
