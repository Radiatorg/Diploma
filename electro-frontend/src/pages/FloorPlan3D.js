import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  cableRunAPI,
  calculationAPI,
  circuitAPI,
  electricalPointAPI,
  floorPlanAPI,
  projectApplianceAPI,
  roomAPI,
  savedSpecificationAPI,
  wallAPI,
} from '../api/api';
import './FloorPlan3D.css';

const DEFAULT_ROOM_HEIGHT_M = 2.8;

// ─── 3D model builder helpers ───────────────────────────────────────────────

function buildOutletGroup(accentColor) {
  const group = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e8, roughness: 0.8 });
  const borderMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 });
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });

  const border = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.018), borderMat);
  border.position.z = -0.004;
  group.add(border);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.024), plateMat);
  group.add(plate);

  [-0.026, 0.026].forEach((ox) => {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 8), holeMat);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(ox, 0.015, 0.001);
    group.add(pin);
  });

  const gnd = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.03, 8), holeMat);
  gnd.rotation.x = Math.PI / 2;
  gnd.position.set(0, -0.021, 0.001);
  group.add(gnd);

  return group;
}

function buildSwitchGroup(accentColor) {
  const group = new THREE.Group();
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf0ede8, roughness: 0.8 });
  const borderMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.6 });
  const rockerMat = new THREE.MeshStandardMaterial({ color: 0xddeeff, roughness: 0.5 });

  const border = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.018), borderMat);
  border.position.z = -0.004;
  group.add(border);

  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.024), plateMat);
  group.add(plate);

  const rocker = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.1, 0.028), rockerMat);
  rocker.rotation.x = -0.18;
  group.add(rocker);

  const notchMat = new THREE.MeshStandardMaterial({ color: 0xaabbcc });
  const notch = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.006, 0.012), notchMat);
  notch.position.set(0, 0.02, 0.017);
  group.add(notch);

  return group;
}

function buildLightGroup(accentColor) {
  const group = new THREE.Group();

  const mountMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.5, metalness: 0.45 });
  const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.085, 0.025, 16), mountMat);
  mount.position.y = 0.01;
  group.add(mount);

  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8960c, roughness: 0.4, metalness: 0.6 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.008, 6, 24), rimMat);
  rim.rotation.x = Math.PI / 2;
  group.add(rim);

  const cordMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.11, 6), cordMat);
  cord.position.y = -0.067;
  group.add(cord);

  const socketMat = new THREE.MeshStandardMaterial({ color: 0x888877, roughness: 0.6 });
  const socket = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.028, 0.04, 10), socketMat);
  socket.position.y = -0.14;
  group.add(socket);

  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfffde7,
    emissive: 0xffee66,
    emissiveIntensity: 0.9,
    roughness: 0.2,
    transparent: true,
    opacity: 0.92,
  });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), bulbMat);
  bulb.position.y = -0.195;
  group.add(bulb);

  return group;
}

function buildSourceGroup() {
  const group = new THREE.Group();

  const boxMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.65, metalness: 0.35 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.045), boxMat);
  group.add(box);

  const doorMat = new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 });
  const innerDoor = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.006), doorMat);
  innerDoor.position.set(-0.005, -0.005, 0.026);
  group.add(innerDoor);

  const handleMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af });
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.025, 6), handleMat);
  handle.rotation.z = Math.PI / 2;
  handle.position.set(0.028, -0.005, 0.03);
  group.add(handle);

  const ledMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 1.2 });
  const led = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 8), ledMat);
  led.position.set(0.03, 0.055, 0.027);
  group.add(led);

  return group;
}

function isSourcePointByNotes(point) {
  const notes = (point?.notes || '').toLowerCase();
  return notes.includes('стартов') || notes.includes('start');
}

function buildPointGroup(point) {
  const type = point?.electricalSymbol?.type || '';
  const isSource = isSourcePointByNotes(point);
  if (type === 'outlet') return buildOutletGroup(0x10b981);
  if (type === 'switch') return buildSwitchGroup(0x60a5fa);
  if (type === 'light' && !isSource) return buildLightGroup(0xffc857);
  return buildSourceGroup();
}

function buildGhostGroup(toolType) {
  let group;
  if (toolType === 'add-outlet') group = buildOutletGroup(0x34d399);
  else if (toolType === 'add-switch') group = buildSwitchGroup(0x93c5fd);
  else if (toolType === 'add-light') group = buildLightGroup(0xfde68a);
  else group = buildSourceGroup();
  group.traverse((child) => {
    if (child.isMesh && child.material) {
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      mats.forEach((mat) => {
        mat.transparent = true;
        mat.opacity = 0.48;
        mat.depthWrite = false;
      });
    }
  });
  return group;
}

function buildDoorGroup(oWidthM, oHeightM, wallThickness) {
  const group = new THREE.Group();
  const depth = wallThickness + 0.06;
  const jambW = 0.065;
  const lintH = 0.075;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xe8ddd0, roughness: 0.75 });
  const lJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, oHeightM + lintH, depth), frameMat);
  lJamb.position.set(-oWidthM / 2 - jambW / 2, lintH / 2, 0);
  group.add(lJamb);

  const rJamb = new THREE.Mesh(new THREE.BoxGeometry(jambW, oHeightM + lintH, depth), frameMat);
  rJamb.position.set(oWidthM / 2 + jambW / 2, lintH / 2, 0);
  group.add(rJamb);

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(oWidthM + jambW * 2, lintH, depth), frameMat);
  lintel.position.set(0, oHeightM / 2 + lintH / 2, 0);
  group.add(lintel);

  const leafMat = new THREE.MeshStandardMaterial({ color: 0xc8935a, roughness: 0.65, transparent: true, opacity: 0.92 });
  const leaf = new THREE.Mesh(new THREE.BoxGeometry(oWidthM - 0.03, oHeightM - 0.015, 0.045), leafMat);
  group.add(leaf);

  const panelMat = new THREE.MeshStandardMaterial({ color: 0xb5824a, roughness: 0.7 });
  [
    [0, oHeightM * 0.22, 0.025],
    [0, -oHeightM * 0.22, 0.025],
  ].forEach(([px, py, pz]) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(oWidthM * 0.7, oHeightM * 0.28, 0.008), panelMat);
    panel.position.set(px, py, pz);
    group.add(panel);
  });

  const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.3, metalness: 0.8 });
  const handleBar = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.11, 8), handleMat);
  handleBar.rotation.x = Math.PI / 2;
  handleBar.position.set(oWidthM / 2 - 0.09, -oHeightM * 0.05, 0.03);
  group.add(handleBar);

  const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.04, 8), handleMat);
  handleStem.position.set(oWidthM / 2 - 0.09, -oHeightM * 0.05, 0.05);
  group.add(handleStem);

  const arcMat = new THREE.MeshStandardMaterial({ color: 0xf97316, transparent: true, opacity: 0.35, roughness: 0.8 });
  const arc = new THREE.Mesh(new THREE.TorusGeometry(oWidthM * 0.85, 0.012, 4, 20, Math.PI / 2), arcMat);
  arc.rotation.x = Math.PI / 2;
  arc.position.set(-oWidthM / 2, -oHeightM / 2, 0);
  group.add(arc);

  return group;
}

function buildWindowGroup(oWidthM, oHeightM, wallThickness) {
  const group = new THREE.Group();
  const depth = wallThickness + 0.06;
  const frameW = 0.06;

  const frameMat = new THREE.MeshStandardMaterial({ color: 0xf0f0f0, roughness: 0.7 });

  const top = new THREE.Mesh(new THREE.BoxGeometry(oWidthM + frameW * 2, frameW, depth), frameMat);
  top.position.set(0, oHeightM / 2 + frameW / 2, 0);
  group.add(top);

  const bot = new THREE.Mesh(new THREE.BoxGeometry(oWidthM + frameW * 2, frameW, depth), frameMat);
  bot.position.set(0, -oHeightM / 2 - frameW / 2, 0);
  group.add(bot);

  const lSide = new THREE.Mesh(new THREE.BoxGeometry(frameW, oHeightM + frameW * 2, depth), frameMat);
  lSide.position.set(-oWidthM / 2 - frameW / 2, 0, 0);
  group.add(lSide);

  const rSide = new THREE.Mesh(new THREE.BoxGeometry(frameW, oHeightM + frameW * 2, depth), frameMat);
  rSide.position.set(oWidthM / 2 + frameW / 2, 0, 0);
  group.add(rSide);

  const glassMat = new THREE.MeshStandardMaterial({
    color: 0xbfdbfe,
    transparent: true,
    opacity: 0.38,
    roughness: 0.05,
    metalness: 0.1,
  });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(oWidthM - 0.01, oHeightM - 0.01, 0.008), glassMat);
  group.add(glass);

  const mullionMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 });
  const vMullion = new THREE.Mesh(new THREE.BoxGeometry(0.04, oHeightM, depth * 0.6), mullionMat);
  group.add(vMullion);

  const hMullion = new THREE.Mesh(new THREE.BoxGeometry(oWidthM, 0.04, depth * 0.6), mullionMat);
  group.add(hMullion);

  return group;
}

// ─────────────────────────────────────────────────────────────────────────────

const FloorPlan3D = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const frameRef = useRef(null);
  const routeDraftLineRef = useRef(null);
  const routeDraftBadLineRef = useRef(null);
  const routeHandleMeshesRef = useRef([]);
  const wallHoverMeshesRef = useRef([]);
  const pointHoverMeshesRef = useRef([]);
  const routeHoverLinesRef = useRef([]);
  const routeHitMeshesRef = useRef([]);
  const hoveredRouteLineRef = useRef(null);
  const openingHoverMeshesRef = useRef([]);
  const routePointsRef = useRef([]);
  const routeNodesRef = useRef([]);
  const metaGroupRef = useRef(null);
  const wallsGroupRef = useRef(null);
  const ghostGroupRef = useRef(null);
  const pointsGroupRef = useRef(null);
  const routesGroupRef = useRef(null);
  const dragStateRef = useRef({ active: false, nodeIndex: -1 });
  const suppressClickRef = useRef(false);
  const hoveredObjectRef = useRef(null);
  const mouseDownPosRef = useRef(null);
  const historyRef = useRef({ undo: [], redo: [], applying: false });

  const [loading, setLoading] = useState(true);
  const [sceneData, setSceneData] = useState({
    floorPlan: null,
    rooms: [],
    walls: [],
    points: [],
    routes: [],
  });
  const [tool, setTool] = useState('navigate');
  const [pointHeight, setPointHeight] = useState(30);
  const [routeHeight, setRouteHeight] = useState(30);
  const [routePlacementMode, setRoutePlacementMode] = useState('wall');
  const [newRouteName, setNewRouteName] = useState('');
  const [routeDraftLength, setRouteDraftLength] = useState(0);
  const [routePointCount, setRoutePointCount] = useState(0);
  const [routeValidationMessages, setRouteValidationMessages] = useState([]);
  const [selectedRouteId, setSelectedRouteId] = useState(null);
  const [circuits, setCircuits] = useState([]);
  const [selectedCircuitId, setSelectedCircuitId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [surfaceMode, setSurfaceMode] = useState('wall');
  const [wallFaceMode, setWallFaceMode] = useState('auto');
  const [wallViewFace, setWallViewFace] = useState('north');
  const [parallelOffsetCm, setParallelOffsetCm] = useState(0);
  const [projectAppliances, setProjectAppliances] = useState([]);
  const [calculationReport, setCalculationReport] = useState(null);
  const [roomPlanData, setRoomPlanData] = useState({});
  const [saved3DCalculations, setSaved3DCalculations] = useState([]);
  const [selectedSavedCalcId, setSelectedSavedCalcId] = useState(null);
  const [selectedSavedCalcDetails, setSelectedSavedCalcDetails] = useState(null);
  const [saveCalcName, setSaveCalcName] = useState('');
  const [insideRoomView, setInsideRoomView] = useState(false);
  const [hoveredWallFace, setHoveredWallFace] = useState(null);
  const [cursorContext, setCursorContext] = useState(null);
  const [cursorPanel, setCursorPanel] = useState({ x: 0, y: 0, visible: false });
  const [historyVersion, setHistoryVersion] = useState(0);
  const [showAutoPlaceDialog, setShowAutoPlaceDialog] = useState(false);
  const [roomWidthCm, setRoomWidthCm] = useState(null);
  const [roomLengthCm, setRoomLengthCm] = useState(null);
  const [roomCeilingHeightM, setRoomCeilingHeightM] = useState(DEFAULT_ROOM_HEIGHT_M);
  const [roomHeightById, setRoomHeightById] = useState({});
  const [lastEditedRoomSide, setLastEditedRoomSide] = useState('width');
  const [savingRoomGeometry, setSavingRoomGeometry] = useState(false);
  const [doorWidthCm, setDoorWidthCm] = useState(90);
  const [windowWidthCm, setWindowWidthCm] = useState(120);
  const [stats, setStats] = useState({
    rooms: 0,
    walls: 0,
    points: 0,
    routes: 0,
  });
  const [toasts, setToasts] = useState([]);

  const toMeters = (value) => Number(value || 0) / 100;
  const toCentimeters = (value) => Number(value || 0) * 100;
  const SNAP_RADIUS_M = 0.35;
  const MIN_SEGMENT_M = 0.05;
  const ORTHOGONAL_TOLERANCE_M = 0.01;
  const WALL_INSET_M = 0.03;
  const ROOM_HEIGHT_M = DEFAULT_ROOM_HEIGHT_M;
  const activeRoomHeightM = selectedRoomId ? roomCeilingHeightM : ROOM_HEIGHT_M;
  const MAX_HISTORY_SIZE = 40;

  const getRoomBounds = useCallback((room, walls = sceneData.walls) => {
    if (!room) return null;
    const px = Number(room.positionX || 0);
    const py = Number(room.positionY || 0);
    const w = Number(room.width || 0);
    const h = Number(room.height || 0);
    if (w > 0 && h > 0) {
      return {
        minX: toMeters(px),
        minZ: toMeters(py),
        maxX: toMeters(px + w),
        maxZ: toMeters(py + h),
      };
    }
    const roomWalls = (walls || []).filter((wall) => wall.roomId && room.id && wall.roomId === room.id);
    if (!roomWalls.length) return null;
    const points = [];
    roomWalls.forEach((wall) => {
      points.push({ x: toMeters(wall.startX), z: toMeters(wall.startY) });
      points.push({ x: toMeters(wall.endX), z: toMeters(wall.endY) });
    });
    return {
      minX: Math.min(...points.map((p) => p.x)),
      minZ: Math.min(...points.map((p) => p.z)),
      maxX: Math.max(...points.map((p) => p.x)),
      maxZ: Math.max(...points.map((p) => p.z)),
    };
  }, [sceneData.walls]);

  const clearGroup = (groupRef) => {
    if (!groupRef.current) return;
    while (groupRef.current.children.length) {
      const child = groupRef.current.children[0];
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
      groupRef.current.remove(child);
    }
  };

  const pushHistoryAction = useCallback((action) => {
    if (!action || historyRef.current.applying) return;
    historyRef.current.undo.push(action);
    if (historyRef.current.undo.length > MAX_HISTORY_SIZE) {
      historyRef.current.undo.shift();
    }
    historyRef.current.redo = [];
    setHistoryVersion((v) => v + 1);
  }, [MAX_HISTORY_SIZE]);

  const getWallFaceLabel = useCallback((face) => {
    if (face === 'north') return 'Северная стена';
    if (face === 'south') return 'Южная стена';
    if (face === 'west') return 'Западная стена';
    if (face === 'east') return 'Восточная стена';
    if (face === 'floor') return 'Пол';
    if (face === 'ceiling') return 'Потолок';
    return 'Стена';
  }, []);

  const getWallFaceRotationY = useCallback((face) => {
    if (face === 'north') return 0;
    if (face === 'south') return Math.PI;
    if (face === 'east') return -Math.PI / 2;
    if (face === 'west') return Math.PI / 2;
    return 0;
  }, []);

  const getPointTypeLabel = useCallback((symbolType) => {
    if (symbolType === 'outlet') return 'Розетка';
    if (symbolType === 'switch') return 'Выключатель';
    if (symbolType === 'light') return 'Световая точка';
    return 'Электрическая точка';
  }, []);

  const getPointPlacementLabel = useCallback((heightFromFloor, roomHeightM) => {
    const h = Number(heightFromFloor || 0);
    const ceilCm = (roomHeightM || DEFAULT_ROOM_HEIGHT_M) * 100;
    if (h <= 10) return 'На полу';
    if (h >= ceilCm - 15) return 'На потолке';
    if (h < 60) return `Нижний пояс (${h} см)`;
    if (h <= 170) return `Средний пояс (${h} см)`;
    return `Верхний пояс (${h} см)`;
  }, []);

  const addToast = useCallback((message, type = 'warn') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev.slice(-5), { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearGhostPreview = useCallback(() => {
    const g = ghostGroupRef.current;
    if (!g) return;
    while (g.children.length) {
      const child = g.children[0];
      child.traverse((c) => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) {
          const mats = Array.isArray(c.material) ? c.material : [c.material];
          mats.forEach((m) => m.dispose());
        }
      });
      g.remove(child);
    }
  }, []);

  const updateGhostPreview = useCallback((toolType, position, roomCenter) => {
    clearGhostPreview();
    const g = ghostGroupRef.current;
    if (!g || !position) return;
    const ghost = buildGhostGroup(toolType);
    ghost.position.copy(position);
    if (roomCenter) {
      ghost.rotation.y = Math.atan2(roomCenter.x - position.x, roomCenter.z - position.z);
    }
    g.add(ghost);
  }, [clearGhostPreview]);

  const getRouteModeWarning = useCallback(() => {
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

  const getRouteModeHeight = useCallback(() => {
    if (routePlacementMode === 'ceiling') return Math.max(routeHeight, 240);
    if (routePlacementMode === 'floor') return Math.min(routeHeight, 20);
    return routeHeight;
  }, [routeHeight, routePlacementMode]);

  const prevRouteModeWarningRef = useRef('');
  useEffect(() => {
    const warning = getRouteModeWarning();
    if (warning && warning !== prevRouteModeWarningRef.current) {
      addToast(warning, 'warn');
    }
    prevRouteModeWarningRef.current = warning;
  }, [getRouteModeWarning, addToast]);

  const getPointColor = (point) => {
    const symbolType = point?.electricalSymbol?.type || '';
    if (symbolType === 'light') return 0xffc857;
    if (symbolType === 'switch') return 0x60a5fa;
    return 0x10b981;
  };

  const addOpeningMesh = useCallback((point, type) => {
    if (!metaGroupRef.current) return;
    const widthCm = type === 'door' ? doorWidthCm : windowWidthCm;
    const widthM = toMeters(widthCm);
    const depthM = 0.08;
    const heightM = type === 'door' ? 2.0 : 1.2;
    const yCenter = type === 'door' ? heightM / 2 : roomCeilingHeightM - heightM / 2;
    const group = type === 'door'
      ? buildDoorGroup(widthM, heightM, depthM)
      : buildWindowGroup(widthM, heightM, depthM);
    group.position.set(point.x, yCenter, point.z);
    group.traverse((child) => { if (child.isMesh) child.castShadow = true; });
    metaGroupRef.current.add(group);
  }, [doorWidthCm, roomCeilingHeightM, toMeters, windowWidthCm]);

  const redrawScene = useCallback(() => {
    if (!sceneRef.current || !sceneData.floorPlan) return;
    clearGroup(wallsGroupRef);
    clearGroup(pointsGroupRef);
    clearGroup(routesGroupRef);
    wallHoverMeshesRef.current = [];
    pointHoverMeshesRef.current = [];
    routeHoverLinesRef.current = [];
    routeHitMeshesRef.current = [];
    openingHoverMeshesRef.current = [];

    const floorWidthM = toMeters(sceneData.floorPlan.width);
    const floorHeightM = toMeters(sceneData.floorPlan.height);
    const floorY = 0;

    const floorGeometry = new THREE.PlaneGeometry(floorWidthM, floorHeightM, 20, 20);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x1b2333,
      roughness: 0.95,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(floorWidthM / 2, floorY, floorHeightM / 2);
    floor.receiveShadow = true;
    wallsGroupRef.current.add(floor);

    sceneData.rooms.forEach((room) => {
      const bounds = getRoomBounds(room, sceneData.walls);
      if (!bounds) return;
      const roomHeightM = roomHeightById[room.id] || (room.id === selectedRoomId ? roomCeilingHeightM : ROOM_HEIGHT_M);
      const width = Math.max(bounds.maxX - bounds.minX, 0.2);
      const depth = Math.max(bounds.maxZ - bounds.minZ, 0.2);
      const roomMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, roomHeightM, depth),
        new THREE.MeshStandardMaterial({
          color: selectedRoomId === room.id ? 0x0ea5e9 : 0x334155,
          transparent: true,
          opacity: selectedRoomId === room.id ? 0.17 : 0.08,
        })
      );
      roomMesh.position.set(bounds.minX + width / 2, roomHeightM / 2, bounds.minZ + depth / 2);
      wallsGroupRef.current.add(roomMesh);

      if (selectedRoomId === room.id) {
        const floorHovered = hoveredWallFace === 'floor';
        const floorOverlay = new THREE.Mesh(
          new THREE.PlaneGeometry(width, depth),
          new THREE.MeshBasicMaterial({
            color: floorHovered ? 0xf59e0b : (surfaceMode === 'floor' ? 0x22d3ee : 0x1e293b),
            transparent: true,
            opacity: floorHovered ? 0.42 : (surfaceMode === 'floor' ? 0.34 : 0.14),
            side: THREE.DoubleSide,
          })
        );
        floorOverlay.rotation.x = -Math.PI / 2;
        floorOverlay.position.set(bounds.minX + width / 2, 0.015, bounds.minZ + depth / 2);
        floorOverlay.userData = { wallFace: 'floor' };
        wallsGroupRef.current.add(floorOverlay);
        wallHoverMeshesRef.current.push(floorOverlay);

        const ceilingHovered = hoveredWallFace === 'ceiling';
        const ceilingOverlay = new THREE.Mesh(
          new THREE.PlaneGeometry(width, depth),
          new THREE.MeshBasicMaterial({
            color: ceilingHovered ? 0xf59e0b : (surfaceMode === 'ceiling' ? 0xfacc15 : 0x334155),
            transparent: true,
            opacity: ceilingHovered ? 0.42 : (surfaceMode === 'ceiling' ? 0.3 : 0.12),
            side: THREE.DoubleSide,
          })
        );
        ceilingOverlay.rotation.x = Math.PI / 2;
        ceilingOverlay.position.set(bounds.minX + width / 2, roomHeightM - 0.01, bounds.minZ + depth / 2);
        ceilingOverlay.userData = { wallFace: 'ceiling' };
        wallsGroupRef.current.add(ceilingOverlay);
        wallHoverMeshesRef.current.push(ceilingOverlay);

        const wallPlanes = [
          {
            key: 'north',
            color: hoveredWallFace === 'north' ? 0xf59e0b : (wallFaceMode === 'north' || wallFaceMode === 'auto' ? 0x60a5fa : 0x475569),
            pos: [(bounds.minX + bounds.maxX) / 2, roomHeightM / 2, bounds.minZ + WALL_INSET_M],
            size: [width, roomHeightM],
            rotY: Math.PI,
          },
          {
            key: 'south',
            color: hoveredWallFace === 'south' ? 0xf59e0b : (wallFaceMode === 'south' || wallFaceMode === 'auto' ? 0x818cf8 : 0x475569),
            pos: [(bounds.minX + bounds.maxX) / 2, roomHeightM / 2, bounds.maxZ - WALL_INSET_M],
            size: [width, roomHeightM],
            rotY: 0,
          },
          {
            key: 'west',
            color: hoveredWallFace === 'west' ? 0xf59e0b : (wallFaceMode === 'west' || wallFaceMode === 'auto' ? 0x38bdf8 : 0x475569),
            pos: [bounds.minX + WALL_INSET_M, roomHeightM / 2, (bounds.minZ + bounds.maxZ) / 2],
            size: [depth, roomHeightM],
            rotY: Math.PI / 2,
          },
          {
            key: 'east',
            color: hoveredWallFace === 'east' ? 0xf59e0b : (wallFaceMode === 'east' || wallFaceMode === 'auto' ? 0x0ea5e9 : 0x475569),
            pos: [bounds.maxX - WALL_INSET_M, roomHeightM / 2, (bounds.minZ + bounds.maxZ) / 2],
            size: [depth, roomHeightM],
            rotY: -Math.PI / 2,
          },
        ];

        wallPlanes.forEach((wallPlane) => {
          const wallOverlay = new THREE.Mesh(
            new THREE.PlaneGeometry(wallPlane.size[0], wallPlane.size[1]),
            new THREE.MeshBasicMaterial({
              color: wallPlane.color,
              transparent: true,
              opacity: hoveredWallFace === wallPlane.key ? 0.38 : (surfaceMode === 'wall' ? 0.22 : 0.1),
              side: THREE.DoubleSide,
            })
          );
          wallOverlay.position.set(wallPlane.pos[0], wallPlane.pos[1], wallPlane.pos[2]);
          wallOverlay.rotation.y = wallPlane.rotY;
          wallOverlay.userData = { wallFace: wallPlane.key };
          wallsGroupRef.current.add(wallOverlay);
          wallHoverMeshesRef.current.push(wallOverlay);
        });
      }
    });

    sceneData.walls.forEach((wall) => {
      const startX = toMeters(wall.startX);
      const startZ = toMeters(wall.startY);
      const endX = toMeters(wall.endX);
      const endZ = toMeters(wall.endY);
      const dx = endX - startX;
      const dz = endZ - startZ;
      const length = Math.max(Math.sqrt(dx * dx + dz * dz), 0.05);
      const thickness = Math.max(toMeters(wall.thickness || 20), 0.03);
      const wallHeight = 2.8;

      const geometry = new THREE.BoxGeometry(length, wallHeight, thickness);
      const isExternal = wall.wallType === 'external';
      const hasOpenings = wall.openings && wall.openings.length > 0;
      const baseOpacity = !selectedRoomId || wall.roomId === selectedRoomId || isExternal ? 0.96 : 0.42;
      const material = new THREE.MeshStandardMaterial({
        color: isExternal ? 0xb7bcc4 : 0x9aa1ab,
        transparent: true,
        // Make walls with openings semi-transparent so points/routes behind them stay visible
        opacity: hasOpenings ? Math.min(baseOpacity, 0.22) : baseOpacity,
        polygonOffset: !isExternal,
        polygonOffsetFactor: !isExternal ? -1 : 0,
        polygonOffsetUnits: !isExternal ? -1 : 0,
      });
      const wallMesh = new THREE.Mesh(geometry, material);
      const wallAngle = -Math.atan2(dz, dx);
      wallMesh.position.set((startX + endX) / 2, wallHeight / 2, (startZ + endZ) / 2);
      wallMesh.rotation.y = wallAngle;
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallsGroupRef.current.add(wallMesh);

      if (hasOpenings) {
        const wallLenM = length;
        const wallDirX = dx / wallLenM;
        const wallDirZ = dz / wallLenM;
        wall.openings.forEach((opening, openingIdx) => {
          const posM = toMeters(opening.position || 0);
          const oWidthM = toMeters(opening.width || 90);
          const oHeightM = toMeters(opening.height || (opening.openingType === 'door' ? 200 : 120));
          const yCenter = opening.openingType === 'door' ? oHeightM / 2 : Math.max(wallHeight - oHeightM / 2 - 0.3, oHeightM / 2);
          const cx = startX + wallDirX * (posM + oWidthM / 2);
          const cz = startZ + wallDirZ * (posM + oWidthM / 2);
          const openingGroup = opening.openingType === 'door'
            ? buildDoorGroup(oWidthM, oHeightM, thickness)
            : buildWindowGroup(oWidthM, oHeightM, thickness);
          openingGroup.position.set(cx, yCenter, cz);
          openingGroup.rotation.y = wallAngle;
          openingGroup.traverse((child) => { if (child.isMesh) child.castShadow = true; });

          const hitBoxGeo = new THREE.BoxGeometry(oWidthM, oHeightM, thickness + 0.06);
          const hitBoxMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
          const hitBox = new THREE.Mesh(hitBoxGeo, hitBoxMat);
          hitBox.userData = {
            openingData: {
              wallId: wall.id,
              wallRaw: wall,
              openingIndex: openingIdx,
              opening,
            },
          };
          openingGroup.add(hitBox);
          wallsGroupRef.current.add(openingGroup);
          openingHoverMeshesRef.current.push(hitBox);
        });
      }
    });

    sceneData.points.forEach((point) => {
      if (selectedRoomId && point.roomId !== selectedRoomId) return;
      const x = toMeters(point.positionX);
      const z = toMeters(point.positionY);
      const y = Math.max(toMeters(point.heightFromFloor || 30), 0.05);

      const group = buildPointGroup(point);
      group.position.set(x, y, z);

      const pRoom = sceneData.rooms.find((r) => r.id === point.roomId);
      const pBounds = getRoomBounds(pRoom);
      if (pBounds) {
        const rcX = (pBounds.minX + pBounds.maxX) / 2;
        const rcZ = (pBounds.minZ + pBounds.maxZ) / 2;
        group.rotation.y = Math.atan2(rcX - x, rcZ - z);
      }

      group.castShadow = true;
      group.traverse((child) => { if (child.isMesh) child.castShadow = true; });

      const hitGeo = new THREE.SphereGeometry(0.11, 8, 8);
      const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.userData = { pointData: point, pointGroup: group };
      group.add(hitMesh);

      pointsGroupRef.current.add(group);
      pointHoverMeshesRef.current.push(hitMesh);
    });

    sceneData.routes.forEach((route) => {
      if (!route.pathJson) return;
      try {
        const path = JSON.parse(route.pathJson);
        if (!Array.isArray(path) || path.length < 2) return;
        const points3D = path.map((node) => new THREE.Vector3(toMeters(node.x), toMeters(node.z || 0), toMeters(node.y)));
        const lineGeo = new THREE.BufferGeometry().setFromPoints(points3D);
        const lineMat = new THREE.LineBasicMaterial({
          color: 0xf43f5e,
          depthTest: false,
          depthWrite: false,
          transparent: true,
          opacity: 0,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        line.renderOrder = 10;
        const tubeMeshes = [];
        for (let ti = 0; ti < points3D.length - 1; ti += 1) {
          const curve = new THREE.LineCurve3(points3D[ti], points3D[ti + 1]);
          const tubeGeo = new THREE.TubeGeometry(curve, 1, 0.025, 8, false);
          const tubeMat = new THREE.MeshBasicMaterial({
            color: 0xf43f5e,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.9,
          });
          const tube = new THREE.Mesh(tubeGeo, tubeMat);
          tube.renderOrder = 10;
          routesGroupRef.current.add(tube);
          tubeMeshes.push(tube);
        }
        line.userData = { routeData: route, tubeMeshes };
        routesGroupRef.current.add(line);
        routeHoverLinesRef.current.push(line);

        points3D.forEach((pt) => {
          const nodeGeo = new THREE.OctahedronGeometry(0.052, 0);
          const nodeMat = new THREE.MeshBasicMaterial({
            color: 0xfb7185,
            depthTest: false,
            depthWrite: false,
            transparent: true,
            opacity: 0.95,
          });
          const nodeMesh = new THREE.Mesh(nodeGeo, nodeMat);
          nodeMesh.renderOrder = 11;
          nodeMesh.position.copy(pt);
          routesGroupRef.current.add(nodeMesh);
        });

        // Invisible cylinder meshes per segment for reliable raycasting
        const upAxis = new THREE.Vector3(0, 1, 0);
        for (let si = 0; si < points3D.length - 1; si += 1) {
          const segA = points3D[si];
          const segB = points3D[si + 1];
          const segVec = new THREE.Vector3().subVectors(segB, segA);
          const segLen = segVec.length();
          if (segLen < 0.001) continue; // eslint-disable-line no-continue
          const segDir = segVec.clone().normalize();
          const hitGeo = new THREE.CylinderGeometry(0.18, 0.18, segLen, 6);
          const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });
          const hitMesh = new THREE.Mesh(hitGeo, hitMat);
          hitMesh.position.lerpVectors(segA, segB, 0.5);
          if (Math.abs(segDir.dot(upAxis) + 1) < 0.001) {
            hitMesh.rotation.z = Math.PI;
          } else {
            hitMesh.quaternion.setFromUnitVectors(upAxis, segDir);
          }
          hitMesh.userData = { routeData: route, routeLineId: route.id };
          routesGroupRef.current.add(hitMesh);
          routeHitMeshesRef.current.push(hitMesh);
        }
      } catch (e) {
        // ignore malformed route json
      }
    });
  }, [ROOM_HEIGHT_M, WALL_INSET_M, getRoomBounds, hoveredWallFace, roomCeilingHeightM, roomHeightById, sceneData, selectedRoomId, surfaceMode, wallFaceMode]);

  const loadSceneData = useCallback(async () => {
    try {
      setLoading(true);
      const floorPlanRes = await floorPlanAPI.get(projectId).catch(async (e) => {
        if (e?.response?.status === 404) {
          return floorPlanAPI.createOrUpdate(projectId, { width: 1000, height: 800, scale: 1.0 });
        }
        throw e;
      });
      if (!floorPlanRes?.data) {
        throw new Error('План проекта не найден');
      }

      let routeLoadError = null;
      const [roomsRes, wallsRes, pointsRes, routesRes, circuitsRes, appliancesRes, reportRes, savedRes] = await Promise.all([
        roomAPI.getByProject(projectId).catch(() => ({ data: [] })),
        wallAPI.getByProject(projectId).catch(() => ({ data: [] })),
        electricalPointAPI.getByProject(projectId).catch(() => ({ data: [] })),
        cableRunAPI.getByProject(projectId).catch((e) => {
          routeLoadError = e?.response?.data?.message || 'Не удалось загрузить трассы кабеля';
          return { data: [] };
        }),
        circuitAPI.getByProject(projectId).catch(() => ({ data: [] })),
        projectApplianceAPI.getByProject(projectId).catch(() => ({ data: [] })),
        calculationAPI.getReport(projectId).catch(() => ({ data: null })),
        savedSpecificationAPI.getAll(projectId).catch(() => ({ data: [] })),
      ]);
      if (routeLoadError) {
        addToast(routeLoadError, 'error');
      }

      const nextSceneData = {
        floorPlan: floorPlanRes.data,
        rooms: roomsRes.data || [],
        walls: wallsRes.data || [],
        points: pointsRes.data || [],
        routes: routesRes.data || [],
      };
      setSceneData(nextSceneData);
      setStats({
        rooms: nextSceneData.rooms.length,
        walls: nextSceneData.walls.length,
        points: nextSceneData.points.length,
        routes: nextSceneData.routes.length,
      });
      const loadedCircuits = circuitsRes.data || [];
      setProjectAppliances(appliancesRes.data || []);
      setCalculationReport(reportRes.data || null);
      setSaved3DCalculations(savedRes.data || []);
      setCircuits(loadedCircuits);
      if (!selectedCircuitId && loadedCircuits.length > 0) {
        setSelectedCircuitId(String(loadedCircuits[0].id));
      }
    } catch (e) {
      addToast('Не удалось загрузить данные 3D-редактора', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedCircuitId, selectedRoomId, addToast]);

  useEffect(() => {
    loadSceneData();
  }, [loadSceneData]);

  useEffect(() => {
    if (!mountRef.current || sceneRef.current) return undefined;
    const mount = mountRef.current;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f1420);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(55, mount.clientWidth / mount.clientHeight, 0.01, 1000);
    camera.position.set(7, 6, 7);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.target.set(5, 0, 4);
    controlsRef.current = controls;

    const ambient = new THREE.AmbientLight(0xffffff, 0.62);
    scene.add(ambient);
    const directional = new THREE.DirectionalLight(0xffffff, 0.9);
    directional.position.set(10, 20, 5);
    directional.castShadow = true;
    scene.add(directional);

    const wallsGroup = new THREE.Group();
    const pointsGroup = new THREE.Group();
    const routesGroup = new THREE.Group();
    const metaGroup = new THREE.Group();
    const ghostGroup = new THREE.Group();
    wallsGroupRef.current = wallsGroup;
    pointsGroupRef.current = pointsGroup;
    routesGroupRef.current = routesGroup;
    metaGroupRef.current = metaGroup;
    ghostGroupRef.current = ghostGroup;
    scene.add(wallsGroup);
    scene.add(pointsGroup);
    scene.add(routesGroup);
    scene.add(metaGroup);
    scene.add(ghostGroup);

    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frameRef.current = requestAnimationFrame(animate);
    };
    animate();

    const resizeHandler = () => {
      if (!rendererRef.current || !cameraRef.current || !mountRef.current) return;
      const w = mountRef.current.clientWidth;
      const h = mountRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      controls.dispose();
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      sceneRef.current = null;
      cameraRef.current = null;
      rendererRef.current = null;
      controlsRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (pointsGroupRef.current) pointsGroupRef.current.visible = true;
    if (routesGroupRef.current) routesGroupRef.current.visible = true;
    if (!insideRoomView) {
      hoveredObjectRef.current = null;
      setCursorContext((prev) => (prev?.isObject ? null : prev));
    }
  }, [insideRoomView]);

  const getGroundIntersection = (event) => {
    if (!rendererRef.current || !cameraRef.current || !mountRef.current || !sceneData.floorPlan) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) return null;

    const maxX = toMeters(sceneData.floorPlan.width);
    const maxZ = toMeters(sceneData.floorPlan.height);
    if (point.x < 0 || point.x > maxX || point.z < 0 || point.z > maxZ) {
      return null;
    }
    return point;
  };

  const getIntersectionOnHeight = (event, heightM) => {
    if (!rendererRef.current || !cameraRef.current || !mountRef.current || !sceneData.floorPlan) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -heightM);
    const point = new THREE.Vector3();
    if (!raycaster.ray.intersectPlane(plane, point)) return null;

    const maxX = toMeters(sceneData.floorPlan.width);
    const maxZ = toMeters(sceneData.floorPlan.height);
    if (point.x < 0 || point.x > maxX || point.z < 0 || point.z > maxZ) {
      return null;
    }
    return point;
  };

  const getPointerWallFace = useCallback((event) => {
    if (!rendererRef.current || !cameraRef.current || wallHoverMeshesRef.current.length === 0) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(wallHoverMeshesRef.current, false);
    return intersects[0]?.object?.userData?.wallFace || null;
  }, []);

  const getPointerWallHit = useCallback((event) => {
    if (!rendererRef.current || !cameraRef.current || wallHoverMeshesRef.current.length === 0) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(wallHoverMeshesRef.current, false);
    if (!intersects.length) return null;
    return {
      point: intersects[0].point,
      wallFace: intersects[0]?.object?.userData?.wallFace || null,
    };
  }, []);

  const getDistanceToNearestCorner = useCallback((point, bounds) => {
    if (!point || !bounds) return null;
    const corners = [
      { x: bounds.minX, z: bounds.minZ },
      { x: bounds.maxX, z: bounds.minZ },
      { x: bounds.minX, z: bounds.maxZ },
      { x: bounds.maxX, z: bounds.maxZ },
    ];
    const minDistance = Math.min(...corners.map((c) => Math.hypot(point.x - c.x, point.z - c.z)));
    return Number(minDistance.toFixed(2));
  }, []);

  const pickRouteHandleIndex = (event) => {
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
  };

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

      // Invisible hit sphere for raycasting
      const hitMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 8, 8),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hitMesh.userData = { routeHandleIndex: idx, routeHandlePos: p.clone() };
      handleGroup.add(hitMesh);

      routesGroupRef.current.add(handleGroup);
      routeHandleMeshesRef.current.push(hitMesh);
    });
  }, []);

  useEffect(() => {
    redrawScene();
    // Keep in-progress route visible after scene redraws (surface/camera mode changes).
    redrawRouteDraft();
  }, [redrawRouteDraft, redrawScene]);

  const findNearestExistingPoint = (candidate, pointsForSnap = sceneData.points) => {
    let nearest = null;
    let minDistance = Number.POSITIVE_INFINITY;
    pointsForSnap.forEach((point) => {
      const px = toMeters(point.positionX);
      const pz = toMeters(point.positionY);
      const distance = Math.hypot(candidate.x - px, candidate.z - pz);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = {
          x: px,
          z: pz,
          y: Math.max(toMeters(point.heightFromFloor || routeHeight), 0.05),
          pointId: point.id,
          symbolType: point?.electricalSymbol?.type || '',
        };
      }
    });
    if (!nearest || minDistance > SNAP_RADIUS_M) {
      return { point: candidate, pointId: null, symbolType: null };
    }
    return {
      point: new THREE.Vector3(nearest.x, nearest.y, nearest.z),
      pointId: nearest.pointId,
      symbolType: nearest.symbolType,
    };
  };

  const isPointInsideBounds = useCallback((point, bounds, tolerance = 0.001) => {
    if (!point || !bounds) return false;
    return (
      point.x >= bounds.minX - tolerance
      && point.x <= bounds.maxX + tolerance
      && point.z >= bounds.minZ - tolerance
      && point.z <= bounds.maxZ + tolerance
    );
  }, []);

  const getWallSnapPointFromBounds = useCallback((point, bounds, heightM) => {
    if (!point || !bounds) return point;
    const y = Math.min(Math.max(heightM, 0.05), activeRoomHeightM - 0.02);
    const laneOffset = toMeters(parallelOffsetCm);
    const clampedX = Math.min(Math.max(point.x, bounds.minX + WALL_INSET_M), bounds.maxX - WALL_INSET_M);
    const clampedZ = Math.min(Math.max(point.z, bounds.minZ + WALL_INSET_M), bounds.maxZ - WALL_INSET_M);

    const clampX = (value) => Math.min(Math.max(value, bounds.minX + WALL_INSET_M), bounds.maxX - WALL_INSET_M);
    const clampZ = (value) => Math.min(Math.max(value, bounds.minZ + WALL_INSET_M), bounds.maxZ - WALL_INSET_M);
    const candidates = {
      north: new THREE.Vector3(clampX(clampedX + laneOffset), y, bounds.minZ + WALL_INSET_M),
      south: new THREE.Vector3(clampX(clampedX + laneOffset), y, bounds.maxZ - WALL_INSET_M),
      west: new THREE.Vector3(bounds.minX + WALL_INSET_M, y, clampZ(clampedZ + laneOffset)),
      east: new THREE.Vector3(bounds.maxX - WALL_INSET_M, y, clampZ(clampedZ + laneOffset)),
    };

    if (wallFaceMode !== 'auto') {
      return candidates[wallFaceMode] || candidates.north;
    }

    const entries = Object.entries(candidates);
    let nearest = entries[0][1];
    let nearestDistance = Number.POSITIVE_INFINITY;
    entries.forEach(([, candidate]) => {
      const distance = Math.hypot(point.x - candidate.x, point.z - candidate.z);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = candidate;
      }
    });
    return nearest;
  }, [WALL_INSET_M, activeRoomHeightM, parallelOffsetCm, toMeters, wallFaceMode]);

  const selectedRoom = useMemo(
    () => sceneData.rooms.find((room) => room.id === selectedRoomId) || null,
    [sceneData.rooms, selectedRoomId]
  );

  const selectedRoomBounds = useMemo(
    () => getRoomBounds(selectedRoom, sceneData.walls),
    [getRoomBounds, sceneData.walls, selectedRoom]
  );

  const moveCameraByKeyboard = useCallback((direction) => {
    if (!cameraRef.current || !controlsRef.current || !selectedRoomBounds) return false;

    const camera = cameraRef.current;
    const controls = controlsRef.current;
    const step = insideRoomView ? 0.12 : 0.3;
    const roomSpan = Math.max(
      selectedRoomBounds.maxX - selectedRoomBounds.minX,
      selectedRoomBounds.maxZ - selectedRoomBounds.minZ
    );
    const margin = Math.max(1.2, Math.min(roomSpan * 0.55, 2.8));

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() < 1e-6) return false;
    forward.normalize();

    const right = new THREE.Vector3(-forward.z, 0, forward.x).normalize();
    const delta = new THREE.Vector3();
    if (direction === 'forward') delta.copy(forward).multiplyScalar(step);
    if (direction === 'backward') delta.copy(forward).multiplyScalar(-step);
    if (direction === 'left') delta.copy(right).multiplyScalar(-step);
    if (direction === 'right') delta.copy(right).multiplyScalar(step);
    if (delta.lengthSq() === 0) return false;

    const clampX = (x) => Math.min(Math.max(x, selectedRoomBounds.minX - margin), selectedRoomBounds.maxX + margin);
    const clampZ = (z) => Math.min(Math.max(z, selectedRoomBounds.minZ - margin), selectedRoomBounds.maxZ + margin);

    camera.position.x = clampX(camera.position.x + delta.x);
    camera.position.z = clampZ(camera.position.z + delta.z);
    controls.target.x = clampX(controls.target.x + delta.x);
    controls.target.z = clampZ(controls.target.z + delta.z);
    controls.update();
    return true;
  }, [insideRoomView, selectedRoomBounds]);

  const snapPointToSurface = useCallback((point, preferredHeightCm = pointHeight, effectiveSurface = surfaceMode) => {
    if (!point || !selectedRoomBounds) return null;
    const clampedX = Math.min(Math.max(point.x, selectedRoomBounds.minX + WALL_INSET_M), selectedRoomBounds.maxX - WALL_INSET_M);
    const clampedZ = Math.min(Math.max(point.z, selectedRoomBounds.minZ + WALL_INSET_M), selectedRoomBounds.maxZ - WALL_INSET_M);
    if (effectiveSurface === 'floor') {
      return new THREE.Vector3(clampedX, 0.05, clampedZ);
    }
    if (effectiveSurface === 'ceiling') {
      return new THREE.Vector3(clampedX, activeRoomHeightM - 0.05, clampedZ);
    }
    return getWallSnapPointFromBounds(new THREE.Vector3(clampedX, 0, clampedZ), selectedRoomBounds, Math.max(toMeters(preferredHeightCm), 0.05));
  }, [WALL_INSET_M, activeRoomHeightM, getWallSnapPointFromBounds, pointHeight, selectedRoomBounds, surfaceMode, toMeters]);

  const selectedRoomPoints = useMemo(
    () => (selectedRoomId ? sceneData.points.filter((point) => point.roomId === selectedRoomId) : []),
    [sceneData.points, selectedRoomId]
  );

  const findWallForFace = useCallback((face, bounds) => {
    const tol = 0.35;
    const matchesFace = (wall) => {
      const sx = toMeters(wall.startX);
      const sz = toMeters(wall.startY);
      const ex = toMeters(wall.endX);
      const ez = toMeters(wall.endY);
      if (face === 'north') return Math.abs(sz - bounds.minZ) < tol && Math.abs(ez - bounds.minZ) < tol;
      if (face === 'south') return Math.abs(sz - bounds.maxZ) < tol && Math.abs(ez - bounds.maxZ) < tol;
      if (face === 'west') return Math.abs(sx - bounds.minX) < tol && Math.abs(ex - bounds.minX) < tol;
      if (face === 'east') return Math.abs(sx - bounds.maxX) < tol && Math.abs(ex - bounds.maxX) < tol;
      return false;
    };
    // First try walls that belong to this room
    const withRoom = sceneData.walls.find(
      (wall) => String(wall.roomId) === String(selectedRoomId) && matchesFace(wall),
    );
    if (withRoom) return withRoom;
    // Fallback: any wall matching the face geometry (handles walls without roomId)
    return sceneData.walls.find(matchesFace) || null;
  }, [sceneData.walls, selectedRoomId, toMeters]);

  const ensureRoomEditingAllowed = useCallback(() => {
    if (!selectedRoomId) {
      addToast('Сначала выберите комнату в левой панели.', 'info');
      return false;
    }
    if (!selectedRoomBounds) {
      addToast('У выбранной комнаты не задана геометрия. Укажите размеры и сохраните.', 'warn');
      return false;
    }
    return true;
  }, [selectedRoomBounds, selectedRoomId, addToast]);

  const makeOrthogonalPoint = (nextPoint, forceVertical = false) => {
    if (routePointsRef.current.length === 0) return nextPoint;
    const prev = routePointsRef.current[routePointsRef.current.length - 1];
    if (forceVertical) {
      return new THREE.Vector3(prev.x, nextPoint.y, prev.z);
    }
    const dy = Math.abs(nextPoint.y - prev.y);
    const dx = Math.abs(nextPoint.x - prev.x);
    const dz = Math.abs(nextPoint.z - prev.z);
    if (dy > dx && dy > dz) {
      return new THREE.Vector3(prev.x, nextPoint.y, prev.z);
    }
    // Preserve nextPoint.y (set by snapPointToSurface) so floor/ceiling height
    // is not overridden when the dominant displacement is horizontal.
    if (dx > dz) {
      return new THREE.Vector3(nextPoint.x, nextPoint.y, prev.z);
    }
    return new THREE.Vector3(prev.x, nextPoint.y, nextPoint.z);
  };

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
      const changedAxes =
        (dx > ORTHOGONAL_TOLERANCE_M ? 1 : 0) +
        (dy > ORTHOGONAL_TOLERANCE_M ? 1 : 0) +
        (dz > ORTHOGONAL_TOLERANCE_M ? 1 : 0);
      if (changedAxes !== 1) {
        messages.push(`Сегмент ${i} должен менять только одну координату (X, Y или Z).`);
        badSegmentPoints.push([prev.clone(), current.clone()]);
      }
      const segmentLength = Math.max(dx, dy, dz);
      if (segmentLength < MIN_SEGMENT_M) {
        messages.push(`Сегмент ${i} слишком короткий: минимум 0.05 м.`);
        badSegmentPoints.push([prev.clone(), current.clone()]);
      }
    }

    if (nodes.length >= 2) {
      const start = nodes[0];
      const end = nodes[nodes.length - 1];
      if (!start.pointId) {
        messages.push('Начало трассы должно быть привязано к электрической точке — подведите первый узел ближе к розетке, выключателю или точке старта (до 35 см).');
      }
      if (!end.pointId) {
        messages.push('Конец трассы должен быть привязан к электрической точке — подведите последний узел ближе к розетке, выключателю или точке старта (до 35 см).');
      }
      if ((start.symbolType === 'switch' && end.symbolType === 'outlet')
        || (start.symbolType === 'outlet' && end.symbolType === 'switch')) {
        messages.push('Прямая трасса между выключателем и розеткой запрещена — добавьте промежуточный узел.');
      }
      if (start.symbolType === 'switch' && end.symbolType === 'switch') {
        messages.push('Трасса не может начинаться и заканчиваться на выключателях.');
      }

      // ТКП 339: трасса должна начинаться от точки старта (щитка), если она есть в комнате
      const roomSources = selectedRoomId
        ? sceneData.points.filter((p) => p.roomId === selectedRoomId && isSourcePointByNotes(p))
        : [];
      if (roomSources.length > 0) {
        const startPoint = sceneData.points.find((p) => p.id === start.pointId);
        const endPoint = sceneData.points.find((p) => p.id === end.pointId);
        const startIsSource = startPoint ? isSourcePointByNotes(startPoint) : false;
        const endIsSource = endPoint ? isSourcePointByNotes(endPoint) : false;
        if (!startIsSource && !endIsSource) {
          messages.push('ТКП 339: в помещении есть точка старта (щиток) — трасса должна начинаться или заканчиваться на ней.');
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
  }, [getRouteModeHeight, isPointInsideBounds, routePlacementMode, sceneData.points, selectedCircuitId, selectedRoomBounds, selectedRoomId]);

  const handleCanvasClick = async (event) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      mouseDownPosRef.current = null;
      return;
    }
    if (mouseDownPosRef.current) {
      const dx = event.clientX - mouseDownPosRef.current.x;
      const dy = event.clientY - mouseDownPosRef.current.y;
      mouseDownPosRef.current = null;
      if (dx * dx + dy * dy > 36) return;
    }
    if (loading) return;

    if (tool === 'delete') {
      await deleteHoveredObject();
      return;
    }

    if (tool === 'add-door' || tool === 'add-window') {
      if (!ensureRoomEditingAllowed()) return;

      const wallHit = getPointerWallHit(event);
      const clickFace = wallHit?.wallFace;
      if (!clickFace || !['north', 'south', 'east', 'west'].includes(clickFace)) {
        addToast('Наведите курсор на стену (она подсветится) и нажмите ЛКМ.', 'warn');
        return;
      }

      const hitPoint = wallHit.point;
      const snapped = getWallSnapPointFromBounds(hitPoint, selectedRoomBounds, tool === 'add-door' ? 1.0 : 1.5);

      const openingType = tool === 'add-door' ? 'door' : 'window';
      const widthCm = tool === 'add-door' ? doorWidthCm : windowWidthCm;
      const heightCm = tool === 'add-door' ? 200 : 120;

      let matchingWall = findWallForFace(clickFace, selectedRoomBounds);

      // If no DB wall found, try to auto-create it from room geometry
      if (!matchingWall && selectedRoom) {
        const px = Number(selectedRoom.positionX || 0);
        const py = Number(selectedRoom.positionY || 0);
        const rw = Number(selectedRoom.width || 0);
        const rh = Number(selectedRoom.height || 0);
        if (rw > 0 && rh > 0) {
          const faceWallCoords = {
            north: { startX: px, startY: py, endX: px + rw, endY: py },
            south: { startX: px, startY: py + rh, endX: px + rw, endY: py + rh },
            west:  { startX: px, startY: py, endX: px, endY: py + rh },
            east:  { startX: px + rw, startY: py, endX: px + rw, endY: py + rh },
          };
          const coords = faceWallCoords[clickFace];
          if (coords) {
            try {
              const created = await wallAPI.create(projectId, {
                ...coords,
                thickness: 20,
                wallType: 'internal',
                roomId: selectedRoomId,
                openings: [],
              });
              matchingWall = created.data;
            } catch (createErr) {
              addToast(`Не удалось создать стену: ${createErr?.response?.data?.message || createErr?.message || 'ошибка сервера'}`, 'error');
              return;
            }
          }
        }
      }

      if (!matchingWall) {
        addToast('Стена не найдена. Убедитесь, что у комнаты заданы размеры в «Геометрия комнаты для 3D».', 'warn');
        return;
      }

      const wallSX = Number(matchingWall.startX);
      const wallSY = Number(matchingWall.startY);
      const wallEX = Number(matchingWall.endX);
      const wallEY = Number(matchingWall.endY);
      const isHorizontalWall = Math.abs(wallEX - wallSX) >= Math.abs(wallEY - wallSY);
      const wallStartRef = isHorizontalWall ? Math.min(wallSX, wallEX) : Math.min(wallSY, wallEY);
      const positionCm = isHorizontalWall
        ? toCentimeters(snapped.x) - wallStartRef
        : toCentimeters(snapped.z) - wallStartRef;

      try {
        const existingOpenings = (matchingWall.openings || []).map((o) => ({
          position: Number(o.position),
          width: Number(o.width),
          height: Number(o.height || (o.openingType === 'door' ? 200 : 120)),
          openingType: o.openingType,
        }));
        await wallAPI.update(projectId, matchingWall.id, {
          startX: Number(matchingWall.startX),
          startY: Number(matchingWall.startY),
          endX: Number(matchingWall.endX),
          endY: Number(matchingWall.endY),
          thickness: Number(matchingWall.thickness || 20),
          wallType: matchingWall.wallType || 'internal',
          roomId: matchingWall.roomId,
          openings: [...existingOpenings, {
            position: Number(Math.max(0, positionCm).toFixed(2)),
            width: widthCm,
            height: heightCm,
            openingType,
          }],
        });
        addToast(`${openingType === 'door' ? 'Дверь' : 'Окно'} добавлено`, 'info');
        await loadSceneData();
      } catch (e) {
        addToast(`Не удалось сохранить проём: ${e?.response?.data?.message || e?.message || 'ошибка сервера'}`, 'error');
      }
      return;
    }

    // Determine effective surface: hover takes priority over surfaceMode selector
    const effectiveSurface = (hoveredWallFace === 'floor' || hoveredWallFace === 'ceiling')
      ? hoveredWallFace
      : surfaceMode;

    // Get the best 3D click point for each surface type.
    // For walls when looking from inside the room, getGroundIntersection fails because
    // a near-horizontal ray lands far outside bounds. We use the wall mesh hit instead.
    const getBasePoint = () => {
      if (effectiveSurface === 'ceiling') {
        return getIntersectionOnHeight(event, activeRoomHeightM - 0.05)
          ?? getGroundIntersection(event);
      }
      if (effectiveSurface === 'wall') {
        // Wall mesh raycast works from any camera angle, including inside the room
        const wallHit = getPointerWallHit(event);
        if (wallHit?.point) return wallHit.point;
        // Fallback: project to a mid-height plane (less accurate but better than y=0)
        return getIntersectionOnHeight(event, Math.max(toMeters(pointHeight), 0.3))
          ?? getGroundIntersection(event);
      }
      // floor
      return getGroundIntersection(event);
    };

    const basePoint = getBasePoint();
    if (!basePoint) return;

    const roomBoundedTools = ['add-source', 'add-outlet', 'add-switch', 'add-light', 'draw-route'];
    if (roomBoundedTools.includes(tool)) {
      if (!ensureRoomEditingAllowed()) return;
      if (!isPointInsideBounds(basePoint, selectedRoomBounds)) {
        addToast('Работа возможна только внутри выбранной комнаты. Переключитесь на нужную комнату.', 'warn');
        return;
      }
    }

    if (tool === 'add-source' || tool === 'add-outlet' || tool === 'add-switch' || tool === 'add-light') {
      // ТКП: точка старта (щиток) должна размещаться на стене, не на полу и не на потолке
      if (tool === 'add-source') {
        if (effectiveSurface === 'floor') {
          addToast('ТКП 339: точка старта (щиток) должна быть на стене, а не на полу. Переключитесь в режим стены (W).', 'error');
          return;
        }
        if (effectiveSurface === 'ceiling') {
          addToast('ТКП 339: точка старта (щиток) должна быть на стене, а не на потолке. Переключитесь в режим стены (W).', 'error');
          return;
        }
        // ТКП: в помещении допускается только одна точка старта (один щиток/ввод)
        const existingSources = getRoomSourcePoints(selectedRoomId);
        if (existingSources.length > 0) {
          addToast('ТКП 339: в помещении уже есть точка старта (щиток). Допускается только один ввод на группу.', 'error');
          return;
        }
      }

      if (tool === 'add-switch') {
        if (pointHeight < 80 || pointHeight > 170) {
          addToast(`ТКП 8.5.9: выключатель — высота 0.8–1.7 м. Сейчас: ${pointHeight} см. Измените «Высота точки».`, 'warn');
          return;
        }
        // ТКП 8.5.9 / 8.7.4: выключатели запрещены в мокрых зонах (зоны 0, 1, 2 — ванная, душевая, сауна)
        if (isWetRoom(selectedRoomId)) {
          addToast('ТКП 8.5.9: установка выключателей запрещена в ванных, душевых и саунах (зоны 0–2).', 'error');
          return;
        }
      }

      if (tool === 'add-outlet') {
        if (isWetRoom(selectedRoomId)) {
          if (!selectedCircuit || !selectedCircuit.rcdRatingMa || Number(selectedCircuit.rcdRatingMa) > 30) {
            addToast('ТКП 8.5.6/8.7.4: розетка в мокрой зоне — выберите цепь с УЗО ≤ 30 мА.', 'warn');
            return;
          }
        }
        // ТКП: в детских комнатах розетки устанавливаются на высоте 1.8 м от пола
        if (isChildrenRoom(selectedRoomId) && pointHeight !== 180) {
          addToast(`ТКП 7.1.48: в детских комнатах розетки должны быть на высоте 1.8 м (180 см). Высота скорректирована.`, 'warn');
          setPointHeight(180);
          return;
        }
      }

      if (tool === 'add-light') {
        // ТКП 8.7.4: в мокрых помещениях (зона 2) — только светильники класса защиты 2
        if (isWetRoom(selectedRoomId)) {
          addToast('ТКП 8.7.4: в мокрых помещениях допускаются только светильники класса защиты IP44 / класса II.', 'warn');
        }
        // ТКП: над плитами и рабочими столами на кухне — защитное стекло
        if (isKitchenRoom(selectedRoomId)) {
          addToast('ТКП: на кухне над рабочими поверхностями и плитой светильники должны иметь защитное стекло.', 'warn');
        }
      }
      const symbolType = tool === 'add-outlet'
        ? 'outlet'
        : tool === 'add-switch'
          ? 'switch'
          : 'light';
      try {
        const snappedSurfacePoint = snapPointToSurface(basePoint, pointHeight, effectiveSurface);
        if (!snappedSurfacePoint || !isPointInsideBounds(snappedSurfacePoint, selectedRoomBounds)) {
          addToast('Не удалось привязать точку к поверхности. Наведите на стену, пол или потолок и кликните.', 'warn');
          return;
        }
        const payload = {
          symbolType,
          powerConsumption: tool === 'add-source' ? 10 : symbolType === 'light' ? 120 : 2200,
          positionX: Number(toCentimeters(snappedSurfacePoint.x).toFixed(2)),
          positionY: Number(toCentimeters(snappedSurfacePoint.z).toFixed(2)),
          heightFromFloor: Number(
            tool === 'add-source'
              ? (effectiveSurface === 'ceiling' ? toCentimeters(activeRoomHeightM - 0.05) : effectiveSurface === 'floor' ? 5 : Math.max(pointHeight, 120))
              : Number(toCentimeters(snappedSurfacePoint.y).toFixed(0))
          ),
          ...(selectedRoomId ? { roomId: selectedRoomId } : {}),
          ...(selectedCircuitId ? { circuitId: Number(selectedCircuitId) } : {}),
          installationScope: 'PLANNED',
          notes: tool === 'add-source' ? 'Стартовая точка линии (3D)' : 'Создано в 3D-редакторе',
        };
        const created = await electricalPointAPI.create(projectId, payload);
        const createdPointId = created?.data?.id;
        if (createdPointId) {
          let activePointId = createdPointId;
          pushHistoryAction({
            undo: async () => electricalPointAPI.delete(projectId, activePointId),
            redo: async () => {
              const recreated = await electricalPointAPI.create(projectId, payload);
              activePointId = recreated?.data?.id || activePointId;
            },
            undoError: 'Не удалось отменить создание точки',
            redoError: 'Не удалось повторить создание точки',
          });
        }
        await loadSceneData();
        const pointLabel = getPointTypeLabel(symbolType);
        addToast(`${pointLabel} добавлена`, 'success');
        if (tool === 'add-source') {
          // Keep source and route heights aligned by default (TKP-friendly wall wiring flow).
          setRouteHeight(Number(payload.heightFromFloor));
        }
      } catch (e) {
        addToast('Не удалось добавить электрическую точку', 'error');
      }
      return;
    }

    if (tool === 'draw-route') {
      // Routes use routePlacementMode (independent of surfaceMode)
      const routeEffectiveSurface = (hoveredWallFace === 'floor' || hoveredWallFace === 'ceiling')
        ? hoveredWallFace
        : routePlacementMode;

      // Get route-specific base point using appropriate intersection for the route surface
      const routeHeightM = Math.max(toMeters(getRouteModeHeight()), 0.05);
      let routeBasePoint;
      if (routeEffectiveSurface === 'ceiling') {
        routeBasePoint = getIntersectionOnHeight(event, activeRoomHeightM - 0.05) ?? getGroundIntersection(event);
      } else if (routeEffectiveSurface === 'floor') {
        routeBasePoint = getGroundIntersection(event);
      } else {
        const wallHit = getPointerWallHit(event);
        routeBasePoint = wallHit?.point
          ?? getIntersectionOnHeight(event, routeHeightM)
          ?? getGroundIntersection(event);
      }
      if (!routeBasePoint) return;
      if (!isPointInsideBounds(routeBasePoint, selectedRoomBounds)) {
        addToast('Узел трассы должен находиться в пределах выбранной комнаты.', 'warn');
        return;
      }

      let snapped = snapPointToSurface(routeBasePoint, getRouteModeHeight(), routeEffectiveSurface);
      if (!snapped) return;
      if (!isPointInsideBounds(snapped, selectedRoomBounds)) {
        addToast('Узел трассы должен находиться в пределах выбранной комнаты.', 'warn');
        return;
      }
      const snappedPointResult = findNearestExistingPoint(snapped, selectedRoomPoints);
      snapped = snappedPointResult.point;
      // If the route starts from an existing electrical point (especially source),
      // sync route base height to that point so continuation does not "drop" by Y.
      if (routePointsRef.current.length === 0 && snappedPointResult.pointId) {
        const snappedHeightCm = Number(toCentimeters(snapped.y).toFixed(0));
        if (Number.isFinite(snappedHeightCm)) {
          setRouteHeight(snappedHeightCm);
        }
      }
      // For wall routing, keep the previous segment height by default.
      // Vertical transitions should be explicit (Shift + click).
      if (routeEffectiveSurface === 'wall' && routePointsRef.current.length > 0 && !event.shiftKey) {
        const prev = routePointsRef.current[routePointsRef.current.length - 1];
        snapped = new THREE.Vector3(snapped.x, prev.y, snapped.z);
      }
      const forceVertical = event.shiftKey;
      snapped = makeOrthogonalPoint(snapped, forceVertical);
      routePointsRef.current.push(new THREE.Vector3(snapped.x, snapped.y, snapped.z));
      routeNodesRef.current.push({
        x: snapped.x,
        y: snapped.z,
        z: snapped.y,
        pointId: snappedPointResult.pointId,
        symbolType: snappedPointResult.symbolType,
      });
      redrawRouteDraft();
      validateRouteDraft();
    }
  };

  const handleCanvasMouseDown = (event) => {
    mouseDownPosRef.current = { x: event.clientX, y: event.clientY };
    const picked = pickRouteHandleIndex(event);
    if (picked < 0) return;
    dragStateRef.current = { active: true, nodeIndex: picked };
    suppressClickRef.current = true;
    redrawRouteDraft();
  };

  const handleCanvasMouseMove = (event) => {
    const mountRect = mountRef.current?.getBoundingClientRect();
    if (mountRect) {
      setCursorPanel({
        x: event.clientX - mountRect.left + 14,
        y: event.clientY - mountRect.top + 14,
        visible: true,
      });
    }

    // --- Object hover detection (electrical points + routes) ---
    // Reset all point groups to normal scale
    pointHoverMeshesRef.current.forEach((m) => {
      const g = m.userData.pointGroup || m;
      g.scale.setScalar(1.0);
    });

    // Reset previously highlighted route tubes/line
    if (hoveredRouteLineRef.current) {
      hoveredRouteLineRef.current.material.color.set(0xf43f5e);
      (hoveredRouteLineRef.current.userData.tubeMeshes || []).forEach((tm) => tm.material.color.set(0xf43f5e));
      hoveredRouteLineRef.current = null;
    }

    let objectContext = null;
    if (rendererRef.current && cameraRef.current) {
      const rect = rendererRef.current.domElement.getBoundingClientRect();
      const objMouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );
      const objRay = new THREE.Raycaster();
      objRay.setFromCamera(objMouse, cameraRef.current);

      // Check draft route handles (active during draw-route tool)
      if (tool === 'draw-route' && routeHandleMeshesRef.current.length > 0) {
        const hdHits = objRay.intersectObjects(routeHandleMeshesRef.current, false);
        if (hdHits.length > 0) {
          const hdData = hdHits[0].object.userData;
          const hdIdx = hdData.routeHandleIndex;
          if (typeof hdIdx === 'number') {
            const hdPos = hdData.routeHandlePos || routePointsRef.current[hdIdx];
            const hx = hdPos ? Number(toCentimeters(hdPos.x).toFixed(0)) : '—';
            const hy = hdPos ? Number(toCentimeters(hdPos.y).toFixed(0)) : '—';
            const hz = hdPos ? Number(toCentimeters(hdPos.z).toFixed(0)) : '—';
            const isFirst = hdIdx === 0;
            const isLast = hdIdx === routePointsRef.current.length - 1;
            const nodeLabel = isFirst ? 'Начало трассы' : isLast ? 'Конец трассы' : `Узел трассы #${hdIdx + 1}`;
            objectContext = {
              isObject: true,
              objectType: nodeLabel,
              placement: `X: ${hx} см, Z: ${hz} см`,
              heightCm: hy,
              roomName: null,
              circuitName: null,
              nearestWallCm: null,
              notes: 'Перетащите, чтобы переместить',
            };
            hoveredObjectRef.current = { type: 'routeHandle', index: hdIdx };
          }
        }
      }

      // Check electrical points (only inside room view)
      if (!objectContext && insideRoomView && pointHoverMeshesRef.current.length > 0) {
        const ptHits = objRay.intersectObjects(pointHoverMeshesRef.current, false);
        if (ptHits.length > 0) {
          const hitObj = ptHits[0].object;
          const scaleTarget = hitObj.userData.pointGroup || hitObj;
          scaleTarget.scale.setScalar(1.55);
          const pData = hitObj.userData.pointData;
          if (pData) {
            hoveredObjectRef.current = { type: 'point', data: pData };
            const pRoom = sceneData.rooms.find((r) => r.id === pData.roomId);
            const pBounds = getRoomBounds(pRoom, sceneData.walls);
            const px = toMeters(pData.positionX);
            const pz = toMeters(pData.positionY);
            const pRoomHeightM = pRoom ? (roomHeightById[pRoom.id] || ROOM_HEIGHT_M) : ROOM_HEIGHT_M;
            const pCircuit = circuits.find((c) => String(c.id) === String(pData.circuitId));
            let nearestWallCm = null;
            if (pBounds) {
              nearestWallCm = Number(toCentimeters(Math.min(
                pz - pBounds.minZ,
                pBounds.maxZ - pz,
                px - pBounds.minX,
                pBounds.maxX - px
              )).toFixed(0));
            }
            objectContext = {
              isObject: true,
              objectType: getPointTypeLabel(pData.electricalSymbol?.type),
              placement: getPointPlacementLabel(pData.heightFromFloor || 0, pRoomHeightM),
              heightCm: pData.heightFromFloor || 0,
              roomName: pRoom?.name || '—',
              circuitName: pCircuit?.name || 'Без цепи',
              nearestWallCm,
              notes: pData.notes || '',
              pointId: pData.id,
            };
          }
        }
      }

      // Check route segments via invisible cylinder hit-meshes (reliable Mesh raycasting)
      if (!objectContext && routeHitMeshesRef.current.length > 0) {
        const rtHits = objRay.intersectObjects(routeHitMeshesRef.current, false);
        if (rtHits.length > 0) {
          const rData = rtHits[0].object.userData.routeData;
          if (rData) {
            hoveredObjectRef.current = { type: 'route', data: rData };
            const visualLine = routeHoverLinesRef.current.find(
              (l) => l.userData.routeData?.id === rData.id,
            );
            if (visualLine) {
              visualLine.material.color.set(0xfbbf24);
              (visualLine.userData.tubeMeshes || []).forEach((tm) => tm.material.color.set(0xfbbf24));
              hoveredRouteLineRef.current = visualLine;
            }
            const rCircuit = circuits.find((c) => String(c.id) === String(rData.circuitId));
            const nodeCount = (() => {
              try { return JSON.parse(rData.pathJson)?.length ?? 0; } catch { return 0; }
            })();
            objectContext = {
              isObject: true,
              objectType: 'Трасса кабеля',
              placement: null,
              heightCm: null,
              roomName: null,
              circuitName: rCircuit?.name || 'Без цепи',
              nearestWallCm: null,
              notes: rData.notes || '',
              routeLength: rData.lengthM ? `${Number(rData.lengthM).toFixed(2)} м` : null,
              routeNodeCount: nodeCount,
              routeId: rData.id,
            };
          }
        }
      }

      // Check openings (doors / windows) — only inside room view
      if (insideRoomView && !objectContext && openingHoverMeshesRef.current.length > 0) {
        const opHits = objRay.intersectObjects(openingHoverMeshesRef.current, false);
        if (opHits.length > 0) {
          const od = opHits[0].object.userData.openingData;
          if (od) {
            hoveredObjectRef.current = { type: 'opening', data: od };
            const isDoor = od.opening.openingType === 'door';
            objectContext = {
              isObject: true,
              objectType: isDoor ? 'Дверь' : 'Окно',
              placement: null,
              heightCm: Number(od.opening.height || (isDoor ? 200 : 120)),
              roomName: null,
              circuitName: null,
              nearestWallCm: null,
              notes: `Ширина: ${Number(od.opening.width || (isDoor ? 90 : 120))} см`,
              routeLength: null,
            };
          }
        }
      }

      if (!objectContext) hoveredObjectRef.current = null;
    } else {
      hoveredObjectRef.current = null;
    }

    // If hovering an object, show object info and skip surface detection
    if (objectContext) {
      setCursorContext(objectContext);
      // Still update hover face state so wall highlights work
      const hoveredFace = getPointerWallFace(event);
      if (hoveredFace !== hoveredWallFace) setHoveredWallFace(hoveredFace);
      if (!dragStateRef.current.active) return;
    }

    const hoveredFace = getPointerWallFace(event);
    if (hoveredFace !== hoveredWallFace) {
      setHoveredWallFace(hoveredFace);
    }

    if (selectedRoomBounds) {
      let contextPoint = null;
      let surfaceLabel = 'Пол';

      if (hoveredFace === 'floor') {
        const groundHit = getGroundIntersection(event);
        if (groundHit && isPointInsideBounds(groundHit, selectedRoomBounds)) {
          contextPoint = new THREE.Vector3(groundHit.x, 0.05, groundHit.z);
          surfaceLabel = 'Пол';
        }
      } else if (hoveredFace === 'ceiling') {
        const ceilingHit = getIntersectionOnHeight(event, activeRoomHeightM - 0.05);
        if (ceilingHit && isPointInsideBounds(ceilingHit, selectedRoomBounds)) {
          contextPoint = new THREE.Vector3(ceilingHit.x, activeRoomHeightM - 0.05, ceilingHit.z);
          surfaceLabel = 'Потолок';
        }
      } else if (hoveredFace) {
        const wallHit = getPointerWallHit(event);
        if (wallHit?.point) {
          contextPoint = wallHit.point;
          surfaceLabel = getWallFaceLabel(hoveredFace);
        }
      } else if (surfaceMode === 'ceiling') {
        const ceilingHit = getIntersectionOnHeight(event, activeRoomHeightM - 0.05);
        if (ceilingHit && isPointInsideBounds(ceilingHit, selectedRoomBounds)) {
          contextPoint = new THREE.Vector3(ceilingHit.x, activeRoomHeightM - 0.05, ceilingHit.z);
          surfaceLabel = 'Потолок';
        }
      } else if (surfaceMode === 'floor') {
        const groundHit = getGroundIntersection(event);
        if (groundHit) {
          const snapped = snapPointToSurface(groundHit, pointHeight);
          if (snapped) {
            contextPoint = snapped;
            surfaceLabel = 'Пол';
          }
        }
      } else {
        const wallHit = getPointerWallHit(event);
        if (wallHit?.point) {
          contextPoint = wallHit.point;
          if (wallHit.wallFace) {
            surfaceLabel = getWallFaceLabel(wallHit.wallFace);
          } else if (wallFaceMode !== 'auto') {
            surfaceLabel = getWallFaceLabel(wallFaceMode);
          } else {
            surfaceLabel = 'Стена (авто)';
          }
        }
      }

      if (!objectContext) {
        if (contextPoint) {
          const nearestCornerM = getDistanceToNearestCorner(contextPoint, selectedRoomBounds);
          setCursorContext({
            isObject: false,
            surface: surfaceLabel,
            heightCm: Number(toCentimeters(contextPoint.y).toFixed(0)),
            nearestCornerM,
            circuitName: selectedCircuit?.name || 'Без цепи',
          });
        } else {
          setCursorContext(null);
        }
      }

      // Ghost preview for placement tools + openings + route segment
      const pointPlacementTools = ['add-outlet', 'add-switch', 'add-light', 'add-source'];
      const openingTools = ['add-door', 'add-window'];
      if (pointPlacementTools.includes(tool) && !objectContext) {
        const ghostSurface = (hoveredFace === 'floor' || hoveredFace === 'ceiling') ? hoveredFace : surfaceMode;
        const snapBase = contextPoint ?? (hoveredFace === 'floor' ? getGroundIntersection(event) : null);
        if (snapBase) {
          const snappedPos = snapPointToSurface(snapBase, pointHeight, ghostSurface);
          if (snappedPos && isPointInsideBounds(snappedPos, selectedRoomBounds)) {
            const roomCenter = selectedRoomBounds
              ? new THREE.Vector3(
                  (selectedRoomBounds.minX + selectedRoomBounds.maxX) / 2,
                  snappedPos.y,
                  (selectedRoomBounds.minZ + selectedRoomBounds.maxZ) / 2,
                )
              : null;
            updateGhostPreview(tool, snappedPos, roomCenter);
          } else {
            clearGhostPreview();
          }
        } else {
          clearGhostPreview();
        }
      } else if (openingTools.includes(tool) && !objectContext) {
        const wallHit = getPointerWallHit(event);
        const clickFace = wallHit?.wallFace;
        if (wallHit?.point && clickFace && ['north', 'south', 'east', 'west'].includes(clickFace) && selectedRoomBounds) {
          const snapped = getWallSnapPointFromBounds(wallHit.point, selectedRoomBounds, tool === 'add-door' ? 1.0 : 1.5);
          if (snapped && isPointInsideBounds(snapped, selectedRoomBounds)) {
            clearGhostPreview();
            const g = ghostGroupRef.current;
            if (g) {
              const matchingWall = findWallForFace(clickFace, selectedRoomBounds);
              const widthCm = tool === 'add-door' ? doorWidthCm : windowWidthCm;
              const widthM = toMeters(widthCm);
              const depthM = toMeters(matchingWall?.thickness || 20);
              const heightM = tool === 'add-door' ? 2.0 : 1.2;
              let previewX = snapped.x;
              let previewZ = snapped.z;
              let previewRotY = getWallFaceRotationY(clickFace);
              if (matchingWall) {
                const wallSX = Number(matchingWall.startX);
                const wallSY = Number(matchingWall.startY);
                const wallEX = Number(matchingWall.endX);
                const wallEY = Number(matchingWall.endY);
                const startX = toMeters(wallSX);
                const startZ = toMeters(wallSY);
                const endX = toMeters(wallEX);
                const endZ = toMeters(wallEY);
                const dx = endX - startX;
                const dz = endZ - startZ;
                const wallLenM = Math.max(Math.sqrt(dx * dx + dz * dz), 0.05);
                const wallDirX = dx / wallLenM;
                const wallDirZ = dz / wallLenM;
                const isHorizontalWall = Math.abs(wallEX - wallSX) >= Math.abs(wallEY - wallSY);
                const wallStartRef = isHorizontalWall ? Math.min(wallSX, wallEX) : Math.min(wallSY, wallEY);
                const positionCm = isHorizontalWall
                  ? toCentimeters(snapped.x) - wallStartRef
                  : toCentimeters(snapped.z) - wallStartRef;
                const posM = toMeters(Math.max(0, positionCm));
                previewX = startX + wallDirX * (posM + widthM / 2);
                previewZ = startZ + wallDirZ * (posM + widthM / 2);
                previewRotY = -Math.atan2(dz, dx);
              }
              const yCenter = tool === 'add-door'
                ? heightM / 2
                : Math.max(2.8 - heightM / 2 - 0.3, heightM / 2);
              const openingGroup = tool === 'add-door'
                ? buildDoorGroup(widthM, heightM, depthM)
                : buildWindowGroup(widthM, heightM, depthM);
              openingGroup.position.set(previewX, yCenter, previewZ);
              openingGroup.rotation.y = previewRotY;
              openingGroup.traverse((child) => {
                if (child.isMesh && child.material) {
                  const mats = Array.isArray(child.material) ? child.material : [child.material];
                  mats.forEach((mat) => {
                    mat.transparent = true;
                    mat.opacity = 0.48;
                    mat.depthWrite = false;
                  });
                }
              });
              g.add(openingGroup);
            }
          } else {
            clearGhostPreview();
          }
        } else {
          clearGhostPreview();
        }
      } else if (tool === 'draw-route' && !objectContext) {
        if (!selectedRoomBounds) {
          clearGhostPreview();
        } else {
          const routeEffectiveSurface = (hoveredFace === 'floor' || hoveredFace === 'ceiling')
            ? hoveredFace
            : routePlacementMode;
          const routeHeightM = Math.max(toMeters(getRouteModeHeight()), 0.05);
          let routeBasePoint = null;
          if (routeEffectiveSurface === 'ceiling') {
            routeBasePoint = getIntersectionOnHeight(event, activeRoomHeightM - 0.05) ?? getGroundIntersection(event);
          } else if (routeEffectiveSurface === 'floor') {
            routeBasePoint = getGroundIntersection(event);
          } else {
            const wallHit = getPointerWallHit(event);
            routeBasePoint = wallHit?.point ?? getIntersectionOnHeight(event, routeHeightM) ?? getGroundIntersection(event);
          }

          if (!routeBasePoint || !isPointInsideBounds(routeBasePoint, selectedRoomBounds)) {
            clearGhostPreview();
          } else {
            let snapped = snapPointToSurface(routeBasePoint, getRouteModeHeight(), routeEffectiveSurface);
            if (!snapped || !isPointInsideBounds(snapped, selectedRoomBounds)) {
              clearGhostPreview();
            } else {
              const snappedPointResult = findNearestExistingPoint(snapped, selectedRoomPoints);
              snapped = snappedPointResult.point;
              if (routeEffectiveSurface === 'wall' && routePointsRef.current.length > 0 && !event.shiftKey) {
                const prev = routePointsRef.current[routePointsRef.current.length - 1];
                snapped = new THREE.Vector3(snapped.x, prev.y, snapped.z);
              }
              const forceVertical = event.shiftKey;
              snapped = makeOrthogonalPoint(snapped, forceVertical);

              clearGhostPreview();
              const g = ghostGroupRef.current;
              if (g && routePointsRef.current.length > 0) {
                const prev = routePointsRef.current[routePointsRef.current.length - 1];
                const geom = new THREE.BufferGeometry().setFromPoints([prev, snapped]);
                const mat = new THREE.LineDashedMaterial({
                  color: 0xfacc15,
                  dashSize: 0.12,
                  gapSize: 0.08,
                  transparent: true,
                  opacity: 0.9,
                  depthWrite: false,
                });
                const line = new THREE.Line(geom, mat);
                line.computeLineDistances();
                g.add(line);
                const sphere = new THREE.Mesh(
                  new THREE.SphereGeometry(0.035, 10, 10),
                  new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.8, depthWrite: false })
                );
                sphere.position.copy(snapped);
                g.add(sphere);
              } else if (g) {
                const sphere = new THREE.Mesh(
                  new THREE.SphereGeometry(0.04, 12, 12),
                  new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.75, depthWrite: false })
                );
                sphere.position.copy(snapped);
                g.add(sphere);
              }
            }
          }
        }
      } else if (![...pointPlacementTools, ...openingTools, 'draw-route'].includes(tool)) {
        clearGhostPreview();
      }
    } else if (!objectContext) {
      setCursorContext(null);
    }

    if (!dragStateRef.current.active) return;
    const idx = dragStateRef.current.nodeIndex;
    if (idx < 0 || idx >= routeNodesRef.current.length) return;

    const currentNode = routeNodesRef.current[idx];
    const hit = getIntersectionOnHeight(event, currentNode.z);
    if (!hit) return;
    if (selectedRoomBounds && !isPointInsideBounds(hit, selectedRoomBounds)) return;

    let snapped = surfaceMode === 'wall'
      ? getWallSnapPointFromBounds(new THREE.Vector3(hit.x, currentNode.z, hit.z), selectedRoomBounds, currentNode.z)
      : new THREE.Vector3(hit.x, currentNode.z, hit.z);
    if (selectedRoomBounds && !isPointInsideBounds(snapped, selectedRoomBounds)) return;
    const snappedPointResult = findNearestExistingPoint(snapped, selectedRoomPoints);
    snapped = snappedPointResult.point;

    const nextNodes = routeNodesRef.current.map((node, i) =>
      i === idx
        ? {
          ...node,
          x: snapped.x,
          y: snapped.z,
          z: snapped.y,
          pointId: snappedPointResult.pointId || null,
          symbolType: snappedPointResult.symbolType || null,
        }
        : node
    );

    routeNodesRef.current = nextNodes;
    routePointsRef.current = nextNodes.map((node) => new THREE.Vector3(node.x, node.z, node.y));
    redrawRouteDraft();
    validateRouteDraft();
  };

  const focusRoom = useCallback((roomId) => {
    const room = sceneData.rooms.find((r) => r.id === roomId);
    const bounds = getRoomBounds(room, sceneData.walls);
    const viewHeightM = roomHeightById[roomId] || ROOM_HEIGHT_M;
    setSelectedRoomId(roomId);
    if (!bounds || !cameraRef.current || !controlsRef.current) return;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    controlsRef.current.target.set(centerX, viewHeightM / 3, centerZ);
    cameraRef.current.position.set(centerX + 3.6, viewHeightM + 2.8, centerZ + 3.6);
    controlsRef.current.update();
    setInsideRoomView(false);
  }, [ROOM_HEIGHT_M, getRoomBounds, roomHeightById, sceneData.rooms, sceneData.walls]);

  const enterRoom = useCallback((roomId) => {
    const room = sceneData.rooms.find((r) => r.id === roomId);
    const bounds = getRoomBounds(room, sceneData.walls);
    setSelectedRoomId(roomId);
    if (!bounds || !cameraRef.current || !controlsRef.current) return;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const lookZ = Math.min(bounds.maxZ - 0.12, centerZ + 0.8);
    cameraRef.current.position.set(centerX, 1.65, centerZ);
    controlsRef.current.target.set(centerX, 1.45, lookZ);
    controlsRef.current.update();
    setInsideRoomView(true);
  }, [getRoomBounds, sceneData.rooms, sceneData.walls]);

  const setCameraToFloorPlane = useCallback((roomId) => {
    const room = sceneData.rooms.find((r) => r.id === roomId);
    const bounds = getRoomBounds(room, sceneData.walls);
    const viewHeightM = roomHeightById[roomId] || ROOM_HEIGHT_M;
    setSelectedRoomId(roomId);
    if (!bounds || !cameraRef.current || !controlsRef.current) return;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    controlsRef.current.target.set(centerX, 0, centerZ);
    cameraRef.current.position.set(centerX, viewHeightM + 3, centerZ + 0.01);
    controlsRef.current.update();
    setInsideRoomView(false);
  }, [ROOM_HEIGHT_M, getRoomBounds, roomHeightById, sceneData.rooms, sceneData.walls]);

  const setCameraToWallPlane = useCallback((roomId, face = wallViewFace) => {
    const room = sceneData.rooms.find((r) => r.id === roomId);
    const bounds = getRoomBounds(room, sceneData.walls);
    const viewHeightM = roomHeightById[roomId] || ROOM_HEIGHT_M;
    setSelectedRoomId(roomId);
    if (!bounds || !cameraRef.current || !controlsRef.current) return;

    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const inwardPadding = 0.16;
    const eyeHeight = Math.min(Math.max(1.65, viewHeightM * 0.58), viewHeightM - 0.35);
    const targetHeight = Math.min(Math.max(1.45, viewHeightM * 0.5), viewHeightM - 0.45);

    let cameraX = centerX;
    let cameraZ = centerZ;
    let targetX = centerX;
    let targetZ = centerZ;

    if (face === 'north') {
      cameraZ = Math.min(bounds.maxZ - inwardPadding, centerZ + 0.85);
      targetZ = bounds.minZ + inwardPadding;
    } else if (face === 'south') {
      cameraZ = Math.max(bounds.minZ + inwardPadding, centerZ - 0.85);
      targetZ = bounds.maxZ - inwardPadding;
    } else if (face === 'west') {
      cameraX = Math.min(bounds.maxX - inwardPadding, centerX + 0.85);
      targetX = bounds.minX + inwardPadding;
    } else if (face === 'east') {
      cameraX = Math.max(bounds.minX + inwardPadding, centerX - 0.85);
      targetX = bounds.maxX - inwardPadding;
    } else {
      cameraZ = Math.min(bounds.maxZ - inwardPadding, centerZ + 0.85);
      targetZ = bounds.minZ + inwardPadding;
    }

    cameraRef.current.position.set(cameraX, eyeHeight, cameraZ);
    controlsRef.current.target.set(targetX, targetHeight, targetZ);
    controlsRef.current.update();
    setInsideRoomView(true);
    setWallFaceMode(face === 'auto' ? 'auto' : face);
  }, [ROOM_HEIGHT_M, getRoomBounds, roomHeightById, sceneData.rooms, sceneData.walls, wallViewFace]);

  const setCameraToCeilingPlane = useCallback((roomId) => {
    const room = sceneData.rooms.find((r) => r.id === roomId);
    const bounds = getRoomBounds(room, sceneData.walls);
    const viewHeightM = roomHeightById[roomId] || ROOM_HEIGHT_M;
    setSelectedRoomId(roomId);
    if (!bounds || !cameraRef.current || !controlsRef.current) return;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    controlsRef.current.target.set(centerX, viewHeightM - 0.2, centerZ);
    cameraRef.current.position.set(centerX + 0.01, viewHeightM + 1.2, centerZ + 0.6);
    controlsRef.current.update();
    setInsideRoomView(false);
  }, [ROOM_HEIGHT_M, getRoomBounds, roomHeightById, sceneData.rooms, sceneData.walls]);

  useEffect(() => {
    if (!controlsRef.current) return;
    if (insideRoomView) {
      controlsRef.current.minDistance = 0.2;
      controlsRef.current.maxDistance = 4.5;
      controlsRef.current.maxPolarAngle = Math.PI * 0.58;
    } else if (surfaceMode === 'floor') {
      controlsRef.current.minDistance = 1.5;
      controlsRef.current.maxDistance = 25;
      controlsRef.current.maxPolarAngle = Math.PI / 2;
    } else if (surfaceMode === 'ceiling') {
      controlsRef.current.minDistance = 0.8;
      controlsRef.current.maxDistance = 10;
      controlsRef.current.maxPolarAngle = Math.PI * 0.7;
    } else {
      controlsRef.current.minDistance = 0.5;
      controlsRef.current.maxDistance = 40;
      controlsRef.current.maxPolarAngle = Math.PI / 2;
    }
  }, [insideRoomView, surfaceMode]);

  // When the active tool changes, auto-set pointHeight to ТКП-compliant defaults
  useEffect(() => {
    if (tool === 'add-switch') {
      setPointHeight((prev) => (prev >= 80 && prev <= 170 ? prev : 100));
    } else if (tool === 'add-source') {
      // ТКП 339: щиток (точка старта) — стандартная высота 120–180 см, по умолчанию 150 см
      setPointHeight((prev) => (prev >= 120 && prev <= 180 ? prev : 150));
    } else if (tool === 'add-outlet') {
      setPointHeight((prev) => (prev >= 20 && prev <= 60 ? prev : 30));
    } else if (tool === 'add-light') {
      // Lights always go on ceiling — snap to ceiling height via surfaceMode/hover,
      // but set a default high value so the sphere renders near the ceiling
      setPointHeight((prev) => (prev >= 200 ? prev : 250));
    }
    const placementTools = ['add-outlet', 'add-switch', 'add-light', 'add-source', 'add-door', 'add-window', 'draw-route'];
    if (!placementTools.includes(tool)) {
      clearGhostPreview();
    }
  }, [clearGhostPreview, tool]);

  // When the route placement mode changes, auto-adjust route height to valid range
  useEffect(() => {
    if (routePlacementMode === 'ceiling') {
      setRouteHeight((prev) => Math.max(prev, 240));
    } else if (routePlacementMode === 'floor') {
      setRouteHeight((prev) => Math.min(prev, 20));
    } else {
      setRouteHeight((prev) => (prev >= 10 && prev <= 230 ? prev : 120));
    }
  }, [routePlacementMode]);

  // Sync routePlacementMode with surfaceMode so they stay consistent
  useEffect(() => {
    setRoutePlacementMode(surfaceMode);
  }, [surfaceMode]);

  useEffect(() => {
    const onKeyDown = (event) => {
      const targetTag = event.target?.tagName;
      const isTyping = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT' || event.target?.isContentEditable;
      if (isTyping) return;
      if (event.key === 'ArrowUp' && moveCameraByKeyboard('forward')) {
        event.preventDefault();
        return;
      }
      if (event.key === 'ArrowDown' && moveCameraByKeyboard('backward')) {
        event.preventDefault();
        return;
      }
      if (event.key === 'ArrowLeft' && moveCameraByKeyboard('left')) {
        event.preventDefault();
        return;
      }
      if (event.key === 'ArrowRight' && moveCameraByKeyboard('right')) {
        event.preventDefault();
        return;
      }
      if (event.key === '1') setTool('add-outlet');
      if (event.key === '2') setTool('add-switch');
      if (event.key === '3') setTool('add-light');
      if (event.key === '4') setTool('draw-route');
      if (event.key.toLowerCase() === 'f') setSurfaceMode('floor');
      if (event.key.toLowerCase() === 'w') setSurfaceMode('wall');
      if (event.key.toLowerCase() === 'c') setSurfaceMode('ceiling');
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [moveCameraByKeyboard]);

  const toolHintShownRef = useRef(false);
  useEffect(() => {
    if (!toolHintShownRef.current) {
      toolHintShownRef.current = true;
      return;
    }
    const hints = {
      'draw-route': 'Кликайте на сцене для добавления узлов трассы. Shift+клик — вертикальный переход. Enter — сохранить.',
      'add-outlet': 'Наведите курсор на стену, пол или потолок и кликните ЛКМ для добавления розетки.',
      'add-switch': 'Наведите курсор на стену и кликните ЛКМ для добавления выключателя.',
      'add-light': 'Наведите курсор на потолок или стену и кликните ЛКМ для добавления световой точки.',
      'add-source': 'Наведите курсор на стену и кликните ЛКМ для размещения щитка (стартовой точки).',
      'add-door': 'Наведите курсор на стену (она подсветится) и кликните ЛКМ для добавления двери.',
      'add-window': 'Наведите курсор на стену (она подсветится) и кликните ЛКМ для добавления окна.',
      'delete': 'Наведите на объект для выделения, затем нажмите ЛКМ или Delete для удаления.',
      'navigate': 'Режим навигации: ЛКМ+перетаскивание — вращение, колёсико — зум, ПКМ — панорамирование.',
    };
    const hint = hints[tool];
    if (hint) addToast(hint, 'info');
  }, [tool, addToast]);

  const saveCurrent3DCalculation = async () => {
    try {
      const name = saveCalcName.trim() || `3D расчет ${new Date().toLocaleString('ru-RU')}`;
      await savedSpecificationAPI.save(projectId, { name, projectId: Number(projectId) });
      setSaveCalcName('');
      await loadSceneData();
      addToast('Расчет сохранён', 'success');
    } catch (e) {
      addToast(e?.response?.data?.message || 'Не удалось сохранить текущий 3D расчет', 'error');
    }
  };

  const openSaved3DCalculation = async (savedId) => {
    try {
      const response = await savedSpecificationAPI.getById(projectId, savedId, true);
      setSelectedSavedCalcId(savedId);
      setSelectedSavedCalcDetails(response.data || null);
      addToast('Расчет загружен', 'success');
    } catch (e) {
      addToast('Не удалось открыть сохраненный 3D расчет', 'error');
    }
  };

  const roomExistingStats = useMemo(() => {
    if (!selectedRoomId) return { points: 0, outlets: 0, switches: 0, lights: 0, appliances: 0 };
    const roomPoints = sceneData.points.filter((point) => point.roomId === selectedRoomId);
    return {
      points: roomPoints.length,
      outlets: roomPoints.filter((p) => p?.electricalSymbol?.type === 'outlet').length,
      switches: roomPoints.filter((p) => p?.electricalSymbol?.type === 'switch').length,
      lights: roomPoints.filter((p) => p?.electricalSymbol?.type === 'light').length,
      appliances: projectAppliances
        .filter((item) => item.roomId === selectedRoomId)
        .reduce((sum, item) => sum + Number(item.quantity || 1), 0),
    };
  }, [projectAppliances, sceneData.points, selectedRoomId]);

  const selectedRoomCalculation = useMemo(() => {
    if (!selectedRoomId || !calculationReport?.roomCalculations) return null;
    return calculationReport.roomCalculations.find((r) => r.roomId === selectedRoomId) || null;
  }, [calculationReport, selectedRoomId]);

  const selectedRoomHasGeometry = useMemo(
    () => !!selectedRoomBounds,
    [selectedRoomBounds]
  );

  useEffect(() => {
    if (!selectedRoom) {
      setRoomWidthCm(null);
      setRoomLengthCm(null);
      setRoomCeilingHeightM(DEFAULT_ROOM_HEIGHT_M);
      return;
    }
    const widthFromRoom = Number(selectedRoom.width || 0);
    const heightFromRoom = Number(selectedRoom.height || 0);
    const areaM2 = Number(selectedRoom.area || 0);
    let defaultSideCm = 300;
    if (areaM2 > 0) {
      defaultSideCm = Math.max(Math.sqrt(areaM2) * 100, 100);
    }
    setRoomWidthCm(widthFromRoom || defaultSideCm);
    setRoomLengthCm(heightFromRoom || defaultSideCm);
    setRoomCeilingHeightM(roomHeightById[selectedRoom.id] || DEFAULT_ROOM_HEIGHT_M);
  }, [roomHeightById, selectedRoom]);

  const roomPlan = roomPlanData[selectedRoomId] || { plannedOutlets: 0, plannedSwitches: 0, plannedLights: 0, cableReserveM: 0 };
  const getRoomName = useCallback((roomId) => (
    sceneData.rooms.find((room) => room.id === roomId)?.name?.toLowerCase() || ''
  ), [sceneData.rooms]);
  const isWetRoom = useCallback((roomId) => {
    const name = getRoomName(roomId);
    return name.includes('ван') || name.includes('душ') || name.includes('сануз') || name.includes('саун');
  }, [getRoomName]);

  const isChildrenRoom = useCallback((roomId) => {
    const name = getRoomName(roomId);
    return name.includes('дет') || name.includes('игров') || name.includes('nursery');
  }, [getRoomName]);

  const isKitchenRoom = useCallback((roomId) => {
    const name = getRoomName(roomId);
    return name.includes('кух') || name.includes('kitchen');
  }, [getRoomName]);

  const getRoomSourcePoints = useCallback((roomId) => (
    sceneData.points.filter((p) => p.roomId === roomId && isSourcePointByNotes(p))
  ), [sceneData.points]);
  const selectedCircuit = useMemo(
    () => circuits.find((circuit) => String(circuit.id) === String(selectedCircuitId)) || null,
    [circuits, selectedCircuitId]
  );
  const canUndo = useMemo(() => historyRef.current.undo.length > 0, [historyVersion]);
  const canRedo = useMemo(() => historyRef.current.redo.length > 0, [historyVersion]);
  const validationStages = useMemo(() => {
    const stage1Errors = [];
    const stage2Errors = [];
    const stage3Warnings = [];

    if (selectedRoom) {
      const nextWidth = Number(selectedRoom.width || 0);
      const nextHeight = Number(selectedRoom.height || 0);
      if (!nextWidth || !nextHeight) {
        stage1Errors.push('Задайте геометрию комнаты (ширина/глубина).');
      }
      if (nextWidth && nextHeight) {
        const area = (nextWidth * nextHeight) / 10000;
        if (area < 2) {
          stage1Errors.push('Площадь комнаты должна быть не менее 2 м².');
        }
      }
    }

    if (isWetRoom(selectedRoomId)) {
      if (!selectedCircuit || !selectedCircuit.rcdRatingMa || Number(selectedCircuit.rcdRatingMa) > 30) {
        stage2Errors.push('Для мокрых помещений требуется цепь с УЗО не более 30 мА (ТКП 8.5.6, 8.7.4).');
      }
      stage3Warnings.push('Для розеток в мокрых помещениях требуется зона 3 и расстояние не менее 0.6 м от душа (ТКП 8.5.6).');
      if (tool === 'add-switch') {
        stage2Errors.push('Установка выключателей запрещена в мокрых помещениях — зоны 0, 1, 2 (ТКП 8.5.9).');
      }
      if (tool === 'add-light') {
        stage3Warnings.push('В мокрых помещениях допускаются только светильники класса защиты II / IP44 и выше (ТКП 8.7.4).');
      }
    }

    if (tool === 'add-switch' && (pointHeight < 80 || pointHeight > 170)) {
      stage2Errors.push('Высота выключателя должна быть в диапазоне 0.8-1.7 м от пола (ТКП 8.5.9).');
    }

    // ТКП 339: точка старта (щиток) — стандартная высота 120–180 см
    if (tool === 'add-source' && (pointHeight < 120 || pointHeight > 180)) {
      stage3Warnings.push(`Рекомендуемая высота щитка (точки старта) — 120–180 см. Текущая: ${pointHeight} см (ТКП 339).`);
    }

    // ТКП 339: в комнате должна быть хотя бы одна точка старта для прокладки трасс
    if (selectedRoom && tool === 'draw-route') {
      const roomSources = sceneData.points.filter(
        (p) => p.roomId === selectedRoomId && ((p?.notes || '').toLowerCase().includes('стартов') || (p?.notes || '').toLowerCase().includes('start'))
      );
      if (roomSources.length === 0) {
        stage3Warnings.push('ТКП 339: перед прокладкой трасс разместите точку старта (щиток) в помещении.');
      }
    }

    // ТКП: в детской комнате розетки должны быть на высоте 1.8 м
    if (tool === 'add-outlet' && isChildrenRoom(selectedRoomId) && pointHeight !== 180) {
      stage2Errors.push('ТКП 7.1.48: в детских комнатах розетки устанавливаются на высоте 1.8 м (180 см).');
    }

    return {
      stage1Errors,
      stage2Errors,
      stage3Warnings,
      isValid: stage1Errors.length === 0 && stage2Errors.length === 0,
    };
  }, [isChildrenRoom, isWetRoom, pointHeight, sceneData.points, selectedCircuit, selectedRoom, selectedRoomId, tool]);

  const autoPlaceSelectedRoom = useCallback(async (forcedWidthCm = null, forcedLengthCm = null) => {
    if (!selectedRoom || !sceneData.floorPlan) {
      return;
    }
    try {
      let widthCm = Number(forcedWidthCm || roomWidthCm || 0);
      let heightCm = Number(forcedLengthCm || roomLengthCm || 0);
      const areaM2 = Number(selectedRoom.area || 0);
      if ((!widthCm || !heightCm) && areaM2 > 0) {
        if (!widthCm && heightCm) {
          widthCm = (areaM2 * 10000) / heightCm;
        } else if (!heightCm && widthCm) {
          heightCm = (areaM2 * 10000) / widthCm;
        } else if (!widthCm && !heightCm) {
          const side = Math.max(Math.sqrt(areaM2) * 100, 100);
          widthCm = side;
          heightCm = side;
        }
      }
      if (!widthCm || !heightCm) {
        addToast('Укажите ширину и длину комнаты в панели 3D-редактора или задайте площадь комнаты.', 'warn');
        return;
      }
      const floorWidth = Number(sceneData.floorPlan.width || 0);
      const floorHeight = Number(sceneData.floorPlan.height || 0);
      const x0 = Math.max((floorWidth - widthCm) / 2, 0);
      const y0 = Math.max((floorHeight - heightCm) / 2, 0);
      const x1 = x0 + widthCm;
      const y1 = y0 + heightCm;
      const thickness = 10;
      const cornerInset = 5;
      const extend = 5;
      const wallsPayload = [
        {
          roomId: selectedRoom.id,
          startX: Math.max(x0 - extend, 0),
          startY: y0,
          endX: Math.min(x1 + extend, floorWidth),
          endY: y0,
          thickness,
          wallType: 'internal',
        },
        {
          roomId: selectedRoom.id,
          startX: x1,
          startY: y0 + cornerInset,
          endX: x1,
          endY: y1 - cornerInset,
          thickness,
          wallType: 'internal',
        },
        {
          roomId: selectedRoom.id,
          startX: Math.max(x0 - extend, 0),
          startY: y1,
          endX: Math.min(x1 + extend, floorWidth),
          endY: y1,
          thickness,
          wallType: 'internal',
        },
        {
          roomId: selectedRoom.id,
          startX: x0,
          startY: y1 - cornerInset,
          endX: x0,
          endY: y0 + cornerInset,
          thickness,
          wallType: 'internal',
        },
      ];
      await wallAPI.saveBatch(projectId, wallsPayload);
      await loadSceneData();
      if (cameraRef.current && controlsRef.current) {
        const centerX = toMeters(x0 + widthCm / 2);
        const centerZ = toMeters(y0 + heightCm / 2);
        controlsRef.current.target.set(centerX, roomCeilingHeightM / 4, centerZ);
        cameraRef.current.position.set(centerX, roomCeilingHeightM + 1.5, centerZ + 0.01);
        controlsRef.current.update();
      }
      addToast('Комната размещена на плане', 'success');
    } catch (e) {
      addToast('Не удалось автоматически разместить комнату на плане', 'error');
    }
  }, [addToast, loadSceneData, projectId, roomCeilingHeightM, sceneData.floorPlan, selectedRoom, toMeters, roomLengthCm, roomWidthCm]);

  const saveSelectedRoomGeometry = useCallback(async () => {
    if (!selectedRoom || !sceneData.floorPlan) return;
    try {
      setSavingRoomGeometry(true);
      const areaM2 = Number(selectedRoom.area || 0);
      let widthCm = Number(roomWidthCm || 0);
      let lengthCm = Number(roomLengthCm || 0);

      if (areaM2 > 0) {
        if (lastEditedRoomSide === 'width' && widthCm > 0) {
          lengthCm = (areaM2 * 10000) / widthCm;
        } else if (lastEditedRoomSide === 'length' && lengthCm > 0) {
          widthCm = (areaM2 * 10000) / lengthCm;
        } else if (widthCm > 0 && !lengthCm) {
          lengthCm = (areaM2 * 10000) / widthCm;
        } else if (lengthCm > 0 && !widthCm) {
          widthCm = (areaM2 * 10000) / lengthCm;
        }
      }

      if (!widthCm || !lengthCm || widthCm < 50 || lengthCm < 50) {
        addToast('Ширина и длина комнаты должны быть заданы и быть не меньше 0.5 м.', 'warn');
        return;
      }

      const normalizedWidthCm = Number(widthCm.toFixed(2));
      const normalizedLengthCm = Number(lengthCm.toFixed(2));
      await roomAPI.update(projectId, selectedRoom.id, {
        width: normalizedWidthCm,
        height: normalizedLengthCm,
      });
      setRoomWidthCm(normalizedWidthCm);
      setRoomLengthCm(normalizedLengthCm);
      await autoPlaceSelectedRoom(normalizedWidthCm, normalizedLengthCm);
    } catch (e) {
      addToast(e?.response?.data?.message || 'Не удалось сохранить геометрию комнаты', 'error');
    } finally {
      setSavingRoomGeometry(false);
    }
  }, [addToast, autoPlaceSelectedRoom, lastEditedRoomSide, projectId, roomLengthCm, roomWidthCm, sceneData.floorPlan, selectedRoom]);

  useEffect(() => {
    if (selectedRoom && !selectedRoomHasGeometry) {
      setShowAutoPlaceDialog(true);
    } else {
      setShowAutoPlaceDialog(false);
    }
  }, [selectedRoom, selectedRoomHasGeometry]);

  const handleConfirmAutoPlace = useCallback(async () => {
    await autoPlaceSelectedRoom();
    setShowAutoPlaceDialog(false);
  }, [autoPlaceSelectedRoom]);

  const handleCancelAutoPlace = useCallback(() => {
    setShowAutoPlaceDialog(false);
  }, []);

  const handleCanvasMouseUp = () => {
    if (dragStateRef.current.active) {
      dragStateRef.current = { active: false, nodeIndex: -1 };
      suppressClickRef.current = true;
      mouseDownPosRef.current = null;
      redrawRouteDraft();
    }
  };

  const handleCanvasMouseLeave = () => {
    handleCanvasMouseUp();
    setCursorPanel((prev) => ({ ...prev, visible: false }));
    setHoveredWallFace(null);
    setCursorContext(null);
    clearGhostPreview();
  };

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
      }
      : { ...current, pointId: null, symbolType: null };
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

  const undoLastAction = useCallback(async () => {
    if (historyRef.current.applying || historyRef.current.undo.length === 0) return;
    const action = historyRef.current.undo.pop();
    if (!action?.undo) return;
    try {
      historyRef.current.applying = true;
      await action.undo();
      historyRef.current.redo.push(action);
      if (historyRef.current.redo.length > MAX_HISTORY_SIZE) {
        historyRef.current.redo.shift();
      }
      setHistoryVersion((v) => v + 1);
      await loadSceneData();
      addToast('Действие отменено', 'info');
    } catch (e) {
      addToast(action.undoError || 'Не удалось отменить действие', 'error');
    } finally {
      historyRef.current.applying = false;
    }
  }, [MAX_HISTORY_SIZE, addToast, loadSceneData]);

  const redoLastAction = useCallback(async () => {
    if (historyRef.current.applying || historyRef.current.redo.length === 0) return;
    const action = historyRef.current.redo.pop();
    if (!action?.redo) return;
    try {
      historyRef.current.applying = true;
      await action.redo();
      historyRef.current.undo.push(action);
      if (historyRef.current.undo.length > MAX_HISTORY_SIZE) {
        historyRef.current.undo.shift();
      }
      setHistoryVersion((v) => v + 1);
      await loadSceneData();
      addToast('Действие повторено', 'info');
    } catch (e) {
      addToast(action.redoError || 'Не удалось повторить действие', 'error');
    } finally {
      historyRef.current.applying = false;
    }
  }, [MAX_HISTORY_SIZE, addToast, loadSceneData]);

  const deleteHoveredObject = useCallback(async () => {
    const hovered = hoveredObjectRef.current;
    if (!hovered) return;

    if (hovered.type === 'point') {
      const pointData = hovered.data;
      const pointId = pointData.id;
      try {
        await electricalPointAPI.delete(projectId, pointId);
        hoveredObjectRef.current = null;
        setCursorContext(null);
        pushHistoryAction({
          undo: async () => electricalPointAPI.create(projectId, {
            symbolType: pointData.symbolType,
            powerConsumption: pointData.powerConsumption,
            positionX: pointData.positionX,
            positionY: pointData.positionY,
            heightFromFloor: pointData.heightFromFloor,
            roomId: pointData.roomId,
            circuitId: pointData.circuitId,
            installationScope: pointData.installationScope || 'PLANNED',
            notes: pointData.notes,
          }),
          redo: async () => electricalPointAPI.delete(projectId, pointId),
          undoError: 'Не удалось отменить удаление точки',
          redoError: 'Не удалось повторить удаление точки',
        });
        addToast('Электрическая точка удалена', 'info');
        await loadSceneData();
      } catch (e) {
        addToast('Не удалось удалить электрическую точку', 'error');
      }
    } else if (hovered.type === 'route') {
      const routeData = hovered.data;
      const routeId = routeData.id;
      try {
        await cableRunAPI.delete(projectId, routeId);
        hoveredObjectRef.current = null;
        setCursorContext(null);
        pushHistoryAction({
          undo: async () => cableRunAPI.create(projectId, {
            circuitId: routeData.circuitId || null,
            lengthM: Number(routeData.lengthM || 0),
            installationScope: routeData.installationScope || 'PLANNED',
            pathJson: routeData.pathJson,
            notes: routeData.notes || 'Трасса 3D',
          }),
          redo: async () => cableRunAPI.delete(projectId, routeId),
          undoError: 'Не удалось отменить удаление трассы',
          redoError: 'Не удалось повторить удаление трассы',
        });
        addToast('Трасса кабеля удалена', 'info');
        await loadSceneData();
      } catch (e) {
        addToast('Не удалось удалить трассу', 'error');
      }
    } else if (hovered.type === 'opening') {
      const { wallId, wallRaw, openingIndex } = hovered.data;
      const removedOpening = (wallRaw.openings || [])[openingIndex];
      const updatedOpenings = (wallRaw.openings || [])
        .filter((_, i) => i !== openingIndex)
        .map((o) => ({
          position: Number(o.position),
          width: Number(o.width),
          height: Number(o.height || (o.openingType === 'door' ? 200 : 120)),
          openingType: o.openingType,
        }));
      try {
        await wallAPI.update(projectId, wallId, {
          startX: Number(wallRaw.startX),
          startY: Number(wallRaw.startY),
          endX: Number(wallRaw.endX),
          endY: Number(wallRaw.endY),
          thickness: Number(wallRaw.thickness || 20),
          wallType: wallRaw.wallType || 'internal',
          roomId: wallRaw.roomId,
          openings: updatedOpenings,
        });
        hoveredObjectRef.current = null;
        setCursorContext(null);
        if (removedOpening) {
          pushHistoryAction({
            undo: async () => wallAPI.update(projectId, wallId, {
              startX: Number(wallRaw.startX),
              startY: Number(wallRaw.startY),
              endX: Number(wallRaw.endX),
              endY: Number(wallRaw.endY),
              thickness: Number(wallRaw.thickness || 20),
              wallType: wallRaw.wallType || 'internal',
              roomId: wallRaw.roomId,
              openings: [...updatedOpenings, {
                position: Number(removedOpening.position),
                width: Number(removedOpening.width),
                height: Number(removedOpening.height || (removedOpening.openingType === 'door' ? 200 : 120)),
                openingType: removedOpening.openingType,
              }],
            }),
            redo: async () => wallAPI.update(projectId, wallId, {
              startX: Number(wallRaw.startX),
              startY: Number(wallRaw.startY),
              endX: Number(wallRaw.endX),
              endY: Number(wallRaw.endY),
              thickness: Number(wallRaw.thickness || 20),
              wallType: wallRaw.wallType || 'internal',
              roomId: wallRaw.roomId,
              openings: updatedOpenings,
            }),
            undoError: 'Не удалось отменить удаление проёма',
            redoError: 'Не удалось повторить удаление проёма',
          });
        }
        const label = removedOpening?.openingType === 'door' ? 'Дверь' : 'Окно';
        addToast(`${label} удалено`, 'info');
        await loadSceneData();
      } catch (e) {
        addToast('Не удалось удалить проём', 'error');
      }
    }
  }, [addToast, loadSceneData, projectId, pushHistoryAction]);

  useEffect(() => {
    const onHistoryHotkeys = (event) => {
      const targetTag = event.target?.tagName;
      const isTyping = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT' || event.target?.isContentEditable;
      if (isTyping) return;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && key === 'z') {
        event.preventDefault();
        undoLastAction();
      }
      if (((event.ctrlKey || event.metaKey) && key === 'y') || ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'z')) {
        event.preventDefault();
        redoLastAction();
      }
      if (event.key === 'Delete' && hoveredObjectRef.current) {
        event.preventDefault();
        deleteHoveredObject();
      }
      if (event.key === 'Backspace' && routeNodesRef.current.length > 0) {
        event.preventDefault();
        removeLastNode();
      }
    };
    window.addEventListener('keydown', onHistoryHotkeys);
    return () => window.removeEventListener('keydown', onHistoryHotkeys);
  }, [deleteHoveredObject, redoLastAction, removeLastNode, undoLastAction]);

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
      routeNodesRef.current = parsed.map((n) => ({
        x: toMeters(n.x),
        y: toMeters(n.y),
        z: toMeters(n.z || 0),
        pointId: n.pointId || null,
        symbolType: null,
      }));
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

  const readinessText = useMemo(() => {
    if (stats.walls === 0) {
      return 'Для точного 3D-метража сначала задайте стены и проемы в настройках проекта.';
    }
    if (stats.points === 0) {
      return 'Добавьте электрические точки (розетки, выключатели, световые точки).';
    }
    if (stats.routes === 0) {
      return 'Добавьте ручные трассы кабеля: расчет метража перейдет в точный режим.';
    }
    return 'Сцена готова к детальной трассировке и нормативным проверкам.';
  }, [stats]);

  return (
    <div className="floor-plan-3d-page">
      <header className="floor-plan-3d-header">
        <div>
          <h1>3D редактор проекта #{projectId}</h1>
          <p>Полноэкранный режим для точной трассировки кабелей по ТКП 339-2022.</p>
        </div>
        <div className="floor-plan-3d-actions">
          <button type="button" className="btn-primary" onClick={loadSceneData}>
            Обновить
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/projects/${projectId}/edit`)}>
            Настройки проекта
          </button>
          <button type="button" className="btn-secondary" onClick={() => navigate(`/projects/${projectId}`)}>
            К проекту
          </button>
          {insideRoomView && selectedRoomId && (
            <button type="button" className="btn-secondary" onClick={() => focusRoom(selectedRoomId)}>
              Выйти из комнаты
            </button>
          )}
        </div>
      </header>

      <main className="floor-plan-3d-main">
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
                <button className={tool === 'add-light' ? 'tool-btn active' : 'tool-btn'} onClick={() => setTool('add-light')}>
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
              <div className="editor-field">
                <label htmlFor="surfaceMode">Рабочая поверхность</label>
                <select id="surfaceMode" value={surfaceMode} onChange={(e) => setSurfaceMode(e.target.value)}>
                  <option value="wall">Стены</option>
                  <option value="floor">Пол</option>
                  <option value="ceiling">Потолок</option>
                </select>
              </div>
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
                  <option value="wall">По стене</option>
                  <option value="ceiling">По потолку</option>
                  <option value="floor">По полу</option>
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
                <strong>Логика разводки:</strong> 1) поставьте «Точку старта» на стене/потолке, 2) проложите трассы от неё — клик рядом со старт-точкой прицепит маршрут к ней, 3) завершите трассу у розетки или другой точки. После сохранения черновик очищается — начинайте следующую трассу сразу.
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
                Для вертикального сегмента удерживайте Shift при клике. Для плотной прокладки рядом используйте смещение линии.
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

        <section className="floor-plan-3d-canvas">
          {selectedRoom && (
            <div className="camera-mode-bar">
              <div className="camera-mode-inner">
                <span className="camera-mode-label">Режим камеры для комнаты:</span>
                <div className="camera-mode-buttons">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setCameraToFloorPlane(selectedRoom.id)}
                  >
                    Вид сверху (пол)
                  </button>
                  <div className="wall-view-dropdown">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setCameraToWallPlane(selectedRoom.id, wallViewFace)}
                    >
                      Вид по стенам
                    </button>
                    <div className="wall-view-dropdown-menu">
                      <button
                        type="button"
                        className={wallViewFace === 'north' ? 'wall-view-option active' : 'wall-view-option'}
                        onClick={() => {
                          setWallViewFace('north');
                          setCameraToWallPlane(selectedRoom.id, 'north');
                        }}
                      >
                        Северная
                      </button>
                      <button
                        type="button"
                        className={wallViewFace === 'south' ? 'wall-view-option active' : 'wall-view-option'}
                        onClick={() => {
                          setWallViewFace('south');
                          setCameraToWallPlane(selectedRoom.id, 'south');
                        }}
                      >
                        Южная
                      </button>
                      <button
                        type="button"
                        className={wallViewFace === 'west' ? 'wall-view-option active' : 'wall-view-option'}
                        onClick={() => {
                          setWallViewFace('west');
                          setCameraToWallPlane(selectedRoom.id, 'west');
                        }}
                      >
                        Западная
                      </button>
                      <button
                        type="button"
                        className={wallViewFace === 'east' ? 'wall-view-option active' : 'wall-view-option'}
                        onClick={() => {
                          setWallViewFace('east');
                          setCameraToWallPlane(selectedRoom.id, 'east');
                        }}
                      >
                        Восточная
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setCameraToCeilingPlane(selectedRoom.id)}
                  >
                    Вид по потолку
                  </button>
                </div>
              </div>
            </div>
          )}
          <div
            ref={mountRef}
            className="three-stage"
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseLeave}
            onClick={handleCanvasClick}
            role="presentation"
          />
          {cursorPanel.visible && cursorContext && (
            <div
              className={`cursor-context-panel${cursorContext.isObject ? ' cursor-context-object' : ''}`}
              style={{ left: `${cursorPanel.x}px`, top: `${cursorPanel.y}px` }}
            >
              {cursorContext.isObject ? (
                <>
                  <div className="cursor-context-title">{cursorContext.objectType}</div>
                  {cursorContext.placement && (
                    <div><span className="cc-label">Размещение: </span>{cursorContext.placement}</div>
                  )}
                  {cursorContext.heightCm != null && (
                    <div><span className="cc-label">Высота: </span>{cursorContext.heightCm} см</div>
                  )}
                  {cursorContext.roomName && (
                    <div><span className="cc-label">Комната: </span>{cursorContext.roomName}</div>
                  )}
                  {cursorContext.circuitName && (
                    <div><span className="cc-label">Цепь: </span>{cursorContext.circuitName}</div>
                  )}
                  {cursorContext.nearestWallCm != null && (
                    <div><span className="cc-label">До стены: </span>{cursorContext.nearestWallCm} см</div>
                  )}
                  {cursorContext.routeLength && (
                    <div><span className="cc-label">Длина: </span>{cursorContext.routeLength}</div>
                  )}
                  {cursorContext.routeNodeCount != null && cursorContext.routeNodeCount > 0 && (
                    <div><span className="cc-label">Узлов: </span>{cursorContext.routeNodeCount}</div>
                  )}
                  {cursorContext.notes && (
                    <div><span className="cc-label">Заметки: </span>{cursorContext.notes}</div>
                  )}
                  {tool === 'delete' && (
                    <div style={{ color: '#f87171', marginTop: '0.25rem' }}>ЛКМ / Delete — удалить</div>
                  )}
                </>
              ) : (
                <>
                  <div><span className="cc-label">Поверхность: </span>{cursorContext.surface}</div>
                  <div><span className="cc-label">Высота: </span>{cursorContext.heightCm} см</div>
                  {cursorContext.circuitName && (
                    <div><span className="cc-label">Цепь: </span>{cursorContext.circuitName}</div>
                  )}
                  {cursorContext.nearestCornerM != null && (
                    <div><span className="cc-label">До угла: </span>{cursorContext.nearestCornerM} м</div>
                  )}
                </>
              )}
            </div>
          )}
          {loading && <div className="floor-plan-3d-overlay">Загрузка 3D-сцены...</div>}
        </section>
      </main>
      {showAutoPlaceDialog && selectedRoom && !selectedRoomHasGeometry && (
        <div className="floor-plan-3d-modal-backdrop">
          <div className="floor-plan-3d-modal">
            <h2>Автоматическое размещение комнаты</h2>
            <p>
              Для комнаты <strong>{selectedRoom.name}</strong> не найден план (стены/контур на плане).
            </p>
            <p>
              Разместить комнату автоматически по указанной при создании площади? Стены будут добавлены
              как прямоугольник по центру плана.
            </p>
            <div className="floor-plan-3d-modal-actions">
              <button type="button" className="btn-secondary" onClick={handleCancelAutoPlace}>
                Отмена
              </button>
              <button type="button" className="btn-primary" onClick={handleConfirmAutoPlace}>
                Разместить комнату
              </button>
            </div>
          </div>
        </div>
      )}

      {toasts.length > 0 && (
        <div className="toast-container">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast-${t.type || 'warn'}`}>
              <span className="toast-message">{t.message}</span>
              <button
                type="button"
                className="toast-dismiss"
                onClick={() => dismissToast(t.id)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FloorPlan3D;
