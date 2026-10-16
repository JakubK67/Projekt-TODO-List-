import { useRef, useState } from 'react';
import { formatDate, parseDate } from '../utils/date';
import './DateInput.css';

export default function DateInput({ id, name, value = '', onChange, required = false }) {
  const [draft, setDraft] = useState({ source: value, text: formatDate(value) });
  const inputRef = useRef(null);

  const changeText = event => {
    const text = event.target.value;
    setDraft({ source: value, text });
    const iso = parseDate(text);
    event.target.setCustomValidity(iso === null ? 'Podaj poprawną datę w formacie dd-MM-yyyy.' : '');
    if (iso !== null) onChange(iso);
  };

  const chooseDate = event => {
    const iso = event.target.value;
    if (iso && parseDate(formatDate(iso)) === null) return;
    inputRef.current.setCustomValidity('');
    setDraft({ source: iso, text: formatDate(iso) });
    onChange(iso);
  };

  return (
    <span className="date-input">
      <input ref={inputRef} className="date-input-text" id={id} name={name} type="text"
        placeholder="dd-MM-yyyy" maxLength={10} required={required}
        title="Data w formacie dd-MM-yyyy" autoComplete="off"
        value={draft.source === value ? draft.text : formatDate(value)} onChange={changeText} />
      <span className="date-input-trigger">
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M16 3v4M8 3v4M3 11h18" />
        </svg>
        <input className="date-input-calendar" type="date" value={value} min="1000-01-01" max="9999-12-31"
          aria-label="Wybierz datę z kalendarza" onChange={chooseDate} />
      </span>
    </span>
  );
}
