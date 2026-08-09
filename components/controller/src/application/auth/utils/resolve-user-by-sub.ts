import { UserRepository } from '~/domain/user/repositories/user.repository';
import { UserDomainService } from '~/domain/user/services/user-domain.service';

/**
 * Резолвит пользователя по `sub` из JWT — единый источник для passport-стратегии
 * (HTTP) и резолвера подписки (WebSocket). `sub` может быть legacy Mongo ObjectId
 * (24 hex) либо UUID; формат определяет, в какой источник идти.
 */
export async function resolveUserBySub(
  sub: string,
  userRepository: UserRepository,
  userDomainService: UserDomainService
) {
  if (isLegacyMongoId(sub)) {
    return userDomainService.getUserByLegacyMongoId(sub);
  }
  if (isValidUuid(sub)) {
    const user = await userRepository.findById(sub);
    if (!user) {
      throw new Error('Пользователь с указанным JWT не найден');
    }
    return user;
  }
  throw new Error('Неверный формат ID пользователя в JWT токене');
}

function isLegacyMongoId(id: string): boolean {
  return /^[a-f\d]{24}$/i.test(id);
}

function isValidUuid(id: string): boolean {
  const uuidWithDashes = /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i;
  const uuidWithoutDashes = /^[a-f\d]{32}$/i;
  return uuidWithDashes.test(id) || uuidWithoutDashes.test(id);
}
