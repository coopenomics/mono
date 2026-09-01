import type { ComputedRef, InjectionKey, Ref } from 'vue'
import type { IIssue } from 'app/extensions/capital/entities/Issue/model'
import type { IProject } from 'app/extensions/capital/entities/Project/model'
import type { IGetStoriesInput } from 'app/extensions/capital/entities/Story/model'

export interface IssuePageContext {
  issue: Ref<IIssue | null>
  parentProject: Ref<IProject | null>
  projectHash: ComputedRef<string>
  logsRefreshTrigger: Ref<number>
  isAutoSaving: Ref<boolean>
  autoSaveError: Ref<string | null>
  requirementsFilter: ComputedRef<Partial<IGetStoriesInput['filter']>>
  createRequirementFilter: ComputedRef<{ project_hash: string; issue_hash: string }>
  canCreateRequirement: ComputedRef<boolean>
  linkedGitCommits: ComputedRef<unknown[]>
  handleDescriptionChange: () => Promise<void>
  openCreateRequirementDialog: () => void
  /** Перечитать задачу с сервера (после отката к редакции) */
  reloadIssue: () => Promise<void>
}

export const ISSUE_PAGE_KEY: InjectionKey<IssuePageContext> = Symbol('issuePage')
