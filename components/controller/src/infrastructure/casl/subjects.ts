/**
 * Субъекты (ресурсы) для проверки прав.
 * Каждая страница/раздел = отдельный subject.
 */
export enum Subject {
  // Системные
  All = 'all',
  System = 'System',
  Extension = 'Extension',

  // Кооператив
  Participant = 'Participant',
  Agreement = 'Agreement',
  Document = 'Document',
  Payment = 'Payment',
  Meet = 'Meet',
  Branch = 'Branch',
  BoardMember = 'BoardMember',
  Decision = 'Decision',

  // Пользовательские
  Wallet = 'Wallet',
  Profile = 'Profile',
  UserDocument = 'UserDocument',
  UserPayment = 'UserPayment',

  // Capital
  Project = 'Project',
  Component = 'Component',
  Issue = 'Issue',
  Process = 'Process',
  Commit = 'Commit',

  // Отчёты
  Report = 'Report',

  // Поиск
  Search = 'Search',

  // Ledger
  Ledger = 'Ledger',
}
