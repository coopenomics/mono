import { Mutations, Queries } from '@coopenomics/sdk';
import { client } from 'src/shared/api/client';

/**
 * Справочник разделов и уровней каталога (7DD-23): раздел — область знаний,
 * уровень — ступень внутри раздела, порядок уровней — их последовательность.
 * Курс ссылается на записи справочника; ведёт справочник администратор.
 */
export type ISection = Queries.Edubridge.Sections.IOutput['edubridgeSections'][number];
export type ILevel = ISection['levels'][number];
export type ISectionsFilter = NonNullable<Queries.Edubridge.Sections.IInput['filter']>;

export async function fetchSections(filter: ISectionsFilter = {}): Promise<ISection[]> {
  const { [Queries.Edubridge.Sections.name]: result } = await client.Query(Queries.Edubridge.Sections.query, { variables: { filter } });
  return result;
}

export async function saveSection(data: Mutations.Edubridge.SaveSection.IInput['data']): Promise<ISection> {
  const { [Mutations.Edubridge.SaveSection.name]: result } = await client.Mutation(Mutations.Edubridge.SaveSection.mutation, { variables: { data } });
  return result;
}

export async function saveLevel(data: Mutations.Edubridge.SaveLevel.IInput['data']): Promise<ILevel> {
  const { [Mutations.Edubridge.SaveLevel.name]: result } = await client.Mutation(Mutations.Edubridge.SaveLevel.mutation, { variables: { data } });
  return result;
}

export async function reorderSections(ids: string[]): Promise<ISection[]> {
  const { [Mutations.Edubridge.ReorderSections.name]: result } = await client.Mutation(Mutations.Edubridge.ReorderSections.mutation, { variables: { data: { ids } } });
  return result;
}

export async function reorderLevels(section_id: string, ids: string[]): Promise<ISection[]> {
  const { [Mutations.Edubridge.ReorderLevels.name]: result } = await client.Mutation(Mutations.Edubridge.ReorderLevels.mutation, { variables: { data: { section_id, ids } } });
  return result;
}

export async function archiveSection(id: string, archived: boolean): Promise<ISection> {
  const { [Mutations.Edubridge.ArchiveSection.name]: result } = await client.Mutation(Mutations.Edubridge.ArchiveSection.mutation, { variables: { data: { id, archived } } });
  return result;
}

export async function archiveLevel(id: string, archived: boolean): Promise<ILevel> {
  const { [Mutations.Edubridge.ArchiveLevel.name]: result } = await client.Mutation(Mutations.Edubridge.ArchiveLevel.mutation, { variables: { data: { id, archived } } });
  return result;
}
