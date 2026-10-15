import { describe, expect, it } from 'vitest'
import { ringsIntersect } from './overlap'


describe('ringsIntersect', () => {
  const masonie = { lat: 8.4588254, lon: -13.1879126 }
  const kenema = { lat: 7.8747342, lon: -11.1877479 }
  const near = { lat: 8.4588254 + 0.008, lon: -13.1879126 } // ~890 m north
  it('false for Freetown + Kenema', () => expect(ringsIntersect([masonie, kenema], 500)).toBe(false))
  it('true when centres are within 2r', () => expect(ringsIntersect([masonie, near], 500)).toBe(true))
  it('false at a radius too small to meet', () => expect(ringsIntersect([masonie, near], 400)).toBe(false))
})
