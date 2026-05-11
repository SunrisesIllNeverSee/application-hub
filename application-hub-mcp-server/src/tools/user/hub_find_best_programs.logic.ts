export type ProgramRow = {
  name: string;
  slug: string;
  type: string;
  status: string;
  deadline_at: string | null;
  equity_pct: number | null;
  cash_value_usd: number | null;
  program_value_score: number | null;
  is_rolling: boolean;
};

export type RankedProgram = ProgramRow & {
  fit_score: number;
  composite: number;
};

export function extractProgram(row: any): ProgramRow {
  return (Array.isArray(row.programs) ? row.programs[0] : row.programs) as ProgramRow;
}

export function rowToRanked(row: any): RankedProgram {
  const p = extractProgram(row);
  return {
    name: p.name, slug: p.slug, type: p.type, status: p.status,
    deadline_at: p.deadline_at, equity_pct: p.equity_pct,
    cash_value_usd: p.cash_value_usd, program_value_score: p.program_value_score,
    is_rolling: p.is_rolling,
    fit_score: row.fit_score,
    composite: ((row.fit_score ?? 0) * (p.program_value_score ?? 50)) / 100
  };
}

export function passesEquity(p: { equity_pct: number | null }, equity_max_pct: number | undefined): boolean {
  if (equity_max_pct === undefined) return true;
  if (p.equity_pct == null) return true;
  return p.equity_pct <= equity_max_pct;
}

export function passesType(p: { type: string }, type: string[] | undefined): boolean {
  if (!type) return true;
  return type.includes(p.type);
}

export function rankPrograms(
  rows: any[],
  equity_max_pct: number | undefined,
  type: string[] | undefined,
  limit: number
): RankedProgram[] {
  return rows
    .filter((r) => r.programs)
    .map(rowToRanked)
    .filter((p) => passesEquity(p, equity_max_pct))
    .filter((p) => passesType(p, type))
    .sort((a, b) => b.composite - a.composite)
    .slice(0, limit);
}

export function daysUntil(deadline_at: string | null, now: number = Date.now()): number | null {
  if (!deadline_at) return null;
  return Math.ceil((new Date(deadline_at).getTime() - now) / 86_400_000);
}
