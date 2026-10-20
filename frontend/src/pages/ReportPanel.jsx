import { useState, useRef, useEffect, useMemo } from 'react';
import Papa from 'papaparse';
import DateInput from '../components/DateInput';
<<<<<<< HEAD
import { filterTasks } from './reportFilters';
=======
import { formatDate as formatDisplayDate } from '../utils/date';
>>>>>>> 6436c95c2da2eee69df9aabfd66c4126da6d99bc
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?worker';

pdfMake.addVirtualFileSystem(pdfFonts);

pdfMake.vfs = pdfFonts?.pdfMake?.vfs ?? pdfFonts?.vfs ?? pdfFonts;
pdfjsLib.GlobalWorkerOptions.workerPort = new PdfWorker();

const COLUMNS = [
  ['Nazwa', 'name'],
  ['Projekt', 'project_name'],
  ['Termin', 'deadline'],
  ['Priorytet', 'priority'],
  ['Status', 'status'],
  ['Opis', 'description'],
];

const STATUSES = ['Do zrobienia', 'W trakcie', 'Zakończone'];

<<<<<<< HEAD
=======
const pad = (n) => String(n).padStart(2, '0');

const formatDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const getCurrentMonthRange = () => {
  const now = new Date();
  return [
    formatDate(new Date(now.getFullYear(), now.getMonth(), 1)),
    formatDate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  ];
};

const filterTasks = (tasks, from, to, excludedPriorities, excludedStatuses) =>
  tasks.filter((t) => {
    if (!t.deadline) return false;
    if (from && t.deadline < from) return false;
    if (to && t.deadline > to) return false;
    if (excludedPriorities.includes(t.priority)) return false;
    if (excludedStatuses.includes(t.status)) return false;
    return true;
  });

>>>>>>> 6436c95c2da2eee69df9aabfd66c4126da6d99bc
const toggleItem = (list, item) =>
  list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const buildCsv = (rows) =>
  '\uFEFF' +
  Papa.unparse(
    {
      fields: COLUMNS.map(([header]) => header),
      data: rows.map((t) => COLUMNS.map(([, key]) => t[key] ?? '')),
    },
    {
      delimiter: ';',
      newline: '\r\n',
      quotes: true,
      escapeFormulae: true,
    },
  );

const buildPdfDefinition = (rows, from, to) => ({
  pageOrientation: 'landscape',
  content: [
    { text: 'Raport zadań', style: 'title' },
    {
      text: `Okres: ${from || '…'} – ${to || '…'}   |   Liczba zadań: ${rows.length}`,
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        headerRows: 1,
        widths: ['*', 'auto', 'auto', 'auto', 'auto', '*'],
        body: [
          COLUMNS.map(([h]) => ({ text: h, bold: true, fillColor: '#eeeeee' })),
          ...rows.map((t) => COLUMNS.map(([, k]) => String(t[k] ?? ''))),
        ],
      },
    },
  ],
  styles: { title: { fontSize: 18, bold: true, margin: [0, 0, 0, 6] } },
  defaultStyle: { fontSize: 9 },
});

const createPdfBlob = (def) =>
  new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(def).getBlob((blob) => resolve(blob));
    } catch (err) {
      reject(err);
    }
  });

async function renderPreview(blob, container) {
  container.innerHTML = '';
  const data = new Uint8Array(await blob.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const viewport = page.getViewport({ scale: 1.2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    canvas.style.maxWidth = '100%';
    canvas.style.display = 'block';
    canvas.style.marginBottom = '8px';
    container.appendChild(canvas);
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  }
}

export default function ReportPanel({ tasks }) {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [monthStart, monthEnd] = useMemo(getCurrentMonthRange, []);
  const [format, setFormat] = useState('pdf');
  const [excludedPriorities, setExcludedPriorities] = useState([]);
  const [excludedStatuses, setExcludedStatuses] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewBlob, setPreviewBlob] = useState(null);
  const previewRef = useRef(null);

  const priorities = useMemo(
    () => [...new Set(tasks.map((t) => t.priority).filter(Boolean))],
    [tasks],
  );

  useEffect(() => {
    if (previewBlob && previewRef.current) {
      renderPreview(previewBlob, previewRef.current).catch((e) => {
        console.error(e);
        setError('Nie udało się wyświetlić podglądu PDF.');
      });
    }
  }, [previewBlob]);

  const getRows = () => {
    const effFrom = from || monthStart;
    const effTo = to || monthEnd;

    if (effFrom > effTo) {
      setError('Data początkowa nie może być późniejsza niż końcowa.');
      return null;
    }
    if (priorities.length > 0 && priorities.every((p) => excludedPriorities.includes(p))) {
      setError('Wybierz co najmniej jeden priorytet.');
      return null;
    }
    if (STATUSES.every((s) => excludedStatuses.includes(s))) {
      setError('Wybierz co najmniej jeden status.');
      return null;
    }
    const rows = filterTasks(tasks, effFrom, effTo, excludedPriorities, excludedStatuses);
    if (rows.length === 0) {
      setError('Brak zadań w wybranym okresie.');
      return null;
    }
    return { rows, effFrom, effTo };
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setPreviewBlob(null);
    const result = getRows();
    if (!result) return;
    const { rows, effFrom, effTo } = result;
    setBusy(true);
    try {
      const stamp = `${effFrom}_${effTo}`;
      if (format === 'csv') {
        download(
          new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' }),
          `raport-zadan_${stamp}.csv`,
        );
      } else {
        const blob = await createPdfBlob(buildPdfDefinition(rows, effFrom, effTo));
        setPreviewBlob(blob);
        download(blob, `raport-zadan_${stamp}.pdf`);
      }
    } catch (err) {
      console.error(err);
      setError('Nie udało się wygenerować raportu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="report">
      <form onSubmit={handleGenerate}>
        <h1>Raport zadań</h1>
        <label htmlFor="report-from">Od (termin):</label>
        <DateInput id="report-from" value={from} onChange={setFrom} placeholder={formatDisplayDate(monthStart)} /><br /><br />
        <label htmlFor="report-to">Do (termin):</label>
        <DateInput id="report-to" value={to} onChange={setTo} placeholder={formatDisplayDate(monthEnd)} /><br /><br />

        <label>Priorytet:</label><br />
        {priorities.map((p) => (
          <div className="checkbox-group" key={p}>
            <input type="checkbox" id={`report-priority-${p}`} name="report-priority" value={p}
              checked={!excludedPriorities.includes(p)}
              onChange={() => setExcludedPriorities((prev) => toggleItem(prev, p))} />
            <label htmlFor={`report-priority-${p}`}>{p}</label><br />
          </div>
        ))}
        <br />

        <label>Status:</label><br />
        {STATUSES.map((s) => (
          <div className="checkbox-group" key={s}>
            <input type="checkbox" id={`report-status-${s}`} name="report-status" value={s}
              checked={!excludedStatuses.includes(s)}
              onChange={() => setExcludedStatuses((prev) => toggleItem(prev, s))} />
            <label htmlFor={`report-status-${s}`}>{s}</label><br />
          </div>
        ))}
        <br />

        <label>Format:</label><br />
        {[['pdf', 'PDF'], ['csv', 'CSV']].map(([v, label]) => (
          <div className="radio-group" key={v}>
            <input type="radio" id={`report-format-${v}`} name="report-format" value={v}
              checked={format === v} onChange={(e) => setFormat(e.target.value)} />
            <label htmlFor={`report-format-${v}`}>{label}</label><br />
          </div>
        ))}
        <br />
        <button type="submit" disabled={busy}>{busy ? 'Generowanie…' : 'Generuj raport'}</button>
        {error && <p role="alert">{error}</p>}
      </form>

      {previewBlob && (
        <div>
          <h2>Podgląd (PDF.js)</h2>
          <div ref={previewRef} className="report-preview" />
        </div>
      )}
    </div>
  );
}
