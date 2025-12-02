import React, { useState } from 'react';
import { Building2, Palette, ZoomIn, Menu, X } from 'lucide-react';

export const Header: React.FC = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <header className="header" role="banner">
      <div className="header-container">
        <div className="header-brand">
          <h1 className="brand-title">
            <span className="brand-icon" aria-hidden="true">
              <Building2 size={28} strokeWidth={2.5} />
            </span>
            Property Buyer Platform
          </h1>
        </div>

        <div className="header-actions">
          <button
            className="accessibility-button"
            aria-label="Toggle high contrast mode"
            title="Toggle high contrast mode"
          >
            <Palette size={18} />
          </button>

          <button
            className="accessibility-button"
            aria-label="Increase text size"
            title="Increase text size"
          >
            <ZoomIn size={18} />
          </button>

          <button
            className={`menu-toggle ${isMenuOpen ? 'menu-toggle--open' : ''}`}
            aria-label="Toggle navigation menu"
            aria-expanded={isMenuOpen}
            onClick={toggleMenu}
          >
            <span className="menu-icon" aria-hidden="true">
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};