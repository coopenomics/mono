import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';
import { decodeParticipantCertificate, type VerificationTypeClaim } from '@coopenomics/auth';

export type { VerificationTypeClaim };

/** Claims удостоверения пайщика (payload participant_certificate, Story 1.8). */
export interface ParticipantCertificate {
  /** Само удостоверение как выдал сервер — им наполняется код для предъявления. */
  jws: string;
  jti: string;
  sub: string;
  iat: number;
  exp: number;
  coopname: string;
  /**
   * Цепочка заверений от корня к кооперативу — подписанные заверения целиком.
   * Разбирать её для показа умеет `decodeTrustChain` из пакета авторизации.
   */
  trust_chain: string[];
  verification_types: VerificationTypeClaim[];
  identification: Record<string, unknown> | null;
}

/**
 * Запросить и декодировать актуальное удостоверение пайщика
 * (Queries.Certificate.getMyCertificate). Чтение claims — каноническим
 * `decodeParticipantCertificate` из `@coopenomics/auth` (подпись здесь не
 * проверяется — это делает offline-верификация, Story 4.4).
 */
export async function fetchParticipantCertificate(): Promise<ParticipantCertificate | null> {
  const { [Queries.Certificate.GetMyCertificate.name]: result } = await client.Query(
    Queries.Certificate.GetMyCertificate.query,
  );
  if (!result?.participant_certificate) return null;
  const claims = decodeParticipantCertificate(result.participant_certificate);
  return {
    jws: result.participant_certificate,
    jti: claims.jti,
    sub: claims.sub,
    iat: claims.iat,
    exp: claims.exp,
    coopname: claims.coopname,
    trust_chain: claims.trust_chain,
    verification_types: claims.verification_types,
    identification: claims.identification,
  };
}
