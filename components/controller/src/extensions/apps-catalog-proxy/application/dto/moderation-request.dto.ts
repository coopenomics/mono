import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import GraphQLJSON from 'graphql-type-json';

/**
 * Статусы заявки на модерацию (зеркало `ModerationStatus` из ca-admin).
 */
export enum ModerationStatusEnum {
  SUBMITTED = 'SUBMITTED',
  WITHDRAWN = 'WITHDRAWN',
  APPROVED = 'APPROVED',
  APPROVED_PENDING_CHAIN = 'APPROVED_PENDING_CHAIN',
  REJECTED = 'REJECTED',
}

registerEnumType(ModerationStatusEnum, {
  name: 'ModerationStatusEnum',
  description: 'Статус заявки на модерацию пакета',
});

export enum ReleaseTypeEnum {
  FULL = 'full',
  CANARY = 'canary',
}

registerEnumType(ReleaseTypeEnum, {
  name: 'ReleaseTypeEnum',
  description: 'Тип релиза: full / canary',
});

/**
 * Запись заявки на модерацию для стола восхода (story 9.9).
 *
 * Возвращается из `appsCatalogPendingModerations`. Поля `scope` — JSON
 * (union all/subnets/cooperatives/empty), фронт сам разбирает по `.type`.
 */
@ObjectType()
export class ModerationRequestDTO {
  @Field({ description: 'UUID заявки' })
  id!: string;

  @Field({ description: 'Идентификатор пакета (@scope/name)' })
  packageId!: string;

  @Field({ description: 'Версия пакета (SemVer)' })
  version!: string;

  @Field(() => GraphQLJSON, {
    description: 'ReleaseScope: { type, subnets?, coopnames? }',
  })
  scope!: unknown;

  @Field({ description: 'Краткое описание / release notes от разработчика' })
  brief!: string;

  @Field(() => ReleaseTypeEnum, { description: 'Тип релиза' })
  releaseType!: ReleaseTypeEnum;

  @Field(() => ModerationStatusEnum, { description: 'Текущий статус' })
  status!: ModerationStatusEnum;

  @Field({ description: 'Кто подал заявку (Antelope-имя)' })
  submittedBy!: string;

  @Field({ description: 'Когда подана (ISO 8601)' })
  submittedAt!: string;

  @Field({ description: 'Когда последний раз обновлена (ISO 8601)' })
  updatedAt!: string;

  @Field({
    description:
      'Требуется ли явный override:true при approve (критическая уязвимость в scan_report)',
  })
  requiresOverride!: boolean;
}
