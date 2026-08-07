import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';

/**
 * Перенос задачи между компонентами одного проекта или назначение свободной задачи компоненту
 * (без участия в закоммиченной экономике).
 */
@InputType('MoveCapitalIssueToComponentInput')
export class MoveCapitalIssueToComponentInputDTO {
  @Field(() => String, { description: 'Хеш задачи' })
  @IsNotEmpty()
  @IsString()
  issue_hash!: string;

  @Field(() => String, {
    description: 'Хеш компонента, в который переносим или назначаем задачу',
  })
  @IsNotEmpty()
  @IsString()
  target_project_hash!: string;
}
