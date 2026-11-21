import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { SettingsDTO } from '~/application/system/dto/settings.dto';
import { CooperativeLogoService } from '../services/cooperative-logo.service';

/**
 * Поле `Settings.logo_url`: подписанная ссылка живёт недолго, поэтому её не
 * кладут в сам DTO на всё время работы узла — запрашивают на каждый показ.
 */
@Resolver(() => SettingsDTO)
export class SettingsLogoResolver {
  constructor(private readonly logos: CooperativeLogoService) {}

  @ResolveField(() => String, {
    nullable: true,
    description: 'Ссылка на логотип кооператива; пусто — логотипа нет.',
  })
  async logo_url(@Parent() _settings: SettingsDTO): Promise<string | null> {
    return this.logos.getLogoUrl();
  }
}
