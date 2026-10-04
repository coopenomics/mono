/**
 * Заявление пайщика на выход, принятое и подписанное, но ещё не отправленное в
 * цепь: ждёт подтверждения по ссылке из письма. После подтверждения и при
 * отмене запись удаляется. На пайщика кооператива — одно заявление.
 */
export interface MembershipExitRequest {
  id: string;
  coopname: string;
  username: string;
  exit_hash: string;
  /** Подписанный документ заявления, как пришёл с клиента. */
  statement: Record<string, unknown>;
  token: string;
  created_at: Date;
  updated_at: Date;
}

export type MembershipExitRequestCreate = Pick<
  MembershipExitRequest,
  'coopname' | 'username' | 'exit_hash' | 'statement' | 'token'
>;

export interface MembershipExitRequestRepository {
  create(data: MembershipExitRequestCreate): Promise<MembershipExitRequest>;
  findByMember(coopname: string, username: string): Promise<MembershipExitRequest | null>;
  findByToken(token: string): Promise<MembershipExitRequest | null>;
  deleteById(id: string): Promise<void>;
}

export const MEMBERSHIP_EXIT_REQUEST_REPOSITORY = Symbol('MembershipExitRequestRepository');
