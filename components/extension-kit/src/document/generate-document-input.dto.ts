import { InputType, OmitType } from '@nestjs/graphql';
import { GenerateMetaDocumentInputDTO } from './generate-meta-document-input.dto';

/**
 * То же, что `GenerateMetaDocumentInputDTO`, но реестр обязателен на уровне
 * типов TypeScript.
 *
 * `registry_id` намеренно без `@Field`: в схеме у `GenerateDocumentInput` этого
 * поля нет и не было — реестр проставляет сервер по вызванной мутации, а не
 * клиент. Добавить `@Field` значило бы завести новое обязательное поле во
 * входном типе и сломать всех клиентов.
 */
@InputType('GenerateDocumentInput')
export class GenerateDocumentInputDTO extends OmitType(GenerateMetaDocumentInputDTO, ['registry_id'] as const) {
  registry_id!: number;

  constructor() {
    super();
  }
}
