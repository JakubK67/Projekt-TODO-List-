import { Platform } from 'react-native';
import Constants from 'expo-constants';
import type { Task, TaskInput } from '../types';

const expoHost = Constants.expoConfig?.hostUri?.split(':')[0];
const defaultHost = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
const detectedHost = expoHost || defaultHost;
const apiUrl = (process.env.EXPO_PUBLIC_API_URL || `http://${detectedHost}:3001`).replace(/\/$/, '');

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) throw new Error(`API request failed (${response.status})`);
  return response.json() as Promise<T>;
}

export function getTasks(): Promise<Task[]> {
  return request<Task[]>('/tasks');
}

export function createTask(task: TaskInput): Promise<Task> {
  return request<Task>('/tasks', { method: 'POST', body: JSON.stringify(task) });
}

export function updateTask(task: Task): Promise<Task> {
  return request<Task>(`/tasks/${encodeURIComponent(task.id)}`, {
    method: 'PUT',
    body: JSON.stringify(task),
  });
}
