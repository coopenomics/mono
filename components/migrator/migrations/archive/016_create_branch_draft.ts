import { Cooperative, DraftContract, SovietContract } from 'cooptypes';
import { Registry } from '@coopenomics/docs-factory';
import type { Migration } from '../../src/migration_interface';
import { api } from '../../src/eos';
import { createDraft } from '../../src/utils/createDraft';

export class InitialMigration implements Migration {
  async run(): Promise<void> {
    
    try {
      
        const id = 101 //selectBranch
        const template = Registry[(id as unknown) as keyof typeof Registry]
    
        await createDraft({
          scope: DraftContract.contractName.production,
          username: 'eosio',
          registry_id: id,
          lang: 'ru',
          title: template.Template.title,
          description: template.Template.description,
          context: template.Template.context,
          model: JSON.stringify(template.Template.model),
          translation_data: JSON.stringify(template.Template.translations.ru),
        })
      
      console.log('update drafts successful');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}
