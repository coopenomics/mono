// Сценарий: Собрания.
// eslint-disable-next-line no-unused-vars
import { memberPage, USER, COOP_PAGE } from '../../lib/participant.mjs';
const s = memberPage({ doc: 'meetings', title: 'Собрания', url: USER('meets'),
  description: 'Общие собрания пайщиков: даты, повестка и состояние голосования.',
  rowDescription: null });
export const meta = s.meta;
export default s.run;
