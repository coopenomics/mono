import { Client } from '@coopenomics/sdk'
import { env } from 'src/shared/config'
import { currentLocale } from 'src/shared/i18n'

// Создаем и экспортируем экземпляр API-клиента
export const client = Client.create({
  api_url: env.BACKEND_URL + '/v1/graphql',
  headers: {
    'Content-Type': 'application/json',
    // Бэкенд переводит ошибки и уведомления на язык запроса.
    'Accept-Language': currentLocale(),
  },
  chain_url: env.CHAIN_URL as string,
  chain_id: env.CHAIN_ID as string,
})

