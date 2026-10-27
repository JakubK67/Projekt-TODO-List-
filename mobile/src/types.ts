export const PRIORITIES = ['Niski', 'Normalny', 'Wysoki'] as const;
export const STATUSES = ['Do zrobienia', 'Realizowane', 'Wykonane'] as const;

export type Task = {
  id: string;
  name: string;
  description: string;
  deadline: string;
  priority: typeof PRIORITIES[number];
  status: typeof STATUSES[number];
};

export type TaskInput = Omit<Task, 'id'>;

export type RootStackParamList = {
  Login: undefined;
  Tasks: undefined;
  TaskForm: { task?: Task } | undefined;
};
