import { DraftContract } from 'cooptypes'
import { ProgramAgreementsAnnulmentStatement } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'

export { ProgramAgreementsAnnulmentStatement as Template } from '../Templates'

/**
 * Заявление об аннулировании соглашений об участии в целевых потребительских
 * программах. Перечень программ, кошельки и остатки собирает сервер и передаёт
 * в `data.programs` — фабрика форматирует суммы и печатает их таблицей.
 */
export class Factory extends DocFactory<ProgramAgreementsAnnulmentStatement.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: ProgramAgreementsAnnulmentStatement.Action, _options?: IGenerationOptions): Promise<IGeneratedDocument> {
    const { template, coop, vars, userData } = await this.resolveParallel({
      template: () => process.env.SOURCE === 'local'
        ? Promise.resolve(ProgramAgreementsAnnulmentStatement.Template as ITemplate<ProgramAgreementsAnnulmentStatement.Model>)
        : this.getTemplate<ProgramAgreementsAnnulmentStatement.Model>(DraftContract.contractName.production, ProgramAgreementsAnnulmentStatement.registry_id, data.block_num),
      coop: () => super.getCooperative(data.coopname, data.block_num),
      vars: () => super.getVars(data.coopname, data.block_num),
      userData: () => super.getUser(data.username, data.block_num),
    })

    const meta: IMetaDocument = await super.getMeta({ title: template.title, ...data })

    const combinedData: ProgramAgreementsAnnulmentStatement.Model = {
      meta,
      coop,
      user: super.getCommonUser(userData),
      vars,
      exit_hash: data.exit_hash ?? '',
      programs: data.programs.map((program) => ({
        ...program,
        refund: this.formatAsset(program.refund),
        wallets: program.wallets.map((wallet) => ({ ...wallet, balance: this.formatAsset(wallet.balance) })),
      })),
      total_refund: this.formatAsset(data.total_refund),
    }

    await super.validate(combinedData, template.model)

    const translation = template.translations[meta.lang]

    return await super.generatePDF('', template.context, combinedData, translation, meta, data.skip_save)
  }
}
