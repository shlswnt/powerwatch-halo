import { bandIndex } from './geo'
import { BANDS, type NearEntry, type Rings } from './types'

export interface CompareStats {
  covered: Rings
  shared: Rings
  /** [radius index][transformer index] */
  inRange: number[][]
  only: number[][]
}

/** Each building's distance to each selected transformer (Infinity when outside its 500 m list); a repeated key keeps its nearest distance. */
function distances(lists: NearEntry[][]): Map<string, number[]> {
  const m = new Map<string, number[]>()
  lists.forEach((list, j) => {
    for (const [key, d] of list) {
      let row = m.get(key)
      if (!row) {
        row = new Array(lists.length).fill(Infinity)
        m.set(key, row)
      }
      if (d < row[j]) row[j] = d
    }
  })
  return m
}

export function compareStats(lists: NearEntry[][]): CompareStats {
  const covered: Rings = [0, 0, 0, 0, 0]
  const shared: Rings = [0, 0, 0, 0, 0]
  const inRange = BANDS.map(() => new Array<number>(lists.length).fill(0))
  const only = BANDS.map(() => new Array<number>(lists.length).fill(0))
  for (const row of distances(lists).values()) {
    BANDS.forEach((r, ri) => {
      let n = 0
      let last = -1
      row.forEach((d, j) => {
        if (d <= r) {
          n++
          last = j
          inRange[ri][j]++
        }
      })
      if (n >= 1) covered[ri]++
      if (n >= 2) shared[ri]++
      if (n === 1) only[ri][last]++
    })
  }
  return { covered, shared, inRange, only }
}

/** Map tint while comparing: each building's band from its nearest selected transformer, and the keys shared by 2+ within `radius`. */
export function compareTint(lists: NearEntry[][], radius: number): { bands: Map<string, number>; shared: string[] } {
  const bands = new Map<string, number>()
  const shared: string[] = []
  for (const [key, row] of distances(lists)) {
    const b = bandIndex(Math.min(...row))
    if (b !== null) bands.set(key, b)
    if (row.filter((d) => d <= radius).length >= 2) shared.push(key)
  }
  shared.sort()
  return { bands, shared }
}
