// Типы полей — явными thunk'ами: esbuild не эмитит `design:type` (см. соседний
// generated-document.dto.ts).
import { InputType, Field } from '@nestjs/graphql';
import type { IGenerationOptions } from '@coopenomics/docs-templates';

@InputType('GenerateDocumentOptionsInput')
export class GenerateDocumentOptionsInputDTO implements IGenerationOptions {
  @Field(() => Boolean, { nullable: true, description: 'Пропустить сохранение' })
  skip_save?: boolean;

  @Field(() => String, { nullable: true, description: 'Язык документа' })
  lang?: string;
}
