import { Cooperative, DraftContract, SovietContract } from 'cooptypes';
import { Registry } from '@coopenomics/docs-factory';
import type { Migration } from '../../src/migration_interface';
import { api } from '../../src/eos';
import { editDraft } from '../../src/utils/editDraft';
import { editTranslation } from '../../src/utils/editTranslation';

export class InitialMigration implements Migration {
  async run(): Promise<void> {
    
    try {
      const id = 101 //selectBranch
          
      const drafts = await api.rpc.get_table_rows({json: true, code: 'draft', scope: 'draft', table: 'drafts'})
        
        const target = drafts.rows.find(draft => draft.registry_id == id)
        
        const template = Registry[(id as unknown) as keyof typeof Registry]
    
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
          data: JSON.stringify(template.Template.translations.ru)
        })
      
      console.log('update drafts successful');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}
