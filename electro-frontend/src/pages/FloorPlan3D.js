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
  const routePointsRef = useRef([]);
  const routeNodesRef = useRef([]);
  const metaGroupRef = useRef(null);
  const wallsGroupRef = useRef(null);
  const pointsGroupRef = useRef(null);
  const routesGroupRef = useRef(null);
  const dragStateRef = useRef({ active: false, nodeIndex: -1 });
  const suppressClickRef = useRef(false);
  const historyRef = useRef({ undo: [], redo: [], applying: false });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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
  const [doorWidthCm, setDoorWidthCm] = useState(90);
  const [windowWidthCm, setWindowWidthCm] = useState(120);
  const [stats, setStats] = useState({
    rooms: 0,
    walls: 0,
    points: 0,
    routes: 0,
  });

  const toMeters = (value) => Number(value || 0) / 100;
  const toCentimeters = (value) => Number(value || 0) * 100;
  const SNAP_RADIUS_M = 0.35;
  const MIN_SEGMENT_M = 0.05;
  const ORTHOGONAL_TOLERANCE_M = 0.01;
  const WALL_INSET_M = 0.03;
  const ROOM_HEIGHT_M = DEFAULT_ROOM_HEIGHT_M;
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
    return 'Стена';
  }, []);

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
    const geometry = new THREE.BoxGeometry(widthM, heightM, depthM);
    const material = new THREE.MeshStandardMaterial({
      color: type === 'door' ? 0xf97316 : 0x60a5fa,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(point.x, yCenter, point.z);
    mesh.castShadow = true;
    metaGroupRef.current.add(mesh);
  }, [doorWidthCm, roomCeilingHeightM, toMeters, windowWidthCm]);

  const redrawScene = useCallback(() => {
    if (!sceneRef.current || !sceneData.floorPlan) return;
    clearGroup(wallsGroupRef);
    clearGroup(pointsGroupRef);
    clearGroup(routesGroupRef);
    wallHoverMeshesRef.current = [];

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
      const width = Math.max(bounds.maxX - bounds.minX, 0.2);
      const depth = Math.max(bounds.maxZ - bounds.minZ, 0.2);
      const roomMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, ROOM_HEIGHT_M, depth),
        new THREE.MeshStandardMaterial({
          color: selectedRoomId === room.id ? 0x0ea5e9 : 0x334155,
          transparent: true,
          opacity: selectedRoomId === room.id ? 0.17 : 0.08,
        })
      );
      roomMesh.position.set(bounds.minX + width / 2, ROOM_HEIGHT_M / 2, bounds.minZ + depth / 2);
      wallsGroupRef.current.add(roomMesh);

      if (selectedRoomId === room.id) {
        const floorOverlay = new THREE.Mesh(
          new THREE.PlaneGeometry(width, depth),
          new THREE.MeshBasicMaterial({
            color: surfaceMode === 'floor' ? 0x22d3ee : 0x1e293b,
            transparent: true,
            opacity: surfaceMode === 'floor' ? 0.34 : 0.14,
            side: THREE.DoubleSide,
          })
        );
        floorOverlay.rotation.x = -Math.PI / 2;
        floorOverlay.position.set(bounds.minX + width / 2, 0.015, bounds.minZ + depth / 2);
        wallsGroupRef.current.add(floorOverlay);

        const ceilingOverlay = new THREE.Mesh(
          new THREE.PlaneGeometry(width, depth),
          new THREE.MeshBasicMaterial({
            color: surfaceMode === 'ceiling' ? 0xfacc15 : 0x334155,
            transparent: true,
            opacity: surfaceMode === 'ceiling' ? 0.3 : 0.12,
            side: THREE.DoubleSide,
          })
        );
        ceilingOverlay.rotation.x = Math.PI / 2;
        ceilingOverlay.position.set(bounds.minX + width / 2, ROOM_HEIGHT_M - 0.01, bounds.minZ + depth / 2);
        wallsGroupRef.current.add(ceilingOverlay);

        const wallPlanes = [
          {
            key: 'north',
            color: hoveredWallFace === 'north' ? 0xf59e0b : (wallFaceMode === 'north' || wallFaceMode === 'auto' ? 0x60a5fa : 0x475569),
            pos: [(bounds.minX + bounds.maxX) / 2, ROOM_HEIGHT_M / 2, bounds.minZ + WALL_INSET_M],
            size: [width, ROOM_HEIGHT_M],
            rotY: Math.PI,
          },
          {
            key: 'south',
            color: hoveredWallFace === 'south' ? 0xf59e0b : (wallFaceMode === 'south' || wallFaceMode === 'auto' ? 0x818cf8 : 0x475569),
            pos: [(bounds.minX + bounds.maxX) / 2, ROOM_HEIGHT_M / 2, bounds.maxZ - WALL_INSET_M],
            size: [width, ROOM_HEIGHT_M],
            rotY: 0,
          },
          {
            key: 'west',
            color: hoveredWallFace === 'west' ? 0xf59e0b : (wallFaceMode === 'west' || wallFaceMode === 'auto' ? 0x38bdf8 : 0x475569),
            pos: [bounds.minX + WALL_INSET_M, ROOM_HEIGHT_M / 2, (bounds.minZ + bounds.maxZ) / 2],
            size: [depth, ROOM_HEIGHT_M],
            rotY: Math.PI / 2,
          },
          {
            key: 'east',
            color: hoveredWallFace === 'east' ? 0xf59e0b : (wallFaceMode === 'east' || wallFaceMode === 'auto' ? 0x0ea5e9 : 0x475569),
            pos: [bounds.maxX - WALL_INSET_M, ROOM_HEIGHT_M / 2, (bounds.minZ + bounds.maxZ) / 2],
            size: [depth, ROOM_HEIGHT_M],
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
      const material = new THREE.MeshStandardMaterial({
        color: isExternal ? 0xb7bcc4 : 0x9aa1ab,
        transparent: true,
        opacity: !selectedRoomId || wall.roomId === selectedRoomId || isExternal ? 0.96 : 0.42,
        polygonOffset: !isExternal,
        polygonOffsetFactor: !isExternal ? -1 : 0,
        polygonOffsetUnits: !isExternal ? -1 : 0,
      });
      const wallMesh = new THREE.Mesh(geometry, material);
      wallMesh.position.set((startX + endX) / 2, wallHeight / 2, (startZ + endZ) / 2);
      wallMesh.rotation.y = -Math.atan2(dz, dx);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      wallsGroupRef.current.add(wallMesh);
    });

    sceneData.points.forEach((point) => {
      const x = toMeters(point.positionX);
      const z = toMeters(point.positionY);
      const y = Math.max(toMeters(point.heightFromFloor || 30), 0.05);
      const geometry = new THREE.SphereGeometry(0.07, 20, 20);
      const material = new THREE.MeshStandardMaterial({ color: getPointColor(point) });
      const sphere = new THREE.Mesh(geometry, material);
      sphere.position.set(x, y, z);
      sphere.castShadow = true;
      pointsGroupRef.current.add(sphere);
    });

    sceneData.routes.forEach((route) => {
      if (!route.pathJson) return;
      try {
        const path = JSON.parse(route.pathJson);
        if (!Array.isArray(path) || path.length < 2) return;
        const points3D = path.map((node) => new THREE.Vector3(toMeters(node.x), toMeters(node.z || 0), toMeters(node.y)));
        const geometry = new THREE.BufferGeometry().setFromPoints(points3D);
        const material = new THREE.LineBasicMaterial({ color: 0xf43f5e, linewidth: 2 });
        const line = new THREE.Line(geometry, material);
        routesGroupRef.current.add(line);
      } catch (e) {
        // ignore malformed route json
      }
    });
  }, [ROOM_HEIGHT_M, WALL_INSET_M, getRoomBounds, hoveredWallFace, sceneData, selectedRoomId, surfaceMode, wallFaceMode]);

  const loadSceneData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const floorPlanRes = await floorPlanAPI.get(projectId).catch(async (e) => {
        if (e?.response?.status === 404) {
          return floorPlanAPI.createOrUpdate(projectId, { width: 1000, height: 800, scale: 1.0 });
        }
        throw e;
      });
      if (!floorPlanRes?.data) {
        throw new Error('План проекта не найден');
      }

      const [roomsRes, wallsRes, pointsRes, routesRes, circuitsRes, appliancesRes, reportRes, savedRes] = await Promise.all([
        roomAPI.getByProject(projectId).catch(() => ({ data: [] })),
        wallAPI.getByProject(projectId).catch(() => ({ data: [] })),
        electricalPointAPI.getByProject(projectId).catch(() => ({ data: [] })),
        cableRunAPI.getByProject(projectId).catch(() => ({ data: [] })),
        circuitAPI.getByProject(projectId).catch(() => ({ data: [] })),
        projectApplianceAPI.getByProject(projectId).catch(() => ({ data: [] })),
        calculationAPI.getReport(projectId).catch(() => ({ data: null })),
        savedSpecificationAPI.getAll(projectId).catch(() => ({ data: [] })),
      ]);

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
      setError('Не удалось загрузить данные 3D-редактора');
    } finally {
      setLoading(false);
    }
  }, [projectId, selectedCircuitId, selectedRoomId]);

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
    wallsGroupRef.current = wallsGroup;
    pointsGroupRef.current = pointsGroup;
    routesGroupRef.current = routesGroup;
    metaGroupRef.current = metaGroup;
    scene.add(wallsGroup);
    scene.add(pointsGroup);
    scene.add(routesGroup);
    scene.add(metaGroup);

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
    redrawScene();
  }, [redrawScene]);

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
    routeHandleMeshesRef.current.forEach((mesh) => {
      if (mesh.geometry) mesh.geometry.dispose();
      if (mesh.material) mesh.material.dispose();
      routesGroupRef.current.remove(mesh);
    });
    routeHandleMeshesRef.current = [];
    setRoutePointCount(routePointsRef.current.length);
    if (routePointsRef.current.length < 2) return;
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

    routePointsRef.current.forEach((p, idx) => {
      const handleGeometry = new THREE.SphereGeometry(0.08, 16, 16);
      const selected = dragStateRef.current.active && dragStateRef.current.nodeIndex === idx;
      const handleMaterial = new THREE.MeshStandardMaterial({ color: selected ? 0xf97316 : 0x22d3ee });
      const handle = new THREE.Mesh(handleGeometry, handleMaterial);
      handle.position.copy(p);
      handle.userData = { routeHandleIndex: idx };
      routesGroupRef.current.add(handle);
      routeHandleMeshesRef.current.push(handle);
    });
  }, []);

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
    const y = Math.min(Math.max(heightM, 0.05), ROOM_HEIGHT_M - 0.02);
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
  }, [ROOM_HEIGHT_M, WALL_INSET_M, parallelOffsetCm, toMeters, wallFaceMode]);

  const selectedRoom = useMemo(
    () => sceneData.rooms.find((room) => room.id === selectedRoomId) || null,
    [sceneData.rooms, selectedRoomId]
  );

  const selectedRoomBounds = useMemo(
    () => getRoomBounds(selectedRoom, sceneData.walls),
    [getRoomBounds, sceneData.walls, selectedRoom]
  );

  const snapPointToSurface = useCallback((point, preferredHeightCm = pointHeight) => {
    if (!point || !selectedRoomBounds) return null;
    const clampedX = Math.min(Math.max(point.x, selectedRoomBounds.minX + WALL_INSET_M), selectedRoomBounds.maxX - WALL_INSET_M);
    const clampedZ = Math.min(Math.max(point.z, selectedRoomBounds.minZ + WALL_INSET_M), selectedRoomBounds.maxZ - WALL_INSET_M);
    if (surfaceMode === 'floor') {
      return new THREE.Vector3(clampedX, 0.05, clampedZ);
    }
    if (surfaceMode === 'ceiling') {
      return new THREE.Vector3(clampedX, ROOM_HEIGHT_M - 0.05, clampedZ);
    }
    return getWallSnapPointFromBounds(new THREE.Vector3(clampedX, 0, clampedZ), selectedRoomBounds, Math.max(toMeters(preferredHeightCm), 0.05));
  }, [ROOM_HEIGHT_M, WALL_INSET_M, getWallSnapPointFromBounds, pointHeight, selectedRoomBounds, surfaceMode, toMeters]);

  const selectedRoomPoints = useMemo(
    () => (selectedRoomId ? sceneData.points.filter((point) => point.roomId === selectedRoomId) : []),
    [sceneData.points, selectedRoomId]
  );

  const ensureRoomEditingAllowed = useCallback(() => {
    if (!selectedRoomId) {
      setError('Сначала выберите комнату в левой панели.');
      return false;
    }
    if (!selectedRoomBounds) {
      setError('У выбранной комнаты не задана геометрия. Укажите размеры и сохраните.');
      return false;
    }
    return true;
  }, [selectedRoomBounds, selectedRoomId]);

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
    if (dx > dz) {
      return new THREE.Vector3(nextPoint.x, prev.y, prev.z);
    }
    return new THREE.Vector3(prev.x, prev.y, nextPoint.z);
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
        messages.push('Начало трассы должно быть привязано к электрической точке.');
      }
      if (!end.pointId) {
        messages.push('Конец трассы должен быть привязан к электрической точке.');
      }
      if ((start.symbolType === 'switch' && end.symbolType === 'outlet')
        || (start.symbolType === 'outlet' && end.symbolType === 'switch')) {
        messages.push('Прямая трасса между выключателем и розеткой запрещена.');
      }
      if (start.symbolType === 'switch' && end.symbolType === 'switch') {
        messages.push('Трасса не может начинаться и заканчиваться на выключателе.');
      }
      if (start.pointId && end.pointId && !selectedCircuitId) {
        messages.push('Выберите электрическую цепь для трассы между привязанными точками.');
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

    return messages.length === 0;
  }, [getRouteModeHeight, isPointInsideBounds, routePlacementMode, sceneData.points, selectedCircuitId, selectedRoomBounds, selectedRoomId]);

  const handleCanvasClick = async (event) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    if (loading || error) return;
    const point = getGroundIntersection(event);
    if (!point) return;

    const roomBoundedTools = ['add-source', 'add-outlet', 'add-switch', 'add-light', 'draw-route', 'add-door', 'add-window'];
    if (roomBoundedTools.includes(tool)) {
      if (!ensureRoomEditingAllowed()) return;
      if (!isPointInsideBounds(point, selectedRoomBounds)) {
        setError('Работа возможна только внутри выбранной комнаты. Для другой комнаты сначала переключитесь на нее.');
        return;
      }
    }

    if (tool === 'add-source' || tool === 'add-outlet' || tool === 'add-switch' || tool === 'add-light') {
      if (tool === 'add-switch' && (pointHeight < 80 || pointHeight > 170)) {
        setError('ТКП 8.5.9: выключатель должен располагаться на высоте 0.8-1.7 м.');
        return;
      }
      if (tool === 'add-outlet' && isWetRoom(selectedRoomId)) {
        if (!selectedCircuit || !selectedCircuit.rcdRatingMa || Number(selectedCircuit.rcdRatingMa) > 30) {
          setError('ТКП 8.5.6 и 8.7.4: для розетки в мокрой зоне выберите цепь с УЗО <= 30 мА.');
          return;
        }
      }
      const symbolType = tool === 'add-outlet'
        ? 'outlet'
        : tool === 'add-switch'
          ? 'switch'
          : 'light';
      try {
        const snappedSurfacePoint = snapPointToSurface(point, pointHeight);
        if (!snappedSurfacePoint || !isPointInsideBounds(snappedSurfacePoint, selectedRoomBounds)) {
          setError('Не удалось привязать точку к выбранной поверхности комнаты.');
          return;
        }
        const payload = {
          symbolType,
          powerConsumption: tool === 'add-source' ? 10 : symbolType === 'light' ? 120 : 2200,
          positionX: Number(toCentimeters(snappedSurfacePoint.x).toFixed(2)),
          positionY: Number(toCentimeters(snappedSurfacePoint.z).toFixed(2)),
          heightFromFloor: Number(
            tool === 'add-source'
              ? (surfaceMode === 'ceiling' ? 260 : surfaceMode === 'floor' ? 20 : Math.max(pointHeight, 120))
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
      } catch (e) {
        setError('Не удалось добавить электрическую точку');
      }
      return;
    }

    if (tool === 'add-door' || tool === 'add-window') {
      const candidate = getGroundIntersection(event);
      if (!candidate) return;
      const snapped = getWallSnapPointFromBounds(candidate, selectedRoomBounds, tool === 'add-door' ? 1 : 1.2);
      if (!isPointInsideBounds(snapped, selectedRoomBounds)) return;
      addOpeningMesh(snapped, tool === 'add-door' ? 'door' : 'window');
      return;
    }

    if (tool === 'draw-route') {
      let snapped = snapPointToSurface(point, getRouteModeHeight());
      if (!snapped) return;
      if (!isPointInsideBounds(snapped, selectedRoomBounds)) {
        setError('Узел трассы должен находиться в пределах выбранной комнаты.');
        return;
      }
      const snappedPointResult = findNearestExistingPoint(snapped, selectedRoomPoints);
      snapped = snappedPointResult.point;
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

    const hoveredFace = surfaceMode === 'wall' ? getPointerWallFace(event) : null;
    if (hoveredFace !== hoveredWallFace) {
      setHoveredWallFace(hoveredFace);
    }

    const groundHit = getGroundIntersection(event);
    if (groundHit && selectedRoomBounds) {
      const contextPoint = snapPointToSurface(groundHit, surfaceMode === 'wall' ? routeHeight : pointHeight);
      if (contextPoint) {
        const nearestCornerM = getDistanceToNearestCorner(contextPoint, selectedRoomBounds);
        let surfaceLabel = 'Пол';
        if (surfaceMode === 'ceiling') {
          surfaceLabel = 'Потолок';
        } else if (surfaceMode === 'wall') {
          if (hoveredFace) {
            surfaceLabel = getWallFaceLabel(hoveredFace);
          } else if (wallFaceMode !== 'auto') {
            surfaceLabel = getWallFaceLabel(wallFaceMode);
          } else {
            surfaceLabel = 'Стена (авто)';
          }
        }
        setCursorContext({
          surface: surfaceLabel,
          heightCm: Number(toCentimeters(contextPoint.y).toFixed(0)),
          nearestCornerM,
          circuitName: selectedCircuit?.name || 'Без цепи',
        });
      }
    } else {
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
    setSelectedRoomId(roomId);
    if (!bounds || !cameraRef.current || !controlsRef.current) return;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    controlsRef.current.target.set(centerX, ROOM_HEIGHT_M / 3, centerZ);
    cameraRef.current.position.set(centerX + 3.6, ROOM_HEIGHT_M + 2.8, centerZ + 3.6);
    controlsRef.current.update();
    setInsideRoomView(false);
  }, [ROOM_HEIGHT_M, getRoomBounds, sceneData.rooms, sceneData.walls]);

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
    setSelectedRoomId(roomId);
    if (!bounds || !cameraRef.current || !controlsRef.current) return;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    controlsRef.current.target.set(centerX, 0, centerZ);
    cameraRef.current.position.set(centerX, ROOM_HEIGHT_M + 3, centerZ + 0.01);
    controlsRef.current.update();
    setInsideRoomView(false);
    setSurfaceMode('floor');
    setRoutePlacementMode('floor');
    setRouteHeight((prev) => (prev || 10));
  }, [ROOM_HEIGHT_M, getRoomBounds, sceneData.rooms, sceneData.walls]);

  const setCameraToWallPlane = useCallback((roomId) => {
    enterRoom(roomId);
    setSurfaceMode('wall');
    setRoutePlacementMode('wall');
    setRouteHeight((prev) => (prev || 120));
  }, [enterRoom]);

  const setCameraToCeilingPlane = useCallback((roomId) => {
    const room = sceneData.rooms.find((r) => r.id === roomId);
    const bounds = getRoomBounds(room, sceneData.walls);
    setSelectedRoomId(roomId);
    if (!bounds || !cameraRef.current || !controlsRef.current) return;
    const centerX = (bounds.minX + bounds.maxX) / 2;
    const centerZ = (bounds.minZ + bounds.maxZ) / 2;
    controlsRef.current.target.set(centerX, ROOM_HEIGHT_M - 0.2, centerZ);
    cameraRef.current.position.set(centerX + 0.01, ROOM_HEIGHT_M + 1.2, centerZ + 0.6);
    controlsRef.current.update();
    setInsideRoomView(false);
    setSurfaceMode('ceiling');
    setRoutePlacementMode('ceiling');
    setRouteHeight((prev) => (prev || 260));
  }, [ROOM_HEIGHT_M, getRoomBounds, sceneData.rooms, sceneData.walls]);

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

  useEffect(() => {
    const onKeyDown = (event) => {
      const targetTag = event.target?.tagName;
      const isTyping = targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT' || event.target?.isContentEditable;
      if (isTyping) return;
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
  }, []);

  const saveCurrent3DCalculation = async () => {
    try {
      const name = saveCalcName.trim() || `3D расчет ${new Date().toLocaleString('ru-RU')}`;
      await savedSpecificationAPI.save(projectId, { name, projectId: Number(projectId) });
      setSaveCalcName('');
      await loadSceneData();
      setError('');
    } catch (e) {
      setError(e?.response?.data?.message || 'Не удалось сохранить текущий 3D расчет');
    }
  };

  const openSaved3DCalculation = async (savedId) => {
    try {
      const response = await savedSpecificationAPI.getById(projectId, savedId, true);
      setSelectedSavedCalcId(savedId);
      setSelectedSavedCalcDetails(response.data || null);
      setError('');
    } catch (e) {
      setError('Не удалось открыть сохраненный 3D расчет');
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
    setRoomCeilingHeightM(DEFAULT_ROOM_HEIGHT_M);
  }, [selectedRoom]);

  const roomPlan = roomPlanData[selectedRoomId] || { plannedOutlets: 0, plannedSwitches: 0, plannedLights: 0, cableReserveM: 0 };
  const getRoomName = useCallback((roomId) => (
    sceneData.rooms.find((room) => room.id === roomId)?.name?.toLowerCase() || ''
  ), [sceneData.rooms]);
  const isWetRoom = useCallback((roomId) => {
    const name = getRoomName(roomId);
    return name.includes('ван') || name.includes('душ') || name.includes('сануз') || name.includes('саун');
  }, [getRoomName]);
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
    }

    if (tool === 'add-switch' && (pointHeight < 80 || pointHeight > 170)) {
      stage2Errors.push('Высота выключателя должна быть в диапазоне 0.8-1.7 м от пола (ТКП 8.5.9).');
    }

    return {
      stage1Errors,
      stage2Errors,
      stage3Warnings,
      isValid: stage1Errors.length === 0 && stage2Errors.length === 0,
    };
  }, [isWetRoom, pointHeight, selectedCircuit, selectedRoom, selectedRoomId, tool]);

  const autoPlaceSelectedRoom = useCallback(async () => {
    if (!selectedRoom || !sceneData.floorPlan) {
      return;
    }
    try {
      let widthCm = Number(roomWidthCm || 0);
      let heightCm = Number(roomLengthCm || 0);
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
        setError('Укажите ширину и длину комнаты в панели 3D-редактора или задайте площадь комнаты.');
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
      setError('');
    } catch (e) {
      setError('Не удалось автоматически разместить комнату на плане');
    }
  }, [loadSceneData, projectId, roomCeilingHeightM, sceneData.floorPlan, selectedRoom, toMeters, roomLengthCm, roomWidthCm]);

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
    if (!dragStateRef.current.active) return;
    dragStateRef.current = { active: false, nodeIndex: -1 };
    suppressClickRef.current = true;
    redrawRouteDraft();
  };

  const handleCanvasMouseLeave = () => {
    handleCanvasMouseUp();
    setCursorPanel((prev) => ({ ...prev, visible: false }));
    setHoveredWallFace(null);
    setCursorContext(null);
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
      setError('');
      await loadSceneData();
    } catch (e) {
      setError(action.undoError || 'Не удалось отменить действие');
    } finally {
      historyRef.current.applying = false;
    }
  }, [MAX_HISTORY_SIZE, loadSceneData]);

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
      setError('');
      await loadSceneData();
    } catch (e) {
      setError(action.redoError || 'Не удалось повторить действие');
    } finally {
      historyRef.current.applying = false;
    }
  }, [MAX_HISTORY_SIZE, loadSceneData]);

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
    };
    window.addEventListener('keydown', onHistoryHotkeys);
    return () => window.removeEventListener('keydown', onHistoryHotkeys);
  }, [redoLastAction, undoLastAction]);

  const saveRoute = async () => {
    if (routePointsRef.current.length < 2) return;
    if (!validateRouteDraft()) {
      setError('Черновик трассы не прошел валидацию. Проверьте подсказки в левой панели.');
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
      clearRouteDraft();
      setNewRouteName('');
      setError('');
      await loadSceneData();
    } catch (e) {
      setError(e?.response?.data?.message || 'Не удалось сохранить трассу кабеля');
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
      setError('Не удалось загрузить трассу для редактирования');
    }
  };

  const overwriteSelectedRoute = async () => {
    if (!selectedRouteId) return;
    if (!validateRouteDraft()) {
      setError('Черновик трассы не прошел валидацию.');
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
      setError('');
      await loadSceneData();
      clearRouteDraft();
    } catch (e) {
      setError(e?.response?.data?.message || 'Не удалось обновить трассу');
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
      setError('');
    } catch (e) {
      setError('Не удалось удалить трассу');
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
                      if (!val) {
                        setRoomWidthCm(null);
                        return;
                      }
                      const cm = val * 100;
                      setRoomWidthCm(cm);
                      const areaM2 = Number(selectedRoom.area || 0);
                      if (areaM2 > 0 && (!roomLengthCm || roomLengthCm <= 0)) {
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
                      if (!val) {
                        setRoomLengthCm(null);
                        return;
                      }
                      const cm = val * 100;
                      setRoomLengthCm(cm);
                      const areaM2 = Number(selectedRoom.area || 0);
                      if (areaM2 > 0 && (!roomWidthCm || roomWidthCm <= 0)) {
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
                      setRoomCeilingHeightM(val > 0 ? val : ROOM_HEIGHT_M);
                    }}
                  />
                </div>
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
              </div>
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
                Логика разводки: 1) поставьте "Точку старта линии" на стене/потолке, 2) проложите трассы от нее, 3) на концах трасс ставьте розетки.
              </div>

              <div className="route-actions">
                <button type="button" className="btn-primary" onClick={saveRoute} disabled={routePointCount < 2 || routeValidationMessages.length > 0}>
                  Сохранить трассу
                </button>
                <button type="button" className="btn-primary" onClick={overwriteSelectedRoute} disabled={!selectedRouteId || routePointCount < 2 || routeValidationMessages.length > 0}>
                  Обновить выбранную
                </button>
                <button type="button" className="btn-secondary" onClick={clearRouteDraft}>
                  Очистить черновик
                </button>
                <button type="button" className="btn-secondary" onClick={deleteSelectedRoute} disabled={!selectedRouteId}>
                  Удалить выбранную
                </button>
              </div>

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
              {routeValidationMessages.length > 0 && (
                <div className="floor-plan-3d-tip floor-plan-3d-error">
                  <ul className="validation-list">
                    {routeValidationMessages.map((msg) => (
                      <li key={msg}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}
              {error && <div className="floor-plan-3d-tip floor-plan-3d-error">{error}</div>}
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
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setCameraToWallPlane(selectedRoom.id)}
                  >
                    Вид по стенам
                  </button>
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
              className="cursor-context-panel"
              style={{ left: `${cursorPanel.x}px`, top: `${cursorPanel.y}px` }}
            >
              <div>Поверхность: {cursorContext.surface}</div>
              <div>Высота: {cursorContext.heightCm} см</div>
              <div>Цепь: {cursorContext.circuitName}</div>
              <div>До угла: {cursorContext.nearestCornerM ?? '-'} м</div>
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
    </div>
  );
};

export default FloorPlan3D;
