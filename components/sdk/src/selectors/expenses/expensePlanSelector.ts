import { Selector } from '../../zeus/index'

export const expensePlanSelector = Selector('ExpensePlan')({
  id: true,
  braname: true,
  title: true,
  amount: true,
  due_date: true,
  priority: true,
  pay_to: true,
  creator: true,
  created_at: true,
})
