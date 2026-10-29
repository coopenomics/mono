import {Migration} from '../../src/migration_interface'
import { api } from '../../src/eos'
import { Cooperative, DraftContract, SovietContract } from 'cooptypes';
import { Registry } from '@coopenomics/docs-factory';

export class InitialMigration implements Migration {
  async run(): Promise<void> {
    
    
  const createDraft = async(params: DraftContract.Actions.CreateDraft.ICreateDraft) => {
    
    await api.transact(
      {
        actions: [
          {
            account: DraftContract.contractName.production,
            name: DraftContract.Actions.CreateDraft.actionName,
            authorization: [
              {
                actor: 'eosio',
                permission: "active",
              },
            ],
            data: {
              ...params,
            },
          },
        ],
      },
      {
        blocksBehind: 3,
        expireSeconds: 30,
      }
    )

    console.log("Шаблон создан: ", params)
  }
    
    try {
      for (const id in Registry) {
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
      }
      
      
      console.log('update drafts successful');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}
