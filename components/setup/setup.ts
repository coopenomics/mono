import inquirer from 'inquirer'
import { promises as fs } from 'fs'
import { exec } from 'child_process'
import util from 'util'
import ora from 'ora'
import path from 'path'

const execPromise = util.promisify(exec)
const ROOT = path.resolve(__dirname, '../..')
const COMPONENTS = path.resolve(__dirname, '..')

console.clear()
console.log(`
\x1b[36m╔══════════════════════════════════════════════════╗
║                                                  ║
║     ██████╗ ██╗ ██████╗ ██╗████████╗ █████╗ ██╗  ║
║     ██╔══██╗██║██╔════╝ ██║╚══██╔══╝██╔══██╗██║  ║
║     ██║  ██║██║██║  ███╗██║   ██║   ███████║██║  ║
║     ██║  ██║██║██║   ██║██║   ██║   ██╔══██║██║  ║
║     ██████╔╝██║╚██████╔╝██║   ██║   ██║  ██║███╗ ║
║     ╚═════╝ ╚═╝ ╚═════╝ ╚═╝   ╚═╝   ╚═╝  ╚═╝╚═╝ ║
║                                                  ║
║         ЦИФРОВОЙ КООПЕРАТИВ — УСТАНОВЩИК         ║
║                                                  ║
╚══════════════════════════════════════════════════╝\x1b[0m
`)

// ──────────────────────────────────────────────────
// Конфигурация режимов
// ──────────────────────────────────────────────────

const MAINNET_CONFIG = {
  CHAIN_ID: '6a6e3744e98b16d1b25b4e2c6fdc98b63d3e1a1c23f1a6b1b5b5c4e6d8a7b0c1',
  API_URL: 'https://api.coopenomics.world',
  P2P_PEER: 'p2p.coopenomics.world:9876',
}

const TESTNET_CONFIG = {
  CHAIN_ID: 'f0364a3f9fd913081f1c0b05c6f8f50a59b2ba60bb928cb321ba3a9a36316624',
  BACKEND_URL: 'https://testnet.coopenomics.world/backend',
  CHAIN_URL: 'https://api-testnet.coopenomics.world',
}

// ──────────────────────────────────────────────────
// Главное меню
// ──────────────────────────────────────────────────

type SetupMode = 'dev' | 'testnet' | 'production'

async function mainMenu(): Promise<void> {
  const { mode } = await inquirer.prompt<{ mode: SetupMode }>([
    {
      type: 'list',
      name: 'mode',
      message: '🔧 Выберите режим установки:',
      choices: [
        { name: '🖥️  Для разработки — локальный блокчейн и все сервисы', value: 'dev' },
        { name: '📡 Тестовая сеть — фронтенд подключается к тестнету', value: 'testnet' },
        { name: '🚀 Продакшен — подключение к основной сети', value: 'production' },
      ],
    },
  ])

  switch (mode) {
    case 'dev':
      await setupDevelopment()
      break
    case 'testnet':
      await setupTestnet()
      break
    case 'production':
      await setupProduction()
      break
  }
}

// ──────────────────────────────────────────────────
// РЕЖИМ РАЗРАБОТКИ
// ──────────────────────────────────────────────────

async function setupDevelopment(): Promise<void> {
  console.log('\n\x1b[33m━━━ 🖥️  РЕЖИМ РАЗРАБОТКИ ━━━\x1b[0m\n')

  const { coopname } = await inquirer.prompt<{ coopname: string }>([
    {
      type: 'input',
      name: 'coopname',
      message: 'Имя кооператива (латиница, до 12 символов):',
      default: 'voskhod',
      validate: (v: string) => /^[a-z1-5.]{1,12}$/.test(v) || 'Только a-z, 1-5, точка. Макс. 12 символов.',
    },
  ])

  const { contractsMode } = await inquirer.prompt<{ contractsMode: 'test' | 'prod' }>([
    {
      type: 'list',
      name: 'contractsMode',
      message: 'Режим смарт-контрактов:',
      choices: [
        { name: 'Тестовый (1 член совета)', value: 'test' },
        { name: 'Продуктовый (5 членов совета)', value: 'prod' },
      ],
    },
  ])

  // 1. Генерация .env файлов
  step('Генерация конфигурации')

  await copyEnvExample('boot')
  await copyEnvExample('controller')
  await copyEnvExample('desktop')

  // Обновляем COOPNAME во всех .env
  await updateEnvValue(comp('controller/.env'), 'COOPNAME', coopname)

  ok('Конфигурация сгенерирована')

  // 2. Сборка shared-библиотек
  step('Сборка shared-библиотек')
  await run(`pnpm --filter cooptypes run build`, 'cooptypes')
  await run(`pnpm --filter @coopenomics/factory run build`, 'factory')
  await run(`pnpm --filter @coopenomics/sdk run build`, 'sdk')
  await run(`pnpm --filter @coopenomics/notifications run build`, 'notifications')
  ok('Shared-библиотеки собраны')

  // 3. Сборка смарт-контрактов
  step('Сборка смарт-контрактов')
  const buildArg = contractsMode === 'test' ? 'test' : ''
  await run(`cd ${comp('contracts')} && bash build-all.sh ${buildArg}`, 'Компиляция контрактов (может занять 3-5 мин)')
  ok('Смарт-контракты собраны')

  // 4. Вывод инструкций
  console.log(`
\x1b[32m━━━ ✅ УСТАНОВКА ЗАВЕРШЕНА ━━━\x1b[0m

Для запуска системы выполните:

  \x1b[36m1. pnpm run reboot\x1b[0m        — Полный перезапуск (инфра + boot + сервисы)
  
  Или по шагам:
  \x1b[36m2. docker compose up -d\x1b[0m   — Запуск инфраструктуры
  \x1b[36m3. pnpm run boot\x1b[0m          — Инициализация блокчейна
  \x1b[36m4. pnpm run dev:backend\x1b[0m   — Запуск бэкенда
  \x1b[36m5. pnpm run dev:desktop\x1b[0m   — Запуск фронтенда

Для тестирования:
  \x1b[36mpnpm run test\x1b[0m             — Запуск всех тестов
`)
}

// ──────────────────────────────────────────────────
// РЕЖИМ ТЕСТОВОЙ СЕТИ
// ──────────────────────────────────────────────────

async function setupTestnet(): Promise<void> {
  console.log('\n\x1b[33m━━━ 📡 РЕЖИМ ТЕСТОВОЙ СЕТИ ━━━\x1b[0m\n')

  // 1. Генерация .env для desktop
  step('Настройка фронтенда на тестнет')
  await copyFile(comp('desktop/.env-testnet'), comp('desktop/.env'))
  ok('Desktop настроен на тестнет')

  // 2. Сборка библиотек
  step('Сборка shared-библиотек')
  await run(`pnpm --filter cooptypes run build`, 'cooptypes')
  await run(`pnpm --filter @coopenomics/factory run build`, 'factory')
  await run(`pnpm --filter @coopenomics/sdk run build`, 'sdk')
  await run(`pnpm --filter @coopenomics/notifications run build`, 'notifications')
  ok('Shared-библиотеки собраны')

  console.log(`
\x1b[32m━━━ ✅ УСТАНОВКА ЗАВЕРШЕНА ━━━\x1b[0m

Для запуска фронтенда:
  \x1b[36mpnpm run dev:desktop\x1b[0m

Фронтенд подключится к тестовой сети:
  API:   ${TESTNET_CONFIG.BACKEND_URL}
  Chain: ${TESTNET_CONFIG.CHAIN_URL}
`)
}

// ──────────────────────────────────────────────────
// РЕЖИМ ПРОДАКШЕН
// ──────────────────────────────────────────────────

async function setupProduction(): Promise<void> {
  console.log('\n\x1b[33m━━━ 🚀 РЕЖИМ ПРОДАКШЕН ━━━\x1b[0m\n')

  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'coopname',
      message: 'Имя кооператива:',
      default: 'voskhod',
      validate: (v: string) => /^[a-z1-5.]{1,12}$/.test(v) || 'Только a-z, 1-5, точка. Макс. 12 символов.',
    },
    {
      type: 'input',
      name: 'domain',
      message: 'Домен для доступа (без https://):',
      default: 'coop.example.com',
    },
    {
      type: 'input',
      name: 'coopShortName',
      message: 'Краткое название кооператива:',
      default: 'Мой Кооператив',
    },
    {
      type: 'input',
      name: 'serverSecret',
      message: 'Секретный ключ сервера (SERVER_SECRET):',
      default: generateSecret(),
    },
    {
      type: 'input',
      name: 'jwtSecret',
      message: 'JWT секрет:',
      default: generateSecret(),
    },
    {
      type: 'input',
      name: 'smtpHost',
      message: 'SMTP хост (для отправки почты):',
      default: '',
    },
    {
      type: 'input',
      name: 'smtpPort',
      message: 'SMTP порт:',
      default: '465',
    },
    {
      type: 'input',
      name: 'smtpUser',
      message: 'SMTP пользователь:',
      default: '',
    },
    {
      type: 'password',
      name: 'smtpPass',
      message: 'SMTP пароль:',
      default: '',
    },
  ])

  // 1. Генерация .env для controller
  step('Генерация конфигурации продакшен')

  const dbUser = ['coop', 'admin'].join('')
  const dbPass = generateSecret()
  const siteDesc = ['кооперативная экономика', 'для сообществ и бизнеса'].join(' ')

  const controllerEnv = `NODE_ENV=production
BASE_URL=https://${answers.domain}
PORT=2998
SERVER_SECRET=${answers.serverSecret}
MONGODB_URL=mongodb://mongo:27017/cooperative-x
COOPNAME=${answers.coopname}
JWT_SECRET=${answers.jwtSecret}
JWT_ACCESS_EXPIRATION_MINUTES=864000
JWT_REFRESH_EXPIRATION_DAYS=365
JWT_RESET_PASSWORD_EXPIRATION_MINUTES=10
JWT_VERIFY_EMAIL_EXPIRATION_MINUTES=10
SMTP_HOST=${answers.smtpHost}
SMTP_PORT=${answers.smtpPort}
SMTP_USERNAME=${answers.smtpUser}
SMTP_PASSWORD=${answers.smtpPass}
EMAIL_FROM="'${answers.coopShortName}' <mail@${answers.domain}>"
BLOCKCHAIN_RPC=${MAINNET_CONFIG.API_URL}
CHAIN_ID=${MAINNET_CONFIG.CHAIN_ID}
REDIS_HOST=monoredis
REDIS_PORT=6379
REDIS_PASSWORD=
POSTGRES_HOST=pg
POSTGRES_PORT=5432
POSTGRES_USERNAME=${dbUser}
POSTGRES_PASSWORD=${dbPass}
POSTGRES_DATABASE=${answers.coopname}
TIMEZONE=Europe/Moscow
`
  await fs.writeFile(comp('controller/.env'), controllerEnv)

  // Desktop .env
  const desktopEnv = `NODE_ENV=production
BACKEND_URL=https://${answers.domain}/api
CHAIN_URL=${MAINNET_CONFIG.API_URL}
CHAIN_ID=${MAINNET_CONFIG.CHAIN_ID}
CURRENCY=RUB
COOP_SHORT_NAME=${answers.coopShortName}
SITE_DESCRIPTION=${siteDesc}
SITE_IMAGE=https://${answers.domain}/og-image.jpg
TIMEZONE=Europe/Moscow
`
  await fs.writeFile(comp('desktop/.env'), desktopEnv)

  // Boot .env
  const bootEnv = `EOSIO_PUB_KEY=EOS6MRyAjQq8ud7hVNYcfnVPJqcVpscN5So8BhtHuGYqET5GDW5CV
EOSIO_PRV_KEY=5KQwrPbwdL6PhXujxW37FSSQZ1JiwsST4cqQzDeyXtP79zkvFD3
DATADIR=blockchain-data
BPACCOUNT=eosio
PASSWORD=PW5JGe4WsTPGrjnMzkGd4wfVdzoHCEySgbyq2WBWGAxSfevbXqAG4
SERVER_SECRET=${answers.serverSecret}
SERVER_URL=http://coopback:2998
MONGO_URI=mongodb://mongo:27017/cooperative-x
SKIP_BLOCK_FETCH=TRUE
POSTGRES_HOST=pg
POSTGRES_PORT=5432
POSTGRES_USERNAME=${dbUser}
POSTGRES_PASSWORD=${dbPass}
POSTGRES_DATABASE=${answers.coopname}
`
  await fs.writeFile(comp('boot/.env'), bootEnv)

  ok('Конфигурация продакшен сгенерирована')
  // note: dbUser, dbPass, siteDesc defined above in template literals

  // 2. Сборка
  step('Сборка shared-библиотек')
  await run(`pnpm --filter cooptypes run build`, 'cooptypes')
  await run(`pnpm --filter @coopenomics/factory run build`, 'factory')
  await run(`pnpm --filter @coopenomics/sdk run build`, 'sdk')
  await run(`pnpm --filter @coopenomics/notifications run build`, 'notifications')
  ok('Shared-библиотеки собраны')

  console.log(`
\x1b[32m━━━ ✅ ПРОДАКШЕН КОНФИГУРАЦИЯ ГОТОВА ━━━\x1b[0m

Файлы конфигурации сгенерированы:
  • components/controller/.env
  • components/desktop/.env
  • components/boot/.env

Для запуска в продакшене:
  \x1b[36m1. docker compose up -d\x1b[0m                    — Инфраструктура
  \x1b[36m2. docker compose up -d coopback parser2\x1b[0m    — Бэкенд
  \x1b[36m3. docker compose up -d desktop\x1b[0m            — Фронтенд

Подключение к основной сети:
  API:  ${MAINNET_CONFIG.API_URL}
  P2P:  ${MAINNET_CONFIG.P2P_PEER}

\x1b[33m⚠️  Для синхронизации ноды с основной сетью добавьте в
  components/boot/src/configs/config.ini:
  p2p-peer-address = ${MAINNET_CONFIG.P2P_PEER}\x1b[0m
`)
}

// ──────────────────────────────────────────────────
// Утилиты
// ──────────────────────────────────────────────────

function comp(relativePath: string): string {
  return path.join(COMPONENTS, relativePath)
}

async function copyEnvExample(component: string): Promise<void> {
  const src = comp(`${component}/.env-example`)
  const dst = comp(`${component}/.env`)
  try {
    await fs.copyFile(src, dst)
    console.log(`  📂 ${component}/.env-example → .env`)
  } catch {
    console.log(`  ⚠️  ${component}/.env-example не найден, пропускаем`)
  }
}

async function copyFile(src: string, dst: string): Promise<void> {
  try {
    await fs.copyFile(src, dst)
    console.log(`  📂 ${path.basename(src)} → ${path.basename(dst)}`)
  } catch (err) {
    console.error(`  ❌ Ошибка копирования: ${err}`)
  }
}

async function updateEnvValue(envPath: string, key: string, value: string): Promise<void> {
  try {
    let content = await fs.readFile(envPath, 'utf-8')
    const regex = new RegExp(`^${key}=.*$`, 'm')
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`)
    } else {
      content += `\n${key}=${value}\n`
    }
    await fs.writeFile(envPath, content)
  } catch {}
}

function step(msg: string): void {
  console.log(`\n\x1b[34m▸ ${msg}\x1b[0m`)
}

function ok(msg: string): void {
  console.log(`\x1b[32m  ✅ ${msg}\x1b[0m`)
}

async function run(command: string, label: string): Promise<void> {
  const spinner = ora({ text: label, color: 'cyan' }).start()
  try {
    await execPromise(command, { cwd: ROOT, timeout: 600000 })
    spinner.succeed(label)
  } catch (error: any) {
    spinner.fail(label)
    if (error.stderr) console.error(`    ${error.stderr.split('\n')[0]}`)
  }
}

function generateSecret(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

// Запуск
mainMenu().catch(console.error)
