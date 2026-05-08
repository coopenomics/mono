import type { IBlockchainSyncRepository } from '~/shared/interfaces/blockchain-sync.interface';
import type { UserAgreementDomainEntity } from '../entities/user-agreement-domain.entity';

/**
 * Репозиторий owner'ов программных соглашений (`wallet::users`).
 *
 * Записи синхронизируются один-в-один с состоянием контракта: одна строка
 * на (coopname, username) с массивом `programs[]`.
 */
export interface UserAgreementRepository extends IBlockchainSyncRepository<UserAgreementDomainEntity> {
  /** Найти все программные соглашения пайщика в кооперативе. */
  findByUsername(coopname: string, username: string): Promise<UserAgreementDomainEntity | null>;

  /** Найти всех пайщиков кооператива с подписанными программами. */
  findByCoopname(coopname: string): Promise<UserAgreementDomainEntity[]>;

  /** Найти всех пайщиков, подписавших конкретную программу. */
  findByProgramId(coopname: string, program_id: number): Promise<UserAgreementDomainEntity[]>;
}

export const USER_AGREEMENT_REPOSITORY = Symbol('USER_AGREEMENT_REPOSITORY');
