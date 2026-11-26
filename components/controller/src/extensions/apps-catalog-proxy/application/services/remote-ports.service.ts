import { Inject, Injectable } from '@nestjs/common';
import { DomainError } from '@coopenomics/extension-kit';
import {
  ACCESS_TOKEN_PORT,
  ACCOUNT_PORT,
  CHAIN_PORT,
  COOPERATIVE_VARS_PORT,
  DOCUMENT_PORT,
  VAULT_PORT,
  type IAccessTokenPort,
  type IAccountPort,
  type IChainPort,
  type ICooperativeVarsPort,
  type IDocumentPort,
  type InnerChainAction,
  type IVaultPort,
} from '@coopenomics/innercoop';
import { AppPortGrantRecord } from '../../infrastructure/records/app-port-grant.record';
import { AppSessionService } from './app-session.service';
import { REMOTE_PORTS, type RemotePortName } from './remote-ports.catalog';

/**
 * Вызов порта ядра от имени приложения каталога (487-17).
 *
 * Приложение в своём контейнере зовёт тот же порт, что расширение в монолите;
 * здесь вызов доходит до настоящей реализации порта. Перед этим проверяется
 * заявка пакета: порт заявлен, метод открыт, а для `chain.transact` — каждое
 * действие перечислено в заявке.
 */
@Injectable()
export class RemotePortsService {
  private readonly targets: Record<RemotePortName, object>;

  constructor(
    @Inject(DOCUMENT_PORT) document: IDocumentPort,
    @Inject(COOPERATIVE_VARS_PORT) cooperativeVars: ICooperativeVarsPort,
    @Inject(ACCESS_TOKEN_PORT) accessToken: IAccessTokenPort,
    @Inject(ACCOUNT_PORT) account: IAccountPort,
    @Inject(CHAIN_PORT) private readonly chain: IChainPort,
    @Inject(VAULT_PORT) private readonly vault: IVaultPort,
    private readonly sessions: AppSessionService,
  ) {
    this.targets = { document, cooperativeVars, accessToken, account, chain };
  }

  /**
   * Выполнить метод порта для пакета.
   *
   * @param grant — заявка пакета, найденная по его токену.
   * @param coopname — кооператив узла: от его имени ядро подписывает действия цепи.
   * @throws DomainError `APPS_CATALOG_PROXY_APP_PORT_UNKNOWN` — такого порта или метода в каталоге нет;
   *   `APPS_CATALOG_PROXY_APP_PORT_NOT_GRANTED` — порт не заявлен пакетом;
   *   `APPS_CATALOG_PROXY_APP_CHAIN_ACTION_NOT_GRANTED` — действие цепи не заявлено.
   */
  async call(
    grant: AppPortGrantRecord,
    coopname: string,
    port: string,
    method: string,
    args: unknown[],
  ): Promise<unknown> {
    const methods: readonly string[] | undefined = (REMOTE_PORTS as Record<string, readonly string[]>)[port];
    if (methods === undefined || !methods.includes(method)) {
      throw DomainError.notFound('APPS_CATALOG_PROXY_APP_PORT_UNKNOWN', { port, method });
    }
    if (!grant.ports.includes(port)) {
      throw DomainError.forbidden('APPS_CATALOG_PROXY_APP_PORT_NOT_GRANTED', { package_id: grant.packageId, port });
    }
    if (port === 'chain' && method === 'transact') {
      return this.transact(grant, coopname, args[0] as InnerChainAction | InnerChainAction[], args[1] !== false);
    }
    // Токен приложения опознаёт только то приложение, которому стол его выдал:
    // чужой токен приложения и поддельный дают null, как неверный токен пайщика.
    if (port === 'accessToken' && method === 'identify' && AppSessionService.isAppSession(args[0])) {
      return this.sessions.verify(args[0], grant.packageId);
    }
    const target = this.targets[port as RemotePortName] as Record<string, (...a: unknown[]) => unknown>;
    return target[method](...args);
  }

  /**
   * Действия цепи по просьбе приложения. Ключ узла ядро берёт из своего
   * хранилища и приложению не отдаёт; подписант и разрешение ставятся здесь —
   * приложение не выбирает, от чьего имени действие проводится.
   */
  private async transact(
    grant: AppPortGrantRecord,
    coopname: string,
    input: InnerChainAction | InnerChainAction[],
    broadcast: boolean,
  ): Promise<unknown> {
    const actions = Array.isArray(input) ? input : [input];
    if (actions.length === 0) throw DomainError.badRequest('APPS_CATALOG_PROXY_APP_CHAIN_ACTIONS_EMPTY');
    for (const action of actions) {
      const id = `${String(action?.account)}::${String(action?.name)}`;
      if (!grant.chainActions.includes(id)) {
        throw DomainError.forbidden('APPS_CATALOG_PROXY_APP_CHAIN_ACTION_NOT_GRANTED', { package_id: grant.packageId, action: id });
      }
    }
    const wif = await this.vault.getWif(coopname);
    if (!wif) throw DomainError.internal('APPS_CATALOG_PROXY_APP_COOP_KEY_NOT_FOUND', { coopname });
    this.chain.initialize(coopname, wif);
    const signed = actions.map((action) => ({
      ...action,
      authorization: [{ actor: coopname, permission: 'active' }],
    }));
    return this.chain.transact(signed as InnerChainAction[], broadcast);
  }
}
