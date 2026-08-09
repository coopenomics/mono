import { Field, ObjectType } from '@nestjs/graphql';
import type { InnerDocumentAggregate } from '@coopenomics/innercoop';
import type { IExtendedSignedDocument } from '~/domain/document/interfaces/extended-signed-document-domain.interface';
import { ValidateNested } from 'class-validator';
import { GeneratedDocumentDTO } from '@coopenomics/extension-kit';
import type { DocumentAggregateDomainInterface } from '~/domain/document/interfaces/document-domain-aggregate.interface';
import { SignedDigitalDocumentDTO } from './signed-digital-document.dto';
import { DocumentDomainAggregate } from '~/domain/document/aggregates/document-domain.aggregate';

@ObjectType('DocumentAggregate')
export class DocumentAggregateDTO implements DocumentAggregateDomainInterface {
  @Field(() => String)
  hash!: string;

  @Field(() => SignedDigitalDocumentDTO)
  @ValidateNested()
  document!: SignedDigitalDocumentDTO;

  @Field(() => GeneratedDocumentDTO, { nullable: true })
  rawDocument?: GeneratedDocumentDTO;

  /**
   * Принимает и агрегат ядра, и результат `IDocumentPort.buildAggregate`:
   * формы совпадают, разница только в подписях — контракт порта знает базовые,
   * ядро дополняет их сертификатами. Приведение локально и безопасно: агрегат
   * всегда собирает `DocumentAggregationService`, а он возвращает расширенный
   * вид.
   */
  constructor(data?: DocumentDomainAggregate | InnerDocumentAggregate) {
    if (data) {
      this.hash = data.hash;
      this.document = new SignedDigitalDocumentDTO(data.document as IExtendedSignedDocument);
      if (data.rawDocument) {
        this.rawDocument = new GeneratedDocumentDTO(data.rawDocument);
      }
    }
  }
}
