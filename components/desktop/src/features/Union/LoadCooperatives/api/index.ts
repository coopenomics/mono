import { RegistratorContract } from 'cooptypes';
import { fetchTable } from 'src/shared/api';
import { client } from 'src/shared/api/client';
import { Queries } from '@coopenomics/sdk';

async function loadCoopByUsername(coopname: string): Promise<RegistratorContract.Tables.Cooperatives.ICooperative> {
  const coop = (await fetchTable(
    RegistratorContract.contractName.production,
    RegistratorContract.contractName.production,
    RegistratorContract.Tables.Cooperatives.tableName,
    coopname,
    coopname,
    1
  ))[0] as RegistratorContract.Tables.Cooperatives.ICooperative;


  return coop;
}


/**
 * Реестр кооперативов оператора грузится через бэкенд (coopback GraphQL),
 * а не напрямую из блокчейна: бэкенд сводит on-chain список кооперативов
 * с данными провайдера (подписки / инстанс / биллинг по coopname).
 */
async function loadCoops(): Promise<Queries.System.GetCooperativesRegistry.IOutput['getCooperativesRegistry']> {
  const { [Queries.System.GetCooperativesRegistry.name]: result } = await client.Query(
    Queries.System.GetCooperativesRegistry.query
  );

  return result;
}

export const api = {
  loadCoops,
  loadCoopByUsername
}
