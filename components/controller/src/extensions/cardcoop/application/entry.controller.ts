/**
 * Браузерные точки входа по карте (story 9.2, FR-F1).
 *
 * Два редиректа: начало уводит человека на card.coop, возврат принимает код и уводит на
 * страницу сессии в столе. Токены и секреты в браузере не появляются: обмен кода идёт
 * сервер-сервером, а браузер несёт только идентификатор сессии — случайный UUID.
 */
import { Controller, Get, Inject, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { CardcoopExtension } from '../cardcoop-extension.module';
import { CardcoopEntryService } from '../entry/entry.service';

@Controller('v1/extensions/cardcoop/entry')
export class CardcoopEntryController {
  constructor(
    private readonly extension: CardcoopExtension,
    private readonly entry: CardcoopEntryService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopEntryController.name);
  }

  /** Начинает вход: уводит браузер на card.coop. */
  @Get('start')
  async start(@Res() response: Response): Promise<void> {
    try {
      response.redirect(await this.entry.start(this.extension.config.api_url));
    } catch (error) {
      this.logger.warn(`Вход по карте не начат: ${error instanceof Error ? error.message : String(error)}`);
      response.redirect(this.frontend('/auth/cardcoop-entry?error=unavailable'));
    }
  }

  /**
   * Принимает возврат из card.coop.
   *
   * Ошибка от сети (человек передумал на экране согласия) и любой сбой обмена ведут на ту же
   * страницу с флагом: человеку показывается «не получилось, войдите обычным способом», а не
   * голый код ошибки.
   */
  @Get('callback')
  async callback(
    @Res() response: Response,
    @Query('state') state?: string,
    @Query('code') code?: string,
    @Query('error') error?: string
  ): Promise<void> {
    if (error || !state || !code) {
      response.redirect(this.frontend('/auth/cardcoop-entry?error=cancelled'));
      return;
    }

    try {
      const session = await this.entry.callback(this.extension.config.api_url, state, code);
      response.redirect(this.frontend(`/auth/cardcoop-entry?entry=${session.id}`));
    } catch (err) {
      this.logger.warn(`Возврат входа по карте не принят: ${err instanceof Error ? err.message : String(err)}`);
      response.redirect(this.frontend('/auth/cardcoop-entry?error=failed'));
    }
  }

  /** Адрес страницы стола: маршруты стола живут под именем кооператива. */
  private frontend(path: string): string {
    const settings = platformSettings();
    return `${settings.frontendUrl.replace(/\/+$/, '')}/${settings.coopname}${path}`;
  }
}
