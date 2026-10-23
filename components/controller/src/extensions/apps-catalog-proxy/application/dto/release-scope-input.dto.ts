import { Field, InputType, registerEnumType } from '@nestjs/graphql';

/**
 * Тип области видимости релиза.
 *
 *  - `all` — для всех подсетей (любых кооперативов);
 *  - `subnets` — только перечисленные chain_id подсетей;
 *  - `cooperatives` — только перечисленные кооперативы;
 *  - `empty` — выключить релиз (полная отзывка видимости).
 *
 * См. epics.md Story 3.7 — одобрение заявки на модерацию.
 */
export enum ReleaseScopeType {
  ALL = 'all',
  SUBNETS = 'subnets',
  COOPERATIVES = 'cooperatives',
  EMPTY = 'empty',
}

registerEnumType(ReleaseScopeType, {
  name: 'ReleaseScopeType',
  description: 'Тип области видимости релиза при одобрении заявки',
});

/**
 * Область видимости релиза, передаётся в `approveModeration`.
 *
 * При `type=subnets` ожидается заполненный `subnets`. При
 * `type=cooperatives` — заполненный `coopnames`. Для `all` / `empty`
 * массивы игнорируются.
 *
 * Резолвер сам валидирует соответствие type → массив и нормализует
 * перед отправкой на ca-admin.
 */
@InputType()
export class ReleaseScopeInputDTO {
  @Field(() => ReleaseScopeType, { description: 'Тип scope' })
  type!: ReleaseScopeType;

  @Field(() => [String], {
    nullable: true,
    description: 'chain_id подсетей (для type=subnets)',
  })
  subnets?: string[];

  @Field(() => [String], {
    nullable: true,
    description: 'Antelope-имена кооперативов (для type=cooperatives)',
  })
  coopnames?: string[];
}
