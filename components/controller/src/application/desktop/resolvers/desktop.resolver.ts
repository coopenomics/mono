import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { DesktopService } from '../services/desktop.service';
import { DesktopDTO } from '../dto/desktop.dto';
import { OptionalGqlJwtAuthGuard } from '~/application/auth/guards/optional-graphql-jwt-auth.guard';
import { OptionalCurrentUser } from '~/application/auth/decorators/optional-current-user.decorator';

@Resolver(() => DesktopDTO)
export class DesktopResolver {
  constructor(private readonly desktopService: DesktopService) {}

  @Query(() => DesktopDTO, {
    name: 'getDesktop',
    description: 'Получить состав приложений рабочего стола',
  })
  // Открыт и гостю, и пайщику: состав столов и права доступа (grants)
  // зависят от того, кто спрашивает, поэтому опциональная авторизация.
  @UseGuards(OptionalGqlJwtAuthGuard)
  async getDesktop(
    @OptionalCurrentUser() user: { username?: string; role?: string; status?: string } | null,
  ): Promise<DesktopDTO> {
    return this.desktopService.getDesktop(user ?? undefined);
  }
}
