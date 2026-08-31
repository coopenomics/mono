/**
 * Карта пайщика в столе кооператива (story 7.4, FR-E4).
 *
 * Отвечает на единственный вопрос, который стол задаёт о карте: есть ли она у этого
 * человека и что с его членством. Всё остальное — предмет card.coop, и спрашивать его
 * кооператив не вправе: маршрута «в каких кооперативах состоит X» в сети не существует.
 *
 * Запрос всегда о себе: пайщика берём из токена, а не из аргументов, — иначе появился бы
 * способ узнать, есть ли карта у соседа.
 */
import { Resolver, Query } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthRoles, CurrentUser, GqlJwtAuthGuard, RolesGuard, platformSettings } from '@coopenomics/extension-kit';
import type { IMonoAccount } from '@coopenomics/innercoop';
import { CardcoopExtension } from '../cardcoop-extension.module';
import { CardcoopCardService } from './cardcoop-card.service';
import { CardcoopMyCardDTO } from './dto/cardcoop-my-card.dto';

@Resolver()
export class CardcoopCardResolver {
  constructor(
    private readonly cards: CardcoopCardService,
    private readonly extension: CardcoopExtension
  ) {}

  @Query(() => CardcoopMyCardDTO, {
    name: 'cardcoopMyCard',
    description: 'Карта пайщика в сети «Карта пайщика»: выпущена ли и что с членством',
  })
  @UseGuards(GqlJwtAuthGuard, RolesGuard)
  @AuthRoles(['chairman', 'member', 'user'])
  async myCard(@CurrentUser() user: IMonoAccount): Promise<CardcoopMyCardDTO> {
    return this.cards.forMember(user.username, this.extension.config.api_url, platformSettings().coopname);
  }
}
