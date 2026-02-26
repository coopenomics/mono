import { InputType, Field } from '@nestjs/graphql';
import { StoryStatus } from '../../../domain/enums/story-status.enum';

/**
 * Input DTO для фильтрации историй
 */
@InputType('CapitalStoryFilter', {
  description: 'Параметры фильтрации для запросов историй CAPITAL',
})
export class StoryFilterInputDTO {
  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по названию истории',
  })
  title?: string;

  @Field(() => StoryStatus, {
    nullable: true,
    description: 'Фильтр по статусу истории',
  })
  status?: StoryStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу проекта',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по хешу задачи',
  })
  issue_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по ID создателя',
  })
  created_by?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Фильтр по названию кооператива',
  })
  coopname?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Показывать требования дочерних компонентов при фильтрации по project_hash',
    defaultValue: true,
  })
  show_components_requirements?: boolean;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Показывать требования задач при фильтрации по project_hash',
    defaultValue: true,
  })
  show_issues_requirements?: boolean;
}
