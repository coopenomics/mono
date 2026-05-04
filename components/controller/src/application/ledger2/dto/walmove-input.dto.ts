import { Field, InputType } from '@nestjs/graphql';
import { IsString, MaxLength, MinLength, Matches, Length } from 'class-validator';

/**
 * Input для мутации `walmoveWallets` (operation `o.adj.walmove`).
 *
 * `quantity` — строка с символом, как в действии apply: `"100.0000 RUB"`.
 * `fromWallet`/`toWallet` — eosio::name-идентификаторы кошельков
 * (`w.<contract>.<waltype>`), см. `cooptypes/ledger2/wallets.ts`.
 *
 * Backend валидирует совместимость from_wallet/to_wallet с одним account_id
 * (через `Ledger2.LEDGER2_OPERATION_REGISTRY`) ДО подписания.
 */
@InputType('WalmoveInput')
export class WalmoveInputDTO {
  @Field(() => String)
  @IsString()
  coopname!: string;

  @Field(() => String, { description: 'Владелец кошельков (для коллективных — coopname)' })
  @IsString()
  username!: string;

  @Field(() => String, { description: 'eosio::name кошелька-источника (w.<contract>.<waltype>)' })
  @IsString()
  @Length(1, 13)
  fromWallet!: string;

  @Field(() => String, { description: 'eosio::name кошелька-приёмника (w.<contract>.<waltype>)' })
  @IsString()
  @Length(1, 13)
  toWallet!: string;

  @Field(() => String, { description: 'Сумма с символом, например "100.0000 RUB"' })
  @IsString()
  @Matches(/^\d+(\.\d+)?\s+[A-Z]{1,7}$/, { message: 'Формат "<amount> <SYMBOL>", например "100.0000 RUB"' })
  quantity!: string;

  @Field(() => String, { description: 'Обязательное обоснование корректировки' })
  @IsString()
  @MinLength(1, { message: 'memo обязателен — укажите обоснование корректировки' })
  @MaxLength(255)
  memo!: string;
}
