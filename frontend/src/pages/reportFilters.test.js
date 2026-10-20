import assert from 'node:assert/strict';
import test from 'node:test';
import { filterTasks } from './reportFilters.js';

const tasks = [
  { id: 1, deadline: '2026-03-01', priority: 'Niski', status: 'Do zrobienia' },
  { id: 2, deadline: '2026-03-15', priority: 'Wysoki', status: 'W trakcie' },
  { id: 3, deadline: '2026-03-31', priority: 'Średni', status: 'Zakończone' },
  { id: 4, deadline: '2026-02-28', priority: 'Wysoki', status: 'Do zrobienia' },
  { id: 5, deadline: '2026-04-01', priority: 'Wysoki', status: 'Do zrobienia' },
  { id: 6, deadline: '', priority: 'Niski', status: 'Do zrobienia' },
];

test('includes tasks on both date boundaries and excludes dates outside the range', () => {
  const result = filterTasks(tasks, '2026-03-01', '2026-03-31', [], []);

  assert.deepEqual(result.map(({ id }) => id), [1, 2, 3]);
});

test('excludes selected priorities and statuses together', () => {
  const result = filterTasks(tasks, '', '', ['Wysoki'], ['Zakończone']);

  assert.deepEqual(result.map(({ id }) => id), [1]);
});

test('applies a start date without an end date', () => {
  const result = filterTasks(tasks, '2026-03-15', '', [], []);

  assert.deepEqual(result.map(({ id }) => id), [2, 3, 5]);
});

test('applies an end date without a start date', () => {
  const result = filterTasks(tasks, '', '2026-03-15', [], []);

  assert.deepEqual(result.map(({ id }) => id), [1, 2, 4]);
});

test('always excludes tasks without a deadline', () => {
  const result = filterTasks(tasks, '', '', [], []);

  assert.equal(result.some(({ id }) => id === 6), false);
});
