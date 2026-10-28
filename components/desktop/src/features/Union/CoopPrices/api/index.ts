import { client } from 'src/shared/api/client';
import { Mutations, Queries } from '@coopenomics/sdk';

export type ICoopPrice = Queries.System.GetCoopPrices.IOutput[typeof Queries.System.GetCoopPrices.name][number];
export type ISetCoopPriceInput = Mutations.System.SetCoopPrice.IInput['data'];
export type IRemoveCoopPriceInput = Mutations.System.RemoveCoopPrice.IInput['data'];
export type ICoopService = Queries.System.GetProviderConnectionCatalog.IOutput[typeof Queries.System.GetProviderConnectionCatalog.name]['types'][number];

/** Индивидуальные цены услуг кооператива у оператора. */
async function loadCoopPrices(coopname: string): Promise<ICoopPrice[]> {
  const { [Queries.System.GetCoopPrices.name]: result } = await client.Query(Queries.System.GetCoopPrices.query, {
    variables: { coopname },
  });
  return result;
}

/** Услуги, доступные кооперативу у провайдера: список для назначения цены. */
async function loadCoopServices(coopname: string): Promise<ICoopService[]> {
  const { [Queries.System.GetProviderConnectionCatalog.name]: catalog } = await client.Query(
    Queries.System.GetProviderConnectionCatalog.query,
    { variables: { coopname } },
  );
  return catalog.types;
}

async function setCoopPrice(data: ISetCoopPriceInput): Promise<ICoopPrice> {
  const { [Mutations.System.SetCoopPrice.name]: result } = await client.Mutation(Mutations.System.SetCoopPrice.mutation, {
    variables: { data },
  });
  return result;
}

async function removeCoopPrice(data: IRemoveCoopPriceInput): Promise<boolean> {
  const { [Mutations.System.RemoveCoopPrice.name]: result } = await client.Mutation(
    Mutations.System.RemoveCoopPrice.mutation,
    { variables: { data } },
  );
  return result;
}

export const api = { loadCoopPrices, loadCoopServices, setCoopPrice, removeCoopPrice };
