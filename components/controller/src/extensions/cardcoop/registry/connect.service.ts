/**
 * Самоподключение кооператива к сети «Карта пайщика» (story 7.6, FR-E6).
 *
 * Техническая половина подключения: issuer, клиент и адреса существуют только у этой
 * установки, и донести их в реестр сети может только она сама. Документ подписывается ключом
 * заверения — ключей доступа для этого не заводится, и человек не переносит секреты руками.
 *
 * Отправляется на каждом старте, на котором состав параметров изменился; принятое сетью
 * состояние запоминается отпечатком. Так ротация секрета клиента или смена адреса доезжают
 * сами, а неизменившаяся установка не стучится в сеть на каждом рестарте.
 */
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import canonicalize from 'canonicalize';
import {
  INTEGRATION_SETTINGS_PORT,
  type IIntegrationSettingsPort,
  LOGGER_PORT,
  type ILoggerPort,
} from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { CardcoopAttestationService } from '../attestation/attestation.service';
import { CardcoopConnectStateTypeormEntity } from '../infrastructure/entities/cardcoop-connect-state.typeorm-entity';
import { CardcoopRegistryDocumentType, type CardcoopConnectPayload } from './registry.types';

/** Реквизиты клиента card.coop в CoopID кооператива — из настроек контура. */
interface CardcoopClientSettings {
  client_id?: string;
  client_secret?: string;
  issuer?: string;
}

/** Ключ единственной строки состояния. */
const SELF = 'self';

@Injectable()
export class CardcoopConnectService {
  constructor(
    @InjectRepository(CardcoopConnectStateTypeormEntity)
    private readonly state: Repository<CardcoopConnectStateTypeormEntity>,
    private readonly attestationService: CardcoopAttestationService,
    @Inject(INTEGRATION_SETTINGS_PORT) private readonly integrations: IIntegrationSettingsPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopConnectService.name);
  }

  /**
   * Доносит параметры установки, если они изменились с последней принятой доставки.
   *
   * Вызывается расширением после инициализации. Не бросает: недоставка — рабочая ситуация,
   * она записывается и повторится на следующем старте, а старт кооператива из-за сети карт
   * не падает (NFR-3).
   *
   * @param apiUrl — адрес узла сети из конфигурации расширения.
   */
  async connectIfChanged(apiUrl: string): Promise<void> {
    try {
      const stable = this.stablePayload();
      if (!stable) return;

      const hash = createHash('sha256').update(canonicalize(stable) as string, 'utf8').digest('hex');
      const known = await this.state.findOne({ where: { id: SELF } });
      if (known?.deliveredHash === hash) return;

      await this.deliver(apiUrl, stable, hash, known);
    } catch (error) {
      this.logger.error(
        `Параметры установки не донесены до сети карт: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Стабильная часть документа — без момента выпуска и сети: по ней считается отпечаток.
   *
   * Пустые реквизиты клиента — не ошибка, а честное «подключать нечего»: клиент card.coop в
   * CoopID этой установки не заведён, и слать в реестр пустой секрет хуже, чем промолчать.
   */
  private stablePayload(): Omit<CardcoopConnectPayload, 'issued_at' | 'chain_id'> | null {
    const client = this.integrations.get<CardcoopClientSettings>('cardcoop', 'cardcoop_client');
    if (!client?.client_id || !client.client_secret || !client.issuer) {
      this.logger.warn(
        'Реквизиты клиента card.coop не заданы (CARDCOOP_CLIENT_ID/SECRET/OIDC_ISSUER) — самоподключение к сети пропущено'
      );
      return null;
    }

    const backend = platformSettings().backendUrl.replace(/\/+$/, '');
    return {
      type: CardcoopRegistryDocumentType.Connect,
      coopname: platformSettings().coopname,
      oidc_issuer: client.issuer,
      oidc_client_id: client.client_id,
      oidc_client_secret: client.client_secret,
      attestation_callback_url: `${backend}/v1/extensions/cardcoop/webhooks`,
      disclosure_url: `${backend}/v1/extensions/cardcoop/disclosures`,
    };
  }

  /**
   * Подписывает, отправляет и записывает исход.
   *
   * @param apiUrl — адрес узла сети.
   * @param stable — стабильная часть документа.
   * @param hash — её отпечаток.
   * @param known — прежнее состояние; `null` — первое подключение.
   */
  private async deliver(
    apiUrl: string,
    stable: Omit<CardcoopConnectPayload, 'issued_at' | 'chain_id'>,
    hash: string,
    known: CardcoopConnectStateTypeormEntity | null
  ): Promise<void> {
    const envelope = await this.attestationService.signDocument({
      ...stable,
      issued_at: new Date().toISOString(),
      chain_id: platformSettings().blockchain.chainId,
    });

    const result = await this.attestationService.deliverDocument(
      `${apiUrl.replace(/\/+$/, '')}/v1/coops/connect`,
      envelope
    );

    const record = known ?? this.state.create({ id: SELF, deliveredHash: null, lastError: null });
    if (result.delivered) {
      record.deliveredHash = hash;
      record.lastError = null;
      this.logger.info('Параметры установки донесены до сети карт');
    } else {
      record.lastError = result.reason ?? 'сеть недоступна';
      this.logger.error(`Сеть карт не приняла параметры установки: ${record.lastError}`);
    }
    await this.state.save(record);
  }
}
