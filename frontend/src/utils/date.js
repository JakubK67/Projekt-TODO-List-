export function formatDate(value) {
  if (!value) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
}

export function parseDate(value) {
  if (value === '') return '';
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(value);
  if (!match || Number(match[3]) < 1000) return null;
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
