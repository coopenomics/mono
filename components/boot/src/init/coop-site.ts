import { RegistratorContract } from 'cooptypes'
import config, { siteDomainOf } from '../configs'
import Blockchain from '../blockchain'

export interface WriteCoopSiteOptions {
  /** Аккаунт кооператива; по умолчанию — ведущий сети стенда. */
  coopname?: string
  /** Домен сайта; по умолчанию — COOP_SITE_DOMAIN стенда. */
  site?: string
}

/**
 * Записать сайт кооператива стенда в реестр цепи (поле `announce` его строки).
 *
 * Стенд уже работает, а адрес его сайта сменился либо был пуст: полный
 * перезапуск ради одного поля не делается. По этому домену другие узлы сети
 * зовут узел кооператива (`https://<домен>/backend/v1/graphql`), рабочий стол
 * строит ссылку на кабинет у оператора, провайдер читает его как домен
 * кооператива.
 *
 * `updatecoop` переписывает вместе с адресом взносы и описание, поэтому они
 * читаются из текущей строки и возвращаются без изменений. Совпавший адрес
 * транзакцию не шлёт.
 */
export async function writeCoopSite(opts: WriteCoopSiteOptions = {}): Promise<void> {
  const coopname = opts.coopname ?? config.provider
  const site = siteDomainOf(opts.site) || config.site

  const blockchain = new Blockchain(config.network, config.private_keys)
  await blockchain.update_pass_instance()

  const contract = RegistratorContract.contractName.production
  const rows = await blockchain.getTableRows(contract, contract, 'coops', 1, coopname, coopname)
  const row = rows[0]
  if (!row || row.username !== coopname || !row.is_cooperative)
    throw new Error(`Кооператив ${coopname} в реестре цепи не найден`)

  if (row.announce === site) {
    console.log(`Сайт кооператива ${coopname} в цепи уже ${site} — запись не требуется`)
    return
  }

  const data: RegistratorContract.Actions.UpdateCoop.IUpdateCoop = {
    coopname,
    username: coopname,
    initial: row.initial,
    minimum: row.minimum,
    org_initial: row.org_initial,
    org_minimum: row.org_minimum,
    announce: site,
    description: row.description,
  }

  await blockchain.api.transact(
    {
      actions: [
        {
          account: contract,
          name: RegistratorContract.Actions.UpdateCoop.actionName,
          authorization: [{ actor: coopname, permission: 'active' }],
          data,
        },
      ],
    },
    { blocksBehind: 3, expireSeconds: 30 },
  )

  console.log(`Сайт кооператива ${coopname} в цепи: ${row.announce || '(пусто)'} → ${site}`)
}
