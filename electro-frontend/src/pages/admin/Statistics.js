import React, { useState, useEffect } from 'react';
import { adminAPI } from '../../api/api';
import AdminNavPanel from '../../components/AdminNavPanel/AdminNavPanel';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import './Admin.css';
import './Statistics.css';

const Statistics = () => {
  const [applianceStats, setApplianceStats] = useState([]);
  const [manufacturerStats, setManufacturerStats] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');


  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [statsRes, mfrRes, projectsRes] = await Promise.all([
        adminAPI.getApplianceStatistics(),
        adminAPI.getManufacturerStatistics().catch(() => ({ data: [] })),
        adminAPI.getAllProjects().catch(() => ({ data: [] }))
      ]);
      setApplianceStats(statsRes.data || []);
      setManufacturerStats(mfrRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (err) {
      setError('Ошибка загрузки статистики');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Подготовка данных для круговой диаграммы (топ-9 + остальные в "Другое")
  const sortedStats = applianceStats
    .filter(item => (item.usageCount || 0) > 0)
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  
  const top9 = sortedStats.slice(0, 9).map(item => ({
    name: item.applianceName || 'Неизвестно',
    value: item.usageCount || 0
  }));
  
  const othersSum = sortedStats.slice(9).reduce((sum, item) => sum + (item.usageCount || 0), 0);
  
  const pieChartData = othersSum > 0 
    ? [...top9, { name: 'Другое', value: othersSum }]
    : top9;

  // Цвета для круговой диаграммы
  const COLORS = ['#5a6fd8', '#667eea', '#764ba2', '#f093fb', '#4facfe', '#00f2fe', '#43e97b', '#38f9d7', '#fa709a', '#fee140', '#30cfd0', '#330867', '#a8edea', '#fed6e3', '#ffecd2'];

  const topManufacturersData = (manufacturerStats || [])
    .filter((m) => (m.usageCount || 0) > 0)
    .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
    .slice(0, 10)
    .map((m) => ({
      name: m.manufacturerName || '—',
      fullName: m.manufacturerName || '—',
      value: m.usageCount || 0,
      power: m.totalPowerConsumption ? parseFloat(m.totalPowerConsumption) / 1000 : 0,
      projects: m.projectsCount || 0,
    }));


  // Общая статистика
  const totalStats = {
    totalUsage: applianceStats.reduce((sum, item) => sum + (item.usageCount || 0), 0),
    totalPower: applianceStats.reduce((sum, item) => sum + (item.totalPowerConsumption ? parseFloat(item.totalPowerConsumption) : 0), 0),
    totalProjects: projects.length,
    uniqueAppliances: applianceStats.length
  };

  if (loading) return <div className="loading-container">Загрузка статистики...</div>;
  if (error) return <div className="error-message">{error}</div>;

  return (
    <div className="admin-page statistics-page fade-in">
      <AdminNavPanel />
      <div className="page-header">
        <h1>Статистика использования электроприборов</h1>
        <p className="page-subtitle">Анализ использования оборудования в расчётах</p>
      </div>

      {/* Общая статистика */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-card-content">
            <h3>{totalStats.totalUsage}</h3>
            <p>Всего использований</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content">
            <h3>{(totalStats.totalPower / 1000).toFixed(2)}</h3>
            <p>Общая мощность (кВт)</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content">
            <h3>{totalStats.totalProjects}</h3>
            <p>Расчётов</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-card-content">
            <h3>{totalStats.uniqueAppliances}</h3>
            <p>Уникальных типов</p>
          </div>
        </div>
      </div>

      {/* Круговая диаграмма: все электроприборы по частоте использования */}
      {pieChartData.length > 0 && (
        <div className="chart-container">
          <h2 className="chart-title">Распределение электроприборов по частоте использования</h2>
          <ResponsiveContainer width="100%" height={500}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={150}
                fill="#8884d8"
                dataKey="value"
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* График 1: Топ производителей и их вклад приборов */}
      <div className="chart-container">
        <h2 className="chart-title">Топ-10 производителей по использованию их приборов</h2>
        <ResponsiveContainer width="100%" height={460}>
          <BarChart data={topManufacturersData} margin={{ top: 20, right: 30, left: 20, bottom: 120 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis 
              dataKey="name" 
              angle={-35}
              textAnchor="end"
              height={130}
              interval={0}
              tick={{ fontSize: 12 }}
            />
            <YAxis />
            <Tooltip 
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload || {};
                  return (
                    <div style={{ 
                      backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                      padding: '10px', 
                      border: '1px solid #ccc',
                      borderRadius: '4px'
                    }}>
                      <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>{data.fullName}</p>
                      <p>Использований приборов: {data.value}</p>
                      <p>Общая мощность: {data.power.toFixed(2)} кВт</p>
                      <p>Расчётов: {data.projects}</p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar dataKey="value" fill="#764ba2" name="Использования приборов" />
            <Bar dataKey="power" fill="#43e97b" name="Общая мощность (кВт)" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Таблица детальной статистики */}
      <div className="chart-container">
        <h2 className="chart-title">Детальная статистика по приборам</h2>
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Прибор</th>
                <th>Количество использований</th>
                <th>Общая мощность</th>
                <th>Расчётов</th>
              </tr>
            </thead>
            <tbody>
              {applianceStats.length === 0 ? (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center' }}>
                    Нет данных
                  </td>
                </tr>
              ) : (
                applianceStats
                  .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0))
                  .map((stat) => (
                    <tr key={stat.applianceId}>
                      <td><strong>{stat.applianceName}</strong></td>
                      <td>{stat.usageCount || 0}</td>
                      <td>{stat.totalPowerConsumption ? (parseFloat(stat.totalPowerConsumption) / 1000).toFixed(2) : '0.00'} кВт</td>
                      <td>{stat.projectsCount || 0}</td>
                    </tr>
                  ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
