import { useMemo, useState } from 'react';
import './CalendarView.css';

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const WEEKDAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const MAX_VISIBLE = 3;

const pad = (n) => String(n).padStart(2, '0');
const toKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

const normalizeDate = (value) => {
  if (!value) return null;
  const s = String(value);
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  return null;
};

const formatKey = (key) => {
  const [y, m, d] = key.split('-');
  return `${d}.${m}.${y}`;
};

export default function CalendarView({ tasks }) {
  const today = new Date();
  const todayKey = toKey(today.getFullYear(), today.getMonth(), today.getDate());

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const tasksByDay = useMemo(() => {
    const map = {};
    (tasks || []).forEach((t) => {
      const key = normalizeDate(t.deadline);
      if (!key) return;
      (map[key] = map[key] || []).push(t);
    });
    return map;
  }, [tasks]);

  const cells = useMemo(() => {
    const offset = (new Date(year, month, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const list = Array(offset).fill(null);
    for (let d = 1; d <= daysInMonth; d++) list.push(d);
    while (list.length % 7 !== 0) list.push(null);
    return list;
  }, [year, month]);

  const clearSelection = () => {
    setSelectedDay(null);
    setSelectedTaskId(null);
  };

  const shiftMonth = (delta) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    clearSelection();
  };

  const goToday = () => {
    setYear(today.getFullYear());
    setMonth(today.getMonth());
    clearSelection();
  };

  const handleYearChange = (e) => {
    const value = Number(e.target.value);
    if (Number.isInteger(value) && value >= 1970 && value <= 2100) {
      setYear(value);
      clearSelection();
    }
  };

  const selectDay = (key) => {
    setSelectedDay(key);
    setSelectedTaskId(null);
  };

  const dayTasks = selectedDay ? tasksByDay[selectedDay] || [] : [];
  const previewTask = selectedTaskId == null
    ? null
    : (tasks || []).find((t) => t.id === selectedTaskId) || null;

  return (
    <section className="calendar" aria-label="Kalendarz zadań">
      <div className="calendar-toolbar">
        <button type="button" onClick={() => shiftMonth(-1)} aria-label="Poprzedni miesiąc">‹</button>
        <select
          value={month}
          onChange={(e) => { setMonth(Number(e.target.value)); clearSelection(); }}
          aria-label="Miesiąc"
        >
          {MONTHS.map((name, i) => <option key={name} value={i}>{name}</option>)}
        </select>
        <input
          type="number"
          min="1970"
          max="2100"
          key={year}
          defaultValue={year}
          onChange={handleYearChange}
          aria-label="Rok"
        />
        <button type="button" onClick={() => shiftMonth(1)} aria-label="Następny miesiąc">›</button>
        <button type="button" onClick={goToday}>Dziś</button>
      </div>

      <h2 className="calendar-title">{MONTHS[month]} {year}</h2>

      <div className="calendar-grid">
        {WEEKDAYS.map((w) => <div key={w} className="calendar-weekday">{w}</div>)}
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} className="calendar-cell calendar-cell-empty" />;
          const key = toKey(year, month, day);
          const list = tasksByDay[key] || [];
          const classes = ['calendar-cell'];
          if (key === todayKey) classes.push('calendar-today');
          if (key === selectedDay) classes.push('calendar-selected');
          return (
            <div
              key={key}
              className={classes.join(' ')}
              role="button"
              tabIndex={0}
              onClick={() => selectDay(key)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectDay(key);
                }
              }}
            >
              <span className="calendar-day-number">{day}</span>
              {list.slice(0, MAX_VISIBLE).map((t) => (
                <button
                  type="button"
                  key={t.id}
                  className={`calendar-chip chip-${String(t.priority || '').toLowerCase()}`}
                  title={t.name}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDay(key);
                    setSelectedTaskId(t.id);
                  }}
                >
                  {t.name}
                </button>
              ))}
              {list.length > MAX_VISIBLE && (
                <span className="calendar-more">+{list.length - MAX_VISIBLE} więcej</span>
              )}
            </div>
          );
        })}
      </div>

      {selectedDay && (
        <div className="calendar-details">
          <h3>Zadania na {formatKey(selectedDay)}</h3>
          {dayTasks.length === 0 ? (
            <p>Brak zadań w tym dniu.</p>
          ) : (
            <ul>
              {dayTasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`calendar-task-link${t.id === selectedTaskId ? ' active' : ''}`}
                    onClick={() => setSelectedTaskId(t.id)}
                  >
                    {t.name} <small>({t.status})</small>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {previewTask && (
            <div className={`calendar-preview chip-${String(previewTask.priority || '').toLowerCase()}`}>
              {previewTask.project_name && <h4>{previewTask.project_name}</h4>}
              <h4>{previewTask.name}</h4>
              <p>Termin: {formatKey(normalizeDate(previewTask.deadline) || selectedDay)}</p>
              <p>Priorytet: {previewTask.priority}</p>
              <p>Status: {previewTask.status}</p>
              <p>Opis: {previewTask.description || 'Brak opisu'}</p>
              <button type="button" onClick={() => setSelectedTaskId(null)}>Zamknij podgląd</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
