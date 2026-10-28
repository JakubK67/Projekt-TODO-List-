import assert from 'node:assert/strict';
import test from 'node:test';
import { readTasks, displayDate } from '../src/utils/tasks.ts';

const task = { id: 1, name: 'Zadanie', description: null, deadline: null, priority: 'Normalny', status: 'Do zrobienia' };

test('task lists accept numeric Symfony IDs and string json-server IDs', () => {
  const tasks = readTasks([task, { ...task, id: 'mock-123', project_name: 'Projekt' }]);
  assert.deepEqual(tasks.map(item => item.id), [1, 'mock-123']);
  assert.equal(tasks[0].description, '');
  assert.equal(tasks[0].deadline, '');
  assert.equal(tasks[1].project_name, 'Projekt');
});

test('invalid task lists and malformed task IDs are rejected', () => {
  assert.throws(() => readTasks({ tasks: [] }));
  for (const id of [null, undefined, {}, '', '   ']) assert.throws(() => readTasks([{ ...task, id }]));
  assert.throws(() => readTasks([{ ...task, status: 'Unknown' }]));
});

test('dates from Symfony and json-server keep the same display format', () => {
  assert.equal(displayDate('2026-10-27'), '27-10-2026');
  assert.equal(displayDate('27-10-2026'), '27-10-2026');
  assert.equal(displayDate(''), '');
});
