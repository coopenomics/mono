import { Field, ObjectType } from '@nestjs/graphql';
import { CooperativeChainStatus } from '~/domain/billing/enums/billing-statuses.enum';
import { ProviderSubscriptionDTO } from './provider-subscription.dto';
import { CooperativeCharterOutputDTO } from './cooperative-charter.output';

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

  @Field(() => String, { nullable: true, description: 'Наименование организации кооператива' })
  name?: string;

  @Field(() => String, { nullable: true, description: 'Анонсированный домен/сайт кооператива' })
  announce?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Рассказ кооператива о своей деятельности (on-chain coops.description)',
  })
  description?: string;

  @Field(() => CooperativeCharterOutputDTO, {
    nullable: true,
    description: 'Последний приложенный устав кооператива (без read_url — ссылку берут отдельным запросом)',
  })
  charter?: CooperativeCharterOutputDTO;

  @Field(() => CooperativeChainStatus, { description: 'Статус кооператива в блокчейне' })
  status!: CooperativeChainStatus;

  @Field(() => String, { nullable: true, description: 'Дата регистрации заявки кооператива (on-chain)' })
  created_at?: string;

  @Field(() => Boolean, { description: 'Есть ли у кооператива данные провайдера (хотя бы одна подписка)' })
  has_provider_data!: boolean;

  @Field(() => [ProviderSubscriptionDTO], { description: 'Подписки кооператива у провайдера (с инстансом и биллингом)' })
  subscriptions!: ProviderSubscriptionDTO[];
}
