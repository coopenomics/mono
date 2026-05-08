import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Целевая потребительская программа кооператива (`soviet::programs`):
 * id, тип (`wallet`/`generator`/`blagorost`/`marketplace`), флаг активности
 * и привязка к draft-шаблону. Возвращается фронту вместо прямого
 * `fetchTable(soviet::programs)` (ADR: фронт не ходит в чейн).
 *
 * Человекочитаемые названия программ — на стороне фронта из реестра
 * `cooptypes/src/ledger2/programs.ts`. Контракт оперирует только числовым id.
 */
@ObjectType('CooperativeProgram')
export class CooperativeProgramDTO {
  @Field(() => Int, { description: 'Идентификатор программы (program_id)' })
  id!: number;

  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  coopname!: string;

  @Field(() => String, { description: 'Тип программы: wallet/generator/blagorost/marketplace и т.п.' })
  program_type!: string;

  @Field(() => Boolean, { description: 'Активна ли программа в кооперативе' })
  is_active!: boolean;

  @Field(() => Int, { description: 'Идентификатор шаблона документа (registry_id из draft::drafts), 0 — без шаблона' })
  draft_id!: number;
}
