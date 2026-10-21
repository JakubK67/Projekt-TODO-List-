export const PRIORITIES = [
  { name: 'Niski', points: 1, key: 'low' },
  { name: 'Normalny', points: 2, key: 'normal' },
  { name: 'Wysoki', points: 3, key: 'high' },
];

export const RANKS = [
  { name: 'Początkujący', threshold: 0, color: '#64748b' },
  { name: 'Praktykant', threshold: 10, color: '#2563a6' },
  { name: 'Specjalista', threshold: 30, color: '#398447' },
  { name: 'Ekspert', threshold: 75, color: '#8051b0' },
  { name: 'Mistrz', threshold: 150, color: '#a56b08' },
];

export function getStatistics(tasks) {
  const completed = tasks.filter(task => task.status === 'Wykonane');
  const priorities = PRIORITIES.map(priority => {
    const count = completed.filter(task => task.priority === priority.name).length;
    return { ...priority, count, score: count * priority.points };
  });
  const score = priorities.reduce((total, priority) => total + priority.score, 0);
  const rankIndex = RANKS.findLastIndex(rank => score >= rank.threshold);
  const rank = RANKS[rankIndex];
  const nextRank = RANKS[rankIndex + 1] ?? null;
  const progress = nextRank
    ? Math.floor((score - rank.threshold) / (nextRank.threshold - rank.threshold) * 100)
    : 100;
  return { total: tasks.length, completed: completed.length, priorities, score, rank, nextRank, progress };
}
