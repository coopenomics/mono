import { ObjectType, Field } from '@nestjs/graphql';
import { ExtendedBlockchainActionDTO } from './extended-action.dto';
import type { ActDetailAggregateDomainInterface } from '~/domain/document/interfaces/act-detail-aggregate-domain.interface';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

@ObjectType('ActDetailAggregate', {
  description:
    'Комплексный объект акта, содержащий полную информацию о сгенерированном и опубликованном документе с его агрегатом',
})
export class ActDetailAggregateDTO implements ActDetailAggregateDomainInterface {
  @Field(() => ExtendedBlockchainActionDTO, { nullable: true })
  action!: ExtendedBlockchainActionDTO;

  @Field(() => DocumentAggregateDTO, { nullable: true })
  documentAggregate!: DocumentAggregateDTO;

  constructor(data?: ActDetailAggregateDomainInterface) {
    if (data) {
      this.action = data.action ? new ExtendedBlockchainActionDTO(data.action) : (null as any);
      this.documentAggregate = data.documentAggregate ? new DocumentAggregateDTO(data.documentAggregate) : (null as any);
    }
  }
}
