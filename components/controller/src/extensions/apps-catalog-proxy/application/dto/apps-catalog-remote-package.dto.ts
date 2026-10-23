import { Field, ObjectType } from '@nestjs/graphql';

/**
 * GraphQL-проекция одного remote-пакета в публичном каталоге apps-catalog
 * (Story 9.5.b). Источник — `GET /v1/public/packages` на ca-admin, который
 * controller проксирует через `Query.appsCatalogRemotePackages`. На фронте
 * подписи витрины строятся из этих полей; фильтр self/чужое и self-sub
 * bypass делает desktop по `publisher === coopname`.
 */
@ObjectType()
export class AppsCatalogRemotePackageDTO {
  @Field({ description: 'Идентификатор пакета (например, @voskhod/demoapp)' })
  packageId!: string;

  @Field({ description: 'Имя владельца пакета (кооператив-разработчик)' })
  publisher!: string;

  @Field(() => [String], {
    description: 'Совместимые subnet (chain_id блокчейна ЦК)',
  })
  compatibleSubnets!: string[];

  @Field(() => String, {
    nullable: true,
    description: 'Последняя активная версия (semver). null = релизов ещё нет.',
  })
  lastActiveVersion?: string | null;

  @Field({
    description: 'Заголовок пакета для UI (в MVP — packageId, в будущем из manifest)',
  })
  title!: string;

  @Field({
    description: 'Краткое описание (в MVP — заглушка, в будущем из manifest)',
  })
  description!: string;

  @Field({
    description: 'Стоимость подписки, RUB/месяц (в MVP — фиксированно из dev-pricing seed)',
  })
  rubPerMonth!: number;
}
