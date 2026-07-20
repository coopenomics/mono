import { sha256 } from './sha256';

/**
 * Детерминированная сериализация: ключи объектов сортируются рекурсивно,
 * чтобы отпечаток не зависел от порядка полей. Свой сериализатор, а не
 * json-stable-stringify — этой зависимости в репозитории нет, а тянуть её в
 * worktree с симлинкнутым node_modules ненадёжно.
 */
function canonical(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return (
      '{' +
      Object.keys(obj)
        .sort()
        .map((k) => JSON.stringify(k) + ':' + canonical(obj[k]))
        .join(',') +
      '}'
    );
  }
  return JSON.stringify(value);
}

/**
 * Выбирает из приватного аккаунта только удостоверяющие личность поля, которые
 * попадают в подписанное заявление. Берём whitelist, а не весь объект, чтобы
 * служебные/волатильные поля (id, updated_at и т.п.) не давали ложных
 * расхождений отпечатка.
 */
function pickIdentity(privateAccount: any): Record<string, unknown> | null {
  if (!privateAccount) return null;
  const ind = privateAccount.individual_data;
  const ent = privateAccount.entrepreneur_data;
  const org = privateAccount.organization_data;

  if (ind) {
    return {
      type: 'individual',
      first_name: ind.first_name,
      last_name: ind.last_name,
      middle_name: ind.middle_name,
      birthdate: ind.birthdate,
      full_address: ind.full_address,
      phone: ind.phone,
      email: ind.email,
      passport: ind.passport ?? null,
    };
  }

  if (ent) {
    return {
      type: 'entrepreneur',
      first_name: ent.first_name,
      last_name: ent.last_name,
      middle_name: ent.middle_name,
      birthdate: ent.birthdate,
      phone: ent.phone,
      email: ent.email,
      country: ent.country,
      city: ent.city,
      full_address: ent.full_address,
      details: ent.details ?? null,
    };
  }

  if (org) {
    return {
      type: 'organization',
      organization_type: org.type,
      short_name: org.short_name,
      full_name: org.full_name,
      represented_by: org.represented_by ?? null,
      country: org.country,
      city: org.city,
      full_address: org.full_address,
      fact_address: org.fact_address,
      phone: org.phone,
      email: org.email,
      details: org.details ?? null,
    };
  }

  return null;
}

/**
 * Каноничный отпечаток удостоверяющих личность данных пайщика из приватного
 * аккаунта. Возвращает null, если профиля ещё нет.
 *
 * Используется как «замок» консистентности регистрации: отпечаток фиксируется
 * в момент подписания заявления (registerParticipant) и сверяется перед
 * регистрацией аккаунта в блокчейне (registerBlockchainAccount). Если профиль
 * изменили после подписи и заявление не переподписали — на цепь уйдут данные,
 * отличные от подписанных, чего гард не допускает.
 */
export function registrationProfileFingerprint(privateAccount: any): string | null {
  const identity = pickIdentity(privateAccount);
  if (!identity) return null;
  return sha256(canonical(identity));
}
