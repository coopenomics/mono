import { computeDocumentState } from '~/domain/document-approval/services/compute-document-state';
import { DocumentApprovalRequirement, DocumentApprovalState } from '~/domain/document-approval/enums/document-approval.enums';

const required = DocumentApprovalRequirement.Required;

describe('computeDocumentState', () => {
  it('служебный документ утверждения не требует', () => {
    expect(
      computeDocumentState({ approval: DocumentApprovalRequirement.None, current_version: 5, approved_version: null, pending: false })
    ).toBe(DocumentApprovalState.NotRequired);
  });

  it('без утверждения и без повестки — не утверждён', () => {
    expect(computeDocumentState({ approval: required, current_version: 3, approved_version: null, pending: false })).toBe(
      DocumentApprovalState.NotApproved
    );
  });

  it('проект решения в повестке — pending, даже если редакция устарела или не утверждена', () => {
    expect(computeDocumentState({ approval: required, current_version: 4, approved_version: 3, pending: true })).toBe(
      DocumentApprovalState.Pending
    );
    expect(computeDocumentState({ approval: required, current_version: 4, approved_version: null, pending: true })).toBe(
      DocumentApprovalState.Pending
    );
  });

  it('утверждённая редакция равна редакции в сети — утверждён', () => {
    expect(computeDocumentState({ approval: required, current_version: 3, approved_version: 3, pending: false })).toBe(
      DocumentApprovalState.Approved
    );
  });

  it('в сети редакция новее утверждённой — устарел', () => {
    expect(computeDocumentState({ approval: required, current_version: 4, approved_version: 3, pending: false })).toBe(
      DocumentApprovalState.Outdated
    );
  });

  it('шаблона в цепи нет, но утверждение есть — считается утверждённым, а не устаревшим', () => {
    expect(computeDocumentState({ approval: required, current_version: null, approved_version: 3, pending: false })).toBe(
      DocumentApprovalState.Approved
    );
  });
});
