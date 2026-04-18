import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { cableRunAPI } from '../../api/api';
import { isSourcePointByNotes } from './builders3D';
import { formatSnapRadiusMetersRu, inferRouteSurfaceKindFromHeightM } from './routeConstants';

const MIN_SEGMENT_M = 0.05;

export function useRouteDraft({
  projectId,
  routesGroupRef,
  rendererRef,
  cameraRef,
  sceneData,
  selectedCircuitId,
  setSelectedCircuitId,
  selectedRoomId,
  selectedRoomBounds,
  activeRoomHeightM = 2.8,
  pushHistoryAction,
  loadSceneData,
  addToast,
  toMeters,
  toCentimeters,
  setStats,
  isPointInsideBounds,
}) {
  const routeDraftLineRef = useRef(null);
  const routeDraftBadLineRef = useRef(null);
  const routeHandleMeshesRef = useRef([]);
  const routePointsRef = useRef([]);
  const routeNodesRef = useRef([]);
  const dragStateRef = useRef({ active: false, nodeIndex: -1 });

  const [newRouteName, setNewRouteName] = useState('');
  const [routeDraftLength, setRouteDraftLength] = useState(0);
  const [routePointCount, setRoutePointCount] = useState(0);
  const [routeValidationMessages, setRouteValidationMessages] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [routeHeight, setRouteHeight] = useState(30);
  const [routePlacementMode, setRoutePlacementMode] = useState('auto');

  const getRouteModeHeight = useCallback(() => {
    if (routePlacementMode === 'ceiling') return Math.max(routeHeight, 240);
    if (routePlacementMode === 'floor') return Math.min(routeHeight, 20);
    if (routePlacementMode === 'auto') return routeHeight;
    return routeHeight;
  }, [routeHeight, routePlacementMode]);

  const getRouteModeWarning = useCallback(() => {
    if (routePlacementMode === 'auto') {
      if (routeHeight < 10 || routeHeight > 260) {
        return 'Для резервной привязки к стене (если луч не попал в грань) задайте базовую высоту 10..260 см.';
      }
      return '';
    }
    if (routePlacementMode === 'ceiling' && routeHeight < 240) {
      return 'ТКП: для потолочной прокладки задайте высоту не ниже 240 см.';
    }
    if (routePlacementMode === 'floor' && routeHeight > 20) {
      return 'ТКП: для напольной прокладки задайте высоту не выше 20 см.';
    }
    if (routePlacementMode === 'wall' && (routeHeight < 10 || routeHeight > 260)) {
      return 'ТКП: для стеновой прокладки рекомендован диапазон 10..260 см.';
    }
    return '';
  }, [routeHeight, routePlacementMode]);

  const prevRouteModeWarningRef = useRef('');
  useEffect(() => {
    const warning = getRouteModeWarning();
    if (warning && warning !== prevRouteModeWarningRef.current) {
      addToast(warning, 'warn');
    }
    prevRouteModeWarningRef.current = warning;
  }, [getRouteModeWarning, addToast]);

  const redrawRouteDraft = useCallback(() => {
    if (!routesGroupRef.current) return;
    if (routeDraftLineRef.current) {
      routeDraftLineRef.current.geometry.dispose();
      routeDraftLineRef.current.material.dispose();
      routesGroupRef.current.remove(routeDraftLineRef.current);
      routeDraftLineRef.current = null;
    }
    if (routeDraftBadLineRef.current) {
      routeDraftBadLineRef.current.geometry.dispose();
      routeDraftBadLineRef.current.material.dispose();
      routesGroupRef.current.remove(routeDraftBadLineRef.current);
      routeDraftBadLineRef.current = null;
    }
    routeHandleMeshesRef.current.forEach((hitMesh) => {
      const grp = hitMesh.parent && hitMesh.parent !== routesGroupRef.current
        ? hitMesh.parent
        : hitMesh;
      grp.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
      });
      routesGroupRef.current.remove(grp);
    });
    routeHandleMeshesRef.current = [];
    setRoutePointCount(routePointsRef.current.length);

    if (routePointsRef.current.length >= 2) {
      const geometry = new THREE.BufferGeometry().setFromPoints(routePointsRef.current);
      const material = new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 0.2,
        gapSize: 0.1,
      });
      const line = new THREE.Line(geometry, material);
      line.computeLineDistances();
      routeDraftLineRef.current = line;
      routesGroupRef.current.add(line);
      let sum = 0;
      for (let i = 1; i < routePointsRef.current.length; i += 1) {
        sum += routePointsRef.current[i - 1].distanceTo(routePointsRef.current[i]);
      }
      setRouteDraftLength(Number(sum.toFixed(2)));
    }

    routePointsRef.current.forEach((p, idx) => {
      const selected = dragStateRef.current.active && dragStateRef.current.nodeIndex === idx;
      const isFirst = idx === 0;
      const isLast = idx === routePointsRef.current.length - 1;
      const coreColor = selected ? 0xf97316 : isFirst ? 0x22d3ee : isLast ? 0x34d399 : 0x67e8f9;
      const ringColor = selected ? 0xfbbf24 : 0x0ea5e9;

      const handleGroup = new THREE.Group();
      handleGroup.position.copy(p);

      const coreMat = new THREE.MeshStandardMaterial({ color: coreColor, roughness: 0.3, metalness: 0.5 });
      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), coreMat);
      handleGroup.add(core);

      const ringMat = new THREE.MeshStandardMaterial({ color: ringColor, roughness: 0.4, metalness: 0.3 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 4, 16), ringMat);
      ring.rotation.x = Math.PI / 2;
      handleGroup.add(ring);

      const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hitMesh.userData = { routeHandleIndex: idx, routeHandlePos: p.clone() };
      handleGroup.add(hitMesh);

      routesGroupRef.current.add(handleGroup);
      routeHandleMeshesRef.current.push(hitMesh);
    });
  }, [routesGroupRef]);

  const pickRouteHandleIndex = useCallback((event) => {
    if (!rendererRef.current || !cameraRef.current) return -1;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(routeHandleMeshesRef.current, false);
    if (!intersects.length) return -1;
    const idx = intersects[0]?.object?.userData?.routeHandleIndex;
    return typeof idx === 'number' ? idx : -1;
  }, [cameraRef, rendererRef]);

  const validateRouteDraft = useCallback(() => {
    const messages = [];
    const points = routePointsRef.current;
    const nodes = routeNodesRef.current;
    if (points.length < 2) {
      messages.push('Добавьте минимум две точки маршрута.');
    }

    const badSegmentPoints = [];
    for (let i = 1; i < points.length; i += 1) {
      const prev = points[i - 1];
      const current = points[i];
      const dx = Math.abs(current.x - prev.x);
      const dy = Math.abs(current.y - prev.y);
      const dz = Math.abs(current.z - prev.z);
      const segmentLength = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (segmentLength < MIN_SEGMENT_M) {
        messages.push(`Сегмент ${i} слишком короткий: минимум 0.05 м.`);
        badSegmentPoints.push([prev.clone(), current.clone()]);
      }
    }

    if (nodes.length >= 2) {
      const start = nodes[0];
      const end = nodes[nodes.length - 1];
      if (!start.pointId) {
        messages.push(`ТКП 339: оконцевание проводника — в корпусе прибора; наведите курсор на символ (основная привязка). Запасной допуск по проекции на план (X/Z) — до ${formatSnapRadiusMetersRu()} м; нормативные высоты задаются свойствами точки.`);
      }
      if (!end.pointId) {
        messages.push(`ТКП 339: оконцевание у потребителя — в изделии; наведите курсор на символ. Запасной допуск по проекции на план (X/Z) — до ${formatSnapRadiusMetersRu()} м.`);
      }
      if ((start.symbolType === 'switch' && end.symbolType === 'outlet')
        || (start.symbolType === 'outlet' && end.symbolType === 'switch')) {
        messages.push('Прямая трасса между выключателем и розеткой запрещена — добавьте промежуточный узел.');
      }
      if (start.symbolType === 'switch' && end.symbolType === 'switch') {
        messages.push('Трасса не может начинаться и заканчиваться на выключателях.');
      }

      const roomSources = selectedRoomId
        ? sceneData.points.filter((p) => p.roomId === selectedRoomId && isSourcePointByNotes(p))
        : [];
      if (roomSources.length > 0) {
        const startPoint = sceneData.points.find((p) => p.id === start.pointId);
        const endPoint = sceneData.points.find((p) => p.id === end.pointId);
        const startIsSource = startPoint ? isSourcePointByNotes(startPoint) : false;
        const endIsSource = endPoint ? isSourcePointByNotes(endPoint) : false;
        /* ТКП 339: у групповой линии одно начало у щита; второй конец — потребитель, не второй «ввод». */
        if (!startIsSource && !endIsSource) {
          messages.push('ТКП 339: в помещении есть щиток — трассу нужно привязать к нему на одном из концов (начало линии от аппарата защиты). Второй конец — на розетке, выключателе или светильнике.');
        }
        if (start.pointId && end.pointId && startIsSource && endIsSource && start.pointId !== end.pointId) {
          messages.push('ТКП 339: нельзя соединять две точки старта (щитка) одной трассой — групповая линия имеет один ввод от щита.');
        }
        if (endIsSource && start.pointId !== end.pointId) {
          messages.push('Конец трассы не задаётся на щитке: окончание проводки — у потребителя. Поставьте щиток (точку старта) у первого узла, последний узел — у розетки, выключателя или светильника.');
        }
      }
      if (start.pointId && end.pointId && !selectedCircuitId) {
        const startPoint = sceneData.points.find((p) => p.id === start.pointId);
        const endPoint = sceneData.points.find((p) => p.id === end.pointId);
        const startCircuitId = startPoint?.circuitId ? Number(startPoint.circuitId) : null;
        const endCircuitId = endPoint?.circuitId ? Number(endPoint.circuitId) : null;
        if (startCircuitId && endCircuitId && startCircuitId === endCircuitId) {
          messages.push('Оба конца привязаны к точкам одной цепи — выберите эту электрическую цепь в списке выше перед сохранением.');
        }
      }
    }

    if (routePlacementMode === 'ceiling' && getRouteModeHeight() < 240) {
      messages.push('Для потолочной прокладки высота должна быть не ниже 240 см.');
    }
    if (routePlacementMode === 'floor' && getRouteModeHeight() > 20) {
      messages.push('Для напольной прокладки высота должна быть не выше 20 см.');
    }

    if (selectedRoomBounds) {
      const outOfBoundsIndex = points.findIndex((p) => !isPointInsideBounds(p, selectedRoomBounds));
      if (outOfBoundsIndex >= 0) {
        messages.push('Маршрут должен полностью находиться в пределах выбранной комнаты.');
      }
    }

    if (selectedRoomId && nodes.length >= 2) {
      const startPoint = sceneData.points.find((p) => p.id === nodes[0]?.pointId);
      const endPoint = sceneData.points.find((p) => p.id === nodes[nodes.length - 1]?.pointId);
      if (startPoint && startPoint.roomId !== selectedRoomId) {
        messages.push('Начальная точка трассы должна принадлежать выбранной комнате.');
      }
      if (endPoint && endPoint.roomId !== selectedRoomId) {
        messages.push('Конечная точка трассы должна принадлежать выбранной комнате.');
      }
    }

    setRouteValidationMessages(messages);

    if (routeDraftBadLineRef.current) {
      routeDraftBadLineRef.current.geometry.dispose();
      routeDraftBadLineRef.current.material.dispose();
      routesGroupRef.current.remove(routeDraftBadLineRef.current);
      routeDraftBadLineRef.current = null;
    }
    if (badSegmentPoints.length > 0 && routesGroupRef.current) {
      const flattened = [];
      badSegmentPoints.forEach(([a, b]) => {
        flattened.push(a, b);
      });
      const badGeometry = new THREE.BufferGeometry().setFromPoints(flattened);
      const badMaterial = new THREE.LineBasicMaterial({ color: 0xef4444 });
      const badLine = new THREE.LineSegments(badGeometry, badMaterial);
      routeDraftBadLineRef.current = badLine;
      routesGroupRef.current.add(badLine);
    }

    return messages;
  }, [getRouteModeHeight, isPointInsideBounds, routePlacementMode, sceneData.points, selectedCircuitId, selectedRoomBounds, selectedRoomId, routesGroupRef]);

  const clearRouteDraft = () => {
    routePointsRef.current = [];
    routeNodesRef.current = [];
    setRouteDraftLength(0);
    setRoutePointCount(0);
    setRouteValidationMessages([]);
    setSelectedRouteId(null);
    redrawRouteDraft();
  };

  const rebuildRouteRefsFromNodes = useCallback((nodes) => {
    routeNodesRef.current = nodes.map((node) => ({ ...node }));
    routePointsRef.current = nodes.map(
      (node) => new THREE.Vector3(Number(node.x), Number(node.z), Number(node.y))
    );
    redrawRouteDraft();
    validateRouteDraft();
  }, [redrawRouteDraft, validateRouteDraft]);

  const updateNodeAtIndex = (index, axis, value) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed)) return;
    const nextNodes = routeNodesRef.current.map((node, i) =>
      i === index ? { ...node, [axis]: parsed } : node
    );
    rebuildRouteRefsFromNodes(nextNodes);
  };

  const insertNodeAfter = (index) => {
    if (index < 0 || index >= routeNodesRef.current.length) return;
    const current = routeNodesRef.current[index];
    const next = routeNodesRef.current[index + 1];
    const inserted = next
      ? {
        x: Number(((current.x + next.x) / 2).toFixed(4)),
        y: Number(((current.y + next.y) / 2).toFixed(4)),
        z: Number(((current.z + next.z) / 2).toFixed(4)),
        pointId: null,
        symbolType: null,
        surfaceKind: 'auto',
      }
      : { ...current, pointId: null, symbolType: null, surfaceKind: current.surfaceKind || 'auto' };
    const nextNodes = [...routeNodesRef.current];
    nextNodes.splice(index + 1, 0, inserted);
    rebuildRouteRefsFromNodes(nextNodes);
  };

  const removeNodeAt = (index) => {
    if (routeNodesRef.current.length <= 2) return;
    const nextNodes = routeNodesRef.current.filter((_, i) => i !== index);
    rebuildRouteRefsFromNodes(nextNodes);
  };

  const removeLastNode = useCallback(() => {
    if (routeNodesRef.current.length === 0) return;
    routeNodesRef.current = routeNodesRef.current.slice(0, -1);
    routePointsRef.current = routePointsRef.current.slice(0, -1);
    setRoutePointCount(routeNodesRef.current.length);
    redrawRouteDraft();
    validateRouteDraft();
  }, [redrawRouteDraft, validateRouteDraft]);

  const saveRoute = async () => {
    if (routePointsRef.current.length < 2) {
      addToast('Добавьте минимум 2 точки трассы перед сохранением.', 'info');
      return;
    }
    const draftErrors = validateRouteDraft();
    if (draftErrors.length > 0) {
      draftErrors.slice(0, 3).forEach((msg) => addToast(msg, 'warn'));
      return;
    }
    try {
      const path = routeNodesRef.current.map((node) => ({
        x: Number(toCentimeters(node.x).toFixed(2)),
        y: Number(toCentimeters(node.y).toFixed(2)),
        z: Number(toCentimeters(node.z).toFixed(2)),
        ...(node.pointId ? { pointId: node.pointId } : {}),
      }));
      let length = 0;
      for (let i = 1; i < routePointsRef.current.length; i += 1) {
        length += routePointsRef.current[i - 1].distanceTo(routePointsRef.current[i]);
      }
      const routePayload = {
        circuitId: selectedCircuitId ? Number(selectedCircuitId) : null,
        lengthM: Number(length.toFixed(2)),
        installationScope: 'PLANNED',
        pathJson: JSON.stringify(path),
        notes: newRouteName.trim() || 'Трасса 3D',
      };
      const createdRoute = await cableRunAPI.create(projectId, routePayload);
      const createdRouteId = createdRoute?.data?.id;
      setStats((prev) => ({ ...prev, routes: prev.routes + 1 }));
      if (createdRouteId) {
        let activeRouteId = createdRouteId;
        pushHistoryAction({
          undo: async () => cableRunAPI.delete(projectId, activeRouteId),
          redo: async () => {
            const recreated = await cableRunAPI.create(projectId, routePayload);
            activeRouteId = recreated?.data?.id || activeRouteId;
          },
          undoError: 'Не удалось отменить создание трассы',
          redoError: 'Не удалось повторить создание трассы',
        });
      }
      await loadSceneData();
      clearRouteDraft();
      setNewRouteName('');
      addToast('Трасса сохранена. Можно прокладывать следующую — просто кликайте на сцене.', 'success');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Не удалось сохранить трассу кабеля';
      addToast(msg, 'error');
    }
  };

  const loadRouteToDraft = (routeId) => {
    const route = sceneData.routes.find((r) => r.id === routeId);
    if (!route || !route.pathJson) return;
    try {
      const parsed = JSON.parse(route.pathJson);
      if (!Array.isArray(parsed) || parsed.length < 2) return;
      routePointsRef.current = parsed.map((n) => new THREE.Vector3(toMeters(n.x), toMeters(n.z || 0), toMeters(n.y)));
      routeNodesRef.current = parsed.map((n) => {
        const zM = toMeters(n.z || 0);
        return {
          x: toMeters(n.x),
          y: toMeters(n.y),
          z: zM,
          pointId: n.pointId || null,
          symbolType: null,
          surfaceKind: inferRouteSurfaceKindFromHeightM(zM, activeRoomHeightM),
        };
      });
      setSelectedRouteId(route.id);
      setNewRouteName(route.notes || '');
      setSelectedCircuitId(route.circuitId ? String(route.circuitId) : '');
      redrawRouteDraft();
      validateRouteDraft();
    } catch (e) {
      addToast('Не удалось загрузить трассу для редактирования', 'error');
    }
  };

  const overwriteSelectedRoute = async () => {
    if (!selectedRouteId) return;
    if (validateRouteDraft().length > 0) {
      addToast('Черновик трассы не прошел валидацию.', 'warn');
      return;
    }
    try {
      const path = routeNodesRef.current.map((node) => ({
        x: Number(toCentimeters(node.x).toFixed(2)),
        y: Number(toCentimeters(node.y).toFixed(2)),
        z: Number(toCentimeters(node.z).toFixed(2)),
        ...(node.pointId ? { pointId: node.pointId } : {}),
      }));
      let length = 0;
      for (let i = 1; i < routePointsRef.current.length; i += 1) {
        length += routePointsRef.current[i - 1].distanceTo(routePointsRef.current[i]);
      }
      const previousRoute = sceneData.routes.find((route) => route.id === selectedRouteId);
      const updatePayload = {
        circuitId: selectedCircuitId ? Number(selectedCircuitId) : null,
        lengthM: Number(length.toFixed(2)),
        installationScope: 'PLANNED',
        pathJson: JSON.stringify(path),
        notes: newRouteName.trim() || `Трасса ${selectedRouteId}`,
      };
      await cableRunAPI.update(projectId, selectedRouteId, updatePayload);
      if (previousRoute) {
        pushHistoryAction({
          undo: async () => cableRunAPI.update(projectId, selectedRouteId, {
            circuitId: previousRoute.circuitId || null,
            lengthM: Number(previousRoute.lengthM || 0),
            installationScope: previousRoute.installationScope || 'PLANNED',
            pathJson: previousRoute.pathJson,
            notes: previousRoute.notes || `Трасса ${selectedRouteId}`,
          }),
          redo: async () => cableRunAPI.update(projectId, selectedRouteId, updatePayload),
          undoError: 'Не удалось отменить обновление трассы',
          redoError: 'Не удалось повторить обновление трассы',
        });
      }
      await loadSceneData();
      clearRouteDraft();
      addToast('Трасса обновлена. Черновик очищен — можно прокладывать следующую.', 'success');
    } catch (e) {
      const msg = e?.response?.data?.message || 'Не удалось обновить трассу кабеля';
      addToast(msg, 'error');
    }
  };

  const deleteSelectedRoute = async () => {
    if (!selectedRouteId) return;
    try {
      const deletedRouteSnapshot = sceneData.routes.find((route) => route.id === selectedRouteId);
      await cableRunAPI.delete(projectId, selectedRouteId);
      if (deletedRouteSnapshot) {
        let restoredRouteId = null;
        pushHistoryAction({
          undo: async () => {
            const restored = await cableRunAPI.create(projectId, {
              circuitId: deletedRouteSnapshot.circuitId || null,
              lengthM: Number(deletedRouteSnapshot.lengthM || 0),
              installationScope: deletedRouteSnapshot.installationScope || 'PLANNED',
              pathJson: deletedRouteSnapshot.pathJson,
              notes: deletedRouteSnapshot.notes || 'Трасса 3D',
            });
            restoredRouteId = restored?.data?.id || restoredRouteId;
          },
          redo: async () => {
            if (restoredRouteId) {
              await cableRunAPI.delete(projectId, restoredRouteId);
            }
          },
          undoError: 'Не удалось отменить удаление трассы',
          redoError: 'Не удалось повторить удаление трассы',
        });
      }
      clearRouteDraft();
      await loadSceneData();
      addToast('Трасса удалена', 'info');
    } catch (e) {
      addToast('Не удалось удалить трассу', 'error');
    }
  };

  return {
    routeDraftLineRef,
    routeDraftBadLineRef,
    routeHandleMeshesRef,
    routePointsRef,
    routeNodesRef,
    dragStateRef,
    newRouteName,
    setNewRouteName,
    routeDraftLength,
    routePointCount,
    routeValidationMessages,
    selectedRouteId,
    setSelectedRouteId,
    routeHeight,
    setRouteHeight,
    routePlacementMode,
    setRoutePlacementMode,
    getRouteModeWarning,
    getRouteModeHeight,
    redrawRouteDraft,
    validateRouteDraft,
    clearRouteDraft,
    rebuildRouteRefsFromNodes,
    updateNodeAtIndex,
    insertNodeAfter,
    removeNodeAt,
    removeLastNode,
    saveRoute,
    loadRouteToDraft,
    overwriteSelectedRoute,
    deleteSelectedRoute,
    pickRouteHandleIndex,
  };
}
