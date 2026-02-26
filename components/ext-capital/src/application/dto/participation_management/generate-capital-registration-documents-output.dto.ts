import { Field, ObjectType } from '@nestjs/graphql';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';

/**
 * DTO для результата генерации пачки документов на странице регистрации в Capital
 */
@ObjectType()
export class GenerateCapitalRegistrationDocumentsOutputDTO {
  @Field(() => GeneratedDocumentDTO, { 
    nullable: true, 
    description: 'Договор УХД (всегда генерируется)' 
  })
  generation_contract?: GeneratedDocumentDTO;

  @Field(() => GeneratedDocumentDTO, { 
    nullable: true, 
    description: 'Соглашение о хранении имущества (всегда генерируется)' 
  })
  storage_agreement?: GeneratedDocumentDTO;

  @Field(() => GeneratedDocumentDTO, {
    nullable: true,
    description: 'Соглашение Благорост (только для пути Генератора)'
  })
  blagorost_agreement?: GeneratedDocumentDTO;

  @Field(() => GeneratedDocumentDTO, {
    nullable: true,
    description: 'Оферта Генератор (для пути Капитализации)'
  })
  generator_offer?: GeneratedDocumentDTO;
}
