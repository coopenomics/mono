// Действия контракта debt из debt.hpp

// Заём под обеспечение паевым взносом
export * as CreateLoan from './createLoan'
export * as LoanAuth from './loanAuth'
export * as LoanDecl from './loanDecl'
export * as LoanSigned from './loanSigned'
export * as LoanSignDecl from './loanSignDecl'
export * as LoanPaid from './loanPaid'
export * as LoanPayDecl from './loanPayDecl'
export * as RetryPay from './retryPay'
export * as CancelLoan from './cancelLoan'

// Возврат и срок
export * as RepayLoan from './repayLoan'
export * as ExtendLoan from './extendLoan'
export * as LoanExtOk from './loanExtOk'
export * as LoanExtDecl from './loanExtDecl'
export * as Sweep from './sweep'

// Займы других приложений
export * as RegLoan from './regLoan'
export * as SettleLoan from './settleLoan'
export * as WroffLoan from './wroffLoan'

// Служебные
export * as Migrate from './migrate'
export * as Cleanup from './cleanup'
