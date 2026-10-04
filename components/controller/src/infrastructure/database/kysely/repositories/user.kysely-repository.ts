import { Inject, Injectable } from '@nestjs/common';
import { sql, type Expression, type ExpressionBuilder, type Selectable, type SqlBool } from 'kysely';
import type { UserRepository } from '~/domain/user/repositories/user.repository';
import { UserDomainEntity } from '~/domain/user/entities/user-domain.entity';
import type {
  CreateUserInputDomainInterface,
  UpdateUserInputDomainInterface,
  UserFilterInputDomainInterface,
} from '~/domain/user/interfaces';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { userStatus } from '~/types/user.types';
import { normalizeUserEmail } from '~/utils/normalize-user-email';
import type { DB, Users } from '../database.types';
import { KYSELY, type Database } from '../kysely.tokens';
import { sortColumn } from '@coopenomics/extension-kit';

/** Колонки, по которым реестр пользователей разрешено сортировать с клиента. */
export const USER_SORT_COLUMNS = ['created_at', 'username', 'email', 'status', 'type', 'role'] as const;

type UserExpression = ExpressionBuilder<DB, 'users'>;
type Condition = Expression<SqlBool>;

/** Адрес сравнивается без учёта регистра и пробелов по краям. */
const emailIs = (email: string) => sql<boolean>`LOWER(TRIM(email)) = ${normalizeUserEmail(email)}`;

/** Адрес хранится нормализованным; пустое значение остаётся как есть. */
const storedEmail = (email: string | null | undefined) =>
  email === null || email === undefined || email === '' ? email : normalizeUserEmail(email);

const EXACT = ['username', 'status', 'type', 'role', 'subscriber_id'] as const;
const FLAGS = ['is_email_verified', 'has_account', 'is_registered'] as const;

/** Условия отбора реестра пользователей. */
function conditions(eb: UserExpression, filter: UserFilterInputDomainInterface): Condition[] {
  const exact = EXACT.filter((column) => filter[column]).map((column) => eb(column, '=', filter[column] as string));
  const flags = FLAGS.filter((column) => filter[column] !== undefined).map((column) =>
    eb(column, '=', filter[column] as boolean)
  );
  return [...exact, ...flags, ...emailAndPeriod(eb, filter), ...usernames(eb, filter)];
}

function emailAndPeriod(eb: UserExpression, filter: UserFilterInputDomainInterface): Condition[] {
  const result: Condition[] = [];
  if (filter.email) result.push(emailIs(filter.email));
  if (filter.created_from) result.push(eb('created_at', '>=', filter.created_from));
  if (filter.created_to) result.push(eb('created_at', '<=', filter.created_to));
  return result;
}

function usernames(eb: UserExpression, filter: UserFilterInputDomainInterface): Condition[] {
  if (!filter.usernames) return [];
  // Пустой отбор — пустой результат, а не «все».
  return [filter.usernames.length === 0 ? sql<boolean>`1 = 0` : eb('username', 'in', filter.usernames)];
}

const UPDATABLE = [
  'username',
  'status',
  'message',
  'is_registered',
  'has_account',
  'type',
  'public_key',
  'referer',
  'role',
  'is_email_verified',
  'subscriber_id',
  'subscriber_hash',
] as const;

/** Правятся только переданные поля. */
function changes(updates: UpdateUserInputDomainInterface): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const column of UPDATABLE) {
    if (updates[column] !== undefined) set[column] = updates[column];
  }
  if (updates.email !== undefined) set.email = storedEmail(updates.email);
  return set;
}

/** Значения новой учётной записи, если вызывающий их не задал. */
const NEW_USER_DEFAULTS = {
  status: userStatus['1_Created'] as string,
  message: '',
  is_registered: false,
  has_account: false,
  public_key: '',
  referer: '',
  role: 'user',
  is_email_verified: false,
  subscriber_id: '',
  subscriber_hash: '',
};

const CREATABLE = [...Object.keys(NEW_USER_DEFAULTS), 'username', 'type'] as Array<keyof CreateUserInputDomainInterface>;

/** Заданные поля новой учётной записи; пустое значение уступает умолчанию. */
function given(userData: CreateUserInputDomainInterface): { username: string; type: string } & Record<string, unknown> {
  const entries = CREATABLE.filter((column) => userData[column]).map((column) => [column, userData[column]]);
  return { username: userData.username, type: userData.type, ...Object.fromEntries(entries) };
}

type Direction = 'asc' | 'desc';

/** Сортировка реестра: поле приходит от клиента как «поле:направление». */
function userOrder(sortBy: string | undefined): { field: 'joined_at' | (typeof USER_SORT_COLUMNS)[number]; order: Direction } {
  const [field, direction] = (sortBy ?? '').split(':');
  const order: Direction = direction === 'asc' ? 'asc' : 'desc';
  if (field === 'joined_at') return { field, order };
  const known = USER_SORT_COLUMNS.includes(field as (typeof USER_SORT_COLUMNS)[number]);
  return known ? { field: sortColumn(USER_SORT_COLUMNS, field, 'created_at'), order } : { field: 'created_at', order: 'desc' };
}

function toDomain(row: Selectable<Users>): UserDomainEntity {
  return new UserDomainEntity(
    row.id,
    row.username,
    row.status as any,
    row.message,
    row.is_registered,
    row.has_account,
    row.type as 'individual' | 'entrepreneur' | 'organization',
    row.public_key,
    row.referer,
    row.email as string,
    row.role,
    row.is_email_verified,
    row.subscriber_id,
    row.subscriber_hash,
    row.legacy_mongo_id ?? undefined,
    row.created_at,
    row.updated_at
  );
}

/** Учётные записи пайщиков узла (таблица `users`). */
@Injectable()
export class UserKyselyRepository implements UserRepository {
  constructor(@Inject(KYSELY) private readonly db: Database) {}

  async create(userData: CreateUserInputDomainInterface): Promise<UserDomainEntity> {
    const row = await this.db
      .insertInto('users')
      .values({ ...NEW_USER_DEFAULTS, ...given(userData), email: storedEmail(userData.email) ?? null })
      .returningAll()
      .executeTakeFirstOrThrow();
    return toDomain(row);
  }

  async findById(id: string): Promise<UserDomainEntity | null> {
    return this.findOne((eb) => eb('id', '=', id));
  }

  async findByUsername(username: string): Promise<UserDomainEntity | null> {
    return this.findOne((eb) => eb('username', '=', username));
  }

  async findByEmail(email: string): Promise<UserDomainEntity | null> {
    return this.findOne(() => emailIs(email));
  }

  async findBySubscriberId(subscriberId: string): Promise<UserDomainEntity | null> {
    return this.findOne((eb) => eb('subscriber_id', '=', subscriberId));
  }

  async findByLegacyMongoId(legacyMongoId: string): Promise<UserDomainEntity | null> {
    return this.findOne((eb) => eb('legacy_mongo_id', '=', legacyMongoId));
  }

  async isEmailTaken(email: string, excludeUsername?: string): Promise<boolean> {
    let query = this.db.selectFrom('users').select('id').where(emailIs(email));
    if (excludeUsername) query = query.where('username', '!=', excludeUsername);
    return !!(await query.limit(1).executeTakeFirst());
  }

  /**
   * Правка может переименовать пользователя (повторная регистрация со старым
   * незавершённым аккаунтом даёт новое имя) — возвращается строка после правки.
   */
  async updateByUsername(username: string, updates: UpdateUserInputDomainInterface): Promise<UserDomainEntity | null> {
    return this.updateWhere((eb) => eb('username', '=', username), updates);
  }

  async updateById(id: string, updates: UpdateUserInputDomainInterface): Promise<UserDomainEntity | null> {
    return this.updateWhere((eb) => eb('id', '=', id), updates);
  }

  async deleteByUsername(username: string): Promise<boolean> {
    const rows = await this.db.deleteFrom('users').where('username', '=', username).returningAll().execute();
    return rows.length > 0;
  }

  async deleteById(id: string): Promise<boolean> {
    const rows = await this.db.deleteFrom('users').where('id', '=', id).returningAll().execute();
    return rows.length > 0;
  }

  async findAllPaginated(
    filter?: UserFilterInputDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<UserDomainEntity>> {
    const query = this.db.selectFrom('users').where((eb) => eb.and(conditions(eb, filter ?? {})));
    const page = options?.page || 1;
    const limit = options?.limit || 10;

    const { field, order } = userOrder(options?.sortBy);
    // Ещё не принятые (даты нет) — самые свежие заявки: при «сначала новые»
    // они сверху, при «сначала старые» внизу. Внутри — по дате регистрации.
    const sorted =
      field === 'joined_at'
        ? query
            .selectAll()
            .orderBy('joined_at', (ob) => (order === 'desc' ? ob.desc().nullsFirst() : ob.asc().nullsLast()))
            .orderBy('created_at', order)
        : query.selectAll().orderBy(field, order);

    const rows = await sorted
      .offset((page - 1) * limit)
      .limit(limit)
      .execute();
    const total = await query.select((eb) => eb.fn.countAll<string>().as('count')).executeTakeFirstOrThrow();
    const totalCount = Number(total.count);

    return {
      items: rows.map(toDomain),
      currentPage: page,
      totalPages: Math.ceil(totalCount / limit),
      totalCount,
    };
  }

  async setJoinedAt(username: string, joinedAt: Date): Promise<void> {
    await this.db
      .updateTable('users')
      .set({ joined_at: joinedAt })
      .where('username', '=', username)
      .where('joined_at', 'is', null)
      .execute();
  }

  async findUsernamesWithoutJoinedAt(): Promise<string[]> {
    const rows = await this.db.selectFrom('users').select('username').where('joined_at', 'is', null).execute();
    return rows.map((row) => row.username);
  }

  async findUsernames(filter?: Pick<UserFilterInputDomainInterface, 'role'>): Promise<string[]> {
    let query = this.db.selectFrom('users').select('username');
    if (filter?.role) query = query.where('role', '=', filter.role);
    const rows = await query.execute();
    return rows.map((row) => row.username);
  }

  /** Пользователи без идентификатора подписчика — для досинхронизации уведомлений. */
  async findUsersWithoutSubscriberId(limit = 100): Promise<UserDomainEntity[]> {
    const rows = await this.db
      .selectFrom('users')
      .selectAll()
      .where((eb) => eb.or([eb('subscriber_id', 'is', null), eb('subscriber_id', '=', '')]))
      .orderBy('created_at', 'asc')
      .limit(limit)
      .execute();
    return rows.map(toDomain);
  }

  async findByRoles(roles: string[]): Promise<UserDomainEntity[]> {
    if (roles.length === 0) return [];
    const rows = await this.db.selectFrom('users').selectAll().where('role', 'in', roles).orderBy('created_at', 'desc').execute();
    return rows.map(toDomain);
  }

  private async findOne(where: (eb: UserExpression) => Condition): Promise<UserDomainEntity | null> {
    const row = await this.db.selectFrom('users').selectAll().where(where).limit(1).executeTakeFirst();
    return row ? toDomain(row) : null;
  }

  private async updateWhere(
    where: (eb: UserExpression) => Condition,
    updates: UpdateUserInputDomainInterface
  ): Promise<UserDomainEntity | null> {
    const row = await this.db
      .updateTable('users')
      .set({ ...changes(updates), updated_at: sql`now()` })
      .where(where)
      .returningAll()
      .executeTakeFirst();
    return row ? toDomain(row) : null;
  }
}
