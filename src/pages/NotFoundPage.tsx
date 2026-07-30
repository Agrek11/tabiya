import { Link } from 'react-router-dom';
import { useTokens } from '../theme/ThemeContext';

export function NotFoundPage() {
  const t = useTokens();
  return (
    <section style={{ maxWidth: 680, margin: 'auto', padding: '64px 24px', textAlign: 'center' }}>
      <p style={{ color: t.inkSoft, fontWeight: 700 }}>404</p>
      <h1 style={{ color: t.ink }}>That page is not here.</h1>
      <p style={{ color: t.inkDim }}>Your training and local data are unchanged.</p>
      <p style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
        <Link to="/">Today</Link>
        <Link to="/drill">Train</Link>
      </p>
    </section>
  );
}
