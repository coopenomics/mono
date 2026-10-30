import {Migration} from '../../src/migration_interface'
import { api } from '../../src/eos'
import { DraftContract, SovietContract } from 'cooptypes';
import { Registry as DocsRegistry } from '@coopenomics/docs-templates';
import { Registry } from '@coopenomics/docs-factory';

export class InitialMigration implements Migration {
  async run(): Promise<void> {
    
  const createProgram = async(
      params: SovietContract.Actions.Programs.CreateProgram.ICreateProgram
    ) => {
      await api.transact(
        {
          actions: [
            {
              account: SovietContract.contractName.production,
              name: SovietContract.Actions.Programs.CreateProgram.actionName,
              authorization: [
                {
                  actor: params.username,
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
  
      console.log("Программа установлена: ", params)
    }
  
    
    try {
      await createProgram({
        coopname: 'voskhod',
        username: 'ant',
        draft_id: DocsRegistry.WalletAgreement.registry_id,
        title: "Цифровой Кошелёк",
        announce: "",
        description: "",
        preview: "",
        images: "",
        calculation_type: "free",
        fixed_membership_contribution: `${Number(0).toFixed(4)} RUB`,
        membership_percent_fee: "0",
        meta: "",
      })
      
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}
