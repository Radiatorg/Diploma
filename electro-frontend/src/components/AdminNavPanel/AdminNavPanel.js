import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import './AdminNavPanel.css';

const AdminNavPanel = () => {
  const location = useLocation();

  const navItems = [
    { path: '/admin/users', label: 'Пользователи' },
    { path: '/admin/appliances', label: 'Электроприборы' },
    { path: '/admin/manufacturers', label: 'Производители' },
    // Вкладка электрических символов скрыта, но логика работает
    // { path: '/admin/electrical-symbols', label: 'Электрические символы' },
    { path: '/admin/room-types', label: 'Типы помещений' },
    { path: '/admin/projects', label: 'Расчёты' },
    { path: '/admin/statistics', label: 'Статистика' },
  ];

  return (
    <div className="admin-nav-panel">
      <h2>Администрирование</h2>
      <div className="admin-nav-links">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`admin-nav-link ${location.pathname === item.path ? 'active' : ''}`}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default AdminNavPanel;

