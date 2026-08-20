import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsString } from 'class-validator';
import { ProjectPriority } from '../../../domain/enums/project-priority.enum';

@InputType('SetCapitalProjectPriorityInput')
export class SetCapitalProjectPriorityInputDTO {
  @Field(() => String, { description: 'Хэш проекта или компонента' })
  @IsString()
  project_hash!: string;

  @Field(() => ProjectPriority, { description: 'Новый приоритет проекта или компонента' })
  @IsEnum(ProjectPriority)
  priority!: ProjectPriority;
}
