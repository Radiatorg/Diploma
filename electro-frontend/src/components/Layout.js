import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ChatWidget from './ChatWidget/ChatWidget';
import { fileAbsoluteUrl } from '../utils/apiOrigin';
import { FOOTER_SOCIAL_YOUTUBE, FOOTER_SOCIAL_INSTAGRAM } from '../config/footerSocial';
import './Layout.css';

const Layout = ({ children }) => {
  const { user, logout, isDesigner, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isFullscreen3D = /^\/projects\/\d+\/floor-plan(\/3d)?$/.test(location.pathname);
  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [showFooter, setShowFooter] = useState(() => {
    const saved = localStorage.getItem('showFooter');
    return saved !== null ? saved === 'true' : true;
  });

  // Следим за скроллом для кнопки "Вверх"
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleFooter = () => {
    const newValue = !showFooter;
    setShowFooter(newValue);
    localStorage.setItem('showFooter', newValue.toString());
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const backgroundImageUrl = `${process.env.PUBLIC_URL || ''}/background.jpg`;
  const profileLabel = user?.username || user?.email || 'U';
  const profileInitial = profileLabel.trim().charAt(0).toUpperCase() || 'U';
  const searchLinks = [
    { label: 'Главная', to: '/' },
    { label: 'Расчёты', to: '/projects' },
    { label: 'Каталог приборов', to: '/appliances' },
    { label: 'Калькулятор ведомости', to: '/calculator' },
    { label: 'Профиль', to: '/profile' },
    { label: 'Поддержка', to: '/support' },
    ...(isAdmin()
      ? [
          { label: 'Админ: пользователи', to: '/admin/users' },
          { label: 'Админ: приборы', to: '/admin/appliances' },
          { label: 'Админ: производители', to: '/admin/manufacturers' },
          { label: 'Админ: расчёты', to: '/admin/projects' },
          { label: 'Админ: статистика', to: '/admin/statistics' },
        ]
      : []),
  ];
  const qTrim = headerSearch.trim();
  const filteredHeaderLinks =
    qTrim === ''
      ? searchLinks.slice(0, 6)
      : searchLinks.filter((item) =>
          item.label.toLowerCase().includes(headerSearch.toLowerCase())
        );
  const showCatalogFromSearch = qTrim !== '';
  const maxSuggestions = showCatalogFromSearch ? 7 : 6;
  const displayHeaderLinks = filteredHeaderLinks.slice(0, maxSuggestions);
  const showSuggestionsPanel =
    showCatalogFromSearch || displayHeaderLinks.length > 0;

  const NavSep = () => (
    <span className="nav-sep" aria-hidden="true">
      |
    </span>
  );

  return (
    <div 
      className={`layout-wrapper${isFullscreen3D ? ' layout-wrapper--fullscreen' : ''}`}
      style={{
        '--bg-image': `url(${backgroundImageUrl})`
      }}
    >
      {!isFullscreen3D && (
      <nav className="navbar">
        <div className="nav-container">
          <Link to="/" className="nav-logo">
            <span className="logo-a">А</span>
            <span className="logo-rest">лмондГр</span>
          </Link>
          {user && !isAuthPage && (
            <div className="nav-search">
              <input
                value={headerSearch}
                onChange={(e) => {
                  setHeaderSearch(e.target.value);
                  setShowSearchSuggestions(true);
                }}
                onFocus={() => setShowSearchSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSearchSuggestions(false), 200)}
                placeholder="Поиск по системе..."
                className="nav-search-input"
              />
              {showSearchSuggestions && showSuggestionsPanel && (
                <div className="nav-search-suggestions">
                  {showCatalogFromSearch && (
                    <Link
                      to={`/appliances?q=${encodeURIComponent(qTrim)}`}
                      className="nav-search-item nav-search-item--catalog"
                      onClick={() => {
                        setShowSearchSuggestions(false);
                        setHeaderSearch('');
                      }}
                    >
                      Каталог приборов — искать «
                      {qTrim.length > 56 ? `${qTrim.slice(0, 56)}…` : qTrim}»
                    </Link>
                  )}
                  {displayHeaderLinks.map((item) => (
                    <Link
                      key={item.to + item.label}
                      to={item.to}
                      className="nav-search-item"
                      onClick={() => {
                        setShowSearchSuggestions(false);
                        setHeaderSearch('');
                      }}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="nav-menu nav-menu--bar">
            {user && (
              <>
                <Link to="/" className={`nav-text-link ${location.pathname === '/' ? 'active' : ''}`}>
                  Главная
                </Link>
                {(isDesigner() || isAdmin()) && (
                  <>
                    <NavSep />
                    <Link
                      to="/projects"
                      className={`nav-text-link ${
                        location.pathname.startsWith('/projects') &&
                        !location.pathname.startsWith('/admin/projects')
                          ? 'active'
                          : ''
                      }`}
                    >
                      Расчёты
                    </Link>
                  </>
                )}
                {(isDesigner() || isAdmin()) && (
                  <>
                    <NavSep />
                    <Link
                      to="/appliances"
                      className={`nav-text-link ${location.pathname === '/appliances' ? 'active' : ''}`}
                    >
                      Каталог
                    </Link>
                  </>
                )}
                {isAdmin() && (
                  <>
                    <NavSep />
                    <Link to="/admin/users" className="nav-text-link" title="Админ-панель">
                      Админ
                    </Link>
                  </>
                )}
                {(isDesigner() || isAdmin()) && (
                  <>
                    <NavSep />
                    <Link
                      to="/support"
                      className={`nav-text-link ${location.pathname === '/support' ? 'active' : ''}`}
                    >
                      Поддержка
                    </Link>
                  </>
                )}
                <NavSep />
                <Link to="/profile" className="nav-text-link profile-link">
                  {user.photoUrl && user.photoUrl.trim() !== '' ? (
                    <img src={fileAbsoluteUrl(user.photoUrl) || ''} alt="" className="nav-avatar" />
                  ) : (
                    <span className="nav-avatar-placeholder">{profileInitial}</span>
                  )}
                  Профиль
                </Link>
                <NavSep />
                <button type="button" onClick={handleLogout} className="nav-text-link nav-text-logout">
                  Выйти
                </button>
              </>
            )}
          </div>
        </div>
      </nav>
      )}

      <main className={`main-content${isAuthPage ? ' main-content--auth' : ''}`}>
        <div
          className={`content-container${
            isFullscreen3D
              ? ' content-container--fullscreen'
              : isAuthPage
              ? ' content-container--auth'
              : location.pathname === '/' ||
                location.pathname === '/admin/appliances' ||
                location.pathname.startsWith('/manufacturers/')
              ? ' content-container--wide'
              : ''
          }`}
        >
          {isAuthPage ? (
            <div className="auth-shell">
              <div className="auth-card">
                {children}
              </div>
            </div>
          ) : (
            children
          )}
        </div>
      </main>

      {!isFullscreen3D && showFooter && (
        <footer className="footer">
          <div className="footer-container">
            <div className="footer-body">
              <div className="footer-brand">
                <strong className="footer-title">АлмондГр Расчёты</strong>
              </div>
              <nav className="footer-nav" aria-label="Навигация в подвале">
                {!user && (
                  <div className="footer-links">
                    <Link to="/login">Вход</Link>
                    <span className="footer-sep">|</span>
                    <Link to="/register">Регистрация</Link>
                  </div>
                )}
                {user && (
                  <div className="footer-links">
                    <Link to="/">Главная</Link>
                    {(isDesigner() || isAdmin()) && (
                      <>
                        <span className="footer-sep">|</span>
                        <Link to="/projects">Расчёты</Link>
                        <span className="footer-sep">|</span>
                        <Link to="/appliances">Каталог приборов</Link>
                        <span className="footer-sep">|</span>
                        <Link to="/calculator">Калькулятор ведомости</Link>
                        <span className="footer-sep">|</span>
                        <Link to="/support">Поддержка</Link>
                      </>
                    )}
                    {isAdmin() && (
                      <>
                        <span className="footer-sep">|</span>
                        <Link to="/admin/users">Админ-панель</Link>
                      </>
                    )}
                    <span className="footer-sep">|</span>
                    <Link to="/profile">Профиль</Link>
                  </div>
                )}
                {(FOOTER_SOCIAL_YOUTUBE.trim() || FOOTER_SOCIAL_INSTAGRAM.trim()) && (
                  <div className="footer-social">
                    {FOOTER_SOCIAL_YOUTUBE.trim() && (
                      <a
                        href={FOOTER_SOCIAL_YOUTUBE.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        YouTube
                      </a>
                    )}
                    {FOOTER_SOCIAL_YOUTUBE.trim() && FOOTER_SOCIAL_INSTAGRAM.trim() && (
                      <span className="footer-sep">|</span>
                    )}
                    {FOOTER_SOCIAL_INSTAGRAM.trim() && (
                      <a
                        href={FOOTER_SOCIAL_INSTAGRAM.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Instagram
                      </a>
                    )}
                  </div>
                )}
                <p className="footer-copyright">© {new Date().getFullYear()} АлмондГр Расчёты</p>
              </nav>
            </div>
            <button
              type="button"
              className="footer-toggle-btn"
              onClick={toggleFooter}
              title="Скрыть футер"
            >
              ×
            </button>
          </div>
        </footer>
      )}
      {!isFullscreen3D && !showFooter && (
        <button 
          className="footer-show-btn" 
          onClick={toggleFooter}
          title="Показать футер"
        >
          ↓
        </button>
      )}

      {/* Кнопка Вверх */}
      {!isFullscreen3D && (
      <button 
        className={`scroll-top-btn ${showScrollTop ? 'visible' : ''}`} 
        onClick={scrollToTop}
        title="Наверх"
      >
        ↑
      </button>
      )}

      {/* Чат виджет */}
      {!isFullscreen3D && <ChatWidget />}
    </div>
  );
};

export default Layout;