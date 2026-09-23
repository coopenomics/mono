import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { ProjectFreeDecisionDomainInterface } from '~/domain/common/interfaces/project-free-decision-domain.interface';

@InputType('CreateProjectFreeDecisionInput')
export class CreateProjectFreeDecisionInputDTO implements Omit<ProjectFreeDecisionDomainInterface, 'id'> {
  @Field(() => String, { description: 'Вопрос, который выносится на повестку' })
  @IsNotEmpty({ message: validationMessage('meet.createProjectFreeDecision.agendaQuestionRequired') })
  question!: string;

  @Field(() => String, {
    description: 'Проект решения, которое предлагается принять',
  })
  @IsString({ message: validationMessage('meet.createProjectFreeDecision.draftMustBeString') })
  decision!: string;
}
