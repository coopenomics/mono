import { ObjectType, Field } from '@nestjs/graphql';
import { ExtendedBlockchainActionDTO } from './extended-action.dto';
import type { StatementDetailAggregateDomainInterface } from '~/domain/document/interfaces/statement-detail-aggregate-domain.interface';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

@ObjectType('StatementDetailAggregate', {
  description:
    'Комплексный объект цифрового документа заявления (или другого ведущего документа для цепочки принятия решений совета) с агрегатом документа',
})
export class StatementDetailAggregateDTO implements StatementDetailAggregateDomainInterface {
  @Field(() => ExtendedBlockchainActionDTO)
  action!: ExtendedBlockchainActionDTO;

  @Field(() => DocumentAggregateDTO)
  documentAggregate!: DocumentAggregateDTO;

  constructor(data?: StatementDetailAggregateDomainInterface) {
    if (data) {
      this.action = new ExtendedBlockchainActionDTO(data.action);
      this.documentAggregate = new DocumentAggregateDTO(data.documentAggregate);
    }
  }
}
