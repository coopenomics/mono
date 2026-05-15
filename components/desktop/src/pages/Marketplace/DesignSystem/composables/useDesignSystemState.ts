import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

export type MarketplaceRole = 'orderer' | 'offerer' | 'operator' | 'admin'
export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type ThemeMode = 'light' | 'dark'

/**
 * Состояние витрины дизайн-системы.
 * Хранится в URL query-параметрах, чтобы пользователь мог расшарить ссылку
 * на конкретное состояние компонента и роль/тему/breakpoint.
 */
export function useDesignSystemState() {
  const route = useRoute()
  const router = useRouter()

  const role = computed<MarketplaceRole>({
    get: () => (route.query.role as MarketplaceRole) || 'orderer',
    set: (val) => router.replace({ query: { ...route.query, role: val } }),
  })

  const theme = computed<ThemeMode>({
    get: () => (route.query.theme as ThemeMode) || 'light',
    set: (val) => router.replace({ query: { ...route.query, theme: val } }),
  })

  const breakpoint = computed<Breakpoint>({
    get: () => (route.query.bp as Breakpoint) || 'lg',
    set: (val) => router.replace({ query: { ...route.query, bp: val } }),
  })

  const section = computed<string>({
    get: () => (route.query.section as string) || 'tokens',
    set: (val) => router.replace({ query: { ...route.query, section: val } }),
  })

  // Симуляция breakpoint через max-width на превью-контейнере
  const previewMaxWidth = computed(() => {
    switch (breakpoint.value) {
      case 'xs': return '375px'   // mobile
      case 'sm': return '600px'
      case 'md': return '1024px'
      case 'lg': return '1440px'
      case 'xl': return '100%'
      default: return '1440px'
    }
  })

  const roleClass = computed(() => `mp-role-${role.value}`)

  return {
    role,
    theme,
    breakpoint,
    section,
    previewMaxWidth,
    roleClass,
  }
}

export const MARKETPLACE_ROLES: Array<{ value: MarketplaceRole; label: string; hint: string }> = [
  { value: 'orderer',  label: 'Стол заказчика',   hint: 'просторный пайщик' },
  { value: 'offerer',  label: 'Стол поставщика',  hint: 'просторный пайщик' },
  { value: 'operator', label: 'Стол ПВЗ (POS)',   hint: 'POS, touch 48px' },
  { value: 'admin',    label: 'Стол админа',      hint: 'плотный, таблицы 14px' },
]

export const BREAKPOINTS: Array<{ value: Breakpoint; label: string }> = [
  { value: 'xs', label: 'xs · 375' },
  { value: 'sm', label: 'sm · 600' },
  { value: 'md', label: 'md · 1024' },
  { value: 'lg', label: 'lg · 1440' },
  { value: 'xl', label: 'xl · ∞' },
]
