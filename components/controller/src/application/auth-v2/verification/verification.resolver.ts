import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { CurrentUser, GqlJwtAuthGuard } from '@coopenomics/extension-kit';
import { VerificationOnsiteService } from './verification-onsite.service';
import { VerificationIdentityService } from './verification-identity.service';
import { VerificationAuthorityService } from './verification-authority.service';
import { VerificationReviewService } from './verification-review.service';
import type { VerificationReview } from '~/domain/auth-v2/verification/verification-review.types';
import {
  ApproveVerificationInputDTO,
  ParticipantIdentityForVerificationDTO,
  ParticipantIdentityForVerificationInputDTO,
  ParticipantVerificationDTO,
  RejectVerificationInputDTO,
  UnverifyParticipantInputDTO,
  VerificationReviewDTO,
  VerificationReviewPhotoDTO,
  VerificationReviewPhotosInputDTO,
  VerificationReviewsInputDTO,
  VerifyParticipantOnsiteInputDTO,
} from './dto/verification.dto';

/** Наружу отдаём число снимков, а не их ключи: ссылки выдаёт отдельный запрос. */
function toReviewDTO(review: VerificationReview): VerificationReviewDTO {
  const { photos, ...rest } = review;
  return { ...rest, photos_count: photos.length };
}

interface ICurrentUser {
  id: string;
  username: string;
  role: string;
}

/**
 * GraphQL-фасад верификации личности пайщика.
 *
 * Сверять личность вправе кооперативный участок (председатель участка или его
 * доверенное лицо — тогда указан участок) либо совет кооператива (тогда участок
 * не указан); отзывать — председатель совета. Транзакцию подписывает кооператив:
 * личные ключи пайщиков хранятся у них самих, поэтому полномочия проверяет
 * сервер (`VerificationAuthorityService`), а на участке их дополнительно
 * подтверждает контракт по таблице участка.
 */
@Resolver()
export class VerificationResolver {
  constructor(
    private readonly verificationOnsiteService: VerificationOnsiteService,
    private readonly verificationIdentityService: VerificationIdentityService,
    private readonly verificationAuthorityService: VerificationAuthorityService,
    private readonly verificationReviewService: VerificationReviewService,
  ) {}

  @Query(() => ParticipantIdentityForVerificationDTO, {
    name: 'participantIdentityForVerification',
    description: 'Данные пайщика для сверки с документом; выдаются, пока личность не подтверждена',
  })
  @UseGuards(GqlJwtAuthGuard)
  async participantIdentityForVerification(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: ParticipantIdentityForVerificationInputDTO,
  ): Promise<ParticipantIdentityForVerificationDTO> {
    return this.verificationIdentityService.getForVerification(
      { username: user.username, role: user.role, braname: data.braname },
      data.username,
    );
  }

  @Mutation(() => [ParticipantVerificationDTO], {
    name: 'verifyParticipantOnsite',
    description: 'Подтвердить личность пайщика по паспорту при личной явке',
  })
  @UseGuards(GqlJwtAuthGuard)
  async verifyParticipantOnsite(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: VerifyParticipantOnsiteInputDTO,
  ): Promise<ParticipantVerificationDTO[]> {
    const actor = { username: user.username, role: user.role, braname: data.braname };
    await this.verificationAuthorityService.assertMayVerify(actor);
    return this.verificationOnsiteService.verifyOnsite({
      actor,
      username: data.username,
      braname: data.braname,
      photos: data.photos,
    });
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
    this.verificationAuthorityService.assertMayUnverify({ username: user.username, role: user.role });
    return this.verificationOnsiteService.unverify(user.username, data.username);
  }

  @Query(() => [VerificationReviewDTO], {
    name: 'verificationReviews',
    description: 'Журнал верификаций личности: кто, где и когда сверял и чем это закончилось',
  })
  @UseGuards(GqlJwtAuthGuard)
  async verificationReviews(
    @CurrentUser() user: ICurrentUser,
    @Args('data', { nullable: true }) data?: VerificationReviewsInputDTO,
  ): Promise<VerificationReviewDTO[]> {
    const reviews = await this.verificationReviewService.list(
      { username: user.username, role: user.role },
      data ?? {},
    );
    return reviews.map(toReviewDTO);
  }

  @Query(() => [VerificationReviewPhotoDTO], {
    name: 'verificationReviewPhotos',
    description: 'Снимки сверки для проверки советом; доступны, пока решение не принято',
  })
  @UseGuards(GqlJwtAuthGuard)
  async verificationReviewPhotos(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: VerificationReviewPhotosInputDTO,
  ): Promise<VerificationReviewPhotoDTO[]> {
    return this.verificationReviewService.photoLinks(
      { username: user.username, role: user.role },
      data.review_id,
    );
  }

  @Mutation(() => VerificationReviewDTO, {
    name: 'approveVerification',
    description: 'Совет подтвердил сверку личности; снимки удаляются',
  })
  @UseGuards(GqlJwtAuthGuard)
  async approveVerification(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: ApproveVerificationInputDTO,
  ): Promise<VerificationReviewDTO> {
    const review = await this.verificationReviewService.approve(
      { username: user.username, role: user.role },
      data.review_id,
    );
    return toReviewDTO(review);
  }

  @Mutation(() => VerificationReviewDTO, {
    name: 'rejectVerification',
    description: 'Совет отклонил сверку личности; верификация отзывается, и выдача снова закрыта',
  })
  @UseGuards(GqlJwtAuthGuard)
  async rejectVerification(
    @CurrentUser() user: ICurrentUser,
    @Args('data') data: RejectVerificationInputDTO,
  ): Promise<VerificationReviewDTO> {
    const review = await this.verificationReviewService.reject(
      { username: user.username, role: user.role },
      data.review_id,
      data.reason,
    );
    return toReviewDTO(review);
  }
}
