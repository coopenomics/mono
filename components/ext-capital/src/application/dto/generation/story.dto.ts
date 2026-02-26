import { ObjectType, Field, Int } from '@nestjs/graphql';
import { StoryStatus } from '../../../domain/enums/story-status.enum';
import { BaseOutputDTO } from '~/shared/dto/base.dto';

/**
 * GraphQL Output DTO для сущности Story
 */
@ObjectType('CapitalStory', {
  description: 'История (критерий выполнения) в системе CAPITAL',
})
export class StoryOutputDTO extends BaseOutputDTO {
  @Field(() => String, {
    description: 'Хеш истории',
  })
  story_hash!: string;

  @Field(() => String, {
    description: 'Имя аккаунта кооператива',
  })
  coopname!: string;

  @Field(() => String, {
    description: 'Название истории',
  })
  title!: string;

  @Field(() => String, {
    nullable: true,
    description: 'Описание истории',
  })
  description?: string;

  @Field(() => StoryStatus, {
    description: 'Статус истории',
  })
  status!: StoryStatus;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш проекта (если история привязана к проекту)',
  })
  project_hash?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Хеш задачи (если история привязана к задаче)',
  })
  issue_hash?: string;

  @Field(() => String, {
    description: 'Имя пользователя, создавшего историю',
  })
  created_by!: string;

  @Field(() => Int, {
    description: 'Порядок сортировки',
  })
  sort_order!: number;
}
