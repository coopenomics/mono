/**
 * Документ вместе с подписями и исходником — то, что резолвер расширения
 * отдаёт интерфейсу пайщика.
 *
 * Переехало из `~/application/document/dto`: агрегат возвращают резолверы
 * девятнадцати файлов расширений, а этого пути за пределами монолита нет.
 */
import { Field, ObjectType } from '@nestjs/graphql';
import { ValidateNested } from 'class-validator';
import { GeneratedDocumentDTO } from './generated-document.dto';
import { SignedDigitalDocumentDTO } from './signed-digital-document.dto';

@ObjectType('DocumentAggregate')
export class DocumentAggregateDTO {
  @Field(() => String)
  hash!: string;

  @Field(() => SignedDigitalDocumentDTO)
  @ValidateNested()
  document!: SignedDigitalDocumentDTO;

  @Field(() => GeneratedDocumentDTO, { nullable: true })
  rawDocument?: GeneratedDocumentDTO;

  /**
   * Принимает любой агрегат нужной формы: и доменный из ядра, и результат
   * `IDocumentPort.buildAggregate`. Номинальной связи с ними нет — каркас не
   * зависит ни от контроллера, ни от `@coopenomics/innercoop` (INV-007).
   */
  constructor(data?: { hash: string; document: any; rawDocument?: any }) {
    if (data) {
      this.hash = data.hash;
      this.document = new SignedDigitalDocumentDTO(data.document);
      if (data.rawDocument) {
        this.rawDocument = new GeneratedDocumentDTO(data.rawDocument);
      }
    }
  }
}
