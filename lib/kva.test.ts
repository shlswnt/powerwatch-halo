import { describe, expect, it } from 'vitest'
import { parseKva } from './kva'

describe('parseKva', () => {
  it.each([
    ['This transformer has a load capacity of 1000kva, it provides power', 1000],
    ['Masonie 400kva transformer', 400],
    ['a 250 KVA pole mounted unit', 250],
    ['capacity of 630/500 kva twin transformer', 630],
  ])('%s → %d', (text, kva) => expect(parseKva(text)).toBe(kva))
  it.each([
    'It capacity of 630/500 twin transformer.',
    'The Brookfields substation is a 13 Kv capacity load.',
    '',
    'kva unknown',
  ])('no capacity in "%s"', (text) => expect(parseKva(text)).toBeNull())
})
