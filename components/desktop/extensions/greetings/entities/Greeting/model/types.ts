import type { Mutations, Queries } from '@coopenomics/sdk';

/** Шаблон поздравления. */
export type IGreetingTemplate = Queries.Greetings.GetTemplate.IOutput[typeof Queries.Greetings.GetTemplate.name];
/** Переменная шаблона для панели вставки. */
export type IGreetingVariable = Queries.Greetings.GetVariables.IOutput[typeof Queries.Greetings.GetVariables.name][number];
/** Письмо на пайщике. */
export type IGreetingPreview = Queries.Greetings.GetPreview.IOutput[typeof Queries.Greetings.GetPreview.name];
/** День рождения пайщика в календаре. */
export type IGreetingCalendarEntry = Queries.Greetings.GetCalendar.IOutput[typeof Queries.Greetings.GetCalendar.name][number];
/** Страница журнала поздравлений. */
export type IGreetingJournalPage = Queries.Greetings.GetJournal.IOutput[typeof Queries.Greetings.GetJournal.name];
/** Запись журнала. */
export type IGreetingSend = IGreetingJournalPage['items'][number];

export type ISaveTemplateInput = Mutations.Greetings.SaveTemplate.IInput['data'];
export type IPreviewInput = Queries.Greetings.GetPreview.IInput['data'];
export type IJournalOptions = Queries.Greetings.GetJournal.IInput['options'];
