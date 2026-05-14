/* eslint-disable node/prefer-global/process */
import { Client } from 'pg'
import type { Cooperative } from 'cooptypes'

export async function initSystemStatus() {
  console.log('Инициализация статуса системы для coopname: voskhod')

  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })

  try {
    await client.connect()
    console.log('Подключение к PostgreSQL установлено для initSystemStatus')

    // Создаем enum тип для статуса системы
    try {
      await client.query(`
        CREATE TYPE public.system_status_status_enum AS ENUM ('install', 'initialized', 'active', 'maintenance')
      `)
    }
    catch (error) {
      // Тип уже существует, продолжаем
      console.log('Enum тип system_status_status_enum уже существует, пропускаем создание')
    }

    // Создаем таблицу system_status правильно, как в TypeORM entity
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.system_status (
        coopname varchar(12) NOT NULL,
        install_code varchar(255) NULL,
        install_code_expires_at timestamp NULL,
        init_by_server bool NOT NULL DEFAULT false,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        status public.system_status_status_enum NOT NULL DEFAULT 'install'::system_status_status_enum,
        CONSTRAINT system_status_pkey PRIMARY KEY (coopname)
      )
    `)

    try {
    // Устанавливаем начальный статус для voskhod (active - система готова к работе)
      await client.query(`
      INSERT INTO system_status (coopname, status)
      VALUES ('voskhod', 'active')
      ON CONFLICT (coopname) DO UPDATE SET
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
    `)

      // Проверяем, что статус действительно установлен
      const result = await client.query(`
        SELECT status FROM system_status WHERE coopname = 'voskhod'
      `)
      console.log('Статус системы в PostgreSQL после установки:', result.rows[0]?.status)
    }
    catch (queryError) {
      console.error('Ошибка при установке статуса системы в PostgreSQL:', queryError)
      throw queryError
    }

    console.log('Статус системы инициализирован в PostgreSQL')
  }
  catch (error) {
    console.error('Ошибка инициализации статуса системы в PostgreSQL:', error)
    throw error
  }
  finally {
    await client.end()
  }
}

export async function initUsersInPostgres(
  users: Array<{
    username: string
    email: string
    type: 'individual' | 'entrepreneur' | 'organization'
    role: string
    status: string
    is_registered: boolean
  }>,
) {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })

  try {
    await client.connect()
    console.log('Подключение к PostgreSQL установлено для инициализации пользователей')

    // Создаем таблицу users, если она не существует
    await client.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        status VARCHAR(20) DEFAULT 'created',
        message TEXT DEFAULT '',
        is_registered BOOLEAN DEFAULT FALSE,
        has_account BOOLEAN DEFAULT FALSE,
        type VARCHAR(20) NOT NULL,
        public_key TEXT DEFAULT '',
        referer VARCHAR(100) DEFAULT '',
        email VARCHAR(255),
        role VARCHAR(20) DEFAULT 'user',
        is_email_verified BOOLEAN DEFAULT FALSE,
        subscriber_id VARCHAR(100) DEFAULT '',
        subscriber_hash VARCHAR(255) DEFAULT '',
        legacy_mongo_id VARCHAR(50),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Создаем пользователей
    for (const user of users) {
      // Проверяем, что username не null и не пустой
      if (!user.username || user.username.trim() === '') {
        console.warn(`Пропускаем пользователя с пустым username:`, user)
        continue
      }

      await client.query(`
        INSERT INTO "users" (
          username, email, type, role, status, is_registered,
          has_account, is_email_verified, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        ON CONFLICT (username) DO NOTHING
      `, [
        user.username,
        user.email,
        user.type,
        user.role,
        user.status,
        user.is_registered,
        false, // has_account
        true, // is_email_verified
      ])
    }

    console.log(`Инициализировано ${users.length} пользователей в PostgreSQL`)
  }
  catch (error) {
    console.error('Ошибка инициализации пользователей в PostgreSQL:', error)
    throw error
  }
  finally {
    await client.end()
  }
}

export async function initVaultInPostgres() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })

  try {
    await client.connect()
    console.log('Подключение к PostgreSQL установлено для инициализации vault')

    // Создаем таблицу vaults, если она не существует
    await client.query(`
      CREATE TABLE IF NOT EXISTS "vaults" (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) NOT NULL,
        permission VARCHAR(20) DEFAULT 'active',
        wif TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(username, permission)
      )
    `)

    // Создаем индексы
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vaults_username ON "vaults"(username)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_vaults_username_permission ON "vaults"(username, permission)`)

    // Сохраняем зашифрованный ключ в vault
    await client.query(`
      INSERT INTO "vaults" (username, permission, wif, created_at, updated_at)
      VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      ON CONFLICT (username, permission) DO NOTHING
    `, [
      'voskhod',
      'active',
      '9d6479a9d77ead53fb0e5e54b3608a95:2046ee3c1577d48aecbee49e8f25c4c2df37ab02f15d73d0d1b6352f53a4b774cb9e71b6028fd7caf64568e195c7878dfbb5d2bf10a3766d90ba9e92ea724428',
    ])

    console.log('Vault инициализирован в PostgreSQL')
  }
  catch (error) {
    console.error('Ошибка инициализации vault в PostgreSQL:', error)
    throw error
  }
  finally {
    await client.end()
  }
}

export async function initExtensionsInPostgres() {
  const client = new Client({
    host: process.env.POSTGRES_HOST,
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    user: process.env.POSTGRES_USERNAME,
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DATABASE,
  })

  try {
    await client.connect()
    console.log('Подключение к PostgreSQL установлено для инициализации extensions')

    // Создаем таблицу extensions по аналогии с ExtensionEntity
    await client.query(`
      CREATE TABLE IF NOT EXISTS "extensions" (
        name VARCHAR(12) PRIMARY KEY,
        enabled BOOLEAN DEFAULT true,
        config JSONB DEFAULT '{}',
        schema_version INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Создаем индексы
    await client.query(`CREATE INDEX IF NOT EXISTS idx_extensions_name ON "extensions"(name)`)
    await client.query(`CREATE INDEX IF NOT EXISTS idx_extensions_enabled ON "extensions"(enabled)`)

    // Вставляем запись для capital extension
    const capitalConfig = {
      level_depth_base: 100000000,
      onboarding_init_at: "2026-02-09T07:16:18.380Z",
      expense_pool_percent: 100,
      onboarding_expire_at: "2026-03-11T07:16:18.380Z",
      voting_period_in_days: 1,
      authors_voting_percent: 62.8,
      creators_voting_percent: 62.8,
      energy_gain_coefficient: 1,
      level_growth_coefficient: 1.5,
      coordinator_bonus_percent: 5,
      energy_decay_rate_per_day: 0.02,
      coordinator_invite_validity_days: 30,
      onboarding_blagorost_provision_done: true,
      onboarding_blagorost_provision_hash: "CDE57D987E3C945E79E108920CE02A4A80CFA7980CAA912949BB6C2111B7027A",
      onboarding_blagorost_offer_template_done: true,
      onboarding_blagorost_offer_template_hash: "5CA88BBD303E5CCDA01E565FFE47E51855515176EC6C957F0FBDBCA4C53DBFD2",
      onboarding_generator_offer_template_done: true,
      onboarding_generator_offer_template_hash: "8DA31574E8CC764C3A1FCAE1172726656A3DCDB1BB82AB0E567E2732070C3A44",
      onboarding_generator_program_template_done: true,
      onboarding_generator_program_template_hash: "E55564D8946C55C93490B5277968FC890FDCB10A049DB5B2E0FE9F67FDA80896",
      onboarding_generation_contract_template_done: true,
      onboarding_generation_contract_template_hash: "A4BD579D6130CCE2D8C34337DFA591807C1F028A148DD53689881B12AC2627E2",
      github_sync_branch: 'dev',
      github_sync_poll_interval_minutes: 5,
      github_api_token_encrypted: '',
      program_share_registration_interval_minutes: 1440,
    }

    await client.query(`
      INSERT INTO "extensions" (name, enabled, config, schema_version, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (name) DO UPDATE SET
        enabled = EXCLUDED.enabled,
        config = EXCLUDED.config,
        schema_version = EXCLUDED.schema_version,
        updated_at = CURRENT_TIMESTAMP
    `, [
      'capital',
      true,
      JSON.stringify(capitalConfig),
      1,
      new Date('2026-02-09T02:13:06.620Z'),
      new Date('2026-02-09T02:27:57.155Z')
    ])

    // reports — встроенный extension, конфиг пустой (BuiltinSchema).
    // Контроллер тоже добивает запись через installDefaultApps на старте,
    // но сеем тут заранее, чтобы стол появился сразу после boot.
    await client.query(`
      INSERT INTO "extensions" (name, enabled, config, schema_version)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (name) DO NOTHING
    `, ['reports', true, '{}', 1])

    console.log('Extensions инициализированы в PostgreSQL')
  }
  catch (error) {
    console.error('Ошибка инициализации extensions в PostgreSQL:', error)
    throw error
  }
  finally {
    await client.end()
  }
}
