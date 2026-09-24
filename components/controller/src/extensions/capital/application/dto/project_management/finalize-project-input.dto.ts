import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { IFinalizeProjectDomainInput } from '../../../domain/actions/finalize-project-domain-input.interface';

/**
 * GraphQL DTO для финализации проекта CAPITAL контракта
 * Финализация проекта после завершения всех конвертаций участников
 */
@InputType('FinalizeProjectInput')
export class FinalizeProjectInputDTO implements IFinalizeProjectDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.finalizeProjectInput.coopname.required') })
  @IsString({ message: validationMessage('capital.finalizeProjectInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта для финализации' })
  @IsNotEmpty({ message: validationMessage('capital.finalizeProjectInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.finalizeProjectInput.projectHash.string') })
  project_hash!: string;
}
