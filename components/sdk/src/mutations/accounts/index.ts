/** Зарегистрировать аккаунт пользователя в системе */
export * as RegisterAccount from './registerAccount'

// export * as DeleteAccount from './deleteAccount'

/**
 * Метод замены ключа. Вызывается пайщиком, для которого производится замена с передачей токена,
 * который был отправлен ему на электронную почту после вызова мутации StartResetKey.

```typescript

 import { Mutations } from '@coopenomics/sdk'

 const variables: Mutations.Accounts.ResetKey.IInput = {
    data: {
      public_key: <новый_публичный_ключ>,
      token: <токен_из_письма>,
  }

  const { [Mutations.Accounts.ResetKey.name]: result } = await client.Mutation(
    Mutations.Accounts.ResetKey.mutation,
    {
      variables,
    }
  );

```
Метод производит замену ключа в блокчейне на переданный.
На текущий момент здесь не используется каких-либо дополнительных децентрализованных сценариев проверки.
Считаем, что если кооператив меняет ключ пайщика - значит ему так надо, т.к. обычно сейчас один пайщик с одним аккаунтом является членом только одного кооператива.

Однако, в дальнейшем, при введении функционала "карты пайщика", которая сделает допустимым "быстрый вход" для пайщиков одного кооператива - в другой, система замены ключа будет требовать подтверждения нескольких кооперативов.
/** Заменить приватный ключ аккаунта */
export * as ResetKey from './resetKey'

/**
 * Метод запуска процесса замены ключа.
 * Замена ключа в блокчейне производится за подписью кооператива. Для того, чтобы произвести замену, пайщику необходим токен доступа, который будет отправлен ему на почту после вызова этой мутации.

```typescript

 import { Mutations } from '@coopenomics/sdk'

 const variables: Mutations.Accounts.StartResetKey.IInput = {
    data: {
      email: string;
  }

  const { [Mutations.Accounts.StartResetKey.name]: result } = await client.Mutation(
    Mutations.Accounts.StartResetKey.mutation,
    {
      variables,
    }
  );

```
/** Выслать токен для замены приватного ключа аккаунта на электронную почту */
export * as StartResetKey from './startResetKey'

/** Обновить аккаунт в системе провайдера. Обновление аккаунта пользователя производится по username. Мутация позволяет изменить приватные данные пользователя, а также, адрес электронной почты в MONO. Использовать мутацию может только председатель совета. */
export * as UpdateAccount from './updateAccount'
