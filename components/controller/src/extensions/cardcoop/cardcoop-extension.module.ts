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
import { Module } from '@nestjs/common';
import { CardcoopExtension, Schema, defaultConfig, type IConfig } from './cardcoop.extension';
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
// Проводник для реестра расширений: сам класс и его параметры живут в `cardcoop.extension.ts`
// (см. пояснение там), а реестру привычнее спрашивать их у модуля.
export { CardcoopExtension, Schema, defaultConfig, type IConfig };

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
    private readonly operatorAnnounce: CardcoopOperatorAnnounceService,
    private readonly membership: CardcoopMembershipService
  ) {}

  async initialize() {
    await this.cardcoopExtension.initialize();

    // Самоподключение и повтор недоставленных объявлений идут в фоне: старт кооператива не
    // зависит от доступности сети карт (NFR-3), а исходы видны в журнале и в таблицах.
    void this.connect.connectIfChanged(this.cardcoopExtension.config.api_url);
    void this.operatorAnnounce.resendUndelivered();
    // Свидетельства и отзывы, не доставленные за время внутренних ретраев, повторяются
    // периодически: card.coop о них больше не напомнит — уведомление о связке мы уже
    // подтвердили, а событие выхода в цепи не повторится.
    this.membership.startRetries(this.cardcoopExtension.config.api_url);
  }
}
