import { UserWalletDomainEntity } from '~/domain/wallet/entities/user-wallet-domain.entity';
import { UserWalletTypeormEntity } from '../entities/user-wallet.typeorm-entity';
import type { IUserWalletDatabaseData } from '~/domain/wallet/interfaces/user-wallet-database.interface';
import type { IUserWalletBlockchainData } from '~/domain/wallet/interfaces/user-wallet-blockchain.interface';

export class UserWalletMapper {
  static toDomain(entity: UserWalletTypeormEntity): UserWalletDomainEntity {
    const databaseData: IUserWalletDatabaseData = {
      _id: entity._id,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      block_num: entity.block_num,
      present: entity.present,
    };

    const blockchainData: IUserWalletBlockchainData = {
      id: entity.id,
      coopname: entity.coopname,
      wallet_name: entity.wallet_name,
      username: entity.username,
      available: entity.available,
      blocked: entity.blocked,
    };

    return new UserWalletDomainEntity(databaseData, blockchainData);
  }

  static toEntity(domain: UserWalletDomainEntity): UserWalletTypeormEntity {
    const entity = new UserWalletTypeormEntity();

    entity._id = (domain as any)._id;
    entity._created_at = (domain as any)._created_at || new Date();
    entity._updated_at = new Date();
    entity.block_num = domain.getBlockNum() || 0;
    entity.present = (domain as any).present !== false;

    entity.id = domain.id as string;
    entity.coopname = domain.coopname as string;
    entity.wallet_name = domain.wallet_name as string;
    entity.username = domain.username as string;
    entity.available = (domain.available ?? '0') as string;
    entity.blocked = (domain.blocked ?? '0') as string;

    return entity;
  }
}
