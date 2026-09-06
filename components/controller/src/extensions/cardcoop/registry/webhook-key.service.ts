/**
 * Публикация ключа уведомлений сети в цепи (story 4.8 со стороны сети, задача 3B5-51).
 *
 * Кооперативы проверяют подпись уведомлений card.coop ключом из главной цепи — разрешением
 * `cardcoop` на аккаунте `ano`. Руками ключ не публикуется нигде: сеть отдаёт открытую часть по
 * `GET /v1/webhooks/public-key`, а установка оператора, распоряжающаяся `ano` по делегированным
 * правам (та же механика, что у права заверения `cert`), сверяет её с цепью на каждом старте и
 * публикует при расхождении. Так ключ доезжает и после ротации на стороне сети, и после
 * пересборки девнета: без этого coopback отвечал на уведомления 503 «ключ не опубликован»,
 * и свидетельства не выпускались (стенд 02.09.2026).
 */
import { Inject, Injectable } from '@nestjs/common';
import { PublicKey } from '@wharfkit/antelope';
import {
  CHAIN_PORT,
  type IChainPort,
  COOP_CREDENTIAL_PORT,
  type ICoopCredentialPort,
  LOGGER_PORT,
  type ILoggerPort,
  VAULT_PORT,
  type IVaultPort,
} from '@coopenomics/innercoop';
import { platformSettings } from '@coopenomics/extension-kit';
import { CardcoopExtension } from '../cardcoop.extension';
import { isNetworkOperator } from './operator';

/** Аккаунт сети в цепи и разрешение, под которым лежит ключ уведомлений. */
const NETWORK_ACCOUNT = 'ano';
const WEBHOOK_PERMISSION = 'cardcoop';
/** Сколько ждать ответ сети с ключом. */
const FETCH_TIMEOUT_MS = 5_000;

/** Ключ в одном написании: цепь отдаёт `EOS…`, сеть — `PUB_K1_…`, а это один и тот же ключ. */
const normalize = (key: string): string => PublicKey.from(key).toString();

@Injectable()
export class CardcoopWebhookKeyService {
  constructor(
    private readonly extension: CardcoopExtension,
    @Inject(COOP_CREDENTIAL_PORT) private readonly credential: ICoopCredentialPort,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(CardcoopWebhookKeyService.name);
  }

  /**
   * Доводит ключ уведомлений сети в цепи до актуального.
   *
   * Не бросает: старт кооператива от сети карт не зависит (NFR-3), недоставка видна в журнале и
   * повторится на следующем старте. Идемпотентно: совпадающий ключ не переписывается.
   *
   * @param apiUrl — адрес узла сети из конфигурации расширения.
   * @returns Опубликован ли ключ этим вызовом.
   */
  async ensurePublished(apiUrl: string): Promise<{ published: boolean }> {
    if (!isNetworkOperator(this.extension.config)) return { published: false };
    try {
      const wanted = await this.fetchNetworkKey(apiUrl);
      if (!wanted) return { published: false };

      const onChain = await this.credential.getPermissionKey(NETWORK_ACCOUNT, WEBHOOK_PERMISSION);
      if (onChain && normalize(onChain) === normalize(wanted)) return { published: false };

      const operator = platformSettings().coopname;
      const wif = await this.vault.getWif(operator);
      if (!wif) {
        this.logger.warn(`Нет ключа кооператива ${operator} — ключ уведомлений сети в цепь не опубликован`);
        return { published: false };
      }
      // Подписывает оператор по делегированным правам, а полномочие — от имени ano:
      // так же публикуется право заверения якоря.
      this.chain.initialize(operator, wif);
      await this.chain.transact({
        account: 'eosio',
        name: 'updateauth',
        authorization: [{ actor: NETWORK_ACCOUNT, permission: 'active' }],
        data: {
          account: NETWORK_ACCOUNT,
          permission: WEBHOOK_PERMISSION,
          parent: 'active',
          auth: { threshold: 1, keys: [{ key: wanted, weight: 1 }], accounts: [], waits: [] },
        },
      });
      this.logger.info(
        `Ключ уведомлений сети карт опубликован в цепи: ${NETWORK_ACCOUNT}@${WEBHOOK_PERMISSION} = ${normalize(wanted)}` +
          (onChain ? ` (было ${normalize(onChain)})` : '')
      );
      return { published: true };
    } catch (error) {
      this.logger.error(
        `Ключ уведомлений сети карт не опубликован: ${error instanceof Error ? error.message : String(error)}`
      );
      return { published: false };
    }
  }

  /** Открытая часть ключа уведомлений с самого card.coop; `null` — сеть не ответила. */
  private async fetchNetworkKey(apiUrl: string): Promise<string | null> {
    const response = await fetch(`${apiUrl.replace(/\/+$/, '')}/v1/webhooks/public-key`, {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!response.ok) {
      this.logger.warn(`Сеть карт не отдала ключ уведомлений: ответ ${response.status}`);
      return null;
    }
    const body = (await response.json()) as { publicKey?: unknown };
    return typeof body.publicKey === 'string' && body.publicKey ? body.publicKey : null;
  }
}
