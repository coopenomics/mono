import { ObjectType, Field } from '@nestjs/graphql';
import { ExtendedBlockchainActionDTO } from './extended-action.dto';
import type { DecisionDetailAggregateDomainInterface } from '~/domain/document/interfaces/decision-detail-aggregate-domain.interface';
import { DocumentAggregateDTO } from '@coopenomics/extension-kit';

@ObjectType('DecisionDetailAggregate', {
  description:
    'Комплексный объект решения совета, включающий в себя информацию о голосовавших членах совета, расширенное действие, которое привело к появлению решения, и агрегат документа самого решения.',
})
export class DecisionDetailAggregateDTO implements DecisionDetailAggregateDomainInterface {
  @Field(() => ExtendedBlockchainActionDTO)
  action!: ExtendedBlockchainActionDTO;

  @Field(() => DocumentAggregateDTO)
  documentAggregate!: DocumentAggregateDTO;

  @Field(() => [ExtendedBlockchainActionDTO])
  votes_for!: ExtendedBlockchainActionDTO[];

  @Field(() => [ExtendedBlockchainActionDTO])
  votes_against!: ExtendedBlockchainActionDTO[];

  constructor(data?: DecisionDetailAggregateDomainInterface) {
    if (data) {
      this.action = new ExtendedBlockchainActionDTO(data.action);
      this.documentAggregate = new DocumentAggregateDTO(data.documentAggregate);
      this.votes_for = data.votes_for?.map((vote) => new ExtendedBlockchainActionDTO(vote)) || [];
      this.votes_against = data.votes_against?.map((vote) => new ExtendedBlockchainActionDTO(vote)) || [];
    } else {
      this.votes_for = [];
      this.votes_against = [];
    }
  }
}
