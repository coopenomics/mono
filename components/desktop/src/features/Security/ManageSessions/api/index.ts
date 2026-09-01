import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { IRevokeSessionInput } from '../model';

/**
 * Активные сессии пайщика — самообслуживание безопасности (Story 3.7). Источник —
 * GraphQL-резолвер `AccountSecurityResolver` через @coopenomics/sdk (Zeus); сырых
 * coop/*-POST из desktop не делаем (канон), bearer живёт только в SDK.
 */
async function getSessions() {
  const { [Queries.AccountSecurity.GetSessions.name]: result } = await client.Query(
    Queries.AccountSecurity.GetSessions.query,
  );
  return result;
}

/** Завершить конкретную сессию (точечный logout устройства). */
async function revokeSession(data: IRevokeSessionInput): Promise<boolean> {
  const { [Mutations.AccountSecurity.RevokeSession.name]: result } = await client.Mutation(
    Mutations.AccountSecurity.RevokeSession.mutation,
    { variables: { data } },
  );
  return result;
}

/** Завершить все сессии кроме текущей. Возвращает число завершённых. */
async function revokeAllSessions(): Promise<number> {
  const { [Mutations.AccountSecurity.RevokeAllSessions.name]: result } = await client.Mutation(
    Mutations.AccountSecurity.RevokeAllSessions.mutation,
  );
  return result.revoked;
}

export const api = {
  getSessions,
  revokeSession,
  revokeAllSessions,
};
