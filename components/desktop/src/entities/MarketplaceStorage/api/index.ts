import { Mutations, Queries } from '@coopenomics/sdk'
import { client } from 'src/shared/api/client'
import type {
  MarketplaceContainerTypeView,
  MarketplaceContainerView,
  MarketplaceStorageCellView,
} from '../model/types'

/**
 * Эпик 19: адресное хранение на складе кооперативного участка.
 *
 * Один слой доступа на все экраны, которые работают с местами хранения —
 * стол «Боксы», раскладка, окно закрывающей подписи, склад участка и сводный
 * реестр администратора. Раскладывать эти вызовы по приватным api отдельных
 * страниц нельзя: повторение второй раз выносится в общее (правило DRY монорепы).
 */

// ─── Ячейки хранения (координаты «секция × ярус») ───

export type IListStorageCellsInput = Queries.Marketplace.ListStorageCells.IInput['data']

export async function listStorageCells(
  data?: IListStorageCellsInput,
): Promise<MarketplaceStorageCellView[]> {
  const { [Queries.Marketplace.ListStorageCells.name]: result } = await client.Query(
    Queries.Marketplace.ListStorageCells.query,
    { variables: { data: data ?? null } },
  )
  // Zeus отдаёт скаляр ID как unknown; сужаем идентификатор во вью-типе.
  return result as MarketplaceStorageCellView[]
}

export type ICreateStorageCellInput = Mutations.Marketplace.CreateStorageCell.IInput['data']

export async function createStorageCell(
  data: ICreateStorageCellInput,
): Promise<MarketplaceStorageCellView> {
  const { [Mutations.Marketplace.CreateStorageCell.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateStorageCell.mutation,
    { variables: { data } },
  )
  return result as MarketplaceStorageCellView
}

export type ICreateStorageGridInput = Mutations.Marketplace.CreateStorageGrid.IInput['data']

/** Завести сетку пачкой: секции × диапазон ярусов. Занятые координаты пропускаются. */
export async function createStorageGrid(
  data: ICreateStorageGridInput,
): Promise<MarketplaceStorageCellView[]> {
  const { [Mutations.Marketplace.CreateStorageGrid.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateStorageGrid.mutation,
    { variables: { data } },
  )
  return result as MarketplaceStorageCellView[]
}

export type IUpdateStorageCellInput = Mutations.Marketplace.UpdateStorageCell.IInput['data']

export async function updateStorageCell(
  data: IUpdateStorageCellInput,
): Promise<MarketplaceStorageCellView> {
  const { [Mutations.Marketplace.UpdateStorageCell.name]: result } = await client.Mutation(
    Mutations.Marketplace.UpdateStorageCell.mutation,
    { variables: { data } },
  )
  return result as MarketplaceStorageCellView
}

// ─── Боксы и их типы ───

export type IListContainersInput = Queries.Marketplace.ListContainers.IInput['data']

export async function listContainers(
  data?: IListContainersInput,
): Promise<MarketplaceContainerView[]> {
  const { [Queries.Marketplace.ListContainers.name]: result } = await client.Query(
    Queries.Marketplace.ListContainers.query,
    { variables: { data: data ?? null } },
  )
  return result as MarketplaceContainerView[]
}

export type IResolveContainerByCodeInput =
  Queries.Marketplace.ResolveContainerByCode.IInput['data']

/** Бокс по коду с этикетки или отсканированного QR. Бросает, если кода нет. */
export async function resolveContainerByCode(
  data: IResolveContainerByCodeInput,
): Promise<MarketplaceContainerView> {
  const { [Queries.Marketplace.ResolveContainerByCode.name]: result } = await client.Query(
    Queries.Marketplace.ResolveContainerByCode.query,
    { variables: { data } },
  )
  return result as MarketplaceContainerView
}

export async function listContainerTypes(
  isActive?: boolean,
): Promise<MarketplaceContainerTypeView[]> {
  const { [Queries.Marketplace.ListContainerTypes.name]: result } = await client.Query(
    Queries.Marketplace.ListContainerTypes.query,
    { variables: { is_active: isActive ?? null } },
  )
  return result as MarketplaceContainerTypeView[]
}

export type ICreateContainerTypeInput = Mutations.Marketplace.CreateContainerType.IInput['data']

export async function createContainerType(
  data: ICreateContainerTypeInput,
): Promise<MarketplaceContainerTypeView> {
  const { [Mutations.Marketplace.CreateContainerType.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateContainerType.mutation,
    { variables: { data } },
  )
  return result as MarketplaceContainerTypeView
}

export type ICreateContainersInput = Mutations.Marketplace.CreateContainers.IInput['data']

/** Завести партию боксов одного типа; коды выдаются последовательно (BX-0001…). */
export async function createContainers(
  data: ICreateContainersInput,
): Promise<MarketplaceContainerView[]> {
  const { [Mutations.Marketplace.CreateContainers.name]: result } = await client.Mutation(
    Mutations.Marketplace.CreateContainers.mutation,
    { variables: { data } },
  )
  return result as MarketplaceContainerView[]
}

export type IMoveContainerInput = Mutations.Marketplace.MoveContainer.IInput['data']

/** Поставить бокс в ячейку либо снять с адреса (`cell_id: null` — штатно). */
export async function moveContainer(
  data: IMoveContainerInput,
): Promise<MarketplaceContainerView> {
  const { [Mutations.Marketplace.MoveContainer.name]: result } = await client.Mutation(
    Mutations.Marketplace.MoveContainer.mutation,
    { variables: { data } },
  )
  return result as MarketplaceContainerView
}

export type IUpdateContainerInput = Mutations.Marketplace.UpdateContainer.IInput['data']

export async function updateContainer(
  data: IUpdateContainerInput,
): Promise<MarketplaceContainerView> {
  const { [Mutations.Marketplace.UpdateContainer.name]: result } = await client.Mutation(
    Mutations.Marketplace.UpdateContainer.mutation,
    { variables: { data } },
  )
  return result as MarketplaceContainerView
}

export const api = {
  listStorageCells,
  createStorageCell,
  createStorageGrid,
  updateStorageCell,
  listContainers,
  resolveContainerByCode,
  listContainerTypes,
  createContainerType,
  createContainers,
  moveContainer,
  updateContainer,
}
