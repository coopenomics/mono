import { Field, InputType } from '@nestjs/graphql';

/**
 * Входные данные `Mutation.subscribePackage` (story 9.3.b-sub).
 *
 * Председатель подписывает свой кооператив на пакет каталога. Подписку
 * оформляет провайдер подключения: она входит в общий счёт кооператива,
 * копию провайдер передаёт каталогу (Архитектура v5, 487-34). Кооператив —
 * кооператив узла; клиент не может подставить другой.
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
