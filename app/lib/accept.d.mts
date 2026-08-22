export interface AcceptEntry {
  type: string
  q: number
  specificity: number
}

export function parseAccept(header: string): AcceptEntry[]
export function preferredType(header: string | null, produces?: string[]): string | null
export function appendVaryAccept(headers: Headers): void
