import { Inject, Injectable } from '@nestjs/common';
import { LOGGER_PORT, SECRET_CIPHER_PORT, type ILoggerPort, type ISecretCipherPort } from '@coopenomics/innercoop';
import type { EduAccessCarrier } from '../../domain/enums';
import type { ConnectorCredentials, IConnectorCredentialsSource } from '../../domain/connectors/connector-credentials';
import { EdubridgeConfigHolder } from '../../application/config/edubridge-config.holder';
import { EdubridgeConnectorBindingRepository } from '../repositories/edubridge-connector-binding.repository';

/**
 * Учётные данные площадок: в привязке коннектора, зашифрованные ключом ядра.
 * Наружу значения не выходят — только факт «задано». Прежнее место —
 * настройки расширения — читается как запасной источник, пока владелец не
 * сохранил ключи на странице «Площадки»: стенды с уже введёнными ключами
 * продолжают работать без повторного ввода.
 */
@Injectable()
export class EdubridgeConnectorCredentialsStore implements IConnectorCredentialsSource {
  constructor(
    private readonly bindings: EdubridgeConnectorBindingRepository,
    private readonly config: EdubridgeConfigHolder,
    @Inject(SECRET_CIPHER_PORT) private readonly cipher: ISecretCipherPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(EdubridgeConnectorCredentialsStore.name);
  }

  async get(coopname: string, carrier: EduAccessCarrier): Promise<ConnectorCredentials> {
    const binding = await this.bindings.ensure(coopname, carrier);
    if (binding.credentials_encrypted) {
      try {
        return JSON.parse(this.cipher.decrypt(binding.credentials_encrypted)) as ConnectorCredentials;
      } catch (e) {
        this.logger.error(`Ключи площадки ${carrier} не расшифрованы: ${(e as Error)?.message ?? e}`);
        return {};
      }
    }
    return this.legacy(carrier);
  }

  /**
   * Сохранить поля: пустое значение оставляет прежнее (секрет в форме не
   * показывается, «не менять» — единственный честный смысл пустого поля).
   */
  async set(coopname: string, carrier: EduAccessCarrier, values: ConnectorCredentials): Promise<ConnectorCredentials> {
    const current = await this.get(coopname, carrier);
    const next: ConnectorCredentials = { ...current };
    for (const [key, value] of Object.entries(values)) {
      if (value.trim()) next[key] = value.trim();
    }
    const binding = await this.bindings.ensure(coopname, carrier);
    binding.credentials_encrypted = this.cipher.encrypt(JSON.stringify(next));
    binding.credentials_updated_at = new Date();
    await this.bindings.save(binding);
    return next;
  }

  /** Все поля площадки заполнены. */
  async isConfigured(coopname: string, carrier: EduAccessCarrier, fields: ReadonlyArray<{ key: string }>): Promise<boolean> {
    if (!fields.length) return true;
    const values = await this.get(coopname, carrier);
    return fields.every((f) => Boolean(values[f.key]?.trim()));
  }

  /** Какие поля заданы — для формы владельца, без самих значений. */
  async setFlags(coopname: string, carrier: EduAccessCarrier, fields: ReadonlyArray<{ key: string }>): Promise<Record<string, boolean>> {
    const values = await this.get(coopname, carrier);
    return Object.fromEntries(fields.map((f) => [f.key, Boolean(values[f.key]?.trim())]));
  }

  private legacy(carrier: EduAccessCarrier): ConnectorCredentials {
    const c = this.config.get().connectors;
    if (!c) return {};
    if (carrier === 'skillspace') return c.skillspace_api_key ? { api_key: c.skillspace_api_key } : {};
    if (carrier === 'getcourse') {
      const out: ConnectorCredentials = {};
      if (c.getcourse_account) out.account = c.getcourse_account;
      if (c.getcourse_api_key) out.api_key = c.getcourse_api_key;
      return out;
    }
    return {};
  }
}
