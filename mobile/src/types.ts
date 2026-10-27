export const PRIORITIES = ['Niski', 'Normalny', 'Wysoki'] as const;
export const STATUSES = ['Do zrobienia', 'Realizowane', 'Wykonane'] as const;

export type Task = {
  id: number;
  name: string;
  description: string;
  deadline: string;
  priority: typeof PRIORITIES[number];
  status: typeof STATUSES[number];
  project_id?: number | null;
  project_name?: string | null;
};

export type RootStackParamList = {
  Login: undefined;
  Tasks: undefined;
  TaskForm: { task?: Task } | undefined;
};
