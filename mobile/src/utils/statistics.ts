export const RANKS = [
  { name: 'Początkujący', threshold: 0, color: '#64748b' },
  { name: 'Praktykant', threshold: 10, color: '#2563a6' },
  { name: 'Specjalista', threshold: 30, color: '#398447' },
  { name: 'Ekspert', threshold: 75, color: '#8051b0' },
  { name: 'Mistrz', threshold: 150, color: '#a56b08' },
];

const priorities = [
  { name: 'Niski', points: 1 },
  { name: 'Normalny', points: 2 },
  { name: 'Wysoki', points: 3 },
] as const;

export function readStatistics(data: unknown) {
  if (!data || typeof data !== 'object' || !('counts' in data) || !data.counts || typeof data.counts !== 'object') {
    throw new Error('Nieprawidłowe statystyki.');
  }
  const counts = data.counts as Record<string, unknown>;
  const rows = priorities.map(priority => {
    const count = counts[priority.name];
    if (typeof count !== 'number' || !Number.isSafeInteger(count) || count < 0) throw new Error('Nieprawidłowa liczba zadań.');
    return { ...priority, count, score: count * priority.points };
  });
  const score = rows.reduce((sum, priority) => sum + priority.score, 0);
  const completed = rows.reduce((sum, priority) => sum + priority.count, 0);
  const rankIndex = RANKS.findLastIndex(rank => score >= rank.threshold);
  const rank = RANKS[rankIndex];
  const nextRank = RANKS[rankIndex + 1] ?? null;
  const progress = nextRank ? Math.floor((score - rank.threshold) / (nextRank.threshold - rank.threshold) * 100) : 100;
  return { priorities: rows, score, completed, rank, nextRank, progress };
}
