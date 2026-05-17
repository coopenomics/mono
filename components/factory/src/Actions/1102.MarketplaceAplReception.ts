import { DraftContract } from 'cooptypes'
import { MarketplaceAplReception } from '../Templates'
import { DocFactory } from '../Factory'
import type { IGeneratedDocument, IGenerationOptions, IMetaDocument, ITemplate } from '../Interfaces'
import type { MongoDBConnector } from '../Services/Databazor'
import type { ExternalOrganizationData } from '../Models'

export { MarketplaceAplReception as Template } from '../Templates'

export class Factory extends DocFactory<MarketplaceAplReception.Action> {
  constructor(storage: MongoDBConnector) {
    super(storage)
  }

  async generateDocument(data: MarketplaceAplReception.Action, options?: IGenerationOptions): Promise<IGeneratedDocument> {
    let template: ITemplate<MarketplaceAplReception.Model>

    if (process.env.SOURCE === 'local') {
      template = MarketplaceAplReception.Template
    }
    else {
      template = await this.getTemplate(DraftContract.contractName.production, MarketplaceAplReception.registry_id, data.block_num)
    }

    const meta: IMetaDocument = await this.getMeta({ title: template.title, ...data })
    const coop = await this.getCooperative(data.coopname, data.block_num)
    const vars = await this.getVars(data.coopname, data.block_num)

    // `user` = пайщик-получатель имущества (USERNAME = data.username).
    const user = await this.getUser(data.username, data.block_num)

    // `transmitter` = USERNAME председателя КУ или доверенного им лицa —
    // тот, кто передаёт имущество пайщику.
    const transmitter = await this.getUser(data.transmitter, data.block_num)

    const request = await this.getRequest(Number(data.order_id), data.block_num)

    const commonUser = this.getCommonUser(user)

    if (coop.is_branched && !data.braname)
      throw new Error('Branch name is required')

    let branch: ExternalOrganizationData | undefined
    if (data.braname)
      branch = await this.getOrganization(data.braname, data.block_num)

    const program = await this.getProgram(request.program_id)

    // АПП выдачи пайщику в Marketplace не сопровождается отдельным
    // протоколом совета — поле `decision` заполняем заглушкой для
    // совместимости с шаблоном 802. Реальное основание выдачи —
    // консолидированная заявка cycle_id, она попадает в meta.
    const decision = {
      id: 0,
      date: meta.created_at.split(' ')[0] ?? '',
      time: meta.created_at.split(' ')[1] ?? '',
      votes_for: 0,
      votes_against: 0,
      votes_abstained: 0,
      voters_percent: 0,
    }

    const combinedData: MarketplaceAplReception.Model = {
      meta,
      coop,
      vars,
      user: commonUser,
      request,
      decision,
      program,
      act_id: data.act_id,
      transmitter: this.getFirstLastMiddleName(transmitter.data),
      branch,
    }

    await this.validate(combinedData, template.model)
    const translation = template.translations[meta.lang]
    const document: IGeneratedDocument = await this.generatePDF(commonUser.full_name_or_short_name, template.context, combinedData, translation, meta, options?.skip_save)

    return document
  }
}
