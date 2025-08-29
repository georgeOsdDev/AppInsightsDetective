import React from 'react';
import { PanelType } from '../types';

interface SidebarProps {
  currentPanel: PanelType;
  onPanelChange: (panel: PanelType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPanel, onPanelChange }) => {
  const navItems = [
    {
      id: 'query' as PanelType,
      title: 'Query Editor',
      icon: (
        <path d="M9.5 3A6.5 6.5 0 0 1 16 9.5c0 1.61-.59 3.09-1.56 4.23l.27.27h.79l5 5-1.5 1.5-5-5v-.79l-.27-.27A6.516 6.516 0 0 1 9.5 16 6.5 6.5 0 0 1 3 9.5 6.5 6.5 0 0 1 9.5 3m0 2C7.01 5 5 7.01 5 9.5S7.01 14 9.5 14 14 11.99 14 9.5 11.99 5 9.5 5z"/>
      )
    },
    {
      id: 'templates' as PanelType,
      title: 'Templates',
      icon: (
        <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
      )
    },
    {
      id: 'history' as PanelType,
      title: 'History',
      icon: (
        <path d="M13.5,8H12V13L16.28,15.54L17,14.33L13.5,12.25V8M13,3A9,9 0 0,0 4,12H1L4.96,16.03L9,12H6A7,7 0 0,1 13,5A7,7 0 0,1 20,12A7,7 0 0,1 13,19C11.07,19 9.32,18.21 8.06,16.94L6.64,18.36C8.27,20 10.5,21 13,21A9,9 0 0,0 22,12A9,9 0 0,0 13,3"/>
      )
    }
  ];

  return (
    <aside className="sidebar">
      <nav className="sidebar-nav">
        <div className="nav-section">
          <h3 className="nav-section-title">Query</h3>
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${currentPanel === item.id ? 'active' : ''}`}
              onClick={() => onPanelChange(item.id)}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="currentColor">
                {item.icon}
              </svg>
              {item.title}
            </button>
          ))}
        </div>
      </nav>
    </aside>
  );
};