export const MAX_TASK_NAME_LENGTH = 100;
export const MAX_DESCRIPTION_LENGTH = 5000;

export function validateTaskName(value) {
  const name = value.trim();
  if (!name) return 'Wpisz nazwę zadania. Sama spacja nie wystarczy.';
  if (Array.from(name).length > MAX_TASK_NAME_LENGTH) {
    return `Nazwa może mieć maksymalnie ${MAX_TASK_NAME_LENGTH} znaków.`;
  }
  return '';
}

export function validateDescription(value) {
  if (Array.from(value.trim()).length > MAX_DESCRIPTION_LENGTH) {
    return `Opis może mieć maksymalnie ${MAX_DESCRIPTION_LENGTH} znaków.`;
  }
  return '';
}
