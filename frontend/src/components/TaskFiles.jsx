import axios from 'axios';
import { useState, useEffect } from 'react';

const API_URL = '';
const MAX_FILES = 5;
const MAX_TOTAL_BYTES = 15 * 1024 * 1024;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'application/pdf'];
const ALLOWED_EXT = /\.(png|jpe?g|pdf)$/i;
const TYPE_LABELS = { 'image/png': 'PNG', 'image/jpeg': 'JPG', 'application/pdf': 'PDF' };

const formatSize = (bytes) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

export default function TaskFiles({ taskId }) {
  const [files, setFiles] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);
  const usedPercent = Math.min(100, (totalSize / MAX_TOTAL_BYTES) * 100);
  const limitReached = files.length >= MAX_FILES;

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get(`${API_URL}/api/tasks/${taskId}/files`);
        if (active) setFiles(res.data);
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Nie udało się pobrać plików.');
      }
    })();
    return () => { active = false; };
  }, [taskId]);

  const validate = (selected) => {
    if (files.length + selected.length > MAX_FILES) {
      return `Zadanie może mieć maksymalnie ${MAX_FILES} plików.`;
    }
    for (const f of selected) {
      if (!ALLOWED_TYPES.includes(f.type) || !ALLOWED_EXT.test(f.name)) {
        return `Plik „${f.name}” ma niedozwolony format. Dozwolone: PNG, JPG, PDF.`;
      }
    }
    const newSize = selected.reduce((sum, f) => sum + f.size, 0);
    if (totalSize + newSize > MAX_TOTAL_BYTES) {
      return 'Łączny rozmiar plików zadania nie może przekraczać 15 MB.';
    }
    return '';
  };

  const handleSelect = async (e) => {
    const selected = Array.from(e.target.files || []);
    e.target.value = '';
    if (selected.length === 0) return;

    const problem = validate(selected);
    if (problem) {
      setError(problem);
      return;
    }

    setError('');
    setBusy(true);
    try {
      const form = new FormData();
      selected.forEach((f) => form.append('files[]', f));
      const res = await axios.post(`${API_URL}/api/tasks/${taskId}/files`, form);
      setFiles(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się wgrać plików.');
      console.error(err);
    } finally {
      setBusy(false);
    }
  };

  const handleDownload = async (file) => {
    setError('');
    try {
      const res = await axios.get(`${API_URL}/api/tasks/${taskId}/files/${file.id}`, {
        responseType: 'blob',
      });
      const href = URL.createObjectURL(res.data);
      const link = document.createElement('a');
      link.href = href;
      link.download = file.original_name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(href);
    } catch (err) {
      setError('Nie udało się pobrać pliku.');
      console.error(err);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Czy na pewno usunąć plik „${file.original_name}”?`)) return;
    try {
      await axios.delete(`${API_URL}/api/tasks/${taskId}/files/${file.id}`);
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
    } catch (err) {
      setError(err.response?.data?.error || 'Nie udało się usunąć pliku.');
      console.error(err);
    }
  };

  const uploadDisabled = busy || limitReached;

  return (
    <div className="task-files">
      <div className="task-files__header">
        <h4 className="task-files__title">Pliki</h4>
        <span className="task-files__counter">
          {files.length}/{MAX_FILES} · {formatSize(totalSize)} / 15 MB
        </span>
      </div>

      <div className="task-files__bar" aria-hidden="true">
        <div
          className={`task-files__bar-fill${usedPercent >= 90 ? ' is-full' : ''}`}
          style={{ width: `${usedPercent}%` }}
        />
      </div>

      {files.length === 0 ? (
        <p className="task-files__empty">Brak plików</p>
      ) : (
        <ul className="task-files__list">
          {files.map((f) => (
            <li className="task-files__item" key={f.id}>
              <span className="task-files__badge">{TYPE_LABELS[f.mime_type] || 'PLIK'}</span>
              <button
                type="button"
                className="task-files__name"
                title={f.original_name}
                onClick={() => handleDownload(f)}
              >
                {f.original_name}
              </button>
              <span className="task-files__size">{formatSize(f.size)}</span>
              <button
                type="button"
                className="task-files__remove"
                aria-label={`Usuń plik ${f.original_name}`}
                onClick={() => handleDelete(f)}
              >
                Usuń
              </button>
            </li>
          ))}
        </ul>
      )}

      <label className={`task-files__upload${uploadDisabled ? ' is-disabled' : ''}`}>
        <input
          type="file"
          className="task-files__input"
          multiple
          accept=".png,.jpg,.jpeg,.pdf,image/png,image/jpeg,application/pdf"
          disabled={uploadDisabled}
          onChange={handleSelect}
        />
        {busy ? 'Wysyłanie…' : limitReached ? 'Osiągnięto limit plików' : '+ Dodaj pliki'}
      </label>
      <p className="task-files__hint">PNG, JPG, PDF · maks. {MAX_FILES} plików · łącznie do 15 MB</p>

      {error && <p className="task-files__error" role="alert">{error}</p>}
    </div>
  );
}