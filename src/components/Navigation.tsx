import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, HardHat, FileText, MessageSquare } from 'lucide-react';

export const Navigation: React.FC = () => {
  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home },
    { path: '/updates', label: 'Construction Updates', icon: HardHat },
    { path: '/documents', label: 'Documents', icon: FileText },
    { path: '/support', label: 'AI Support', icon: MessageSquare },
  ];

  return (
    <nav className="navigation" role="navigation" aria-label="Main navigation">
      <ul className="nav-list">
        {navItems.map((item) => (
          <li key={item.path} className="nav-item">
            <NavLink
              to={item.path}
              className={({ isActive }) =>
                `nav-link ${isActive ? 'nav-link--active' : ''}`
              }
            >
              <span className="nav-icon" aria-hidden="true">
                <item.icon size={20} strokeWidth={2} />
              </span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
};