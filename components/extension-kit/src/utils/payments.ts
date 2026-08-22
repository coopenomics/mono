export function getAmountPlusFee(amount: number, fee: number): number {
  if (fee < 0 || fee >= 100) {
    throw new Error('Fee must be between 0 and 100.');
  }
  return amount / ((100 - fee) / 100);
}

export function checkPaymentSymbol(incomeSymbol: string, extectedSymbol: string) {
  if (incomeSymbol != extectedSymbol) return { status: 'error', message: `${incomeSymbol} != expectedSymbol` };
  else return { status: 'success', message: '' };
}

export function checkPaymentAmount(incomeAmount: number, expectedAmount: number, tolerancePercentage: number) {
  //погрешность возникает при округлении суммы платежа на стороне провайдера при расчете им процентов комиссии
  const tolerance = expectedAmount * (tolerancePercentage / 100); // Абсолютное значение погрешности

  if (incomeAmount < expectedAmount - tolerance) {
    return {
      status: 'error',
      message: `Недостаточно средств, поступило: ${incomeAmount}, ожидается: ${expectedAmount}`,
    };
  }

  return {
    status: 'success',
    message: '',
  };
}
