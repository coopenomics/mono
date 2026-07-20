import { ObjectType, Field } from '@nestjs/graphql';
import type { AgendaWithDocumentsDomainInterface } from '~/domain/agenda/interfaces/agenda-with-documents-domain.interface';
import { BlockchainActionDTO } from '../../common/dto/blockchain-action.dto';
import { BlockchainDecisionDTO } from './blockchain-decision.dto';
import { DocumentPackageAggregateDTO } from './document-package-aggregate.dto';
import type { UserCertificateDomainInterface } from '~/domain/user/interfaces/user-certificate-domain.interface';

@ObjectType('AgendaWithDocuments')
export class AgendaWithDocumentsDTO implements AgendaWithDocumentsDomainInterface {
  @Field(() => BlockchainDecisionDTO, {
    description: 'Запись в таблице блокчейна о вопросе на голосовании',
  })
  table!: BlockchainDecisionDTO;

  @Field(() => BlockchainActionDTO, {
    description: 'Действие, которое привело к появлению вопроса на голосовании',
  })
  action!: BlockchainActionDTO;

  @Field(() => DocumentPackageAggregateDTO, {
    description: 'Пакет документов, включающий разные подсекции',
  })
  documents!: DocumentPackageAggregateDTO;

  constructor(
    data: AgendaWithDocumentsDomainInterface,
    usernameCertificate?: UserCertificateDomainInterface | null,
    votesForCertificates?: UserCertificateDomainInterface[],
    votesAgainstCertificates?: UserCertificateDomainInterface[],
    councilMembersCount = 0
  ) {
    this.table = new BlockchainDecisionDTO(
      data.table,
      usernameCertificate,
      votesForCertificates,
      votesAgainstCertificates,
      councilMembersCount
    );
    this.action = new BlockchainActionDTO(data.action);
    this.documents = new DocumentPackageAggregateDTO(data.documents);
  }
}
