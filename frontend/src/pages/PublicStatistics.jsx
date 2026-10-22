import { useParams } from 'react-router-dom';
import Statistics from './Statistics.jsx';
import '../App.css';

export default function PublicStatistics() {
  const { token } = useParams();
  return (
    <div className="page">
      <nav className="nav"><a className="public-statistics-login" href="/tasks">Zaloguj się do aplikacji</a></nav>
      <main className="content"><Statistics publicToken={token} /></main>
    </div>
  );
}
