import { Selector } from '../../zeus/index'

export const expensePlanSelector = Selector('ExpensePlan')({
  id: true,
  braname: true,
  title: true,
  amount: true,
  due_date: true,
  recurrence: true,
  next_due_date: true,
  pay_to: true,
  creator: true,
  created_at: true,
  proposal_hash: true,
  paid_at: true,
})

export const expensePlanScheduleSelector = Selector('ExpensePlanSchedule')({
  due_dates: true,
  reserve_months: true,
  reserve_per_month: true,
})
