import { Field, ObjectType, InputType } from '@nestjs/graphql';
import { IsString } from 'class-validator';

/**
 * Сигнал об изменении кошелька пайщика. Несёт только адрес изменения, а не
 * суммы: авторитетное состояние кошелька живёт в цепи, и клиент дочитывает его
 * запросом — иначе payload и запрос начнут расходиться, а гонка дельт оставит
 * на экране устаревшую сумму, которая выглядит свежей.
 */
@ObjectType('WalletChangedEvent')
export class WalletChangedEventDTO {
  @Field(() => String) coopname!: string;

  @Field(() => String, { description: 'Пайщик, чей кошелёк изменился.' })
  username!: string;

  @Field(() => String, {
    description: 'Имя кошелька в ledger2 — например «w.wal.share» у главного паевого.',
  })
  wallet_name!: string;
}

@InputType('WalletEventsInput')
export class WalletEventsInputDTO {
  @Field(() => String, { description: 'Кооператив; сверяется с кооперативом узла.' })
  @IsString()
  coopname!: string;
}
