import type { Project } from '../types.ts';

export function readProjects(data: unknown): Project[] {
  if (!Array.isArray(data)) throw new Error('Nieprawidłowa lista projektów.');
  return data.map(item => {
    if (!item || !Number.isInteger(item.id) || item.id <= 0 || typeof item.name !== 'string') {
      throw new Error('Nieprawidłowe dane projektu.');
    }
    return { id: item.id, name: item.name, description: typeof item.description === 'string' ? item.description : '' };
  });
}
