import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

export interface CoopChainLink {
  account: string;
  public_key: string;
}

/** Подтверждённый тип верификации в удостоверении (структурная форма, Story 4.3). */
export interface VerificationTypeClaim {
  type: string;
  verified_at: string;
  source: string;
}

/** Claims удостоверения пайщика (payload participant_certificate, Story 1.8). */
export interface ParticipantCertificate {
  jti: string;
  sub: string;
  iat: number;
  exp: number;
  coopname: string;
  coop_chain: CoopChainLink[];
  verification_types: VerificationTypeClaim[];
  identification: Record<string, unknown> | null;
}

/** Нормализовать сырой claim verification_types в структурную форму (Story 4.3). */
function normalizeVerificationTypes(raw: unknown): VerificationTypeClaim[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (e): e is Record<string, unknown> =>
        typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>).type === 'string',
    )
    .map((e) => ({
      type: String(e.type),
      verified_at: String(e.verified_at ?? ''),
      source: String(e.source ?? ''),
    }));
}

/**
 * Локальный декод payload JWS для ОТОБРАЖЕНИЯ в ЛК (подпись здесь не проверяется —
 * это делает offline-верификация, Story 4.4). Каноническое чтение claims —
 * `@coopenomics/auth.decodeParticipantCertificate`; используем его, когда desktop
 * подключит auth-SDK (Эпик 7). UTF-8-декод обязателен — в identification кириллица.
 */
function decodePayload(jws: string): ParticipantCertificate {
  const segment = jws.split('.')[1];
  if (!segment) throw new Error('Некорректный формат удостоверения');
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  const raw = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
  return {
    jti: String(raw.jti ?? ''),
    sub: String(raw.sub ?? ''),
    iat: Number(raw.iat ?? 0),
    exp: Number(raw.exp ?? 0),
    coopname: String(raw.coopname ?? ''),
    coop_chain: Array.isArray(raw.coop_chain) ? (raw.coop_chain as CoopChainLink[]) : [],
    verification_types: normalizeVerificationTypes(raw.verification_types),
    identification: (raw.identification as Record<string, unknown> | null) ?? null,
  };
}

/** Запросить и декодировать актуальное удостоверение пайщика (Queries.Certificate.getMyCertificate). */
export async function fetchParticipantCertificate(): Promise<ParticipantCertificate | null> {
  const { [Queries.Certificate.GetMyCertificate.name]: result } = await client.Query(
    Queries.Certificate.GetMyCertificate.query,
  );
  if (!result?.participant_certificate) return null;
  return decodePayload(result.participant_certificate);
}
