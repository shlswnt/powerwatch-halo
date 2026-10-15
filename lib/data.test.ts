import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadNear } from './data'

afterEach(() => vi.unstubAllGlobals())

describe('loadNear', () => {
  it('fetches each id once even when asked repeatedly', async () => {
    const fetchMock = vi.fn(async () => new Response('[["e9w8|1",10,1]]'))
    vi.stubGlobal('fetch', fetchMock)
    const [a, b] = await Promise.all([loadNear('dedupe01'), loadNear('dedupe01')])
    expect(a).toEqual([['e9w8|1', 10, 1]])
    expect(b).toBe(a)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/data/t/dedupe01.json')
  })
  it('a failed fetch is retried on the next call', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response('nope', { status: 500 }))
      .mockResolvedValueOnce(new Response('[]'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(loadNear('retry001')).rejects.toThrow('500')
    await expect(loadNear('retry001')).resolves.toEqual([])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
