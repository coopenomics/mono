import { Field, ObjectType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ProjectFreeDecisionDomainInterface } from '~/domain/common/interfaces/project-free-decision-domain.interface';

@ObjectType('CreatedProjectFreeDecision')
export class CreatedProjectFreeDecisionDTO implements ProjectFreeDecisionDomainInterface {
  @Field(() => String, { description: 'Идентификатор проекта свободного решения' })
  @IsNotEmpty({ message: validationMessage('freeDecision.createdProjectFreeDecision.idRequired') })
  @IsString({ message: validationMessage('freeDecision.createdProjectFreeDecision.idMustBeString') })
  id!: string;

  @Field(() => String, { description: 'Вопрос, который выносится на повестку' })
  @IsNotEmpty({ message: validationMessage('freeDecision.createdProjectFreeDecision.agendaQuestionRequired') })
  question!: string;

  @Field(() => String, {
    description: 'Пользовательский заголовок документа',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: validationMessage('freeDecision.createdProjectFreeDecision.titleMustBeString') })
  @MaxLength(200, { message: validationMessage('freeDecision.createdProjectFreeDecision.titleTooLong') })
  title?: string;

  @Field(() => String, {
    description: 'Проект решения, которое предлагается принять',
  })
  @IsString({ message: validationMessage('freeDecision.createdProjectFreeDecision.draftMustBeString') })
  decision!: string;

  constructor(data: CreatedProjectFreeDecisionDTO) {
    Object.assign(this, data);
  }
}
