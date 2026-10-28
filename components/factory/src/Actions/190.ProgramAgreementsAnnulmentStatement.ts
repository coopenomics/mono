import { defineBuilder } from '../Builder'
import * as Format from '../Format'
import { ProgramAgreementsAnnulmentStatement } from '../Templates'

export { ProgramAgreementsAnnulmentStatement as Template } from '../Templates'

/** Заявление об аннулировании соглашений ЦПП: пайщик, кооператив, программы с кошельками и возвратами. */
export const Factory = defineBuilder<ProgramAgreementsAnnulmentStatement.Action, ProgramAgreementsAnnulmentStatement.Model>()({
  registry_id: ProgramAgreementsAnnulmentStatement.registry_id,
  version: 1,
  reads: ({ data, f }) => ({
    coop: () => f.getCooperative(data.coopname, data.block_num),
    vars: () => f.getVars(data.coopname, data.block_num),
    userData: () => f.getUser(data.username, data.block_num),
  }),
  assemble: ({ data, meta, reads: { coop, vars, userData } }) => ({
    meta,
    coop,
    user: Format.commonUser(userData),
    vars,
    exit_hash: data.exit_hash ?? '',
    programs: data.programs.map(program => ({
      ...program,
      refund: Format.formatAsset(program.refund),
      wallets: program.wallets.map(wallet => ({ ...wallet, balance: Format.formatAsset(wallet.balance) })),
    })),
    total_refund: Format.formatAsset(data.total_refund),
  }),
})
