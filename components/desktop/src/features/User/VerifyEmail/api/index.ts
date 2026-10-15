import { Mutations } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Подтверждение электронной почты кодом из письма. Обе операции — GraphQL через
 * @coopenomics/sdk (Zeus), сырых REST-вызовов из desktop не делаем (канон).
 *
 * Обе мутации открытые: код спрашивается на первом шаге регистрации, когда
 * учётной записи и сессии ещё нет. Адрес поэтому передаётся явно — и в
 * регистрации, и в кабинете (там его берут из аккаунта).
 */

export interface IVerificationWindow {
  /** Через сколько секунд можно запросить письмо повторно. */
  cooldown_seconds: number;
  /** Сколько секунд действует код. */
  expires_seconds: number;
}

async function requestCode(email: string): Promise<IVerificationWindow> {
  const { [Mutations.Auth.RequestEmailVerification.name]: result } = await client.Mutation(
    Mutations.Auth.RequestEmailVerification.mutation,
    { variables: { data: { email } } },
  );
  return result;
}

async function confirmCode(email: string, code: string): Promise<boolean> {
  const { [Mutations.Auth.ConfirmEmailVerification.name]: result } = await client.Mutation(
    Mutations.Auth.ConfirmEmailVerification.mutation,
    { variables: { data: { email, code } } },
  );
  return result;
}

export const api = { requestCode, confirmCode };
