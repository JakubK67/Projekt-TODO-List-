import { PRIORITIES, STATUSES, type Task } from '../types';

export function readTasks(data: unknown): Task[] {
  if (!Array.isArray(data)) throw new Error('Nieprawidłowa lista zadań.');
  return data.map(item => {
    if (!item || !Number.isInteger(item.id) || typeof item.name !== 'string'
      || !PRIORITIES.includes(item.priority) || !STATUSES.includes(item.status)) throw new Error('Nieprawidłowe dane zadania.');
    return { ...item, description: typeof item.description === 'string' ? item.description : '',
      deadline: typeof item.deadline === 'string' ? item.deadline : '' };
  });
}

export function displayDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}
