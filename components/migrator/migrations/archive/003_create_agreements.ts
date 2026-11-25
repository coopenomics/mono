import {Migration} from '../src/migration_interface'
import { api } from '../src/eos'
import { DraftContract, SovietContract } from 'cooptypes';
import { Registry as DocsRegistry } from '@coopenomics/docs-templates';
import { Registry } from '@coopenomics/docs-factory';

export class InitialMigration implements Migration {
  async run(): Promise<void> {
    
    
  const makeCoagreement = async(
    params: SovietContract.Actions.Agreements.MakeCoagreement.IMakeCoagreement
    ) => {
      await api.transact(
        {
          actions: [
            {
              account: SovietContract.contractName.production,
              name: SovietContract.Actions.Agreements.MakeCoagreement.actionName,
              authorization: [
                {
                  actor: params.administrator,
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
      
      console.log("Соглашение установлено: ", params)
    }
  
    
    try {
      // await makeCoagreement({
      //   coopname: 'voskhod',
      //   administrator: 'voskhod',
      //   type: "wallet",
      //   draft_id: DocsRegistry.WalletAgreement.registry_id,
      //   program_id: 1,
      // })
  
      // await makeCoagreement({
      //   coopname: 'voskhod',
      //   administrator: 'voskhod',
      //   type: "signature",
      //   draft_id: DocsRegistry.RegulationElectronicSignature.registry_id,
      //   program_id: 0,
      // })
      
      await makeCoagreement({
        coopname: 'voskhod',
        administrator: 'voskhod',
        type: "user",
        draft_id: DocsRegistry.UserAgreement.registry_id,
        program_id: 0,
      })
  
      await makeCoagreement({
        coopname: 'voskhod',
        administrator: 'voskhod',
        type: "privacy",
        draft_id: DocsRegistry.PrivacyPolicy.registry_id,
        program_id: 0,
      })
  
      await makeCoagreement({
        coopname: 'voskhod',
        administrator: 'voskhod',
        type: "coopenomics",
        draft_id: DocsRegistry.CoopenomicsAgreement.registry_id,
        program_id: 0,
      })
      
      console.log('Все соглашения установлены');
    } catch (error) {
      console.error('Error during migration:', error);
    }
  }
}
