import { Inject, Injectable } from '@nestjs/common';
import type { IUserDirectoryPort, InnerCoopUser } from '@coopenomics/innercoop';
import { USER_REPOSITORY, type UserRepository } from '~/domain/user/repositories/user.repository';
import { USER_DOMAIN_SERVICE, type UserDomainService } from '~/domain/user/services/user-domain.service';
import { resolveUserBySub } from '~/application/auth/utils/resolve-user-by-sub';
import { AuthentikAdminAdapter } from '~/infrastructure/auth-v2/authentik-admin.adapter';

const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;

/**
 * Реализация `IUserDirectoryPort` поверх репозитория пользователей ядра.
 *
 * Наружу отданы только две выборки. Заводить, менять и удалять пользователей
 * расширение не может — это делает поток вступления в кооператив.
 */
@Injectable()
export class UserDirectoryInnercoopAdapter implements IUserDirectoryPort {
  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepository: UserRepository,
    @Inject(USER_DOMAIN_SERVICE)
    private readonly userDomainService: UserDomainService,
    private readonly authentikAdmin: AuthentikAdminAdapter
  ) {}

  async findByUsername(username: string): Promise<InnerCoopUser | null> {
    return this.userRepository.findByUsername(username);
  }

  async findByRoles(roles: string[]): Promise<InnerCoopUser[]> {
    return this.userRepository.findByRoles(roles);
  }

  /**
   * Пользователь по идентификатору из токена — своему либо из CoopID.
   *
   * Свой `sub` (id ядра или прежний идентификатор Mongo) разбирается как раньше. Если так
   * никого нет, а идентификатор похож на uuid, это учётка authentik: сеть карт присылает в
   * уведомлении `sub` пайщика из CoopID, а uuid учётки и id пользователя ядра — разные
   * числа, миграция их не выравнивает. Тогда пайщик находится через authentik по имени
   * учётки (стенд 02.09.2026: «Пользователь с указанным JWT не найден», свидетельство не
   * выпускалось).
   */
  async findBySubject(subject: string): Promise<InnerCoopUser> {
    try {
      return await resolveUserBySub(subject, this.userRepository, this.userDomainService);
    } catch (error) {
      if (!UUID.test(subject)) throw error;
      const username = await this.authentikAdmin.findUsernameByUuid(subject);
      const user = username ? await this.userRepository.findByUsername(username) : null;
      if (!user) throw error;
      return user;
    }
  }
}
