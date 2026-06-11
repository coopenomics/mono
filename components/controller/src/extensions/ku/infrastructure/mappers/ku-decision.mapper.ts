import { KuDecisionDomainEntity } from '../../domain/entities/ku-decision.entity';
import type { KuDecisionTypeormEntity } from '../entities/ku-decision.typeorm-entity';
import type {
  IKuDecisionBlockchainData,
  IKuDecisionDatabaseData,
} from '../../domain/interfaces/ku-blockchain-data.interface';

/**
 * Маппер между доменной сущностью решения собрания участка и TypeORM-сущностью
 */
export class KuDecisionMapper {
  static toDomain(entity: KuDecisionTypeormEntity): KuDecisionDomainEntity {
    const databaseData: IKuDecisionDatabaseData = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
    };

    let blockchainData: IKuDecisionBlockchainData | undefined;

    if (entity.hash) {
      blockchainData = {
        id: entity.id,
        hash: entity.hash,
        coopname: entity.coopname,
        type: entity.type,
        initiator: entity.initiator,
        chairman: entity.chairman,
        status: entity.status,
        proposal: entity.proposal as IKuDecisionBlockchainData['proposal'],
        protocol: entity.protocol as IKuDecisionBlockchainData['protocol'],
        petition: entity.petition as IKuDecisionBlockchainData['petition'],
        authorization: entity.authorization as IKuDecisionBlockchainData['authorization'],
        open_at: entity.open_at?.toISOString() ?? '',
        close_at: entity.close_at?.toISOString() ?? '',
        signed_ballots: entity.signed_ballots,
        braname: entity.braname,
        address: entity.address,
        participants: entity.participants ?? [],
        created_at: entity.created_at?.toISOString() ?? '',
      };
    }

    return new KuDecisionDomainEntity(databaseData, blockchainData);
  }

  static toEntity(domain: KuDecisionDomainEntity): Partial<KuDecisionTypeormEntity> {
    return {
      _id: domain._id,
      block_num: domain.block_num ?? 0,
      present: domain.present,
      status: domain.status as string,
      _created_at: domain._created_at,
      _updated_at: domain._updated_at,
      id: domain.id as number,
      hash: domain.hash as string,
      coopname: domain.coopname as string,
      type: domain.type as string,
      initiator: domain.initiator as string,
      chairman: domain.chairman as string,
      proposal: domain.proposal as object,
      protocol: domain.protocol as object,
      petition: domain.petition as object,
      authorization: domain.authorization as object,
      open_at: domain.open_at ? new Date(domain.open_at) : undefined,
      close_at: domain.close_at ? new Date(domain.close_at) : undefined,
      signed_ballots: domain.signed_ballots ?? 0,
      braname: domain.braname as string,
      address: domain.address as string,
      participants: domain.participants ?? [],
      created_at: domain.created_at ? new Date(domain.created_at) : undefined,
    };
  }

  static toUpdateEntity(domain: Partial<KuDecisionDomainEntity>): Partial<KuDecisionTypeormEntity> {
    const updateData: Partial<KuDecisionTypeormEntity> = {};

    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;
    if (domain.status !== undefined) updateData.status = domain.status;
    if (domain.chairman !== undefined) updateData.chairman = domain.chairman;
    if (domain.protocol !== undefined) updateData.protocol = domain.protocol as object;
    if (domain.petition !== undefined) updateData.petition = domain.petition as object;
    if (domain.authorization !== undefined) updateData.authorization = domain.authorization as object;
    if (domain.open_at !== undefined) updateData.open_at = new Date(domain.open_at);
    if (domain.close_at !== undefined) updateData.close_at = new Date(domain.close_at);
    if (domain.signed_ballots !== undefined) updateData.signed_ballots = domain.signed_ballots;
    if (domain.address !== undefined) updateData.address = domain.address;
    if (domain.participants !== undefined) updateData.participants = domain.participants;

    return updateData;
  }
}
