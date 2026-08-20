import { ForbiddenException, UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { VerificationOnsiteService } from './verification-onsite.service';
import {
  ParticipantVerificationDTO,
  UnverifyParticipantInputDTO,
  VerifyParticipantOnsiteInputDTO,
} from './dto/verification.dto';

interface ICurrentUser {
  id: string;
  username: string;
  role: string;
}

/** Роль председателя совета — она даёт право распоряжаться верификациями. */
const CHAIRMAN_ROLE = 'chairman';

/**
 * GraphQL-фасад верификации личности пайщика.
 *
 * Верифицировать вправе кооперативный участок (председатель участка или его
 * доверенное лицо — тогда указан участок) либо совет кооператива (тогда участок
 * не указан); отзывать — председатель совета. Транзакцию подписывает кооператив:
 * личные ключи пайщиков хранятся у них самих. Поэтому полномочия участка
 * остаются на контракте (`registrator::verifyacc` сверяет таблицу участка),
 * а полномочия совета проверяются здесь — контракт кооперативу доверяет.
 *
 * Гард ролей (`RolesGuard`) для этого не годится: он пропускает запрос, когда
 * `data.username` совпадает с текущим пайщиком, и любой смог бы верифицировать
 * сам себя.
 */
@Resolver()
export class VerificationResolver {
  constructor(private readonly verificationOnsiteService: VerificationOnsiteService) {}

  @Mutation(() => [ParticipantVerificationDTO], {
    name: 'verifyParticipantOnsite',
    description: 'Подтвердить личность пайщика по паспорту при личной явке',
  })
  @UseGuards(GqlJwtAuthGuard)
  async verifyParticipantOnsite(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: VerifyParticipantOnsiteInputDTO,
  ): Promise<ParticipantVerificationDTO[]> {
    if (!data.braname) this.assertChairman(user, 'Подтверждать личность от имени совета вправе председатель совета');
    return this.verificationOnsiteService.verifyOnsite(user.username, data.username, data.braname);
  }

  @Mutation(() => [ParticipantVerificationDTO], {
    name: 'unverifyParticipant',
    description: 'Отозвать верификацию личности пайщика',
  })
  @UseGuards(GqlJwtAuthGuard)
  async unverifyParticipant(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: UnverifyParticipantInputDTO,
  ): Promise<ParticipantVerificationDTO[]> {
    this.assertChairman(user, 'Отзывать верификацию личности вправе председатель совета');
    return this.verificationOnsiteService.unverify(user.username, data.username);
  }

  private assertChairman(user: ICurrentUser, message: string): void {
    if (user.role !== CHAIRMAN_ROLE) throw new ForbiddenException(message);
  }
}
