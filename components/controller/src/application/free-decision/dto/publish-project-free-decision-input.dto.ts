import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import type { PublishProjectFreeDecisionInputDomainInterface } from '~/domain/free-decision/interfaces/publish-project-free-decision.interface';
import { ProjectFreeDecisionSignedDocumentInputDTO } from '../../document/documents-dto/project-free-decision-document.dto';
import { t } from '~/i18n';

@InputType('PublishProjectFreeDecisionInput')
export class PublishProjectFreeDecisionInputDTO implements PublishProjectFreeDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: t('freeDecision.publishProjectFreeDecisionInput.coopnameRequired') })
  @IsString({ message: t('freeDecision.publishProjectFreeDecisionInput.coopnameMustBeString') })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: t('freeDecision.publishProjectFreeDecisionInput.usernameRequired') })
  username!: string;

  @Field(() => ProjectFreeDecisionSignedDocumentInputDTO, {
    description: 'Подписанный электронный документ (generateProjectOfFreeDecision)',
  })
  @ValidateNested()
  document!: ProjectFreeDecisionSignedDocumentInputDTO;

  @Field(() => String, {
    description: 'Строка мета-информации',
  })
  @IsString({ message: t('freeDecision.publishProjectFreeDecisionInput.metaMustBeString') })
  meta!: string;
}
