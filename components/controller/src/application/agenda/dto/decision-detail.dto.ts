import { ObjectType, Field } from '@nestjs/graphql';
import type { DecisionDetailDomainInterface } from '~/domain/agenda/interfaces/decision-detail-domain.interface';
import { ExtendedBlockchainActionDTO } from './extended-action.dto';
import { GeneratedDocumentDTO } from '@coopenomics/extension-kit';

@ObjectType('DecisionDetail', {
  description:
    'Комплексный объект решения совета, включающий в себя информацию о голосовавших членах совета, расширенное действие, которое привело к появлению решения, и документ самого решения.',
})
export class DecisionDetailDTO implements DecisionDetailDomainInterface {
  @Field(() => ExtendedBlockchainActionDTO)
  action!: ExtendedBlockchainActionDTO;

  @Field(() => GeneratedDocumentDTO)
  document!: GeneratedDocumentDTO;

  @Field(() => [ExtendedBlockchainActionDTO])
  votes_for!: ExtendedBlockchainActionDTO[];

  @Field(() => [ExtendedBlockchainActionDTO])
  votes_against!: ExtendedBlockchainActionDTO[];
}
