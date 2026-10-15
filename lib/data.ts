import type { Meta, NearEntry, Transformer } from './types'

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  return (await res.json()) as T
}

export const loadTransformers = () => getJson<Transformer[]>('/data/transformers.json')
export const loadMeta = () => getJson<Meta>('/data/meta.json')

const nearCache = new Map<string, Promise<NearEntry[]>>()

export function loadNear(id: string): Promise<NearEntry[]> {
  let p = nearCache.get(id)
  if (!p) {
    p = getJson<NearEntry[]>(`/data/t/${id}.json`)
    p.catch(() => nearCache.delete(id))
    nearCache.set(id, p)
  }
  return p
}
