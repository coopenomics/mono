import type { RobotKeyDomainEntity } from '../entities/robot-key.entity';

export const ROBOT_KEY_REPOSITORY = Symbol('RobotKeyRepository');

export type RobotKeyUpsert = Pick<RobotKeyDomainEntity, 'coopname' | 'member' | 'permission_name' | 'encrypted_wif' | 'public_key'>;

export interface RobotKeyRepository {
  findByMember(coopname: string, member: string): Promise<RobotKeyDomainEntity | null>;
  findAll(coopname: string): Promise<RobotKeyDomainEntity[]>;
  upsert(data: RobotKeyUpsert): Promise<RobotKeyDomainEntity>;
  deleteByMember(coopname: string, member: string): Promise<boolean>;
}
