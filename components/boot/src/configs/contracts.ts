/* eslint-disable node/prefer-global/process */
import path from 'node:path'
import { config } from 'dotenv'

config()

export default [
  {
    name: 'eosio.boot',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/system/contracts/eosio.boot'),
    target: 'eosio',
  },
  {
    name: 'eosio.system',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/system/contracts/eosio.system'),
    target: 'eosio',
  },
  {
    name: 'eosio.token',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/system/contracts/eosio.token'),
    target: 'eosio.token',
  },
  {
    name: 'eosio.msig',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/system/contracts/eosio.msig'),
    target: 'eosio.msig',
  },
  {
    name: 'eosio.wrap',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/system/contracts/eosio.wrap'),
    target: 'eosio.wrap',
  },
  {
    name: 'registrator',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/registrator'),
    target: 'registrator',
  },
  {
    name: 'soviet',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/soviet'),
    target: 'soviet',
  },
  {
    name: 'marketplace',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/marketplace'),
    target: 'marketplace',
  },
  {
    name: 'draft',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/draft'),
    target: 'draft',
  },
  {
    name: 'branch',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/branch'),
    target: 'branch',
  },
  {
    name: 'gateway',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/gateway'),
    target: 'gateway',
  },
  {
    name: 'fund',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/fund'),
    target: 'fund',
  },
  {
    name: 'ledger',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/ledger'),
    target: 'ledger',
  },
  {
    name: 'ledger2',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/ledger2'),
    target: 'ledger2',
  },
  {
    name: 'test',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/test'),
    target: 'test',
  },
  {
    name: 'contributor',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/contributor'),
    target: 'contributor',
  },
  {
    name: 'capital',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/capital'),
    target: 'capital',
  },
  {
    name: 'wallet',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/wallet'),
    target: 'wallet',
  },
  {
    name: 'loan',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/loan'),
    target: 'loan',
  },
  {
    name: 'meet',
    path: path.resolve(process.cwd(), '../contracts/build/contracts/meet'),
    target: 'meet',
  },
]
