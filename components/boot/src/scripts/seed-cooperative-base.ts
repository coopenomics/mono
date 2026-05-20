/**
 * Idempotent сидинг базовых сущностей кооператива в Mongo:
 *  - vars(coopname=voskhod) — описание кооператива (отображается в UI хедер/футер)
 *  - monos(coopname=voskhod, status=active) — маркер, что инсталляция активна
 *  - vaults(username=voskhod, permission=active, wif=<encrypted from infra.ts>)
 *
 * Эти данные обычно создаются `pnpm boot:extra`, но если Mongo volume сбросился
 * (а chain нет), их надо восстановить отдельно — этот скрипт делает только эту часть.
 *
 * Запуск:
 *   MONGO_URI=mongodb://127.0.0.1:27047/cooperative-x \
 *     pnpm --filter @coopenomics/boot exec esno src/scripts/seed-cooperative-base.ts
 */
import mongoose from 'mongoose'

async function main() {
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) throw new Error('MONGO_URI not set')
  await mongoose.connect(mongoUri)

  const vars = {
    coopname: 'voskhod',
    full_abbr: 'Потребительский Кооператив',
    full_abbr_genitive: 'Потребительского Кооператива',
    full_abbr_dative: 'Потребительскому Кооперативу',
    short_abbr: 'ПК',
    website: 'цифровой-кооператив.рф',
    name: 'Восход',
    confidential_link: 'coopenomics.world/privacy',
    confidential_email: 'privacy@coopenomics.world',
    contact_email: 'contact@coopenomics.world',
    passport_request: 'no',
    wallet_agreement: { protocol_number: '10-04-2024', protocol_day_month_year: '10 апреля 2024 г.' },
    signature_agreement: { protocol_number: '10-04-2024', protocol_day_month_year: '10 апреля 2024 г.' },
    privacy_agreement: { protocol_number: '10-04-2024', protocol_day_month_year: '10 апреля 2024 г.' },
    user_agreement: { protocol_number: '10-04-2024', protocol_day_month_year: '10 апреля 2024 г.' },
    participant_application: { protocol_number: '10-04-2024', protocol_day_month_year: '10 апреля 2024 г.' },
    generator_program: { protocol_number: '1', protocol_day_month_year: '09.02.2026 10:24' },
    generation_contract_template: { protocol_number: '2', protocol_day_month_year: '09.02.2026 10:24' },
    blagorost_program: { protocol_number: '3', protocol_day_month_year: '09.02.2026 10:24' },
    generator_offer_template: { protocol_number: '4', protocol_day_month_year: '09.02.2026 10:27' },
    blagorost_offer_template: { protocol_number: '5', protocol_day_month_year: '09.02.2026 10:27' },
    deleted: false,
    block_num: 1,
  }

  const varsCol = mongoose.connection.collection('vars')
  const existing = await varsCol.findOne({ coopname: 'voskhod' })
  if (existing) {
    await varsCol.updateOne({ coopname: 'voskhod' }, { $set: vars })
    console.log('vars upserted (was present)')
  }
  else {
    await varsCol.insertOne({ ...vars, _created_at: new Date() })
    console.log('vars inserted')
  }

  const monosCol = mongoose.connection.collection('monos')
  const mExisting = await monosCol.findOne({ coopname: 'voskhod' })
  if (mExisting) {
    await monosCol.updateOne({ coopname: 'voskhod' }, { $set: { status: 'active' } })
    console.log('monos upserted (was present)')
  }
  else {
    await monosCol.insertOne({ coopname: 'voskhod', status: 'active' })
    console.log('monos inserted')
  }

  const vaultsCol = mongoose.connection.collection('vaults')
  const vExisting = await vaultsCol.findOne({ username: 'voskhod', permission: 'active' })
  if (vExisting) {
    console.log('vaults already present (kept as is)')
  }
  else {
    await vaultsCol.insertOne({
      username: 'voskhod',
      permission: 'active',
      wif: '9d6479a9d77ead53fb0e5e54b3608a95:2046ee3c1577d48aecbee49e8f25c4c2df37ab02f15d73d0d1b6352f53a4b774cb9e71b6028fd7caf64568e195c7878dfbb5d2bf10a3766d90ba9e92ea724428',
    })
    console.log('vaults inserted')
  }

  await mongoose.disconnect()
}

main()
  .then(() => process.exit(0))
  .catch((e) => { console.error(e); process.exit(1) })
