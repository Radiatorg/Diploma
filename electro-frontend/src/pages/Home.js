import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './Home.css';

const ADMIN_CARD_ICON = `${process.env.PUBLIC_URL || ''}/icons8-настройки-администратора-50.png`;

const Home = () => {
  const { user, isDesigner, isAdmin } = useAuth();
  const adminDisplayName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim() || user?.firstName || 'Администратор';
  const welcomeName = isAdmin() ? adminDisplayName : (user.firstName || user.username);

  // Состояние для неавторизованного пользователя
  if (!user) {
    return (
      <div className="home-container guest-view home-page--wide">
        <div className="hero-section fade-in">
          <div className="hero-badge">Энергия вашего расчёта</div>
          <h1>Расчёт электросетей нового поколения</h1>
          <p>Профессиональный инструмент для расчета нагрузок, управления электроприборами и визуального планирования помещений.</p>
          <div className="home-actions">
            <Link to="/login" className="btn-primary main-cta">
              Войти в систему
            </Link>
            <Link to="/register" className="btn-outline">
              Регистрация
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Состояние для авторизованного пользователя
  return (
    <div className="home-page home-page--wide fade-in">
      <header className="home-welcome">
        <div className="welcome-text">
          <h1>Рады видеть вас, {welcomeName}!</h1>
          <p>Ваша текущая роль: <strong>{user.roles?.map(role => role === 'ADMIN' ? 'Admin' : role === 'DESIGNER' ? 'Расчётчик' : role).join(', ')}</strong></p>
        </div>
      </header>

      <section className="dashboard-section">
        <h2 className="section-title">Инструменты расчёта</h2>
        <div className="home-cards home-cards--wide">
          {(isDesigner() || isAdmin()) && (
            <>
              <Link to="/projects" className="home-card-fancy">
                <div className="card-content">
                  <h3>Мои расчёты</h3>
                  <p>Создание, редактирование и визуальное планирование схем электроснабжения.</p>
                  <span className="card-link">Перейти →</span>
                </div>
              </Link>

              <Link to="/appliances" className="home-card-fancy">
                <div className="card-content">
                  <h3>Каталог приборов</h3>
                  <p>Просмотр технических характеристик доступного электрооборудования.</p>
                  <span className="card-link">Перейти →</span>
                </div>
              </Link>

              <Link to="/calculator" className="home-card-fancy">
                <div className="card-content">
                  <h3>Калькулятор ведомости</h3>
                  <p>Пошаговый расчёт ведомости нагрузки и параметров линий.</p>
                  <span className="card-link">Перейти →</span>
                </div>
              </Link>
            </>
          )}

          <Link to="/profile" className="home-card-fancy profile-card-dashboard">
            <div className="card-content">
              <h3>Личный профиль</h3>
              <p>Управление персональными данными, смена аватара и настройки аккаунта.</p>
              <span className="card-link">Перейти →</span>
            </div>
          </Link>
        </div>
      </section>

      {isAdmin() && (
        <section className="dashboard-section admin-section">
          <h2 className="section-title">Администрирование системы</h2>
          <div className="home-cards">
            <Link to="/admin/users" className="home-card-fancy admin">
              <div className="card-content">
                <h3>Пользователи</h3>
                <p>Управление доступом, ролями и учетными записями.</p>
              </div>
              <img src={ADMIN_CARD_ICON} alt="" className="home-admin-card-icon" width={40} height={40} />
            </Link>

            <Link to="/admin/appliances" className="home-card-fancy admin">
              <div className="card-content">
                <h3>База оборудования</h3>
                <p>Добавление новых типов приборов и их параметров.</p>
              </div>
              <img src={ADMIN_CARD_ICON} alt="" className="home-admin-card-icon" width={40} height={40} />
            </Link>

            <Link to="/admin/room-types" className="home-card-fancy admin">
              <div className="card-content">
                <h3>Типы помещений</h3>
                <p>Настройка коэффициентов спроса для разных комнат.</p>
              </div>
              <img src={ADMIN_CARD_ICON} alt="" className="home-admin-card-icon" width={40} height={40} />
            </Link>

            <Link to="/admin/projects" className="home-card-fancy admin">
              <div className="card-content">
                <h3>Все расчёты</h3>
                <p>Мониторинг созданных расчётов во всей системе.</p>
              </div>
              <img src={ADMIN_CARD_ICON} alt="" className="home-admin-card-icon" width={40} height={40} />
            </Link>

            <Link to="/admin/statistics" className="home-card-fancy admin">
              <div className="card-content">
                <h3>Глобальная статистика</h3>
                <p>Анализ использования приборов и популярности категорий.</p>
              </div>
              <img src={ADMIN_CARD_ICON} alt="" className="home-admin-card-icon" width={40} height={40} />
            </Link>
          </div>
        </section>
      )}
    </div>
  );
};

export default Home;