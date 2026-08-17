// modules/appstore/dto/extension-graphql-input.dto.ts
import { InputType, Field } from '@nestjs/graphql';
import type { IResolvedRegistryExtension } from '@coopenomics/extension-kit';

@InputType('GetExtensionsInput')
export class GetExtensionsGraphQLInput implements Partial<IResolvedRegistryExtension> {
  @Field(() => String, { description: 'Фильтр по имени', nullable: true })
  name?: string;

  @Field(() => Boolean, { description: 'Фильтр включенных расширений', nullable: true })
  enabled?: boolean;

  @Field(() => Boolean, { description: 'Фильтр установленных расширений', nullable: true })
  is_installed?: boolean;

  @Field(() => Boolean, { description: 'Фильтр рабочих столов', nullable: true })
  is_desktop?: boolean;

  @Field(() => Boolean, { description: 'Фильтр активности', nullable: true })
  is_available?: boolean;
}
