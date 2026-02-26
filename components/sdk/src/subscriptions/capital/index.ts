export const IssueUpdated = {
  name: 'capitalIssueUpdated' as const,
  subscription: {
    capitalIssueUpdated: [
      { project_hash: '' },
      {
        id: true,
        issue_hash: true,
        title: true,
        status: true,
        priority: true,
        estimate: true,
        created_by: true,
        submaster: true,
        creators: true,
        project_hash: true,
      },
    ],
  },
}

export const IssueCreated = {
  name: 'capitalIssueCreated' as const,
  subscription: {
    capitalIssueCreated: [
      { project_hash: '' },
      {
        id: true,
        issue_hash: true,
        title: true,
        status: true,
        priority: true,
        estimate: true,
        created_by: true,
        submaster: true,
        creators: true,
        project_hash: true,
      },
    ],
  },
}

export const CommitCreated = {
  name: 'capitalCommitCreated' as const,
  subscription: {
    capitalCommitCreated: [
      { project_hash: '' },
      {
        id: true,
        commit_hash: true,
        hours: true,
        description: true,
        status: true,
        created_by: true,
        project_hash: true,
      },
    ],
  },
}

export const CommitUpdated = {
  name: 'capitalCommitUpdated' as const,
  subscription: {
    capitalCommitUpdated: [
      { project_hash: '' },
      {
        id: true,
        commit_hash: true,
        hours: true,
        description: true,
        status: true,
        created_by: true,
        project_hash: true,
      },
    ],
  },
}
