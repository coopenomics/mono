import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { CurrentUser } from '~/application/auth/decorators/current-user.decorator';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import { ShareService } from '~/infrastructure/share/share.service';
import { ShareLinkDTO, CreateShareLinkInputDTO } from '../dto/share.dto';
import { config } from '~/config';

@Resolver()
export class ShareResolver {
  constructor(private readonly shareService: ShareService) {}

  @Mutation(() => ShareLinkDTO, {
    name: 'createShareLink',
    description: 'Создать ссылку доступа к странице',
  })
  @UseGuards(GqlJwtAuthGuard)
  async createShareLink(
    @Args('data') data: CreateShareLinkInputDTO,
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<ShareLinkDTO> {
    return this.shareService.createShareLink({
      coopname: config.coopname,
      createdBy: user.username,
      pagePath: data.pagePath,
      pageName: data.pageName,
      targetType: data.targetType,
      targetUsername: data.targetUsername,
      linkName: data.linkName,
      allowedActions: data.allowedActions,
      expiresInDays: data.expiresInDays,
    }) as any;
  }

  @Mutation(() => Boolean, {
    name: 'revokeShareLink',
    description: 'Отозвать ссылку доступа',
  })
  @UseGuards(GqlJwtAuthGuard)
  async revokeShareLink(
    @Args('id') id: string,
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<boolean> {
    await this.shareService.revokeShareLink(id, user.username);
    return true;
  }

  @Query(() => [ShareLinkDTO], {
    name: 'getMyShareLinks',
    description: 'Получить созданные мной ссылки доступа',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getMyShareLinks(
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<ShareLinkDTO[]> {
    return this.shareService.getShareLinks(config.coopname, user.username) as any;
  }

  @Query(() => [ShareLinkDTO], {
    name: 'getSharedWithMe',
    description: 'Получить страницы, к которым мне предоставлен доступ',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getSharedWithMe(
    @CurrentUser() user: MonoAccountDomainInterface,
  ): Promise<ShareLinkDTO[]> {
    return this.shareService.getSharedWithMe(config.coopname, user.username) as any;
  }
}
