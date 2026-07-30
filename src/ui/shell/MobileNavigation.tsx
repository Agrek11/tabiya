import { BarChart3, CalendarDays, Gamepad2, Settings, Swords } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useTokens } from '../../theme/ThemeContext';

const destinations = [
  { to: '/', label: 'Today', icon: CalendarDays, end: true },
  { to: '/drill', label: 'Train', icon: Swords },
  { to: '/games', label: 'Games', icon: Gamepad2 },
  { to: '/progress', label: 'Progress', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function MobileNavigation() {
  const t = useTokens();
  return (
    <nav className="tabiya-mobile-navigation" aria-label="Primary navigation">
      {destinations.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          aria-label={label}
          style={({ isActive }) => ({
            color: isActive ? t.brand : t.inkDim,
            textDecoration: 'none',
            display: 'flex',
            minWidth: 0,
            flex: 1,
            alignItems: 'center',
            flexDirection: 'column',
            gap: 3,
            fontSize: 10,
            fontWeight: isActive ? 700 : 500,
          })}
        >
          {({ isActive }) => <><Icon size={18} aria-hidden="true" /><span aria-current={isActive ? 'page' : undefined}>{label}</span></>}
        </NavLink>
      ))}
    </nav>
  );
}
