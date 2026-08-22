import { Mutations } from '@coopenomics/sdk'
import type { ICreatedProjectDecisionData, IGeneratedProjectDecisionDocument } from 'src/entities/Decision/model';
import type { IAgenda } from 'src/entities/Agenda/model';
import { client } from 'src/shared/api/client';
import { useSignDocument } from 'src/shared/lib/document';
import { ref, type Ref } from 'vue';

export type ICreateProjectDecisionData = Mutations.FreeDecisions.CreateProjectOfFreeDecision.IInput['data']

export function useCreateProjectOfFreeDecision() {

  const createProjectInput: Ref<ICreateProjectDecisionData> = ref({
    title: '',
    decision: '',
    question: ''
  });

  // Возвращает созданный пункт повестки (или null, если бэкенд не успел его
  // извлечь из блокчейна) — чтобы кнопка вставила его в таблицу немедленно.
  async function createProject(coopname: string, username: string): Promise<IAgenda | null> {
    const createdProject = await createProjectOfFreeDecision()

    const title = createProjectInput.value.title?.trim();
    const normalizedTitle = title ? title.substring(0, 200) : undefined;

    const generatedDocument = await generateProjectDocumentOfFreeDecision({
      coopname: coopname,
      project_id: createdProject.id,
      username: username,
      title: normalizedTitle,
    })

    const { signDocument } = useSignDocument()

    const signedDocument = await signDocument(generatedDocument, username)

    return await publishProjectOfFreeDecision({
      coopname: coopname,
      document: signedDocument,
      meta: normalizedTitle ? JSON.stringify({ title: normalizedTitle }) : '',
      username: username
    })
  }

  async function createProjectOfFreeDecision(): Promise<ICreatedProjectDecisionData> {
    const { [Mutations.FreeDecisions.CreateProjectOfFreeDecision.name]: project } = await client.Mutation(
      Mutations.FreeDecisions.CreateProjectOfFreeDecision.mutation,
      {
        variables: {
          data: createProjectInput.value,
        },
      }
    );

    return project
  }

  async function generateProjectDocumentOfFreeDecision(data: Mutations.FreeDecisions.GenerateProjectOfFreeDecision.IInput['data']): Promise<IGeneratedProjectDecisionDocument> {
    const { [Mutations.FreeDecisions.GenerateProjectOfFreeDecision.name]: document } = await client.Mutation(
      Mutations.FreeDecisions.GenerateProjectOfFreeDecision.mutation,
      {
        variables: {
          data,
        },
      }
    );

    return document
  }


  // Публикует решение и возвращает созданный пункт повестки (бэкенд извлекает его
  // из блокчейна с settle-паузой) либо null, если он ещё не проиндексирован.
  async function publishProjectOfFreeDecision(data: Mutations.FreeDecisions.PublishProjectOfFreeDecision.IInput['data']): Promise<IAgenda | null> {
    const { [Mutations.FreeDecisions.PublishProjectOfFreeDecision.name]: result } = await client.Mutation(
      Mutations.FreeDecisions.PublishProjectOfFreeDecision.mutation,
      {
        variables: {
          data,
        },
      }
    );

    // Поле publishProjectOfFreeDecision nullable в схеме → result может быть
    // undefined; приводим к null, чтобы попасть в объявленный IAgenda | null.
    return result ?? null
  }

  return {
    createProjectInput,
    createProject,
    createProjectOfFreeDecision,
    generateProjectDocumentOfFreeDecision,
    publishProjectOfFreeDecision
  }
}
