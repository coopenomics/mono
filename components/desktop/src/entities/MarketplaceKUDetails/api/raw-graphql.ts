import { env } from 'src/shared/config'

/**
 * Минимальный raw-GraphQL клиент для marketplace_ku_details (Эпик 2, Stories 2.1–2.3).
 *
 * Используется до регенерации Zeus-типов в `@coopenomics/sdk`. После
 * регенерации заменить на типизированный `client.Query` / `client.Mutation`.
 *
 * Авторизация: берёт `Authorization` из локального хранилища (тот же
 * заголовок, что использует основной `client`).
 */
export async function rawGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const apiUrl = env.BACKEND_URL + '/v1/graphql'

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const accessToken =
    typeof window !== 'undefined' ? window.localStorage.getItem('accessToken') : null
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query, variables }),
  })

  const json = (await response.json()) as { data?: T; errors?: Array<{ message: string }> }
  if (json.errors && json.errors.length > 0) {
    throw new Error(json.errors.map((e) => e.message).join('; '))
  }
  if (!json.data) throw new Error('GraphQL вернул пустой ответ')
  return json.data
}
