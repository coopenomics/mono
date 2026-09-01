import { mergeContent, isLineMergeableFormat } from '../../../src/extensions/capital/domain/utils/content-merge.util';

const snap = (title: string, description: string) => ({ title, description });

describe('mergeContent — трёхстороннее слияние содержимого', () => {
  const base = snap('Проект', 'строка 1\nстрока 2\nстрока 3\nстрока 4\nстрока 5');

  it('правки в разных местах сливаются без конфликта', () => {
    const ours = snap('Проект', 'строка 1 (моя)\nстрока 2\nстрока 3\nстрока 4\nстрока 5');
    const theirs = snap('Проект', 'строка 1\nстрока 2\nстрока 3\nстрока 4\nстрока 5 (чужая)');
    const out = mergeContent(ours, base, theirs, 'MARKDOWN');
    expect(out.status).toBe('clean');
    if (out.status === 'clean') {
      expect(out.result.description).toBe('строка 1 (моя)\nстрока 2\nстрока 3\nстрока 4\nстрока 5 (чужая)');
      expect(out.merged).toBe(true);
    }
  });

  it('только наша правка — результат равен нашему тексту, merged=false', () => {
    const ours = snap('Проект', 'строка 1 (моя)\nстрока 2\nстрока 3\nстрока 4\nстрока 5');
    const out = mergeContent(ours, base, base, 'MARKDOWN');
    expect(out.status).toBe('clean');
    if (out.status === 'clean') {
      expect(out.result).toEqual(ours);
      expect(out.merged).toBe(false);
    }
  });

  it('только чужая правка — берём серверный текст', () => {
    const theirs = snap('Проект', 'строка 1\nстрока 2 (чужая)\nстрока 3\nстрока 4\nстрока 5');
    const out = mergeContent(base, base, theirs, 'MARKDOWN');
    expect(out.status).toBe('clean');
    if (out.status === 'clean') {
      expect(out.result).toEqual(theirs);
      expect(out.merged).toBe(true);
    }
  });

  it('одна и та же строка изменена по-разному — конфликт с маркерами, ничего не теряется', () => {
    const ours = snap('Проект', 'строка 1\nстрока 2 (моя)\nстрока 3\nстрока 4\nстрока 5');
    const theirs = snap('Проект', 'строка 1\nстрока 2 (чужая)\nстрока 3\nстрока 4\nстрока 5');
    const out = mergeContent(ours, base, theirs, 'MARKDOWN');
    expect(out.status).toBe('conflict');
    if (out.status === 'conflict') {
      expect(out.description_conflict).toBe(true);
      expect(out.title_conflict).toBe(false);
      expect(out.hunks.marked).toContain('<<<<<<< ours');
      expect(out.hunks.marked).toContain('строка 2 (моя)');
      expect(out.hunks.marked).toContain('строка 2 (чужая)');
      expect(out.hunks.marked).toContain('>>>>>>> theirs');
    }
  });

  it('одинаковая правка с обеих сторон — не конфликт', () => {
    const same = snap('Проект', 'строка 1\nстрока 2 (общая)\nстрока 3\nстрока 4\nстрока 5');
    const out = mergeContent(same, base, same, 'MARKDOWN');
    expect(out.status).toBe('clean');
    if (out.status === 'clean') expect(out.result.description).toBe(same.description);
  });

  it('заголовок: изменил один — берём его; изменили оба по-разному — конфликт', () => {
    const oursTitle = snap('Проект (мой)', base.description);
    const one = mergeContent(oursTitle, base, base, 'MARKDOWN');
    expect(one.status).toBe('clean');
    if (one.status === 'clean') expect(one.result.title).toBe('Проект (мой)');

    const theirsTitle = snap('Проект (чужой)', base.description);
    const both = mergeContent(oursTitle, base, theirsTitle, 'MARKDOWN');
    expect(both.status).toBe('conflict');
    if (both.status === 'conflict') expect(both.title_conflict).toBe(true);
  });

  it('XML-форматы не сливаются построчно: параллельная правка = конфликт', () => {
    const xmlBase = snap('Схема', '<a/>');
    const ours = snap('Схема', '<a><b/></a>');
    const theirs = snap('Схема', '<a><c/></a>');
    expect(mergeContent(ours, xmlBase, theirs, 'BPMN').status).toBe('conflict');
    expect(mergeContent(ours, xmlBase, theirs, 'DRAWIO').status).toBe('conflict');
    // правил один — берём его
    const single = mergeContent(ours, xmlBase, xmlBase, 'BPMN');
    expect(single.status).toBe('clean');
    if (single.status === 'clean') expect(single.result.description).toBe('<a><b/></a>');
  });

  it('isLineMergeableFormat: markdown/mermaid/без формата — да, bpmn/drawio — нет', () => {
    expect(isLineMergeableFormat(undefined)).toBe(true);
    expect(isLineMergeableFormat('MARKDOWN')).toBe(true);
    expect(isLineMergeableFormat('MERMAID')).toBe(true);
    expect(isLineMergeableFormat('BPMN')).toBe(false);
    expect(isLineMergeableFormat('DRAWIO')).toBe(false);
  });
});
