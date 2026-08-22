import { Cooperative, DraftContract, SovietContract } from 'cooptypes';
import { Registry } from '@coopenomics/factory';
import type { Migration } from '../src/migration_interface';
import { api } from '../src/eos';
import { createDraft } from '../src/utils/createDraft';

export class InitialMigration implements Migration {
  async run(): Promise<void> {
    const ids = [1030];
    for (const id of ids) {
      try {
        const template = Registry[id as unknown as keyof typeof Registry];
        if (!template) {
          console.warn(`Template for registry_id ${id} not found in Registry.`);
          continue;
        }
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
        });
        console.log(`Draft for registry_id ${id} created successfully`);
      } catch (error) {
        console.error(`Error during migration for registry_id ${id}:`, error);
      }
    }
  }
}
