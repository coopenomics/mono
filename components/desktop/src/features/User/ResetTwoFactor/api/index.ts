import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { IParticipantLoginSecurity } from '../model';

/**
 * Сброс приложения-аутентификатора у пайщика — действие председателя совета.
 * Источник — GraphQL-резолвер `AccountSecurityResolver` через @coopenomics/sdk;
 * сырых REST-вызовов из desktop не делаем (канон).
 */

/** Подключено ли у пайщика приложение и спрашивается ли код при входе. */
async function loadParticipantSecurity(username: string): Promise<IParticipantLoginSecurity> {
  const { [Queries.AccountSecurity.GetParticipantLoginSecurity.name]: result } = await client.Query(
    Queries.AccountSecurity.GetParticipantLoginSecurity.query,
    { variables: { data: { username } } },
  );
  return result;
}

/** Снять приложение-аутентификатор. Возвращает false, если снимать было нечего. */
async function resetParticipantTwoFactor(username: string): Promise<boolean> {
  const { [Mutations.AccountSecurity.ResetParticipantTwoFactor.name]: result } = await client.Mutation(
    Mutations.AccountSecurity.ResetParticipantTwoFactor.mutation,
    { variables: { data: { username } } },
  );
  return result;
}

export const api = { loadParticipantSecurity, resetParticipantTwoFactor };
