import { Inject, Injectable } from '@nestjs/common';
import type { IUserDirectoryPort, InnerCoopUser } from '@coopenomics/innercoop';
import { USER_REPOSITORY, type UserRepository } from '~/domain/user/repositories/user.repository';
import { USER_DOMAIN_SERVICE, type UserDomainService } from '~/domain/user/services/user-domain.service';
import { resolveUserBySub } from '~/application/auth/utils/resolve-user-by-sub';

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
    private readonly userDomainService: UserDomainService
  ) {}

  async findByUsername(username: string): Promise<InnerCoopUser | null> {
    return this.userRepository.findByUsername(username);
  }

  async findByRoles(roles: string[]): Promise<InnerCoopUser[]> {
    return this.userRepository.findByRoles(roles);
  }

  async findBySubject(subject: string): Promise<InnerCoopUser> {
    return resolveUserBySub(subject, this.userRepository, this.userDomainService);
  }
}
