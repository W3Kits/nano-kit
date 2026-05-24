import type { CustomPrompt } from '@/types'
import { readPersistentJson, writePersistentJson } from './persistent-json'

const CUSTOM_PROMPTS_PATH = 'state/custom-prompts.json'

export async function loadCustomPrompts(): Promise<CustomPrompt[]> {
  const prompts = await readPersistentJson<CustomPrompt[]>(CUSTOM_PROMPTS_PATH, [])
  return Array.isArray(prompts) ? prompts : []
}

export async function saveCustomPrompts(prompts: CustomPrompt[]): Promise<void> {
  await writePersistentJson(CUSTOM_PROMPTS_PATH, prompts)
}
