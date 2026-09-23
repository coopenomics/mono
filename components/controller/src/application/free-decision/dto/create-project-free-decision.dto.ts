import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ProjectFreeDecisionDomainInterface } from '~/domain/common/interfaces/project-free-decision-domain.interface';
import { t } from '~/i18n';

@InputType('CreateProjectFreeDecisionInput')
export class CreateProjectFreeDecisionInputDTO implements Omit<ProjectFreeDecisionDomainInterface, 'id'> {
  @Field(() => String, {
    description: 'Пользовательский заголовок документа',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: t('freeDecision.createProjectFreeDecision.titleMustBeString') })
  @MaxLength(200, { message: t('freeDecision.createProjectFreeDecision.titleTooLong') })
  title?: string;

  @Field(() => String, { description: 'Вопрос, который выносится на повестку' })
  @IsNotEmpty({ message: t('freeDecision.createProjectFreeDecision.agendaQuestionRequired') })
  question!: string;

  @Field(() => String, {
    description: 'Проект решения, которое предлагается принять',
  })
  @IsString({ message: t('freeDecision.createProjectFreeDecision.draftMustBeString') })
  decision!: string;
}
