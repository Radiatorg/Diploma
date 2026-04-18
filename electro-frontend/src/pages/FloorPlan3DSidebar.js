import React from 'react';
import { DEFAULT_ROOM_HEIGHT_M } from './floorPlan3D/builders3D';

const ROOM_HEIGHT_M = DEFAULT_ROOM_HEIGHT_M;

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
  windowWidthCm,
  setWindowWidthCm,
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
  roomPlan,
  setRoomPlanData,
  getRouteModeWarning,
  undoLastAction,
  redoLastAction,
  canUndo,
  canRedo,
  loadRouteToDraft,
  selectedRouteId,
}) {
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
            <div className="editor-field">
              <label htmlFor="saveCalcName">Название сохранения</label>
              <input
                id="saveCalcName"
                type="text"
                value={saveCalcName}
                onChange={(e) => setSaveCalcName(e.target.value)}
                placeholder="Например: Вариант с доп. линией кухни"
              />
            </div>
            <button type="button" className="btn-primary" onClick={saveCurrent3DCalculation}>
              Сохранить текущий 3D расчет
            </button>
            <div className="room-list-scroll" style={{ marginTop: '8px' }}>
              {saved3DCalculations.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={selectedSavedCalcId === item.id ? 'route-item-btn active' : 'route-item-btn'}
                  onClick={() => openSaved3DCalculation(item.id)}
                >
                  #{item.id} {item.name}
                </button>
              ))}
            </div>
            {selectedSavedCalcDetails && (
              <div className="floor-plan-3d-tip">
                <div><strong>{selectedSavedCalcDetails.name}</strong></div>
                <div>Сохранено: {new Date(selectedSavedCalcDetails.createdAt).toLocaleString('ru-RU')}</div>
                {selectedSavedCalcDetails.calculation && (
                  <div>
                    Мощность: {Number(selectedSavedCalcDetails.calculation.totalPowerConsumption || 0).toFixed(0)} Вт,
                    кабель: {Number(selectedSavedCalcDetails.calculation.cableLength || 0).toFixed(2)} м
                  </div>
                )}
              </div>
            )}
          </div>
          {selectedRoom && (
            <div className="floor-plan-3d-tip">
              Геометрию и площадь комнаты изменяйте в настройках проекта: /projects/{projectId}/edit.
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
          <div className="floor-plan-3d-tip">
            <strong>Логика разводки:</strong> 1) разместите «Точку старта» (щит) на стене, 2) проложите маршрут: клик около символа на плане привязывает узел к электрической точке, 3) первый и последний узел — у приборов по ТКП. Промежуточные узлы при необходимости тоже можно привязать к потребителям (не более одной электрической точки на узел). После сохранения черновик сбрасывается — следующая трасса с нуля.
          </div>

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
            <strong>Ступенчатая валидация ТКП:</strong>
            <div>Шаг 1 (геометрия): {validationStages.stage1Errors.length ? `ошибки: ${validationStages.stage1Errors.join('; ')}` : 'OK'}</div>
            <div>Шаг 2 (электробезопасность): {validationStages.stage2Errors.length ? `ошибки: ${validationStages.stage2Errors.join('; ')}` : 'OK'}</div>
            <div>Шаг 3 (уточнение): {validationStages.stage3Warnings.length ? validationStages.stage3Warnings.join('; ') : 'OK'}</div>
          </div>
          {selectedRoom && (
            <div className="floor-plan-3d-tip">
              <strong>{selectedRoom.name} — текущее состояние:</strong>
              <div>Точек: {roomExistingStats.points} (розетки {roomExistingStats.outlets}, выключатели {roomExistingStats.switches}, свет {roomExistingStats.lights})</div>
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
              <h3>План размещения (что хотим добавить)</h3>
              <div className="editor-field">
                <label>План: розетки, шт</label>
                <input
                  type="number"
                  min="0"
                  value={roomPlan.plannedOutlets}
                  onChange={(e) => setRoomPlanData((prev) => ({
                    ...prev,
                    [selectedRoomId]: { ...roomPlan, plannedOutlets: Number(e.target.value || 0) },
                  }))}
                />
              </div>
              <div className="editor-field">
                <label>План: выключатели, шт</label>
                <input
                  type="number"
                  min="0"
                  value={roomPlan.plannedSwitches}
                  onChange={(e) => setRoomPlanData((prev) => ({
                    ...prev,
                    [selectedRoomId]: { ...roomPlan, plannedSwitches: Number(e.target.value || 0) },
                  }))}
                />
              </div>
              <div className="editor-field">
                <label>План: световые точки, шт</label>
                <input
                  type="number"
                  min="0"
                  value={roomPlan.plannedLights}
                  onChange={(e) => setRoomPlanData((prev) => ({
                    ...prev,
                    [selectedRoomId]: { ...roomPlan, plannedLights: Number(e.target.value || 0) },
                  }))}
                />
              </div>
              <div className="editor-field">
                <label>Резерв кабеля, м</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={roomPlan.cableReserveM}
                  onChange={(e) => setRoomPlanData((prev) => ({
                    ...prev,
                    [selectedRoomId]: { ...roomPlan, cableReserveM: Number(e.target.value || 0) },
                  }))}
                />
              </div>
              <div className="floor-plan-3d-tip">
                План по комнате: +{roomPlan.plannedOutlets + roomPlan.plannedSwitches + roomPlan.plannedLights} точек,
                доп. кабель {Number(roomPlan.cableReserveM || 0).toFixed(1)} м.
              </div>
            </div>
          )}
          {getRouteModeWarning() && (
            <div className="floor-plan-3d-tip">
              {getRouteModeWarning()}
            </div>
          )}
          <div className="floor-plan-3d-tip">
            Если выбрана цепь, конечные точки трассы автоматически привязываются к ней (если у точек еще нет цепи).
          </div>
          <div className="floor-plan-3d-tip">
            Сегменты трассы могут идти по прямой в пространстве (в т.ч. с переходом потолок–стена–прибор). Для плотной прокладки у стены используйте смещение параллельной линии.
          </div>
          <div className="floor-plan-3d-tip">
            Горячие клавиши: 1-розетка, 2-выключатель, 3-свет, 4-трасса, W-стены, F-пол, C-потолок.
          </div>
          <div className="route-actions">
            <button type="button" className="btn-secondary" onClick={undoLastAction} disabled={!canUndo}>
              Undo (Ctrl+Z)
            </button>
            <button type="button" className="btn-secondary" onClick={redoLastAction} disabled={!canRedo}>
              Redo (Ctrl+Y)
            </button>
          </div>
          <div className="existing-routes-list">
            <h3>Существующие трассы</h3>
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
          </div>
        </>
      )}
    </aside>
  );
}
