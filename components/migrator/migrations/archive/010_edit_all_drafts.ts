import {Migration} from '../src/migration_interface'
import { api } from '../src/eos'
import { Cooperative, DraftContract, SovietContract } from 'cooptypes';
import { Registry } from '@coopenomics/docs-factory';

export class InitialMigration implements Migration {
  async run(): Promise<void> {
  
  const editTranslation = async(params: DraftContract.Actions.EditTranslation.IEditTranslation) => {
    await api.transact({
        actions: [
          {
            account: DraftContract.contractName.production,
            name: DraftContract.Actions.EditTranslation.actionName,
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
    
    console.log("Перевод установлен для:", params.translate_id)
  }
    
  const editDraft = async(params: DraftContract.Actions.EditDraft.IEditDraft) => {
    
    await api.transact(
      {
        actions: [
          {
            account: DraftContract.contractName.production,
            name: DraftContract.Actions.EditDraft.actionName,
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

    console.log("Шаблон отредактирован: ", params.title, params.registry_id)
  }
    
    try {
      const drafts = await api.rpc.get_table_rows({json: true, code: 'draft', scope: 'draft', table: 'drafts'})
      // console.log(drafts)
      
      for (const draft of drafts.rows) {
        const template = Registry[(draft.registry_id as unknown) as keyof typeof Registry]
     
        await editDraft({
          scope: DraftContract.contractName.production,
          username: 'eosio',
          registry_id: draft.registry_id,
          title: template.Template.title,
          description: template.Template.description,
          context: template.Template.context,
          model: JSON.stringify(template.Template.model),
        })
        
        await editTranslation({
          scope: DraftContract.contractName.production,
          username: 'eosio',
          translate_id: draft.default_translation_id,
          data: JSON.stringify(template.Template.translations.ru)
        })
      
    }  
      
      console.log('update drafts successful');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}
