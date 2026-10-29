import {Migration} from '../src/migration_interface'
import { api } from '../src/eos'
import { Cooperative, DraftContract, SovietContract } from 'cooptypes';
import { Registry } from '@coopenomics/docs-factory';

export class InitialMigration implements Migration {
  async run(): Promise<void> {
    
    
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

    console.log("Шаблон отредактирован: ", params)
  }
    
    try {
      const id = 100
      
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
    
      
      
      console.log('update drafts successful');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}
