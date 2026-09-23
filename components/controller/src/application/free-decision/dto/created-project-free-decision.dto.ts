import { Field, ObjectType } from '@nestjs/graphql';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import type { ProjectFreeDecisionDomainInterface } from '~/domain/common/interfaces/project-free-decision-domain.interface';
import { t } from '~/i18n';

@ObjectType('CreatedProjectFreeDecision')
export class CreatedProjectFreeDecisionDTO implements ProjectFreeDecisionDomainInterface {
  @Field(() => String, { description: 'Идентификатор проекта свободного решения' })
  @IsNotEmpty({ message: t('freeDecision.createdProjectFreeDecision.idRequired') })
  @IsString({ message: t('freeDecision.createdProjectFreeDecision.idMustBeString') })
  id!: string;

  @Field(() => String, { description: 'Вопрос, который выносится на повестку' })
  @IsNotEmpty({ message: t('freeDecision.createdProjectFreeDecision.agendaQuestionRequired') })
  question!: string;

  @Field(() => String, {
    description: 'Пользовательский заголовок документа',
    nullable: true,
  })
  @IsOptional()
  @IsString({ message: t('freeDecision.createdProjectFreeDecision.titleMustBeString') })
  @MaxLength(200, { message: t('freeDecision.createdProjectFreeDecision.titleTooLong') })
  title?: string;

  @Field(() => String, {
    description: 'Проект решения, которое предлагается принять',
  })
  @IsString({ message: t('freeDecision.createdProjectFreeDecision.draftMustBeString') })
  decision!: string;

  constructor(data: CreatedProjectFreeDecisionDTO) {
    Object.assign(this, data);
  }
}
