import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString } from 'class-validator';
import type { ProjectFreeDecisionDomainInterface } from '~/domain/common/interfaces/project-free-decision-domain.interface';
import { t } from '~/i18n';

@InputType('CreateProjectFreeDecisionInput')
export class CreateProjectFreeDecisionInputDTO implements Omit<ProjectFreeDecisionDomainInterface, 'id'> {
  @Field(() => String, { description: 'Вопрос, который выносится на повестку' })
  @IsNotEmpty({ message: t('meet.createProjectFreeDecision.agendaQuestionRequired') })
  question!: string;

  @Field(() => String, {
    description: 'Проект решения, которое предлагается принять',
  })
  @IsString({ message: t('meet.createProjectFreeDecision.draftMustBeString') })
  decision!: string;
}
