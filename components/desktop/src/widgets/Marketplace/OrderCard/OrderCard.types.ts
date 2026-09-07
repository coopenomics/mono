// Типы вынесены из SFC: tsc не читает содержимое .vue, и реэкспорт типа из index.ts ломается.

import type { BaseBadgeVariant } from 'src/shared/ui/base'

export type OrderStatus =
  | 'draft'
  | 'placed'
  | 'paid'
  | 'in-delivery'
  | 'arrived-at-pvz'
  | 'ready-to-issue'
  | 'issued'
  | 'cancelled'
  | 'dispute'
  | 'returned'

export type OrderRole = 'orderer' | 'offerer' | 'operator' | 'admin'

export interface Order {
  id: string | number
  shortId?: string
  title: string
  /** Обложка товара (первое изображение предложения); нет — показываем плейсхолдер. */
  imageUrl?: string
  units: number
  unitLabel?: string
  totalCost: number
  /**
   * Пояснение под суммой (requirement b6) — например «С учётом взноса
   * пайщика: 1 300 ₽» на столе поставщика, где `totalCost` — его
   * себестоимость без взноса. Заказчику не показывается — там `totalCost`
   * уже включает взнос.
   */
  feeNote?: string
  /**
   * Заполнение сборки партии до минимального объёма поставки, 0..1.
   * `undefined` — полосу не показывать (заказ вне стадии сбора: уже принят,
   * без коллективного минимума, и т.п.) — раньше это был отдельный экран
   * «Коллективный заказ», слитый сюда (жалоба 2026-08-02).
   */
  progress?: number
  /** Card-status — управляет набором действий per-role (ACTIONS_PER_ROLE). */
  status: OrderStatus
  /** Человекочитаемая подпись доменного статуса для бейджа (из orderStatusDisplay). */
  statusLabel: string
  /** Вариант бейджа доменного статуса. */
  statusVariant: BaseBadgeVariant
  createdAt: string | Date
  /** Наименование пункта выдачи (кооперативного участка) — основная строка ПВЗ. */
  pvzName?: string
  /** Адрес пункта выдачи — вторичная строка под наименованием. */
  pvz?: string
  /** Широта ПВЗ — если задана вместе с pvzLng, блок адреса открывает карту. */
  pvzLat?: number
  /** Долгота ПВЗ. */
  pvzLng?: number
}
