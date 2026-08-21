import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';
import type { ILoginFactors, ISetLoginFactorsInput, ITwoFactorEnrollment } from '../model';

/**
 * Подтверждение входа (2FA) — самообслуживание безопасности. Источник —
 * GraphQL-резолвер `AccountSecurityResolver` через @coopenomics/sdk (Zeus);
 * сырых coop/*-POST из desktop не делаем (канон), bearer живёт только в SDK.
 */
async function loadLoginFactors(): Promise<ILoginFactors> {
  const { [Queries.AccountSecurity.GetLoginFactors.name]: result } = await client.Query(
    Queries.AccountSecurity.GetLoginFactors.query,
  );
  return result;
}

/** Изменить настройки подтверждения входа (изменение TOTP-фактора требует код). */
async function saveLoginFactors(data: ISetLoginFactorsInput): Promise<ILoginFactors> {
  const { [Mutations.AccountSecurity.SetLoginFactors.name]: result } = await client.Mutation(
    Mutations.AccountSecurity.SetLoginFactors.mutation,
    { variables: { data } },
  );
  return result;
}

/** Начать подключение приложения-аутентификатора: секрет + otpauth-URI для QR. */
async function enrollTwoFactor(): Promise<ITwoFactorEnrollment> {
  const { [Mutations.AccountSecurity.EnrollTwoFactor.name]: result } = await client.Mutation(
    Mutations.AccountSecurity.EnrollTwoFactor.mutation,
  );
  return result;
}

/** Подтвердить подключение первым кодом из приложения. */
async function activateTwoFactor(code: string): Promise<boolean> {
  const { [Mutations.AccountSecurity.ActivateTwoFactor.name]: result } = await client.Mutation(
    Mutations.AccountSecurity.ActivateTwoFactor.mutation,
    { variables: { data: { code } } },
  );
  return result;
}

/** Отключить приложение-аутентификатор (требует действующий код). */
async function disableTwoFactor(code: string): Promise<boolean> {
  const { [Mutations.AccountSecurity.DisableTwoFactor.name]: result } = await client.Mutation(
    Mutations.AccountSecurity.DisableTwoFactor.mutation,
    { variables: { data: { code } } },
  );
  return result;
}

export const api = {
  loadLoginFactors,
  saveLoginFactors,
  enrollTwoFactor,
  activateTwoFactor,
  disableTwoFactor,
};
