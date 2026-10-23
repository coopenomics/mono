import { type GraphQLTypes, type InputType, Selector } from '../../zeus/index'

export const name = 'cardcoopMyCard'

/**
 * Карта кооператора в сети «Карта кооператора»: выпущена ли и что с членством.
 *
 * Запрос всегда о себе — пайщика сервер берёт из токена. Ни имени держателя, ни его
 * членств в других кооперативах здесь нет: это чужие сведения, и сеть их кооперативу
 * не отдаёт.
 */
export const query = Selector('Query')({
  [name]: {
    issued: true,
    cardNumber: true,
    state: true,
    memberSince: true,
    enterUrl: true,
  },
})

export type IOutput = InputType<GraphQLTypes['Query'], typeof query>
