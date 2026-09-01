import { Field, InputType, ObjectType } from '@nestjs/graphql';

/**
 * GraphQL-контракт назначаемых наборов возможностей (Story 6.11). Зеркало портов
 * `capability-sets.port.ts`, поля — snake_case по канону GraphQL этого репозитория.
 * Резолвер маппит camelCase из сервиса в snake_case этих DTO.
 *
 * Зачем GraphQL, а не REST: единый типизированный фасад фронта — @coopenomics/sdk
 * (Zeus). Прямой REST с фронта к auth-v2 устранён; токен живёт только в SDK.
 */

/** Гранулярное право: какое действие над каким ресурсом открыто (единица гейтинга UI). */
@ObjectType('AccessGrant')
export class AccessGrantDTO {
  @Field(() => String, { description: 'Действие (например, read / confirm / manage)' })
  action!: string;

  @Field(() => String, { description: 'Ресурс — стол/страница/сущность, к которой открыт доступ' })
  resource!: string;
}

/** Шаблон набора возможностей + что он открывает (для admin-UI «эта роль даёт …»). */
@ObjectType('CapabilitySet')
export class CapabilitySetDTO {
  @Field(() => String, { description: 'Канон-идентификатор набора (например, accountant / cashier)' })
  set_key!: string;

  @Field(() => String, { description: 'Человеко-имя набора для интерфейса' })
  title!: string;

  @Field(() => String, { description: 'Назначение набора' })
  description!: string;

  @Field(() => Boolean, { description: 'true — платформенный набор; false — кооперативный кастомный' })
  builtin!: boolean;

  @Field(() => String, { nullable: true, description: 'Кооператив-владелец кастомного набора; пусто для платформенных' })
  coopname!: string | null;

  @Field(() => [AccessGrantDTO], { description: 'Права, которые открывает набор' })
  grants!: AccessGrantDTO[];
}

/** Назначение набора пайщику (что он имеет сейчас). */
@ObjectType('CapabilitySetAssignment')
export class CapabilitySetAssignmentDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  username!: string;

  @Field(() => String, { description: 'Идентификатор назначенного набора' })
  set_key!: string;

  @Field(() => String, { description: 'Кто выдал набор (председатель)' })
  granted_by!: string;

  @Field(() => String, { description: 'Когда выдан' })
  granted_at!: string;

  @Field(() => String, { nullable: true, description: 'Срок действия назначения; пусто — бессрочно' })
  expires_at!: string | null;
}

/** Эффективный доступ пайщика: активные наборы + плоский список грантов из его Ability. */
@ObjectType('ParticipantAccess')
export class ParticipantAccessDTO {
  @Field(() => [String], { description: 'Идентификаторы активных наборов возможностей пайщика' })
  sets!: string[];

  @Field(() => [AccessGrantDTO], { description: 'Эффективные права пайщика (основание гейтинга столов/страниц)' })
  grants!: AccessGrantDTO[];
}

/** Вход на назначение набора пайщику. */
@InputType('AssignCapabilitySetInput')
export class AssignCapabilitySetInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  username!: string;

  @Field(() => String, { description: 'Идентификатор назначаемого набора' })
  set_key!: string;

  @Field(() => String, { nullable: true, description: 'Срок действия назначения; пусто — бессрочно' })
  expires_at?: string | null;
}

/** Вход на отзыв набора у пайщика. */
@InputType('RevokeCapabilitySetInput')
export class RevokeCapabilitySetInputDTO {
  @Field(() => String, { description: 'Имя аккаунта пайщика' })
  username!: string;

  @Field(() => String, { description: 'Идентификатор отзываемого набора' })
  set_key!: string;
}
