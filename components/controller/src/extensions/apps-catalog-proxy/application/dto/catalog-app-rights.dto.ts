import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ArrayMaxSize, IsArray, IsBoolean, IsString, Matches } from 'class-validator';

const PACKAGE_ID_RE = /^@[a-z0-9-]+\/[a-z0-9-]+$/;
/** Предел перечня прав в одном запросе: защита от мусора, прав у приложения единицы. */
const RIGHTS_MAX = 64;

/** Набор прав ядра: порты и действия цепи. */
@ObjectType('CatalogAppRightsSet')
export class CatalogAppRightsSetDTO {
  @Field(() => [String], { description: 'Порты ядра: имена из манифеста приложения' })
  ports!: string[];

  @Field(() => [String], { description: 'Действия цепи вида contract::action' })
  chainActions!: string[];
}

/** Права ядра приложения каталога на этом узле: что приложение просит, что разрешено, что ждёт согласия. */
@ObjectType('CatalogAppRights')
export class CatalogAppRightsDTO {
  @Field(() => String, { description: 'Пакет каталога, например @voskhod/demoapp' })
  packageId!: string;

  @Field(() => String, { nullable: true, description: 'Действующая версия пакета в каталоге' })
  version?: string | null;

  @Field(() => CatalogAppRightsSetDTO, {
    nullable: true,
    description: 'Права, которые просит действующая версия. Пусто — перечень сейчас недоступен',
  })
  requested?: CatalogAppRightsSetDTO | null;

  @Field(() => CatalogAppRightsSetDTO, { description: 'Права, с которыми председатель согласился' })
  granted!: CatalogAppRightsSetDTO;

  @Field(() => CatalogAppRightsSetDTO, {
    nullable: true,
    description: 'Права, которые новая версия просит сверх согласия. Пусто — запроса нет',
  })
  pending?: CatalogAppRightsSetDTO | null;

  @Field(() => String, { nullable: true, description: 'Версия, которая ждёт согласия' })
  pendingVersion?: string | null;

  @Field(() => Boolean, { description: 'Новые права принимаются без вопроса, после одобрения модератора каталога' })
  autoAccept!: boolean;

  @Field(() => String, { nullable: true, description: 'Кто дал согласие' })
  consentedBy?: string | null;

  @Field(() => String, { nullable: true, description: 'Когда дано согласие (ISO 8601)' })
  consentedAt?: string | null;
}

@InputType('GrantCatalogAppRightsInput')
export class GrantCatalogAppRightsInputDTO {
  @Field(() => String, { description: 'Пакет каталога, например @voskhod/demoapp' })
  @IsString()
  @Matches(PACKAGE_ID_RE)
  packageId!: string;

  @Field(() => [String], { description: 'Порты ядра, с которыми председатель согласен' })
  @IsArray()
  @ArrayMaxSize(RIGHTS_MAX)
  @IsString({ each: true })
  ports!: string[];

  @Field(() => [String], { description: 'Действия цепи, с которыми председатель согласен' })
  @IsArray()
  @ArrayMaxSize(RIGHTS_MAX)
  @IsString({ each: true })
  chainActions!: string[];
}

@InputType('SetCatalogAppRightsAutoAcceptInput')
export class SetCatalogAppRightsAutoAcceptInputDTO {
  @Field(() => String, { description: 'Пакет каталога, например @voskhod/demoapp' })
  @IsString()
  @Matches(PACKAGE_ID_RE)
  packageId!: string;

  @Field(() => Boolean, { description: 'true — принимать новые права без вопроса' })
  @IsBoolean()
  enabled!: boolean;
}
