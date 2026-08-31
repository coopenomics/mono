/**
 * Расширение «Карта пайщика» — сторона кооператива в сети card.coop.
 *
 * Что оно делает: по факту установления связки пайщика с картой формирует
 * подтверждение членства, подписывает его ключом кооператива и отправляет на
 * card.coop; при прекращении членства — отзывает. Карту при этом выпускает не
 * кооператив: он лишь свидетельствует, что человек у него состоит.
 *
 * Что оно НЕ делает: не отдаёт наружу анкету пайщика. В подтверждение попадают
 * ФИО (наименование организации) открыто и пополевые отпечатки остальных полей —
 * см. `IdentityService` (story 7.7) и решение PRD §10 п.8 проекта «Карта
 * пайщика». Перца на этой стороне нет: чистый sha256 считает кооператив, второй
 * слой накладывает card.coop у себя.
 *
 * Реализует story 7.1 (каркас и конфиг). Отправка подтверждений — 7.2,
 * отзыв — 7.3, выдача анкеты по гранту — 7.8.
 */
import { Inject, Module } from '@nestjs/common';
import {
  BaseExtensionModule,
  EXTENSION_REPOSITORY,
  type ExtensionDomainEntity,
  type ExtensionDomainRepository,
} from '@coopenomics/extension-kit';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { type DeserializedDescriptionOfExtension } from '@coopenomics/extension-kit';
import { z } from 'zod';
import { CardcoopIdentityService } from './identity/identity.service';
import { CardcoopAttestationService } from './attestation/attestation.service';
import { CardcoopMembershipService } from './membership/membership.service';
import { CardcoopCardService } from './application/cardcoop-card.service';
import { CardcoopCardResolver } from './application/cardcoop-card.resolver';
import { CardcoopExitEventsService } from './membership/exit-events.service';
import { CardcoopJoinEventsService } from './membership/join-events.service';
import { CardcoopDatabaseModule } from './infrastructure/database/cardcoop-database.module';
import { CardcoopLinkWebhookController } from './application/link-webhook.controller';
import { CardcoopDisclosureController } from './application/disclosure.controller';
import { CardcoopConnectService } from './registry/connect.service';
import { CardcoopOperatorAnnounceService } from './registry/operator-announce.service';
import { CardcoopEntryService } from './entry/entry.service';
import { CardcoopDisclosureIntakeService } from './entry/disclosure-intake.service';
import { CardcoopEntryController } from './application/entry.controller';
import { CardcoopEntryResolver } from './application/cardcoop-entry.resolver';
import { CardcoopDisclosureService } from './disclosure/disclosure.service';
import { CardcoopGrantVerifier } from './disclosure/grant-verifier.service';

/**
 * Параметры расширения.
 *
 * `api_url` — адрес узла сети «Карта пайщика». Он одинаков для всех
 * кооперативов сети, поэтому председателю трогать его незачем: значение по
 * умолчанию рабочее, а поле оставлено настраиваемым ради тестового контура.
 *
 * Ключа проверки уведомлений здесь нет намеренно. Сеть подписывает уведомления
 * ключом, опубликованным отдельным разрешением на её аккаунте в цепи, и
 * проверяющий читает его оттуда сам (см. `link-webhook.controller.ts`). Ручной
 * ввод криптографического ключа председателем запрещён: это гарантированные
 * опечатки, мёртвая ротация и канал для подсовывания поддельного ключа.
 */
/** Подпись поля в форме настроек: председатель видит человеческий текст, а не имя параметра. */
const describeField = (description: DeserializedDescriptionOfExtension): string => JSON.stringify(description);

export const Schema = z.object({
  api_url: z
    .string()
    .url('Адрес должен быть ссылкой вида https://card.coop')
    .describe(
      describeField({
        label: 'Адрес сети «Карта пайщика»',
        note: 'Менять не требуется: значение по умолчанию рабочее. Поле оставлено для тестового контура.',
      })
    ),
  // Юридическая половина подключения кооперативов (story 7.6) — функция установки оператора,
  // а не каждого кооператива. Флаг, а не отдельное расширение: сеть и так примет объявление
  // только от кооператива, названного оператором в её конфигурации, — включённый по ошибке
  // флаг даёт отказ в журнале, а не чужие допуски.
  announce_as_operator: z
    .boolean()
    // default: поле появилось после первых установок, и конфиг без него обязан читаться.
    .default(false)
    .describe(
      describeField({
        label: 'Я — оператор сети (ВОСХОД)',
        note: 'Объявлять card.coop допуск кооперативов, активированных в цепи. Включается только на установке оператора сети.',
      })
    ),
});

export const defaultConfig = {
  api_url: 'https://card.coop',
  announce_as_operator: false,
};

export type IConfig = z.infer<typeof Schema>;

export class CardcoopExtension extends BaseExtensionModule {
  constructor(
    @Inject(EXTENSION_REPOSITORY) private readonly extensionRepository: ExtensionDomainRepository,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    super();
    this.logger.setContext(CardcoopExtension.name);
  }

  name = 'cardcoop';

  extension!: ExtensionDomainEntity<IConfig>;
  public configSchemas = Schema;
  public defaultConfig = defaultConfig;

  /** Читает установленную запись расширения и запоминает конфиг. */
  async initialize(): Promise<void> {
    const extensionData = await this.extensionRepository.findByName(this.name);
    if (!extensionData) throw new Error(`Конфигурация расширения ${this.name} не найдена`);

    this.extension = extensionData;

    this.logger.info(`Инициализация ${this.name}`, { api_url: this.config.api_url });

  }

  /** Текущие параметры установки. Обращение до `initialize` — ошибка разработчика. */
  public get config(): IConfig {
    return this.extension.config;
  }
}

@Module({
  imports: [CardcoopDatabaseModule],
  controllers: [CardcoopLinkWebhookController, CardcoopDisclosureController, CardcoopEntryController],
  providers: [
    CardcoopExtension,
    CardcoopCardService,
    CardcoopCardResolver,
    CardcoopIdentityService,
    CardcoopAttestationService,
    CardcoopMembershipService,
    CardcoopExitEventsService,
    CardcoopJoinEventsService,
    CardcoopGrantVerifier,
    CardcoopDisclosureService,
    CardcoopConnectService,
    CardcoopOperatorAnnounceService,
    CardcoopEntryService,
    CardcoopDisclosureIntakeService,
    CardcoopEntryResolver,
  ],
  exports: [CardcoopExtension, CardcoopAttestationService, CardcoopMembershipService],
})
export class CardcoopExtensionModule {
  constructor(
    private readonly cardcoopExtension: CardcoopExtension,
    private readonly connect: CardcoopConnectService,
    private readonly operatorAnnounce: CardcoopOperatorAnnounceService
  ) {}

  async initialize() {
    await this.cardcoopExtension.initialize();

    // Самоподключение и повтор недоставленных объявлений идут в фоне: старт кооператива не
    // зависит от доступности сети карт (NFR-3), а исходы видны в журнале и в таблицах.
    void this.connect.connectIfChanged(this.cardcoopExtension.config.api_url);
    void this.operatorAnnounce.resendUndelivered();
  }
}
