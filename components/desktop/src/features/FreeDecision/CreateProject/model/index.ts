import { client } from 'src/shared/api/client'
import { Mutations } from '@coopenomics/sdk'
import { ref } from 'vue'
import type { Ref } from 'vue'
import type { ICreatedProjectDecisionData, IGeneratedProjectDecisionDocument } from 'src/entities/Decision/model'
import { signDocument } from 'src/shared/lib/document'

export type ICreateProjectDecisionData = Mutations.FreeDecisions.CreateProjectOfFreeDecision.IInput['data']

export function useCreateProjectOfFreeDecision() {
  const createProjectInput: Ref<ICreateProjectDecisionData> = ref({
    title: '',
    decision: '',
    question: ''
  })

  /**
   * Создает проект свободного решения
   */
  async function createProject(coopname: string, username: string) {
    const createdProject = await createProjectOfFreeDecision()

    const title = createProjectInput.value.title?.trim()
    const normalizedTitle = title ? title.substring(0, 200) : undefined

    const generatedDocument = await generateProjectDocumentOfFreeDecision({
      coopname: coopname,
      project_id: createdProject.id,
      username: username,
      title: normalizedTitle,
    })


    const signedDocument = await signDocument(generatedDocument, username)

    await publishProjectOfFreeDecision({
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
    )

    return project
  }

  /**
   * Генерирует документ проекта свободного решения
   */
  async function generateProjectDocumentOfFreeDecision(data: Mutations.FreeDecisions.GenerateProjectOfFreeDecision.IInput['data']): Promise<IGeneratedProjectDecisionDocument> {
    const { [Mutations.FreeDecisions.GenerateProjectOfFreeDecision.name]: document } = await client.Mutation(
      Mutations.FreeDecisions.GenerateProjectOfFreeDecision.mutation,
      {
        variables: {
          data,
        },
      }
    )

    return document
  }

  /**
   * Публикует проект свободного решения
   */
  async function publishProjectOfFreeDecision(data: Mutations.FreeDecisions.PublishProjectOfFreeDecision.IInput['data']): Promise<Mutations.FreeDecisions.PublishProjectOfFreeDecision.IOutput[typeof Mutations.FreeDecisions.PublishProjectOfFreeDecision.name]> {
    const { [Mutations.FreeDecisions.PublishProjectOfFreeDecision.name]: result } = await client.Mutation(
      Mutations.FreeDecisions.PublishProjectOfFreeDecision.mutation,
      {
        variables: {
          data,
        },
      }
    )

    return result
  }

  return {
    createProjectInput,
    createProject,
    createProjectOfFreeDecision,
    generateProjectDocumentOfFreeDecision,
    publishProjectOfFreeDecision
  }
}
