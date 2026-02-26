import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards, Inject } from '@nestjs/common';
import { GqlJwtAuthGuard } from '~/application/auth/guards/graphql-jwt-auth.guard';
import { RolesGuard } from '~/application/auth/guards/roles.guard';
import { AuthRoles } from '~/application/auth/decorators/auth.decorator';
import { config } from '~/config';
import { UpdateMarketplaceSettingsInputDTO, MarketplaceSettingsDTO } from '../dto/marketplace-settings.dto';
import { MARKETPLACE_SETTINGS_REPOSITORY, type MarketplaceSettingsRepository } from '../../domain/repositories/marketplace-settings.repository';

@Resolver(() => MarketplaceSettingsDTO)
export class MarketplaceSettingsResolver {
  constructor(
    @Inject(MARKETPLACE_SETTINGS_REPOSITORY)
    private readonly settingsRepo: MarketplaceSettingsRepository,
  ) {}

  @Query(() => MarketplaceSettingsDTO, {
    name: 'getMarketplaceSettings',
    description: 'Получить настройки маркетплейса',
  })
  @UseGuards(GqlJwtAuthGuard)
  async getMarketplaceSettings(): Promise<MarketplaceSettingsDTO> {
    const settings = await this.settingsRepo.findByCoopname(config.coopname);
    if (settings) return settings as unknown as MarketplaceSettingsDTO;

    return (await this.settingsRepo.upsert({
      coopname: config.coopname,
      lead_request_policy: 'both' as any,
      publish_access_policy: 'all_members' as any,
      publish_whitelist: [],
      moderation_required: true,
      cycles_enabled: true,
      max_cycle_days: 30,
      external_delivery_enabled: true,
      internal_delivery_enabled: true,
      allowed_category_ids: [],
    })) as unknown as MarketplaceSettingsDTO;
  }

  @Mutation(() => MarketplaceSettingsDTO, {
    name: 'updateMarketplaceSettings',
    description: 'Обновить настройки маркетплейса (только chairman)',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async updateMarketplaceSettings(
    @Args('data') data: UpdateMarketplaceSettingsInputDTO,
  ): Promise<MarketplaceSettingsDTO> {
    return (await this.settingsRepo.upsert({
      coopname: config.coopname,
      ...data,
    })) as unknown as MarketplaceSettingsDTO;
  }

  @Mutation(() => Boolean, {
    name: 'addToPublishWhitelist',
    description: 'Добавить пайщика в белый список публикации',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async addToPublishWhitelist(
    @Args('username', { type: () => String }) username: string,
  ): Promise<boolean> {
    const settings = await this.settingsRepo.findByCoopname(config.coopname);
    if (!settings) return false;
    if (settings.publish_whitelist.includes(username)) return true;
    await this.settingsRepo.upsert({
      coopname: config.coopname,
      publish_whitelist: [...settings.publish_whitelist, username],
    });
    return true;
  }

  @Mutation(() => Boolean, {
    name: 'removeFromPublishWhitelist',
    description: 'Удалить пайщика из белого списка публикации',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman'])
  async removeFromPublishWhitelist(
    @Args('username', { type: () => String }) username: string,
  ): Promise<boolean> {
    const settings = await this.settingsRepo.findByCoopname(config.coopname);
    if (!settings) return false;
    await this.settingsRepo.upsert({
      coopname: config.coopname,
      publish_whitelist: settings.publish_whitelist.filter(u => u !== username),
    });
    return true;
  }
}
