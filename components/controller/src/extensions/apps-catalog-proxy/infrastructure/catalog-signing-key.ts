import { PrivateKey, PublicKey } from '@wharfkit/antelope';

/** Разрешение аккаунта в ответе `get_account`: только то, что нужно для сверки ключей. */
export interface ChainAccountPermission {
  perm_name: string;
  required_auth?: { keys?: { key: string }[] };
}

/**
 * Имя разрешения аккаунта, в котором стоит открытая часть ключа подписи
 * каталога; `null`, если ни в одном.
 *
 * Каталог сверяет подпись с `apps::coops.signing_key`, отдельным от
 * разрешений аккаунта ключом, поэтому `CATALOG_SIGNING_KEY` хранится в
 * окружении. Ключ разрешения (`active`, `owner`) в окружении позволил бы
 * подписывать транзакции кооператива — такое совпадение надо отклонить.
 */
export function accountPermissionHoldingKey(
  permissions: ChainAccountPermission[],
  signingKey: string,
): string | null {
  const signingPublic = PrivateKey.from(signingKey).toPublic();
  const clash = permissions.find((p) =>
    (p.required_auth?.keys ?? []).some((k) => PublicKey.from(k.key).equals(signingPublic)),
  );
  return clash?.perm_name ?? null;
}
