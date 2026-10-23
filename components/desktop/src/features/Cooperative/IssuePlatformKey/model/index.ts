import { PrivateKey } from '@wharfkit/antelope';
import { RegistratorContract } from 'cooptypes';
import { fetchTable } from 'src/shared/api';
import { useSessionStore } from 'src/entities/Session';
import { useSystemStore } from 'src/entities/System/model';
import { useGlobalStore } from 'src/shared/store';

export type IPlatformKeyRecord = RegistratorContract.Tables.Platforms.IPlatform;

export interface IIssuedPlatformKey {
  /** Приватный ключ узла — показывается пайщику один раз и больше нигде не хранится. */
  privateKey: string;
  publicKey: string;
}

/**
 * Ключ установки — ключ разрешения `platform` аккаунта кооператива
 * (registrator::setplatform). Узел кооператива подписывает им транзакции как
 * `active`, а смена ключа пайщика при восстановлении доступа его не трогает.
 */
export function useIssuePlatformKey() {
  async function loadPlatformKey(username: string): Promise<IPlatformKeyRecord | null> {
    const rows = (await fetchTable(
      RegistratorContract.contractName.production,
      RegistratorContract.contractName.production,
      RegistratorContract.Tables.Platforms.tableName,
      username,
      username,
      1,
    )) as IPlatformKeyRecord[];
    return rows[0] ?? null;
  }

  async function issuePlatformKey(): Promise<IIssuedPlatformKey> {
    const session = useSessionStore();
    const system = useSystemStore();
    const global = useGlobalStore();

    // Ключ сессии — активный ключ пайщика: подпись им и доказывает, что он
    // стоит в active, поэтому в active он остаётся рядом с ключом узла.
    const signingKey = await global.ensureSigningKey();
    const activeKey = PrivateKey.from(signingKey).toPublic().toLegacyString();
    const platform = PrivateKey.generate('K1');
    const publicKey = platform.toPublic().toLegacyString();

    await global.transact({
      account: RegistratorContract.contractName.production,
      name: RegistratorContract.Actions.SetPlatform.actionName,
      authorization: [{ actor: session.username, permission: 'active' }],
      data: {
        coopname: system.info.coopname,
        username: session.username,
        platform_key: publicKey,
        active_key: activeKey,
      } satisfies RegistratorContract.Actions.SetPlatform.ISetPlatform,
    });

    return { privateKey: platform.toWif(), publicKey };
  }

  return { loadPlatformKey, issuePlatformKey };
}
