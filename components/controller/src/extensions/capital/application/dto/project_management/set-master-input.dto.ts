import { Field, InputType } from '@nestjs/graphql';
import { validationMessage } from '@coopenomics/extension-kit';
import { IsNotEmpty, IsString } from 'class-validator';
import type { SetMasterDomainInput } from '../../../domain/actions/set-master-domain-input.interface';

/**
 * GraphQL DTO для установки мастера проекта CAPITAL контракта
 */
@InputType('SetMasterInput')
export class SetMasterInputDTO implements SetMasterDomainInput {
  @Field(() => String, { description: 'Имя аккаунта кооператива' })
  @IsNotEmpty({ message: validationMessage('capital.setMasterInput.coopname.required') })
  @IsString({ message: validationMessage('capital.setMasterInput.coopname.string') })
  coopname!: string;

  @Field(() => String, { description: 'Хэш проекта' })
  @IsNotEmpty({ message: validationMessage('capital.setMasterInput.projectHash.required') })
  @IsString({ message: validationMessage('capital.setMasterInput.projectHash.string') })
  project_hash!: string;

  @Field(() => String, { description: 'Имя мастера проекта' })
  @IsString({ message: validationMessage('capital.setMasterInput.master.string') })
  master!: string;
}
