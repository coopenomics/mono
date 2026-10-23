/**
 * Документ требует утверждённой советом редакции, а реквизитов утверждения
 * (номер и дата протокола) в настройках кооператива нет. Текст — что сделать:
 * его узел отдаёт пользователю как есть, вместо общей «ошибки генерации».
 */
export class DocumentNotApprovedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DocumentNotApprovedError'
  }
}
