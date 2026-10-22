import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { apiFetch } from '../api';
import { getStatisticsFromCounts, RANKS } from './statistics.js';
import './Statistics.css';

function StatisticValue({ value }) {
  const containerRef = useRef(null);
  const numberRef = useRef(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const number = numberRef.current;
    const fit = () => {
      number.style.fontSize = '';
      const width = number.getBoundingClientRect().width;
      const available = container.clientWidth;
      if (width > available && available > 0) {
        const size = parseFloat(getComputedStyle(number).fontSize);
        number.style.fontSize = `${size * available / width}px`;
      }
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(container);
    return () => observer.disconnect();
  }, [value]);

  return <p className="statistics-value" ref={containerRef}><span ref={numberRef}>{value}</span></p>;
}

export default function Statistics({ publicToken }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rulesOpen, setRulesOpen] = useState(false);

  useEffect(() => {
    document.title = 'Statystyki';
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError('');
      try {
        const response = publicToken
          ? await fetch(`/api/public/statistics/${encodeURIComponent(publicToken)}`, { signal: controller.signal, credentials: 'omit' })
          : await apiFetch('/api/statistics', { signal: controller.signal });
        const data = await response.json();
        if (response.status === 404) throw new Error('Link do statystyk jest nieprawidłowy lub nieaktualny.');
        if (!response.ok || !data.user || !data.counts) throw new Error('Nie udało się pobrać statystyk. Spróbuj ponownie.');
        if (!controller.signal.aborted) setData(data);
      } catch (err) {
        if (!controller.signal.aborted) setError(err.message || 'Nie udało się pobrać statystyk. Spróbuj ponownie.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [publicToken]);

  const stats = getStatisticsFromCounts(data?.counts ?? {});

  return (
    <section className="statistics-page" aria-labelledby="statistics-title">
      <header className="statistics-heading">
        <h1 id="statistics-title">{publicToken ? `Statystyki${data ? `: ${data.user.username}` : ''}` : 'Twoje statystyki'}</h1>
        {!publicToken && !loading && !error && data && <a href={`/statistics/${data.publicToken}`}>Publiczny podgląd</a>}
      </header>
      {loading ? <p role="status">Ładowanie statystyk…</p> : error ? <p role="alert">{error}</p> : (
        <>
          <div className="statistics-summary">
            <article className="statistics-card statistics-counter">
              <h2>Wykonane zadania</h2>
              <StatisticValue value={stats.completed} />
            </article>
            <article className="statistics-card statistics-counter">
              <h2>Zdobyte punkty</h2>
              <StatisticValue value={stats.score} />
            </article>
            <article className="statistics-card statistics-rank" style={{ '--rank-color': stats.rank.color }}>
              <h2>{publicToken ? 'Ranga użytkownika' : 'Twoja ranga'}</h2>
              <p className="statistics-rank-name">{stats.rank.name}</p>
              <progress value={stats.progress} max="100" aria-label="Postęp do kolejnej rangi" />
              <p>{stats.nextRank
                ? `Do rangi „${stats.nextRank.name}” brakuje ${stats.nextRank.threshold - stats.score} pkt.`
                : 'Osiągnięto najwyższą rangę!'}</p>
            </article>
          </div>
          <section className="statistics-card" aria-labelledby="statistics-priorities">
            <h2 id="statistics-priorities">Wykonane zadania według priorytetu</h2>
            <div className="statistics-table-wrapper">
              <table className="statistics-table">
                <thead><tr><th scope="col">Priorytet</th><th scope="col">Wykonane</th><th scope="col">Punkty za zadanie</th><th scope="col">Suma punktów</th></tr></thead>
                <tbody>
                  {stats.priorities.map(priority => (
                    <tr key={priority.key}>
                      <th scope="row"><span className={`statistics-priority statistics-priority-${priority.key}`}>{priority.name}</span></th>
                      <td>{priority.count}</td><td>{priority.points}</td><td>{priority.score}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot><tr><th scope="row">Łącznie</th><td>{stats.completed}</td><td>—</td><td>{stats.score}</td></tr></tfoot>
              </table>
            </div>
          </section>
          <section className={`statistics-card statistics-rules${rulesOpen ? ' is-open' : ''}`}>
            <h2>
              <button type="button" className="statistics-rules-toggle" aria-expanded={rulesOpen}
                aria-controls="statistics-rules-body" onClick={() => setRulesOpen(open => !open)}>
              <span>Jak zdobyć rangę?</span>
              <span className="statistics-rules-arrow" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </span>
              </button>
            </h2>
            <div className="statistics-rules-content" id="statistics-rules-body" hidden={!rulesOpen}>
              <p>Wykonuj zadania, aby zdobywać punkty. Wyższy priorytet oznacza więcej punktów.</p>
              <ul className="statistics-ranks">
                {RANKS.map(rank => <li key={rank.name} style={{ '--rank-color': rank.color }}><strong>{rank.name}</strong><span>od {rank.threshold} pkt</span></li>)}
              </ul>
              <p>Statystyki obejmują obecnie zapisane zadania. Usunięcie zadania, zmiana jego priorytetu lub statusu powoduje przeliczenie punktów i rangi.</p>
            </div>
          </section>
        </>
      )}
    </section>
  );
}
