import { signProgramAgreement } from '../wallet/signProgramAgreement'
import { capitalDraftId, capitalProgramId } from './consts'

// После Эпика 2 / компонента 48 подпись соглашения ЦПП «Благорост»
// (program_id=4) идёт через `wallet::signagree`, а не `soviet::sndagreement`.
export async function signCapitalAgreement(
  blockchain: any,
  coopname: string,
  username: string,
  fakeDocument: any,
) {
  return signProgramAgreement(
    blockchain,
    coopname,
    username,
    capitalProgramId,
    capitalDraftId,
    fakeDocument,
  )
}
