import assert from 'node:assert/strict';
import test from 'node:test';
import { getStatistics, getStatisticsFromCounts, RANKS } from './statistics.js';

test('public aggregate counts produce the same points and ranks as private tasks', () => {
  const counts = { Niski: 2, Normalny: 3, Wysoki: 4 };
  const tasks = Object.entries(counts).flatMap(([priority, count]) =>
    Array.from({ length: count }, () => ({ priority, status: 'Wykonane' })));
  const { total, ...privateStats } = getStatistics(tasks);
  assert.equal(total, 9);
  assert.deepEqual(getStatisticsFromCounts(counts), privateStats);
  assert.equal(privateStats.score, 20);
  assert.equal(privateStats.rank.name, 'Praktykant');
});

test('empty account starts with zero points and the first rank', () => {
  const stats = getStatistics([]);
  assert.equal(stats.completed, 0);
  assert.equal(stats.score, 0);
  assert.equal(stats.rank, RANKS[0]);
  assert.equal(stats.progress, 0);
  assert.deepEqual(stats.priorities.map(priority => priority.count), [0, 0, 0]);
});

test('counts and weights only completed tasks by priority', () => {
  const stats = getStatistics([
    { status: 'Wykonane', priority: 'Niski' },
    { status: 'Wykonane', priority: 'Normalny' },
    { status: 'Wykonane', priority: 'Wysoki' },
    { status: 'Wykonane', priority: 'Wysoki' },
    { status: 'Do zrobienia', priority: 'Wysoki' },
    { status: 'Realizowane', priority: 'Normalny' },
  ]);
  assert.equal(stats.total, 6);
  assert.equal(stats.completed, 4);
  assert.equal(stats.score, 9);
  assert.deepEqual(stats.priorities.map(priority => priority.count), [1, 1, 2]);
  assert.equal(stats.progress, 90);
});

test('ranks change exactly at each threshold and the highest rank has no successor', () => {
  for (const [index, rank] of RANKS.entries()) {
    const tasks = Array.from({ length: rank.threshold }, () => ({ status: 'Wykonane', priority: 'Niski' }));
    assert.equal(getStatistics(tasks).rank, rank);
    if (index > 0) assert.equal(getStatistics(tasks.slice(1)).rank, RANKS[index - 1]);
  }
  const highest = getStatistics(Array.from({ length: 160 }, () => ({ status: 'Wykonane', priority: 'Niski' })));
  assert.equal(highest.nextRank, null);
  assert.equal(highest.progress, 100);
});

test('changing status, priority or deleting a task recalculates the score', () => {
  const task = { status: 'Wykonane', priority: 'Wysoki' };
  assert.equal(getStatistics([task]).score, 3);
  assert.equal(getStatistics([{ ...task, priority: 'Niski' }]).score, 1);
  assert.equal(getStatistics([{ ...task, status: 'Realizowane' }]).score, 0);
  assert.equal(getStatistics([]).score, 0);
});
