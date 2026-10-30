import assert from 'node:assert/strict';
import test from 'node:test';
import { RANKS, readStatistics } from '../src/utils/statistics.ts';

test('completed priority counts use the same scoring as the web application', () => {
  const stats = readStatistics({ counts: { Niski: 3, Normalny: 2, Wysoki: 1 } });
  assert.equal(stats.completed, 6);
  assert.equal(stats.score, 10);
  assert.equal(stats.rank.name, 'Praktykant');
  assert.equal(stats.progress, 0);
});

test('ranks change at thresholds and progress stays within each rank', () => {
  for (const [index, rank] of RANKS.entries()) {
    const stats = readStatistics({ counts: { Niski: rank.threshold, Normalny: 0, Wysoki: 0 } });
    assert.equal(stats.rank.name, rank.name);
    assert.equal(stats.progress, index === RANKS.length - 1 ? 100 : 0);
    if (index > 0) assert.equal(readStatistics({ counts: { Niski: rank.threshold - 1, Normalny: 0, Wysoki: 0 } }).rank.name, RANKS[index - 1].name);
  }
  assert.equal(readStatistics({ counts: { Niski: 20, Normalny: 0, Wysoki: 0 } }).progress, 50);
});

test('malformed statistics cannot become misleading counters', () => {
  for (const data of [null, {}, { counts: {} }, { counts: { Niski: -1, Normalny: 0, Wysoki: 0 } },
    { counts: { Niski: '2', Normalny: 0, Wysoki: 0 } }]) assert.throws(() => readStatistics(data));
});
