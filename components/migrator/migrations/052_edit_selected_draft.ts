import { Cooperative, DraftContract, SovietContract } from 'cooptypes'
import { editTranslation } from '../src/utils/editTranslation'
import type { Migration } from '../src/migration_interface'
import { editDraft } from '../src/utils/editDraft'
import { Registry } from '@coopenomics/factory'
import { api } from '../src/eos'

export class InitialMigration implements Migration {
  async run(): Promise {
    const ids = [994, 995, 996, 998, 999, 1000]

    for (const id of ids) {
      try {
        const drafts = await api.rpc.get_table_rows({
          json: true,
          code: 'draft',
          scope: 'draft',
          table: 'drafts',
          limit: 1000,
        })

        const target = drafts.rows.find((draft) => draft.registry_id === id)
        if (!target) {
          console.warn(`Draft with registry_id ${id} not found.`)
          continue
        }

        const template = Registry[id as unknown as keyof typeof Registry]
        if (!template) {
          console.warn(`Template for registry_id ${id} not found in Registry.`)
          continue
        }

        await editDraft({
          scope: DraftContract.contractName.production,
          username: 'eosio',
          registry_id: id,
          title: template.Template.title,
          description: template.Template.description,
          context: template.Template.context,
          model: JSON.stringify(template.Template.model),
        })

        await editTranslation({
          scope: DraftContract.contractName.production,
          username: 'eosio',
          translate_id: target.default_translation_id,
          data: JSON.stringify(template.Template.translations.ru),
        })

        console.log(`Update for registry_id ${id} successful`)
      } catch (error) {
        console.error(`Error during migration for registry_id ${id}:`, error)
      }
    }
  }
}
