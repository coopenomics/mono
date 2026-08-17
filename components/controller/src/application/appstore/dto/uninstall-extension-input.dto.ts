// modules/appstore/dto/extension-graphql-input.dto.ts
import { InputType, Field } from '@nestjs/graphql';
import type { ExtensionDomainInterface } from '@coopenomics/extension-kit';

@InputType('UninstallExtensionInput')
export class UninstallExtensionGraphQLInput implements Partial<ExtensionDomainInterface> {
  @Field(() => String, { description: 'Фильтр по имени' })
  name!: string;
}
