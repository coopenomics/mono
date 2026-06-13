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
      meet_place: entity.meet_place ?? undefined,
      meet_at: entity.meet_at ?? undefined,
      branch_name: entity.branch_name ?? undefined,
      branch_email: entity.branch_email ?? undefined,
      branch_phone: entity.branch_phone ?? undefined,
      cancelled: entity.cancelled ?? undefined,
      meet_reminder_sent: entity.meet_reminder_sent ?? undefined,
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
        liability: entity.liability as IKuDecisionBlockchainData['liability'],
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
      liability: domain.liability as object,
      authorization: domain.authorization as object,
      open_at: domain.open_at ? new Date(domain.open_at) : undefined,
      close_at: domain.close_at ? new Date(domain.close_at) : undefined,
      signed_ballots: domain.signed_ballots ?? 0,
      braname: domain.braname as string,
      address: domain.address as string,
      participants: domain.participants ?? [],
      created_at: domain.created_at ? new Date(domain.created_at) : undefined,
      meet_place: domain.meet_place ?? null,
      meet_at: domain.meet_at ?? null,
      branch_name: domain.branch_name ?? null,
      branch_email: domain.branch_email ?? null,
      branch_phone: domain.branch_phone ?? null,
      cancelled: domain.cancelled ?? false,
      meet_reminder_sent: domain.meet_reminder_sent ?? false,
    };
  }

  static toUpdateEntity(domain: Partial<KuDecisionDomainEntity>): Partial<KuDecisionTypeormEntity> {
    const updateData: Partial<KuDecisionTypeormEntity> = {};

    // запись могла быть создана placeholder'ом (upsertPrivateData) до прихода синка —
    // bc-поля первой дельты обязаны материализоваться при обновлении
    if (domain.id !== undefined) updateData.id = domain.id as number;
    if (domain.type !== undefined) updateData.type = domain.type as string;
    if (domain.initiator !== undefined) updateData.initiator = domain.initiator as string;
    if (domain.proposal !== undefined) updateData.proposal = domain.proposal as object;
    if (domain.braname !== undefined) updateData.braname = domain.braname as string;
    if (domain.created_at !== undefined && domain.created_at) updateData.created_at = new Date(domain.created_at);
    if (domain.block_num !== undefined) updateData.block_num = domain.block_num;
    if (domain.present !== undefined) updateData.present = domain.present;
    if (domain.status !== undefined) updateData.status = domain.status;
    if (domain.chairman !== undefined) updateData.chairman = domain.chairman;
    if (domain.protocol !== undefined) updateData.protocol = domain.protocol as object;
    if (domain.petition !== undefined) updateData.petition = domain.petition as object;
    if (domain.liability !== undefined) updateData.liability = domain.liability as object;
    if (domain.authorization !== undefined) updateData.authorization = domain.authorization as object;
    if (domain.open_at !== undefined) updateData.open_at = new Date(domain.open_at);
    if (domain.close_at !== undefined) updateData.close_at = new Date(domain.close_at);
    if (domain.signed_ballots !== undefined) updateData.signed_ballots = domain.signed_ballots;
    if (domain.address !== undefined) updateData.address = domain.address;
    if (domain.participants !== undefined) updateData.participants = domain.participants;
    if (domain.meet_place !== undefined) updateData.meet_place = domain.meet_place;
    if (domain.meet_at !== undefined) updateData.meet_at = domain.meet_at;
    if (domain.branch_name !== undefined) updateData.branch_name = domain.branch_name;
    if (domain.branch_email !== undefined) updateData.branch_email = domain.branch_email;
    if (domain.branch_phone !== undefined) updateData.branch_phone = domain.branch_phone;
    if (domain.cancelled !== undefined) updateData.cancelled = domain.cancelled;
    if (domain.meet_reminder_sent !== undefined) updateData.meet_reminder_sent = domain.meet_reminder_sent;

    return updateData;
  }
}
