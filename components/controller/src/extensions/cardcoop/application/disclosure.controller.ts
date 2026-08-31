/**
 * Выдача анкеты кооперативу-получателю по гранту card.coop (story 7.8, FR-F3).
 *
 * Дверь, в которую стучится кооператив B, чтобы не заставлять человека вводить анкету заново.
 * Открывается она не ему, а гранту: подписанному card.coop согласию держателя, живущему
 * минуты и годному ровно на один обмен.
 *
 * Ключа доступа у этого маршрута нет и быть не должно — предъявителя опознаёт сам грант. Зато
 * есть потолок частоты: проверка подписи стоит процессорного времени, а грант приходит от
 * кого угодно.
 *
 * Грант передаётся телом, а не адресом: он длинный, и в адресе оседал бы в журналах прокси и
 * веб-сервера — то есть согласие человека жило бы дольше положенных ему минут.
 */
import { Body, Controller, ForbiddenException, HttpCode, HttpStatus, Inject, Post } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { UseGuards } from '@nestjs/common';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { CardcoopExtension } from '../cardcoop-extension.module';
import { CardcoopDisclosureService } from '../disclosure/disclosure.service';
import { CardcoopGrantRejected } from '../disclosure/grant-verifier.service';
import type { CardcoopDisclosureEnvelope } from '../disclosure/disclosure.types';

/** Что предъявляет кооператив-получатель. */
interface DiscloseRequest {
  /** Грант раскрытия — compact JWS, выданный card.coop с согласия держателя. */
  grant?: string;
}

@Controller('v1/extensions/cardcoop')
export class CardcoopDisclosureController {
  constructor(
    private readonly extension: CardcoopExtension,
    private readonly disclosures: CardcoopDisclosureService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopDisclosureController.name);
  }

  /**
   * Отдаёт анкету держателя по гранту.
   *
   * Любой отказ выглядит одинаково. Различать «грант просрочен», «такого пайщика у нас нет» и
   * «анкету по этому согласию уже отдали» значило бы отвечать чужому на вопрос о членстве
   * человека — сеть это запрещает (архитектура §8). Причина остаётся в журнале кооператива.
   *
   * @param body — предъявленный грант.
   * @returns Конверт с анкетой, подписанный ключом заверения кооператива.
   */
  @Post('disclosures')
  @HttpCode(HttpStatus.OK)
  @UseGuards(ThrottlerGuard)
  // Имя `default` — то, под которым зарегистрирован единственный ограничитель контура
  // (`ThrottlerModule.forRoot` без имени). Придуманное имя молча не применилось бы: guard
  // ищет переопределение по имени настроенного ограничителя и на незнакомое не смотрит.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async disclose(@Body() body: DiscloseRequest): Promise<CardcoopDisclosureEnvelope> {
    try {
      if (!body.grant) throw new CardcoopGrantRejected('грант не предъявлен');

      return await this.disclosures.disclose(this.extension.config.api_url, body.grant);
    } catch (error) {
      if (error instanceof CardcoopGrantRejected) {
        this.logger.warn(`Раскрытие анкеты отклонено: ${error.message}`);
        throw new ForbiddenException('Грант раскрытия не принят');
      }

      this.logger.error(
        `Раскрытие анкеты не состоялось: ${error instanceof Error ? error.message : String(error)}`
      );
      throw new ForbiddenException('Грант раскрытия не принят');
    }
  }
}
