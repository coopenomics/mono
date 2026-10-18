/**
 * Оповещение о новом вопросе повестки (soviet.agenda).
 *
 * Контракт ставит вопрос в повестку совета, узел оповещает председателя и
 * членов совета. В письме — ссылка на страницу этого вопроса: номер найден по
 * хэшу действия. Журнал уведомлений наружу отдаёт только факт отправки, поэтому
 * ссылку проверяет письмо, перехваченное почтой стенда.
 *
 * Вопрос ставит заявление на выход свежего пайщика; после проверки совет его
 * отклоняет, пайщик остаётся в кооперативе.
 */
import { describe, expect, it } from 'vitest'
import { CHAIRMAN, awaitDecision, caseName, declineDecisionOnChain, freshMember, latestMail, login, requestExit, voteOnDecision } from '../core'

describe('оповещение о новом вопросе повестки', () => {
  it(caseName('sov.agenda.happy.01', 'письмо председателю ведёт на страницу этого вопроса'), async () => {
    const member = freshMember({ prefix: 'agnd' })
    await login(member)
    const hash = await requestExit(member, true)
    const decision = await awaitDecision(hash, `вопрос повестки о выходе ${member.account}`)
    try {
      const mail = await latestMail(CHAIRMAN.email, `/soviet/agenda/${decision.id}`, 120_000)
      expect(mail.html + mail.text).toContain(`/soviet/agenda/${decision.id}`)
    }
    finally {
      // Совет отклоняет вопрос большинством голосов «против».
      await voteOnDecision(Number(decision.id), 'against')
      await declineDecisionOnChain(Number(decision.id))
    }
  }, 300_000)
})
