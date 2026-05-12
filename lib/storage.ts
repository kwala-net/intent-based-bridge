import fs from 'fs'
import path from 'path'
import { Intent } from './types'

const DATA_FILE = path.join(process.cwd(), 'data', 'intents.json')

function ensureFile() {
  const dir = path.dirname(DATA_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}')
}

export function readIntents(): Record<string, Intent> {
  ensureFile()
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'))
}

function writeIntents(intents: Record<string, Intent>): void {
  ensureFile()
  fs.writeFileSync(DATA_FILE, JSON.stringify(intents, null, 2))
}

export function getIntent(id: string): Intent | null {
  return readIntents()[id] ?? null
}

export function saveIntent(intent: Intent): void {
  const intents = readIntents()
  intents[intent.id] = intent
  writeIntents(intents)
}

export function updateIntent(id: string, updates: Partial<Intent>): Intent | null {
  const intents = readIntents()
  if (!intents[id]) return null
  intents[id] = { ...intents[id], ...updates }
  writeIntents(intents)
  return intents[id]
}
