import { InputType, Field } from '@nestjs/graphql';
import { GraphQLJSON } from 'graphql-type-json';
import { GenerateDocumentOptionsInputDTO } from '@coopenomics/extension-kit';

@InputType('GenerateAnyDocumentInput')
export class GenerateAnyDocumentInputDTO {
  @Field(() => GraphQLJSON, { description: 'Произвольные данные для генерации документа в формате JSON' })
  data!: Record<string, any>;

  @Field(() => GenerateDocumentOptionsInputDTO, { nullable: true, description: 'Опции генерации документа' })
  options?: GenerateDocumentOptionsInputDTO;
}
