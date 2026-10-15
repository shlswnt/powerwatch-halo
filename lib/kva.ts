/** First "<number> kVA" in a description; twin ratings like "630/500 kva" take the first number. */
export function parseKva(description: string): number | null {
  const m = description.match(/(\d{2,5})(?:\s*\/\s*\d{2,5})?\s*kva/i)
  return m ? Number(m[1]) : null
}
