import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ProjectFreeDecisionDomainInterface } from '~/domain/common/interfaces/project-free-decision-domain.interface';

@InputType('CreateProjectFreeDecisionInput')
export class CreateProjectFreeDecisionInputDTO implements Omit<ProjectFreeDecisionDomainInterface, 'id'> {
  @Field(() => String, {
    description: 'Пользовательский заголовок документа',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: validationMessage('freeDecision.createProjectFreeDecision.titleMustBeString') })
  @MaxLength(200, { message: validationMessage('freeDecision.createProjectFreeDecision.titleTooLong') })
  title?: string;

  @Field(() => String, { description: 'Вопрос, который выносится на повестку' })
  @IsNotEmpty({ message: validationMessage('freeDecision.createProjectFreeDecision.agendaQuestionRequired') })
  question!: string;

  @Field(() => String, {
    description: 'Проект решения, которое предлагается принять',
  })
  @IsString({ message: validationMessage('freeDecision.createProjectFreeDecision.draftMustBeString') })
  decision!: string;
}
