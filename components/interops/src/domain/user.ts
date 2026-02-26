/**
 * Порты пользователей
 */

export interface IUserDomain {
  username: string;
  email: string;
  role: string;
  is_active: boolean;
}

export interface IUserRepository {
  findByUsername(username: string): Promise<IUserDomain | null>;
  findAll(filter?: any, options?: any): Promise<{ items: IUserDomain[]; totalCount: number }>;
}

export const USER_REPOSITORY = Symbol('UserRepository');
