/**
 * Получатель уведомлений для внешних тестов центра уведомлений.
 *
 * Идентификатор подписчика (адрес в центре уведомлений) заводит регистрация
 * через контроллер. Участники стенда созданы мимо неё — boot и
 * add-plain-participant, — и до фонового прохода раз в полчаса адреса у них
 * нет, уведомление им не ставится. Поэтому получатель регистрируется тем же
 * путём, что и человек с формы вступления: registerAccount отдаёт токен сразу.
 */
import ecc from 'eosjs-ecc'
import { gql, randomAccount } from '../core'

export interface Candidate {
  account: string
  token: string
}

const REGISTER = 'mutation($d:RegisterAccountInput!){ registerAccount(data:$d){ tokens{ access{ token } } account{ username } } }'

export async function registerCandidate(prefix = 'ntf'): Promise<Candidate> {
  const account = randomAccount(prefix)
  const wif = await ecc.randomKey()
  const d = await gql<any>(null, REGISTER, {
    d: {
      email: `${account}@api-tests.coop`,
      username: account,
      public_key: ecc.privateToPublic(wif),
      type: 'individual',
      individual_data: {
        first_name: 'Тест',
        last_name: 'Уведомлений',
        middle_name: 'Проверочный',
        birthdate: '1990-01-01',
        phone: '+70000000000',
        full_address: 'г. Москва, ул. Тестовая, 1',
      },
    },
  })
  return { account: d.registerAccount.account.username, token: d.registerAccount.tokens.access.token }
}
