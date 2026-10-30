export const PRIORITIES = ['Niski', 'Normalny', 'Wysoki'] as const;
export const STATUSES = ['Do zrobienia', 'Realizowane', 'Wykonane'] as const;

export type Task = {
  id: number | string;
  name: string;
  description: string;
  deadline: string;
  priority: typeof PRIORITIES[number];
  status: typeof STATUSES[number];
  project_id?: number | null;
  project_name?: string | null;
};

export type TaskInput = Omit<Task, 'id'>;

export type Project = { id: number; name: string; description: string };

export type RootStackParamList = {
  Login: undefined;
  Tasks: undefined;
  Projects: undefined;
  ProjectForm: { project?: Project } | undefined;
  TaskForm: { task?: Task; projectId?: number } | undefined;
};
