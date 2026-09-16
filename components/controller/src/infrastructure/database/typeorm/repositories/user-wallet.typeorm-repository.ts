import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserWalletDomainEntity } from '~/domain/wallet/entities/user-wallet-domain.entity';
import { UserWalletTypeormEntity } from '../entities/user-wallet.typeorm-entity';
import { UserWalletMapper } from '../mappers/user-wallet.mapper';
import type { UserWalletRepository } from '~/domain/wallet/repositories/user-wallet.repository';
import type { IBlockchainSyncRepository } from '@coopenomics/extension-kit/sync';
import { BaseBlockchainRepository, EntityVersioningService } from '@coopenomics/extension-kit/sync';
import type { IUserWalletBlockchainData } from '~/domain/wallet/interfaces/user-wallet-blockchain.interface';
import type { IUserWalletDatabaseData } from '~/domain/wallet/interfaces/user-wallet-database.interface';

/**
 * Репозиторий L3 кошельков (`ledger2::userwallets`).
 *
 * Контракт стирает строку кошелька, когда баланс доходит до нуля, а копия в
 * базе остаётся с `present = false` и последним ненулевым остатком — она
 * нужна версионированию и откату форков. Для прикладного кода такой строки
 * нет: пайщик без записи в цепи держит на кошельке ноль. Поэтому все
 * прикладные выборки отдают только живые строки (`present = true`);
 * отсутствие строки читатели трактуют как нулевой остаток.
 *
 * Прецедент 14.09.2026: планировщик оформления прочитал надгробие членского
 * кошелька с 81 RUB, недосчитал заявление о переводе ровно на эту сумму, и
 * контракт отказал в заказе «требуется 600, доступно 519».
 */
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
      where: { coopname, wallet_name, username, present: true },
    });
    return entity ? UserWalletMapper.toDomain(entity) : null;
  }

  async findByUsername(coopname: string, username: string): Promise<UserWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname, username, present: true },
      order: { wallet_name: 'ASC' },
    });
    return entities.map(UserWalletMapper.toDomain);
  }

  async findByWallet(coopname: string, wallet_name: string): Promise<UserWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname, wallet_name, present: true },
      order: { username: 'ASC' },
    });
    return entities.map(UserWalletMapper.toDomain);
  }

  async findByCoopname(coopname: string): Promise<UserWalletDomainEntity[]> {
    const entities = await this.repository.find({
      where: { coopname, present: true },
      order: { wallet_name: 'ASC', username: 'ASC' },
    });
    return entities.map(UserWalletMapper.toDomain);
  }
}
