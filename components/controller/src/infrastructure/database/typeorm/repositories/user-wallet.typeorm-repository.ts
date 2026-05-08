import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserWalletDomainEntity } from '~/domain/wallet/entities/user-wallet-domain.entity';
import { UserWalletTypeormEntity } from '../entities/user-wallet.typeorm-entity';
import { UserWalletMapper } from '../mappers/user-wallet.mapper';
import type { UserWalletRepository } from '~/domain/wallet/repositories/user-wallet.repository';
import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseBlockchainRepository } from '~/shared/sync/repositories/base-blockchain.repository';
import { EntityVersioningService } from '~/shared/sync/services/entity-versioning.service';
import type { IUserWalletBlockchainData } from '~/domain/wallet/interfaces/user-wallet-blockchain.interface';
import type { IUserWalletDatabaseData } from '~/domain/wallet/interfaces/user-wallet-database.interface';

@Injectable()
export class UserWalletTypeormRepository
  extends BaseBlockchainRepository<UserWalletDomainEntity, UserWalletTypeormEntity>
  implements UserWalletRepository, IBlockchainSyncRepository<UserWalletDomainEntity>
{
  constructor(
    @InjectRepository(UserWalletTypeormEntity)
    repository: Repository<UserWalletTypeormEntity>,
    entityVersioningService: EntityVersioningService
  ) {
    super(repository, entityVersioningService);
  }

  protected getMapper() {
    return {
      toDomain: UserWalletMapper.toDomain,
      toEntity: UserWalletMapper.toEntity,
    };
  }

  protected createDomainEntity(
    databaseData: IUserWalletDatabaseData,
    blockchainData: IUserWalletBlockchainData
  ): UserWalletDomainEntity {
    return new UserWalletDomainEntity(databaseData, blockchainData);
  }

  protected getSyncKey(): string {
    return UserWalletDomainEntity.getSyncKey();
  }

  async findByWalletAndUsername(
    coopname: string,
    wallet_name: string,
    username: string
  ): Promise<UserWalletDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { coopname, wallet_name, username },
    });
    return entity ? UserWalletMapper.toDomain(entity) : null;
  }

  async findByUsername(coopname: string, username: string): Promise<UserWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname, username },
      order: { wallet_name: 'ASC' },
    });
    return entities.map(UserWalletMapper.toDomain);
  }

  async findByWallet(coopname: string, wallet_name: string): Promise<UserWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname, wallet_name },
      order: { username: 'ASC' },
    });
    return entities.map(UserWalletMapper.toDomain);
  }

  async findByCoopname(coopname: string): Promise<UserWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname },
      order: { wallet_name: 'ASC', username: 'ASC' },
    });
    return entities.map(UserWalletMapper.toDomain);
  }
}
