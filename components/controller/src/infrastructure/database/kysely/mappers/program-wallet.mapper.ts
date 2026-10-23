import { ProgramWalletDomainEntity } from '~/domain/wallet/entities/program-wallet-domain.entity';
import { ProgramWalletRecord } from '../records/program-wallet.record';
import type { IProgramWalletDatabaseData } from '~/domain/wallet/interfaces/program-wallet-database.interface';
import type { IProgramWalletBlockchainData } from '~/domain/wallet/interfaces/program-wallet-blockchain.interface';

/**
 * Маппер для преобразования между TypeORM entity и Domain entity программных кошельков
 */
export class ProgramWalletMapper {
  /**
   * Преобразование из TypeORM entity в Domain entity
   */
  static toDomain(typeormEntity: ProgramWalletRecord): ProgramWalletDomainEntity {
    const databaseData: IProgramWalletDatabaseData = {
      _id: typeormEntity._id,
      _created_at: typeormEntity._created_at,
      _updated_at: typeormEntity._updated_at,
      block_num: typeormEntity.block_num,
      present: typeormEntity.present,
    };

    const blockchainData: IProgramWalletBlockchainData = {
      id: typeormEntity.id,
      coopname: typeormEntity.coopname,
      program_id: typeormEntity.program_id,
      agreement_id: typeormEntity.agreement_id,
      username: typeormEntity.username,
      available: typeormEntity.available,
      blocked: typeormEntity.blocked,
      membership_contribution: typeormEntity.membership_contribution,
    };

    // Создаем entity через конструктор, который вызовет super()
    return new ProgramWalletDomainEntity(databaseData, blockchainData);
  }

  /**
   * Преобразование из Domain entity в TypeORM entity
   */
  static toEntity(domainEntity: ProgramWalletDomainEntity): ProgramWalletRecord {
    const typeormEntity = new ProgramWalletRecord();

    // Копируем базовые поля
    typeormEntity._id = (domainEntity as any)._id;
    typeormEntity._created_at = (domainEntity as any)._created_at || new Date();
    typeormEntity._updated_at = new Date();
    typeormEntity.block_num = domainEntity.getBlockNum() || 0;
    typeormEntity.present = (domainEntity as any).present !== false;

    // Копируем специфичные поля программного кошелька
    typeormEntity.id = domainEntity.id as string;
    typeormEntity.coopname = domainEntity.coopname as string;
    typeormEntity.program_id = domainEntity.program_id as string;
    typeormEntity.agreement_id = domainEntity.agreement_id as string;
    typeormEntity.username = domainEntity.username as string;
    typeormEntity.available = (domainEntity.available ?? '0') as string;
    typeormEntity.blocked = (domainEntity.blocked ?? '0') as string;
    typeormEntity.membership_contribution = (domainEntity.membership_contribution ?? '0') as string;

    return typeormEntity;
  }
}
