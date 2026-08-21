import type { Mutations, Queries } from '@coopenomics/sdk';

/** Настройки подтверждения входа (2FA) — типы из SDK end-to-end. */
export type ILoginFactors =
  Queries.AccountSecurity.GetLoginFactors.IOutput[typeof Queries.AccountSecurity.GetLoginFactors.name];

export type ISetLoginFactorsInput = Mutations.AccountSecurity.SetLoginFactors.IInput['data'];

export type ITwoFactorEnrollment =
  Mutations.AccountSecurity.EnrollTwoFactor.IOutput[typeof Mutations.AccountSecurity.EnrollTwoFactor.name];
