import { Field, InputType } from '@nestjs/graphql';

/**
 * Входные данные `Mutation.subscribePackage` (story 9.3.b-sub).
 *
 * Chairman кооператива-партнёра подписывает свой кооператив на пакет
 * из каталога восхода. Прокидывается на catalog-delivery
 * `POST /v1/subscriptions/activate` с tenant JWT кооператива; on-chain
 * `apps::regsub` подписывает catalog-delivery от имени каталога-оператора.
 *
 * Tenant читается catalog-delivery'ом ТОЛЬКО из JWT — клиент не может
 * переопределить кооператива в body.
 */
@InputType()
export class SubscribePackageInputDTO {
  @Field({
    description:
      'Идентификатор пакета в формате @scope/name, например @voskhod/demoapp',
  })
  packageId!: string;

  @Field({
    nullable: true,
    description: 'Имя плана (eosio::name; в MVP "default"). Опционально.',
  })
  plan?: string;
}
