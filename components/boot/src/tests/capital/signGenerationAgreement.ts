import { signProgramAgreement } from '../wallet/signProgramAgreement'
import { sourceDraftId, sourceProgramId } from './consts'

// После Эпика 2 / компонента 48 подпись соглашения ЦПП «Генератор»
// (program_id=3) идёт через `wallet::signagree`, а не `soviet::sndagreement`.
export async function signGenerationContract(
  blockchain: any,
  coopname: string,
  username: string,
  fakeDocument: any,
) {
  return signProgramAgreement(
    blockchain,
    coopname,
    username,
    sourceProgramId,
    sourceDraftId,
    fakeDocument,
  )
}
