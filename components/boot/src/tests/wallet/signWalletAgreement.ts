import { walletDraftId, walletProgramId } from '../capital/consts'
import { signProgramAgreement } from './signProgramAgreement'

// После Эпика 2 / компонента 48 подпись соглашения ЦПП «Цифровой Кошелёк»
// (program_id=1) идёт через `wallet::signagree`, а не `soviet::sndagreement`.
export async function signWalletAgreement(
  blockchain: any,
  coopname: string,
  username: string,
  fakeDocument: any,
) {
  return signProgramAgreement(
    blockchain,
    coopname,
    username,
    walletProgramId,
    walletDraftId,
    fakeDocument,
  )
}
