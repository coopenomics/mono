import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import type { PublishProjectFreeDecisionInputDomainInterface } from '~/domain/free-decision/interfaces/publish-project-free-decision.interface';
import { ProjectFreeDecisionSignedDocumentInputDTO } from '../../document/documents-dto/project-free-decision-document.dto';

@InputType('PublishProjectFreeDecisionInput')
export class PublishProjectFreeDecisionInputDTO implements PublishProjectFreeDecisionInputDomainInterface {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('freeDecision.publishProjectFreeDecisionInput.coopnameRequired') })
  @IsString({ message: validationMessage('freeDecision.publishProjectFreeDecisionInput.coopnameMustBeString') })
  coopname!: string;

  @Field(() => String, { description: 'Имя аккаунта пользователя' })
  @IsNotEmpty({ message: validationMessage('freeDecision.publishProjectFreeDecisionInput.usernameRequired') })
  username!: string;

  @Field(() => ProjectFreeDecisionSignedDocumentInputDTO, {
    description: 'Подписанный электронный документ (generateProjectOfFreeDecision)',
  })
  @ValidateNested()
  document!: ProjectFreeDecisionSignedDocumentInputDTO;

  @Field(() => String, {
    description: 'Строка мета-информации',
  })
  @IsString({ message: validationMessage('freeDecision.publishProjectFreeDecisionInput.metaMustBeString') })
  meta!: string;
}
