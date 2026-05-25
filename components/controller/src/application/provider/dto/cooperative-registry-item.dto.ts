import { Field, ObjectType } from '@nestjs/graphql';
import { ProviderSubscriptionDTO } from './provider-subscription.dto';

/**
 * Элемент реестра кооперативов для оператора (Восход).
 *
 * Сводит в одну запись:
 *  - on-chain данные кооператива из registrator.coops (статус pending|active|blocked, домен, дата);
 *  - данные провайдера (подписки/инстанс/биллинг) из provider-backend, привязанные по coopname.
 *
 * Источник on-chain: BlockchainPort.getAllRows(registrator, coops).
 * Источник provider: ProviderService.getUserSubscriptions(coopname) (server-secret канал).
 */
@ObjectType('CooperativeRegistryItem')
export class CooperativeRegistryItemDTO {
  @Field(() => String, { description: 'Имя аккаунта кооператива (coopname)' })
  coopname!: string;

  @Field(() => String, { nullable: true, description: 'Анонсированный домен/сайт кооператива (registrator.coops.announce)' })
  announce?: string;

  @Field(() => String, { description: 'Статус кооператива в блокчейне: pending | active | blocked' })
  status!: string;

  @Field(() => String, { nullable: true, description: 'Дата регистрации заявки кооператива (on-chain)' })
  created_at?: string;

  @Field(() => Boolean, { description: 'Есть ли у кооператива данные провайдера (хотя бы одна подписка)' })
  has_provider_data!: boolean;

  @Field(() => [ProviderSubscriptionDTO], { description: 'Подписки кооператива у провайдера (с инстансом и биллингом)' })
  subscriptions!: ProviderSubscriptionDTO[];
}
