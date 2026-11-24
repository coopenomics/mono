import { client } from 'src/shared/api/client';
import { Mutations, Queries, Zeus } from '@coopenomics/sdk';
import type {
  IGreetingCalendarEntry,
  IGreetingJournalPage,
  IGreetingPreview,
  IGreetingTemplate,
  IGreetingVariable,
  IJournalOptions,
  IPreviewInput,
  ISaveTemplateInput,
} from '../model';

/** API приложения «Поздравления»: только типизированные операции SDK. */
async function loadTemplates(): Promise<IGreetingTemplate[]> {
  const { [Queries.Greetings.GetTemplates.name]: output } = await client.Query(Queries.Greetings.GetTemplates.query);
  return output;
}

async function loadTemplate(id: string): Promise<IGreetingTemplate> {
  const { [Queries.Greetings.GetTemplate.name]: output } = await client.Query(Queries.Greetings.GetTemplate.query, {
    variables: { id },
  });
  return output;
}

async function loadVariables(): Promise<IGreetingVariable[]> {
  const { [Queries.Greetings.GetVariables.name]: output } = await client.Query(Queries.Greetings.GetVariables.query);
  return output;
}

async function loadPreview(data: IPreviewInput): Promise<IGreetingPreview> {
  const { [Queries.Greetings.GetPreview.name]: output } = await client.Query(Queries.Greetings.GetPreview.query, {
    variables: { data },
  });
  return output;
}

async function loadCalendar(year: number, month: number): Promise<IGreetingCalendarEntry[]> {
  const { [Queries.Greetings.GetCalendar.name]: output } = await client.Query(Queries.Greetings.GetCalendar.query, {
    variables: { year, month },
  });
  return output;
}

async function loadUpcoming(limit: number): Promise<IGreetingCalendarEntry[]> {
  const { [Queries.Greetings.GetUpcoming.name]: output } = await client.Query(Queries.Greetings.GetUpcoming.query, {
    variables: { limit },
  });
  return output;
}

async function loadJournal(options: IJournalOptions): Promise<IGreetingJournalPage> {
  const { [Queries.Greetings.GetJournal.name]: output } = await client.Query(Queries.Greetings.GetJournal.query, {
    variables: { options },
  });
  return output;
}

async function saveTemplate(data: ISaveTemplateInput): Promise<IGreetingTemplate> {
  const { [Mutations.Greetings.SaveTemplate.name]: output } = await client.Mutation(Mutations.Greetings.SaveTemplate.mutation, {
    variables: { data },
  });
  return output;
}

async function setTemplateStatus(id: string, status: Zeus.GreetingTemplateStatus): Promise<IGreetingTemplate> {
  const { [Mutations.Greetings.SetTemplateStatus.name]: output } = await client.Mutation(
    Mutations.Greetings.SetTemplateStatus.mutation,
    { variables: { id, status } },
  );
  return output;
}

async function deleteTemplate(id: string): Promise<boolean> {
  const { [Mutations.Greetings.DeleteTemplate.name]: output } = await client.Mutation(
    Mutations.Greetings.DeleteTemplate.mutation,
    { variables: { id } },
  );
  return output;
}

export const greetingsApi = {
  loadTemplates,
  loadTemplate,
  loadVariables,
  loadPreview,
  loadCalendar,
  loadUpcoming,
  loadJournal,
  saveTemplate,
  setTemplateStatus,
  deleteTemplate,
};
