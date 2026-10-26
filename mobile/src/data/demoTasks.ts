import type { Task } from '../types';

export const demoTasks: Task[] = [
  {
    id: 1,
    name: 'Przygotować plan tygodnia',
    description: 'Zaplanować najważniejsze zadania i ustalić ich priorytety.',
    deadline: '27-10-2026',
    priority: 'Wysoki',
    status: 'Do zrobienia',
  },
  {
    id: 2,
    name: 'Uporządkować notatki',
    description: 'Zebrać materiały i uporządkować notatki z ostatniego spotkania.',
    deadline: '28-10-2026',
    priority: 'Normalny',
    status: 'Realizowane',
  },
  {
    id: 3,
    name: 'Sprawdzić listę zadań',
    description: 'Przejrzeć zadania zaplanowane na ten tydzień.',
    deadline: '',
    priority: 'Niski',
    status: 'Wykonane',
  },
];
