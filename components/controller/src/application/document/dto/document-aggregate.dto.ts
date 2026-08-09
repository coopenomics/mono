import { Field, ObjectType } from '@nestjs/graphql';
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

  constructor(data?: DocumentDomainAggregate) {
    if (data) {
      this.hash = data.hash;
      this.document = new SignedDigitalDocumentDTO(data.document);
      if (data.rawDocument) {
        this.rawDocument = new GeneratedDocumentDTO(data.rawDocument);
      }
    }
  }
}
