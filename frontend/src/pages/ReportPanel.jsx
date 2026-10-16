import { useState, useRef, useEffect } from 'react';
import DateInput from '../components/DateInput';
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

const filterByPeriod = (tasks, from, to) =>
  tasks.filter((t) => {
    if (!t.deadline) return false;
    if (from && t.deadline < from) return false;
    if (to && t.deadline > to) return false;
    return true;
  });

const download = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const buildCsv = (rows) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    COLUMNS.map(([h]) => esc(h)).join(';'),
    ...rows.map((t) => COLUMNS.map(([, k]) => esc(t[k])).join(';')),
  ];

  return '\uFEFF' + lines.join('\r\n');
};

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
  const [format, setFormat] = useState('pdf');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [previewBlob, setPreviewBlob] = useState(null);
  const previewRef = useRef(null);

  useEffect(() => {
    if (previewBlob && previewRef.current) {
      renderPreview(previewBlob, previewRef.current).catch((e) => {
        console.error(e);
        setError('Nie udało się wyświetlić podglądu PDF.');
      });
    }
  }, [previewBlob]);

  const getRows = () => {
    if (from && to && from > to) {
      setError('Data początkowa nie może być późniejsza niż końcowa.');
      return null;
    }
    const rows = filterByPeriod(tasks, from, to);
    if (rows.length === 0) {
      setError('Brak zadań w wybranym okresie.');
      return null;
    }
    return rows;
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError('');
    setPreviewBlob(null);
    const rows = getRows();
    if (!rows) return;
    setBusy(true);
    try {
      const stamp = `${from || 'start'}_${to || 'koniec'}`;
      if (format === 'csv') {
        download(
          new Blob([buildCsv(rows)], { type: 'text/csv;charset=utf-8' }),
          `raport-zadan_${stamp}.csv`,
        );
      } else {
        const blob = await createPdfBlob(buildPdfDefinition(rows, from, to));
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
        <DateInput id="report-from" value={from} onChange={setFrom} /><br /><br />
        <label htmlFor="report-to">Do (termin):</label>
        <DateInput id="report-to" value={to} onChange={setTo} /><br /><br />

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
          <div ref={previewRef} />
        </div>
      )}
    </div>
  );
}
