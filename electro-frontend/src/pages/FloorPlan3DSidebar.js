import React, { useState } from 'react';
import { DEFAULT_ROOM_HEIGHT_M } from './floorPlan3D/builders3D';

const ROOM_HEIGHT_M = DEFAULT_ROOM_HEIGHT_M;

function SavedCalcModal({ item, mode, onConfirm, onCancel }) {
  if (!item || !mode) return null;
  const isRestore = mode === 'restore';
  return (
    <div className="floor-plan-3d-modal-backdrop" onClick={onCancel}>
      <div
        className="floor-plan-3d-modal"
        style={{ maxWidth: 420 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ color: isRestore ? '#60a5fa' : '#f87171' }}>
          {isRestore ? '↺ Загрузить сохранение' : '✕ Удалить сохранение'}
        </h2>
        <p style={{ fontWeight: 600, color: '#e2e8f0', marginBottom: '0.5rem' }}>
          «{item.name}»
        </p>
        {item.createdAt && (
          <p style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
            Сохранено: {new Date(item.createdAt).toLocaleString('ru-RU')}
          </p>
        )}
        {isRestore ? (
          <>
            {item.projectSnapshot && (
              <p style={{ color: '#86efac', fontSize: '0.85rem', marginTop: '6px' }}>
                Снимок содержит: {(item.projectSnapshot.rooms || []).length} комнат,{' '}
                {(item.projectSnapshot.electricalPoints || []).length} точек,{' '}
                {(item.projectSnapshot.routes || []).length} трасс
              </p>
            )}
            <p style={{ color: '#fbbf24', marginTop: '8px' }}>
              Текущие стены, точки и трассы будут заменены данными из снимка.
            </p>
          </>
        ) : (
          <p style={{ color: '#fca5a5', marginTop: '8px' }}>
            Сохранение будет удалено навсегда. Это действие нельзя отменить.
          </p>
        )}
        <div className="floor-plan-3d-modal-actions">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="btn-primary"
            style={isRestore ? {} : { background: '#991b1b', borderColor: '#ef4444' }}
            onClick={onConfirm}
          >
            {isRestore ? 'Загрузить' : 'Удалить'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FloorPlan3DSidebar({
  sceneData,
  focusRoom,
  enterRoom,
  selectedRoomId,
  selectedRoom,
  roomWidthCm,
  setRoomWidthCm,
  roomLengthCm,
  setRoomLengthCm,
  setLastEditedRoomSide,
  roomCeilingHeightM,
  setRoomCeilingHeightM,
  setRoomHeightById,
  saveSelectedRoomGeometry,
  savingRoomGeometry,
  saveCalcName,
  setSaveCalcName,
  saveCurrent3DCalculation,
  saved3DCalculations,
  selectedSavedCalcId,
  openSaved3DCalculation,
  selectedSavedCalcDetails,
  projectId,
  projectName,
  tool,
  setTool,
  surfaceMode,
  setSurfaceMode,
  wallFaceMode,
  setWallFaceMode,
  parallelOffsetCm,
  setParallelOffsetCm,
  doorWidthCm,
  setDoorWidthCm,
  doorHeightCm,
  setDoorHeightCm,
  windowWidthCm,
  setWindowWidthCm,
  windowHeightCm,
  setWindowHeightCm,
  pointHeight,
  setPointHeight,
  newRouteName,
  setNewRouteName,
  routeHeight,
  setRouteHeight,
  routePlacementMode,
  setRoutePlacementMode,
  selectedCircuitId,
  setSelectedCircuitId,
  circuits,
  saveRoute,
  overwriteSelectedRoute,
  removeLastNode,
  clearRouteDraft,
  deleteSelectedRoute,
  routePointCount,
  routeValidationMessages,
  routeNodesRef,
  updateNodeAtIndex,
  insertNodeAfter,
  removeNodeAt,
  toCentimeters,
  toMeters,
  stats,
  routeDraftLength,
  readinessText,
  validationStages,
  roomExistingStats,
  selectedRoomCalculation,
  roomLimitsEdit,
  setRoomLimitsEdit,
  saveRoomLimits,
  savingRoomLimits,
  getRouteModeWarning,
  undoLastAction,
  redoLastAction,
  canUndo,
  canRedo,
  loadRouteToDraft,
  selectedRouteId,
  outletSocketCount,
  setOutletSocketCount,
  viewingSavedSnapshot,
  exitSavedSnapshot,
  restoreFromSavedCalculation,
  deleteSavedCalculation,
}) {
  const [savedCalcModal, setSavedCalcModal] = useState(null);
  // savedCalcModal = null | { mode: 'restore'|'delete', item: {...} }

  return (
    <aside className="floor-plan-3d-panel">
      <h2>Инструменты</h2>
      <div className="room-list-panel">
        <h3>Комнаты текущего расчета</h3>
        <div className="room-list-scroll">
          {sceneData.rooms.map((room) => (
            <div
              key={room.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: '6px',
                marginBottom: '6px',
              }}
            >
              <button
                type="button"
                className={selectedRoomId === room.id ? 'route-item-btn active' : 'route-item-btn'}
                onClick={() => focusRoom(room.id)}
              >
                {room.name}
              </button>
              <button type="button" className="btn-secondary" onClick={() => enterRoom(room.id)}>
                Войти
              </button>
            </div>
          ))}
        </div>
        <div className="floor-plan-3d-tip">
          Редактирование выполняется только внутри выбранной комнаты.
        </div>
        <div className="floor-plan-3d-tip">
          Сначала выберите комнату и нажмите «Войти» или используйте режимы камеры, затем размещайте точки и трассы внутри нее.
        </div>
      </div>
      {selectedRoom && (
        <>
          <div className="room-geometry-panel">
            <h3>Геометрия комнаты для 3D</h3>
            {selectedRoom.area && (
              <div className="floor-plan-3d-tip">
                Площадь комнаты: <strong>{Number(selectedRoom.area).toFixed(2)} м²</strong>.
                При изменении одной стороны в метрах вторая может быть рассчитана из площади.
              </div>
            )}
            <div className="editor-field">
              <label htmlFor="roomWidthM">Ширина, м</label>
              <input
                id="roomWidthM"
                type="number"
                min="0.5"
                max="50"
                step="0.1"
                value={roomWidthCm != null ? (roomWidthCm / 100).toFixed(2) : ''}
                onChange={(e) => {
                  const val = Number(e.target.value || 0);
                  setLastEditedRoomSide('width');
                  if (!val) {
                    setRoomWidthCm(null);
                    return;
                  }
                  const cm = val * 100;
                  setRoomWidthCm(cm);
                  const areaM2 = Number(selectedRoom.area || 0);
                  if (areaM2 > 0) {
                    const otherCm = (areaM2 * 10000) / cm;
                    setRoomLengthCm(otherCm);
                  }
                }}
              />
            </div>
            <div className="editor-field">
              <label htmlFor="roomLengthM">Длина, м</label>
              <input
                id="roomLengthM"
                type="number"
                min="0.5"
                max="50"
                step="0.1"
                value={roomLengthCm != null ? (roomLengthCm / 100).toFixed(2) : ''}
                onChange={(e) => {
                  const val = Number(e.target.value || 0);
                  setLastEditedRoomSide('length');
                  if (!val) {
                    setRoomLengthCm(null);
                    return;
                  }
                  const cm = val * 100;
                  setRoomLengthCm(cm);
                  const areaM2 = Number(selectedRoom.area || 0);
                  if (areaM2 > 0) {
                    const otherCm = (areaM2 * 10000) / cm;
                    setRoomWidthCm(otherCm);
                  }
                }}
              />
            </div>
            <div className="editor-field">
              <label htmlFor="roomHeightM">Высота потолка, м</label>
              <input
                id="roomHeightM"
                type="number"
                min="2"
                max="5"
                step="0.1"
                value={roomCeilingHeightM.toFixed(2)}
                onChange={(e) => {
                  const val = Number(e.target.value || ROOM_HEIGHT_M);
                  const nextHeight = val > 0 ? val : ROOM_HEIGHT_M;
                  setRoomCeilingHeightM(nextHeight);
                  if (selectedRoomId) {
                    setRoomHeightById((prev) => ({ ...prev, [selectedRoomId]: nextHeight }));
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={saveSelectedRoomGeometry}
              disabled={savingRoomGeometry}
            >
              {savingRoomGeometry ? 'Сохранение...' : 'Сохранить геометрию комнаты'}
            </button>
          </div>
          <div className="room-plan-panel">
            <h3>Сохранения 3D расчетов</h3>
            {viewingSavedSnapshot && (
              <div className="floor-plan-3d-tip" style={{ color: '#fbbf24', borderColor: '#92400e', background: '#1c1205' }}>
                <strong>Просмотр сохранённого снимка.</strong> Редактирование отключено. Нажмите «Вернуться к текущему», чтобы продолжить работу.
                <button type="button" className="btn-primary" style={{ marginTop: '6px', width: '100%' }} onClick={exitSavedSnapshot}>
                  Вернуться к текущему
                </button>
              </div>
            )}
            <div className="editor-field">
              <label htmlFor="saveCalcName">Название сохранения</label>
              <input
                id="saveCalcName"
                type="text"
                value={saveCalcName}
                onChange={(e) => setSaveCalcName(e.target.value)}
                placeholder="Например: Вариант с доп. линией кухни"
                disabled={viewingSavedSnapshot}
              />
            </div>
            <button type="button" className="btn-primary" onClick={saveCurrent3DCalculation} disabled={viewingSavedSnapshot}>
              Сохранить текущий 3D расчет
            </button>
            <div className="room-list-scroll" style={{ marginTop: '8px' }}>
              {saved3DCalculations.map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    background: selectedSavedCalcId === item.id ? '#0c1a35' : '#0f1729',
                    border: `1px solid ${selectedSavedCalcId === item.id ? '#2563eb' : '#1e2d45'}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    marginBottom: '6px',
                    cursor: 'default',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        background: 'none',
                        border: 'none',
                        color: selectedSavedCalcId === item.id ? '#93c5fd' : '#cbd5e1',
                        fontWeight: selectedSavedCalcId === item.id ? 600 : 400,
                        textAlign: 'left',
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '0.9rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      onClick={() => openSaved3DCalculation(item.id)}
                      title="Просмотреть снимок"
                    >
                      {item.name}
                    </button>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: '1px solid #1d4ed8',
                        borderRadius: '5px',
                        color: '#60a5fa',
                        width: '28px',
                        height: '28px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                      onClick={() => setSavedCalcModal({ mode: 'restore', item })}
                      title="Загрузить как текущее состояние"
                    >
                      ↺
                    </button>
                    <button
                      type="button"
                      style={{
                        background: 'none',
                        border: '1px solid #7f1d1d',
                        borderRadius: '5px',
                        color: '#f87171',
                        width: '28px',
                        height: '28px',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                      onClick={() => setSavedCalcModal({ mode: 'delete', item })}
                      title="Удалить сохранение"
                    >
                      ✕
                    </button>
                  </div>
                  {item.createdAt && (
                    <span style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '4px' }}>
                      {new Date(item.createdAt).toLocaleString('ru-RU')}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {selectedSavedCalcDetails && (
              <div className="floor-plan-3d-tip">
                <div><strong>{selectedSavedCalcDetails.name}</strong></div>
                <div>Сохранено: {new Date(selectedSavedCalcDetails.createdAt).toLocaleString('ru-RU')}</div>
                {selectedSavedCalcDetails.totalPower != null && (
                  <div>Мощность: {Number(selectedSavedCalcDetails.totalPower || 0).toFixed(0)} Вт</div>
                )}
                {selectedSavedCalcDetails.totalCost != null && (
                  <div>Стоимость: {Number(selectedSavedCalcDetails.totalCost || 0).toFixed(2)} BYN</div>
                )}
                {selectedSavedCalcDetails.calculation && (
                  <div>Кабель: {Number(selectedSavedCalcDetails.calculation.cableLength || 0).toFixed(2)} м</div>
                )}
                {selectedSavedCalcDetails.projectSnapshot && (
                  <div style={{ marginTop: '4px', color: '#86efac' }}>
                    Снимок: {(selectedSavedCalcDetails.projectSnapshot.rooms || []).length} комнат,{' '}
                    {(selectedSavedCalcDetails.projectSnapshot.electricalPoints || []).length} точек,{' '}
                    {(selectedSavedCalcDetails.projectSnapshot.routes || []).length} трасс,{' '}
                    {(selectedSavedCalcDetails.projectSnapshot.walls || []).length} стен
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="existing-routes-list">
            <h3>Существующие трассы</h3>
            {sceneData.routes.length === 0 ? (
              <div className="floor-plan-3d-tip">Трасс пока нет. Нарисуйте маршрут и нажмите «Сохранить и начать новую».</div>
            ) : (
              <ul>
                {sceneData.routes.map((route) => (
                  <li key={route.id}>
                    <button
                      type="button"
                      className={selectedRouteId === route.id ? 'route-item-btn active' : 'route-item-btn'}
                      onClick={() => loadRouteToDraft(route.id)}
                    >
                      #{route.id} {route.notes || 'Без названия'} ({Number(route.lengthM || 0).toFixed(2)} м)
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {selectedRoom && (
            <div className="floor-plan-3d-tip">
              Геометрию и площадь комнаты изменяйте в настройках проекта «{projectName}».
            </div>
          )}
          <div className="tool-grid">
            <button className={tool === 'navigate' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('navigate')}>
              Навигация
            </button>
            <button className={tool === 'add-source' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('add-source')}>
              Точка старта линии
            </button>
            <button className={tool === 'add-outlet' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('add-outlet')}>
              Розетка
            </button>
            {tool === 'add-outlet' && (() => {
              // Parse config groups to know which sizes are available and how many are placed
              let configGroups = [];
              if (selectedRoom?.socketGroupsConfig) {
                try { configGroups = JSON.parse(selectedRoom.socketGroupsConfig); } catch (e) { }
              }
              // Count allowed per size from config
              const allowedBySize = configGroups.reduce((acc, g) => {
                const n = Number(g.socketsCount) || 1;
                acc[n] = (acc[n] || 0) + 1;
                return acc;
              }, {});
              const configSizes = Object.keys(allowedBySize).map(Number).sort();
              // Which sizes to show: if config exists — only those sizes; otherwise 1–4
              const sizesToShow = configSizes.length > 0 ? configSizes : [1, 2, 3, 4];
              return (
                <div className="editor-field">
                  <label>В группе</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
                    {sizesToShow.map((n) => {
                      const allowed = allowedBySize[n] || 0;
                      const placed = roomExistingStats?.outletsBySize?.[n] || 0;
                      const full = configSizes.length > 0 && placed >= allowed;
                      const isSelected = outletSocketCount === n;
                      return (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setOutletSocketCount(n)}
                          title={configSizes.length > 0 ? `${placed}/${allowed} размещено` : undefined}
                          style={{
                            padding: '6px 12px',
                            fontSize: '0.95rem',
                            fontWeight: isSelected ? 700 : 400,
                            background: isSelected ? (full ? '#dc2626' : '#16a34a') : (full ? '#fee2e2' : '#0b1120'),
                            color: isSelected ? '#fff' : (full ? '#b91c1c' : '#e2e8f0'),
                            border: `1px solid ${full ? '#fca5a5' : isSelected ? '#16a34a' : '#334155'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            textDecoration: full ? 'line-through' : 'none',
                          }}
                        >
                          {n}{configSizes.length > 0 ? ` (${placed}/${allowed})` : ''}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })()}
            <button className={tool === 'add-switch' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('add-switch')}>
              Выключатель
            </button>
            <button
              type="button"
              className={tool === 'add-light' ? 'tool-btn active' : 'tool-btn'}
              onClick={() => setTool('add-light')}
              title="Только на потолок"
            >
              Лампа
            </button>
            <button className={tool === 'draw-route' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('draw-route')}>
              Трасса кабеля
            </button>
            <button className={tool === 'add-door' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('add-door')}>
              Дверь
            </button>
            <button className={tool === 'add-window' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('add-window')}>
              Окно
            </button>
            <button
              className={tool === 'delete' ? 'tool-btn active' : 'tool-btn'}
              style={tool === 'delete' ? { borderColor: '#f87171', background: '#3b0f0f' } : {}}
              onClick={() => setTool('delete')}
            >
              🗑 Удалить объект
            </button>
          </div>
          {tool === 'delete' && (
            <div className="floor-plan-3d-tip" style={{ color: '#fca5a5', borderColor: '#7f1d1d', background: '#1c0a0a' }}>
              Наведите на точку или трассу и нажмите ЛКМ или клавишу Delete для удаления.
            </div>
          )}
          {tool === 'add-light' && (
            <div className="floor-plan-3d-tip">
              Светильник размещается только на потолке; режим «Потолок» включается автоматически.
            </div>
          )}

          {/* Рабочая поверхность — для инструментов размещения точек и трассы */}
          {['add-outlet', 'add-switch', 'add-light', 'add-source', 'draw-route'].includes(tool) && (
            <>
              <div className="editor-field">
                <label htmlFor="surfaceMode">Рабочая поверхность</label>
                <select
                  id="surfaceMode"
                  value={surfaceMode}
                  onChange={(e) => setSurfaceMode(e.target.value)}
                  disabled={tool === 'add-light'}
                >
                  <option value="any">Все поверхности</option>
                  <option value="wall">Стены</option>
                  <option value="floor">Пол</option>
                  <option value="ceiling">Потолок</option>
                </select>
              </div>
              {surfaceMode === 'any' && (
                <div className="floor-plan-3d-tip">
                  Клик и превью по ближайшей грани луча (стена, пол или потолок). Для фиксации одной грани выберите «Стены», «Пол» или «Потолок».
                </div>
              )}
              {surfaceMode === 'wall' && (
                <div className="editor-field">
                  <label htmlFor="wallFaceMode">Грань стены (изнутри комнаты)</label>
                  <select id="wallFaceMode" value={wallFaceMode} onChange={(e) => setWallFaceMode(e.target.value)}>
                    <option value="auto">Авто (ближайшая)</option>
                    <option value="north">Северная</option>
                    <option value="south">Южная</option>
                    <option value="west">Западная</option>
                    <option value="east">Восточная</option>
                  </select>
                </div>
              )}
            </>
          )}

          {/* Высота точки — только для точечных объектов */}
          {['add-outlet', 'add-switch', 'add-light', 'add-source'].includes(tool) && (
            <div className="editor-field">
              <label htmlFor="pointHeight">Высота точки, см</label>
              <input
                id="pointHeight"
                type="number"
                min="0"
                max="400"
                value={pointHeight}
                onChange={(e) => setPointHeight(Number(e.target.value || 0))}
              />
            </div>
          )}

          {/* Электрическая цепь — для любых электрических точек и трасс */}
          {['add-outlet', 'add-switch', 'add-light', 'add-source', 'draw-route'].includes(tool) && (
            <div className="editor-field">
              <label htmlFor="routeCircuit">Электрическая цепь</label>
              <select
                id="routeCircuit"
                value={selectedCircuitId}
                onChange={(e) => setSelectedCircuitId(e.target.value)}
              >
                <option value="">Без цепи</option>
                {circuits.map((circuit) => (
                  <option key={circuit.id} value={circuit.id}>
                    {circuit.name} ({circuit.breakerRatingA || '?'}A)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Ширина и высота двери — только при добавлении двери */}
          {tool === 'add-door' && (
            <>
              <div className="editor-field">
                <label htmlFor="doorWidth">Ширина двери, см</label>
                <input
                  id="doorWidth"
                  type="number"
                  min="50"
                  max="200"
                  value={doorWidthCm}
                  onChange={(e) => setDoorWidthCm(Number(e.target.value || 0))}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="doorHeight">Высота двери, см</label>
                <input
                  id="doorHeight"
                  type="number"
                  min="180"
                  max="220"
                  value={doorHeightCm}
                  onChange={(e) => setDoorHeightCm(Number(e.target.value || 0))}
                />
              </div>
            </>
          )}

          {/* Ширина и высота окна — только при добавлении окна */}
          {tool === 'add-window' && (
            <>
              <div className="editor-field">
                <label htmlFor="windowWidth">Ширина окна, см</label>
                <input
                  id="windowWidth"
                  type="number"
                  min="50"
                  max="300"
                  value={windowWidthCm}
                  onChange={(e) => setWindowWidthCm(Number(e.target.value || 0))}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="windowHeight">Высота окна, см</label>
                <input
                  id="windowHeight"
                  type="number"
                  min="60"
                  max="150"
                  value={windowHeightCm}
                  onChange={(e) => setWindowHeightCm(Number(e.target.value || 0))}
                />
              </div>
            </>
          )}

          {/* Параметры трассы — только в режиме прокладки трассы */}
          {tool === 'draw-route' && (
            <>
              <div className="editor-field">
                <label htmlFor="routeMode">Режим прокладки</label>
                <select
                  id="routeMode"
                  value={routePlacementMode}
                  onChange={(e) => setRoutePlacementMode(e.target.value)}
                >
                  <option value="auto">Авто: пол, стены, потолок (по лучу)</option>
                  <option value="wall">Только стена</option>
                  <option value="ceiling">Только потолок</option>
                  <option value="floor">Только пол</option>
                </select>
              </div>
              {routePlacementMode === 'wall' && (
                <div className="editor-field">
                  <label htmlFor="parallelOffsetCm">Смещение параллельной линии, см</label>
                  <input
                    id="parallelOffsetCm"
                    type="number"
                    min="-30"
                    max="30"
                    value={parallelOffsetCm}
                    onChange={(e) => setParallelOffsetCm(Number(e.target.value || 0))}
                  />
                </div>
              )}
              <div className="editor-field">
                <label htmlFor="routeHeight">Базовая высота трассы, см</label>
                <input
                  id="routeHeight"
                  type="number"
                  min="0"
                  max="400"
                  value={routeHeight}
                  onChange={(e) => setRouteHeight(Number(e.target.value || 0))}
                />
              </div>
              <div className="editor-field">
                <label htmlFor="routeName">Название трассы</label>
                <input
                  id="routeName"
                  type="text"
                  value={newRouteName}
                  onChange={(e) => setNewRouteName(e.target.value)}
                  placeholder="Например: Кухня-розетки-1"
                />
              </div>
              <div className="floor-plan-3d-tip">
                «Рабочая поверхность» и «Режим прокладки» синхронизируются автоматически. Режим «Авто» — переходы между стенами, полом и потолком. Другие режимы — одна поверхность. Смещение работает только в режиме «Только стена».
              </div>
              <div className="floor-plan-3d-tip">
                <strong>Логика разводки:</strong> 1) разместите «Точку старта» (щит) на стене, 2) проложите маршрут: клик около символа привязывает узел к электрической точке, 3) первый и последний узел — у приборов по ТКП. После сохранения черновик сбрасывается.
              </div>
            </>
          )}

          <div className="route-actions">
            <button type="button" className="btn-primary" onClick={saveRoute} disabled={routePointCount < 2 || routeValidationMessages.length > 0} title="Сохранить текущий черновик в базу и очистить для новой трассы">
              ✓ Сохранить и начать новую
            </button>
            <button type="button" className="btn-primary" onClick={overwriteSelectedRoute} disabled={!selectedRouteId || routePointCount < 2 || routeValidationMessages.length > 0} title="Заменить уже сохранённую трассу текущим черновиком">
              Обновить выбранную
            </button>
            <button type="button" className="btn-secondary" onClick={removeLastNode} disabled={routePointCount === 0}>
              ← Удалить последний узел
            </button>
            <button type="button" className="btn-secondary" onClick={clearRouteDraft} title="Отменить черновик без сохранения">
              Сбросить черновик
            </button>
            <button type="button" className="btn-secondary" onClick={deleteSelectedRoute} disabled={!selectedRouteId}>
              Удалить выбранную
            </button>
          </div>
          {routeValidationMessages.length > 0 && (
            <div className="route-validation-messages">
              <strong>Что нужно исправить:</strong>
              <ul>
                {routeValidationMessages.map((msg) => (
                  <li key={msg}>{msg}</li>
                ))}
              </ul>
            </div>
          )}

          {routeNodesRef.current.length > 0 && (
            <div className="route-node-editor">
              <h3>Узлы черновика</h3>
              <div className="route-node-scroll">
                {routeNodesRef.current.map((node, idx) => (
                  <div key={`${idx}-${node.x}-${node.y}-${node.z}`} className="route-node-row">
                    <span className="route-node-index">#{idx + 1}</span>
                    <input
                      type="number"
                      step="0.1"
                      value={Number(toCentimeters(node.x).toFixed(1))}
                      onChange={(e) => updateNodeAtIndex(idx, 'x', toMeters(e.target.value))}
                      title="X (см)"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={Number(toCentimeters(node.y).toFixed(1))}
                      onChange={(e) => updateNodeAtIndex(idx, 'y', toMeters(e.target.value))}
                      title="Y (см)"
                    />
                    <input
                      type="number"
                      step="0.1"
                      value={Number(toCentimeters(node.z).toFixed(1))}
                      onChange={(e) => updateNodeAtIndex(idx, 'z', toMeters(e.target.value))}
                      title="Z (см)"
                    />
                    <button type="button" className="mini-btn" onClick={() => insertNodeAfter(idx)}>+</button>
                    <button type="button" className="mini-btn" onClick={() => removeNodeAt(idx)} disabled={routeNodesRef.current.length <= 2}>-</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <h2>Статус сцены</h2>
          <ul>
            <li>Помещения: {stats.rooms}</li>
            <li>Стены: {stats.walls}</li>
            <li>Точки: {stats.points}</li>
            <li>Трассы: {stats.routes}</li>
            <li>Узлы трассы: {routePointCount}</li>
            <li>Длина черновика: {routeDraftLength.toFixed(2)} м</li>
          </ul>
          <div className="floor-plan-3d-tip">{readinessText}</div>
          <div className="floor-plan-3d-tip">
            <strong>Валидация ТКП 339:</strong>
            <div style={{ marginTop: '4px' }}>
              <span style={{ color: validationStages.stage1Errors.length ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                {validationStages.stage1Errors.length ? '✗' : '✓'} Геометрия:
              </span>
              {validationStages.stage1Errors.length
                ? validationStages.stage1Errors.map((e, i) => <div key={i} style={{ color: '#fca5a5', paddingLeft: '12px' }}>— {e}</div>)
                : <span style={{ color: '#86efac' }}> OK</span>}
            </div>
            <div style={{ marginTop: '4px' }}>
              <span style={{ color: validationStages.stage2Errors.length ? '#f87171' : '#4ade80', fontWeight: 600 }}>
                {validationStages.stage2Errors.length ? '✗' : '✓'} Электробезопасность:
              </span>
              {validationStages.stage2Errors.length
                ? validationStages.stage2Errors.map((e, i) => <div key={i} style={{ color: '#fca5a5', paddingLeft: '12px' }}>— {e}</div>)
                : <span style={{ color: '#86efac' }}> OK</span>}
            </div>
            <div style={{ marginTop: '4px' }}>
              <span style={{ color: validationStages.stage3Warnings.length ? '#fbbf24' : '#4ade80', fontWeight: 600 }}>
                {validationStages.stage3Warnings.length ? '⚠' : '✓'} Рекомендации:
              </span>
              {validationStages.stage3Warnings.length
                ? validationStages.stage3Warnings.map((w, i) => <div key={i} style={{ color: '#fde68a', paddingLeft: '12px' }}>— {w}</div>)
                : <span style={{ color: '#86efac' }}> нет замечаний</span>}
            </div>
          </div>
          {selectedRoom && (
            <div className="floor-plan-3d-tip">
              <strong>{selectedRoom.name} — текущее состояние:</strong>
              <div>Точек: {roomExistingStats.points} (розетки {roomExistingStats.outlets} гр. / {roomExistingStats.totalOutletSockets ?? 0} шт., выключатели {roomExistingStats.switches}, свет {roomExistingStats.lights})</div>
              <div>Двери: {roomExistingStats.doors}, Окна: {roomExistingStats.windows}</div>
              <div>Приборов в комнате: {roomExistingStats.appliances}</div>
              {selectedRoomCalculation && (
                <div>
                  Частичный расчет: {selectedRoomCalculation.applianceCount} приборов, {Number(selectedRoomCalculation.totalPower || 0).toFixed(0)} Вт
                </div>
              )}
            </div>
          )}
          {selectedRoom && (
            <div className="room-plan-panel">
              <h3>Лимиты комнаты</h3>
              <div className="floor-plan-3d-tip">
                Установите максимально допустимое количество объектов. Оставьте поле пустым, чтобы не ограничивать.
              </div>
              {(() => {
                if (!selectedRoom?.socketGroupsConfig) return null;
                let groups = [];
                try { groups = JSON.parse(selectedRoom.socketGroupsConfig); } catch (e) { return null; }
                if (!groups.length) return null;
                // Count allowed per size
                const allowedBySize = groups.reduce((acc, g) => {
                  const n = Number(g.socketsCount) || 1;
                  acc[n] = (acc[n] || 0) + 1;
                  return acc;
                }, {});
                return (
                  <div className="floor-plan-3d-tip" style={{ marginBottom: '6px' }}>
                    <strong>Розеточные группы (из калькулятора):</strong>
                    {Object.entries(allowedBySize).sort(([a], [b]) => a - b).map(([size, count]) => {
                      const placed = roomExistingStats?.outletsBySize?.[Number(size)] || 0;
                      const full = placed >= count;
                      return (
                        <div key={size} style={{ color: full ? '#16a34a' : undefined }}>
                          {count}× по {size} розетки — {placed}/{count} размещено {full ? '✓' : ''}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div className="editor-field">
                <label>Макс. выключателей, шт</label>
                <input
                  type="number"
                  min="0"
                  value={roomLimitsEdit.maxSwitches ?? ''}
                  onChange={(e) => setRoomLimitsEdit({ maxSwitches: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Без ограничений"
                />
              </div>
              <div className="editor-field">
                <label>Макс. дверей, шт</label>
                <input
                  type="number"
                  min="0"
                  value={roomLimitsEdit.maxDoors ?? ''}
                  onChange={(e) => setRoomLimitsEdit({ maxDoors: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Без ограничений"
                />
              </div>
              <div className="editor-field">
                <label>Макс. окон, шт</label>
                <input
                  type="number"
                  min="0"
                  value={roomLimitsEdit.maxWindows ?? ''}
                  onChange={(e) => setRoomLimitsEdit({ maxWindows: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Без ограничений"
                />
              </div>
              <div className="editor-field">
                <label>Макс. световых точек, шт</label>
                <input
                  type="number"
                  min="0"
                  value={roomLimitsEdit.maxLights ?? ''}
                  onChange={(e) => setRoomLimitsEdit({ maxLights: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Без ограничений"
                />
              </div>
              <button type="button" className="btn-primary" onClick={saveRoomLimits} disabled={savingRoomLimits}>
                {savingRoomLimits ? 'Сохранение...' : 'Сохранить лимиты'}
              </button>
              <div className="floor-plan-3d-tip" style={{ marginTop: '8px' }}>
                Текущее: розетки {roomExistingStats.outlets} гр. / {roomExistingStats.totalOutletSockets ?? 0} шт., выключатели {roomExistingStats.switches}, двери {roomExistingStats.doors}, окна {roomExistingStats.windows}, свет {roomExistingStats.lights}
              </div>
            </div>
          )}
          {getRouteModeWarning() && (
            <div className="floor-plan-3d-tip">
              {getRouteModeWarning()}
            </div>
          )}
          <div className="floor-plan-3d-tip">
            Горячие клавиши: <strong>1</strong>-розетка, <strong>2</strong>-выключатель, <strong>3</strong>-свет, <strong>4</strong>-трасса, <strong>5</strong>-дверь, <strong>6</strong>-окно, <strong>N</strong>-навигация, <strong>E</strong>-старт линии, <strong>D</strong>-удалить; поверхности: <strong>W</strong>-стены, <strong>F</strong>-пол, <strong>C</strong>-потолок.
          </div>
          <div className="route-actions">
            <button type="button" className="btn-secondary" onClick={undoLastAction} disabled={!canUndo}>
              Undo (Ctrl+Z)
            </button>
            <button type="button" className="btn-secondary" onClick={redoLastAction} disabled={!canRedo}>
              Redo (Ctrl+Y)
            </button>
          </div>
        </>
      )}
      <SavedCalcModal
        item={savedCalcModal?.item}
        mode={savedCalcModal?.mode}
        onCancel={() => setSavedCalcModal(null)}
        onConfirm={() => {
          if (savedCalcModal?.mode === 'restore') restoreFromSavedCalculation(savedCalcModal.item.id);
          else if (savedCalcModal?.mode === 'delete') deleteSavedCalculation(savedCalcModal.item.id);
          setSavedCalcModal(null);
        }}
      />
    </aside>
  );
}
