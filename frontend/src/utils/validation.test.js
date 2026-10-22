import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MAX_DESCRIPTION_LENGTH,
  MAX_TASK_NAME_LENGTH,
  validateDescription,
  validateTaskName,
} from './validation.js';

test('task names reject empty and whitespace-only values', () => {
  assert.notEqual(validateTaskName(''), '');
  assert.notEqual(validateTaskName(' \t\n '), '');
});

test('task names accept trimmed values within the database limit', () => {
  assert.equal(validateTaskName(` ${'ż'.repeat(MAX_TASK_NAME_LENGTH)} `), '');
});

test('task names reject values over 100 Unicode characters', () => {
  assert.match(validateTaskName('😀'.repeat(MAX_TASK_NAME_LENGTH + 1)), /100/);
});

test('task and project descriptions share the 5000 character limit', () => {
  assert.equal(validateDescription('x'.repeat(MAX_DESCRIPTION_LENGTH)), '');
  assert.match(validateDescription('x'.repeat(MAX_DESCRIPTION_LENGTH + 1)), /5000/);
  assert.equal(validateDescription('  opis z polskimi znakami żółć  '), '');
});
