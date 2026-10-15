import { Field, ObjectType } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';

/**
 * Ответ заявителя на одну анкету вступления. Схема отдаётся снимком на момент
 * подачи: по ней интерфейс подписывает поля, даже если расширение уже выключено.
 */
@ObjectType('CandidateIntakeAnswer')
export class CandidateIntakeAnswerDTO {
  @Field(() => String, { description: 'Идентификатор анкеты' })
  form_id!: string;

  @Field(() => String, { description: 'Заголовок анкеты на момент подачи' })
  title!: string;

  @Field(() => GraphQLJSON, { description: 'JSON Schema полей анкеты на момент подачи' })
  json_schema!: Record<string, unknown>;

  @Field(() => GraphQLJSON, { description: 'Значения полей: имя поля → значение' })
  values!: Record<string, unknown>;

  @Field(() => Date, { description: 'Когда заявитель подал ответы' })
  submitted_at!: Date;
}

/** Сведения, которые заявитель сообщил о себе при вступлении. */
@ObjectType('CandidateIntake')
export class CandidateIntakeDTO {
  @Field(() => String)
  username!: string;

  @Field(() => String, { nullable: true, description: 'Программа, выбранная при вступлении' })
  program_key?: string;

  @Field(() => [CandidateIntakeAnswerDTO], { description: 'Ответы на анкеты вступления' })
  answers!: CandidateIntakeAnswerDTO[];
}
