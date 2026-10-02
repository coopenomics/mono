/**
 * Подставной внешний узел стенда (scripts/blackbox/http-stub.mjs): играет сеть
 * карт кооператора и другие чужие узлы, с которыми платформа говорит по HTTP.
 * Тест задаёт, чем узел ответит, и читает, что платформа ему отправила.
 *
 * Узел живёт в сети стенда: контроллер ходит на STUB_URL, тест управляет им
 * с хоста через STUB_CONTROL_URL. На стенде без узла (обычный dev-стенд)
 * наборы, которым он нужен, падают с понятной причиной, а не молча зеленеют.
 */
import process from 'node:process'

/** Адрес узла, каким его видит контроллер. */
export const STUB_URL = process.env.STUB_URL || 'http://stub:8090'
const CONTROL = process.env.STUB_CONTROL_URL || 'http://127.0.0.1:8091'

export interface StubResponse {
  status?: number
  body?: unknown
  headers?: Record<string, string>
  delayMs?: number
}

export interface StubRequest {
  method: string
  path: string
  query: Record<string, string>
  headers: Record<string, string>
  body: any
  at: string
}

async function control(method: 'GET' | 'POST', path: string, body?: unknown): Promise<any> {
  let res: Response
  try {
    res = await fetch(`${CONTROL}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  }
  catch (error) {
    throw new Error(`подставной узел стенда недоступен (${CONTROL}): нужен стенд внешнего слоя — scripts/blackbox/stack.sh app; ${String((error as Error).message)}`)
  }
  if (!res.ok)
    throw new Error(`подставной узел: ${method} ${path} → ${res.status} ${await res.text()}`)
  return res.json()
}

/** Забыть маршруты и журнал — в начале каждого набора. */
export async function stubReset(): Promise<void> {
  await control('POST', '/reset')
}

/**
 * Чем узел отвечает на путь: ответы отдаются по очереди, последний повторяется.
 * Путь — точный либо префикс со звёздочкой в конце.
 */
export async function stubRoute(method: string, path: string, ...responses: StubResponse[]): Promise<void> {
  await control('POST', '/routes', { method, path, responses })
}

/** Что платформа отправила узлу; путь — точный либо префикс со звёздочкой. */
export async function stubRequests(path?: string): Promise<StubRequest[]> {
  return control('GET', path ? `/requests?path=${encodeURIComponent(path)}` : '/requests')
}
