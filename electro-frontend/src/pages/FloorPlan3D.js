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
import FloorPlan3DSidebar from './FloorPlan3DSidebar';
import { useFloorPlanHistory } from './floorPlan3D/useFloorPlanHistory';
import { useRouteDraft } from './floorPlan3D/useRouteDraft';
import {
  DEFAULT_ROOM_HEIGHT_M,
  buildGhostGroup,
  buildPointGroup,
  buildDoorGroup,
  buildWindowGroup,
  isSourcePointByNotes,
} from './floorPlan3D/builders3D';
import {
  ROUTE_EQUIPMENT_PLANAR_SNAP_RADIUS_M,
  ROUTE_EQUIPMENT_RAY_HIT_RADIUS_M,
  inferRouteSurfaceKindFromHeightM,
} from './floorPlan3D/routeConstants';
import { expandSurfaceRouteSegment } from './floorPlan3D/surfaceRoutePolyline';
import { orientElectricalPointGroup } from './floorPlan3D/electricalPointOrientation';
import './FloorPlan3D.css';

const FloorPlan3D = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const frameRef = useRef(null);
  const wallHoverMeshesRef = useRef([]);
  const pointHoverMeshesRef = useRef([]);
  const routeHoverLinesRef = useRef([]);
  const routeHitMeshesRef = useRef([]);
  const hoveredRouteLineRef = useRef(null);
  const openingHoverMeshesRef = useRef([]);
  const metaGroupRef = useRef(null);
  const wallsGroupRef = useRef(null);
  const ghostGroupRef = useRef(null);
  const pointsGroupRef = useRef(null);
  const routesGroupRef = useRef(null);
  const suppressClickRef = useRef(false);
  const hoveredObjectRef = useRef(null);
  const mouseDownPosRef = useRef(null);

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
  const [circuits, setCircuits] = useState([]);
  const [selectedCircuitId, setSelectedCircuitId] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState(null);
  const [surfaceMode, setSurfaceMode] = useState('any');
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
  const WALL_INSET_M = 0.03;
  const ROOM_HEIGHT_M = DEFAULT_ROOM_HEIGHT_M;
  const activeRoomHeightM = selectedRoomId ? roomCeilingHeightM : ROOM_HEIGHT_M;

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

  const updateGhostPreview = useCallback((toolType, position, bounds, roomHeightM) => {
    clearGhostPreview();
    const g = ghostGroupRef.current;
    if (!g || !position) return;
    const ghost = buildGhostGroup(toolType);
    if (bounds && roomHeightM != null) {
      orientElectricalPointGroup(ghost, position.x, position.y, position.z, bounds, roomHeightM, WALL_INSET_M);
    } else {
      ghost.position.copy(position);
    }
    g.add(ghost);
  }, [clearGhostPreview]);

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
            color: floorHovered ? 0xf59e0b : (surfaceMode === 'floor' || surfaceMode === 'any' ? 0x22d3ee : 0x1e293b),
            transparent: true,
            opacity: floorHovered ? 0.42 : (surfaceMode === 'floor' ? 0.34 : surfaceMode === 'any' ? 0.28 : 0.14),
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
            color: ceilingHovered ? 0xf59e0b : (surfaceMode === 'ceiling' || surfaceMode === 'any' ? 0xfacc15 : 0x334155),
            transparent: true,
            opacity: ceilingHovered ? 0.42 : (surfaceMode === 'ceiling' ? 0.3 : surfaceMode === 'any' ? 0.24 : 0.12),
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
              opacity: hoveredWallFace === wallPlane.key ? 0.38 : (surfaceMode === 'wall' || surfaceMode === 'any' ? 0.2 : 0.1),
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
      if (selectedRoomId != null && String(point.roomId) !== String(selectedRoomId)) return;
      const x = toMeters(point.positionX);
      const z = toMeters(point.positionY);
      const y = Math.max(toMeters(point.heightFromFloor || 30), 0.05);

      const group = buildPointGroup(point);

      const pRoom = sceneData.rooms.find((r) => r.id === point.roomId);
      const pBounds = getRoomBounds(pRoom);
      const roomHForPoint = pRoom
        ? (roomHeightById[pRoom.id] || (pRoom.id === selectedRoomId ? roomCeilingHeightM : ROOM_HEIGHT_M))
        : ROOM_HEIGHT_M;
      if (pBounds) {
        orientElectricalPointGroup(group, x, y, z, pBounds, roomHForPoint, WALL_INSET_M);
      } else {
        group.position.set(x, y, z);
      }

      group.castShadow = true;
      group.traverse((child) => { if (child.isMesh) child.castShadow = true; });

      const hitGeo = new THREE.SphereGeometry(ROUTE_EQUIPMENT_RAY_HIT_RADIUS_M, 8, 8);
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

  const {
    pushHistoryAction,
    undoLastAction,
    redoLastAction,
    canUndo,
    canRedo,
  } = useFloorPlanHistory({ loadSceneData, addToast });

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

  /** Только вертикальные грани комнаты (без оверлеев пола/потолка) — для режима «Стены». */
  const getPointerVerticalWallHit = useCallback((event) => {
    if (!rendererRef.current || !cameraRef.current || wallHoverMeshesRef.current.length === 0) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const intersects = raycaster.intersectObjects(wallHoverMeshesRef.current, false);
    const wallFaces = ['north', 'south', 'east', 'west'];
    const hit = intersects.find((h) => wallFaces.includes(h.object?.userData?.wallFace));
    if (!hit) return null;
    return {
      point: hit.point,
      wallFace: hit.object?.userData?.wallFace || null,
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

  /**
   * Грань под курсором для трассы: ближайшее пересечение луча (меши комнаты + плоскости пола/потолка).
   * Не зависит от «Рабочая поверхность» — только от геометрии луча (согласование с pickRouteSurfaceAlongRay).
   */
  const getRoutePointerHoverFace = useCallback((event) => {
    if (!rendererRef.current || !cameraRef.current || !selectedRoomBounds) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const ray = raycaster.ray;
    const floorY = 0.05;
    const ceilY = Math.max(activeRoomHeightM, 0.2) - 0.05;
    const clampXZ = (x, z) => ({
      x: Math.min(Math.max(x, selectedRoomBounds.minX + WALL_INSET_M), selectedRoomBounds.maxX - WALL_INSET_M),
      z: Math.min(Math.max(z, selectedRoomBounds.minZ + WALL_INSET_M), selectedRoomBounds.maxZ - WALL_INSET_M),
    });
    const candidates = [];
    if (wallHoverMeshesRef.current.length > 0) {
      const hits = raycaster.intersectObjects(wallHoverMeshesRef.current, false);
      if (hits.length > 0) {
        const wf = hits[0].object?.userData?.wallFace;
        if (wf) candidates.push({ face: wf, dist: hits[0].distance });
      }
    }
    const fp = new THREE.Vector3();
    const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
    if (ray.intersectPlane(floorPlane, fp)) {
      const c = clampXZ(fp.x, fp.z);
      const pt = new THREE.Vector3(c.x, floorY, c.z);
      if (isPointInsideBounds(pt, selectedRoomBounds)) {
        candidates.push({ face: 'floor', dist: ray.origin.distanceTo(pt) });
      }
    }
    const cp = new THREE.Vector3();
    const ceilPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ceilY);
    if (ray.intersectPlane(ceilPlane, cp)) {
      const c = clampXZ(cp.x, cp.z);
      const pt = new THREE.Vector3(c.x, ceilY, c.z);
      if (isPointInsideBounds(pt, selectedRoomBounds)) {
        candidates.push({ face: 'ceiling', dist: ray.origin.distanceTo(pt) });
      }
    }
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => a.dist - b.dist);
    return candidates[0].face;
  }, [activeRoomHeightM, isPointInsideBounds, selectedRoomBounds, WALL_INSET_M]);

  /**
   * Режим «Все поверхности»: сначала явное попадание в меш пола/потолка/стены (как при «Стены»),
   * иначе ближайшая грань из getRoutePointerHoverFace (меши + плоскости).
   */
  const resolveAnyModePointer = useCallback((event) => {
    const hf = getPointerWallFace(event);
    const rf = getRoutePointerHoverFace(event);
    if (hf === 'floor' || hf === 'ceiling') {
      return { kind: hf, faceForUi: hf };
    }
    if (rf === 'floor' || rf === 'ceiling') {
      return { kind: rf, faceForUi: rf };
    }
    const wallFace = hf && ['north', 'south', 'east', 'west'].includes(hf)
      ? hf
      : (rf && ['north', 'south', 'east', 'west'].includes(rf) ? rf : hf ?? rf);
    return { kind: 'wall', faceForUi: wallFace || 'north' };
  }, [getPointerWallFace, getRoutePointerHoverFace]);

  const routeDraftApi = useRouteDraft({
    projectId,
    routesGroupRef,
    rendererRef,
    cameraRef,
    sceneData,
    selectedCircuitId,
    setSelectedCircuitId,
    selectedRoomId,
    selectedRoomBounds,
    activeRoomHeightM,
    pushHistoryAction,
    loadSceneData,
    addToast,
    toMeters,
    toCentimeters,
    setStats,
    isPointInsideBounds,
  });

  const {
    routePointsRef,
    routeNodesRef,
    routeHandleMeshesRef,
    dragStateRef,
    newRouteName,
    setNewRouteName,
    routeDraftLength,
    routePointCount,
    routeValidationMessages,
    selectedRouteId,
    routeHeight,
    setRouteHeight,
    routePlacementMode,
    setRoutePlacementMode,
    getRouteModeWarning,
    getRouteModeHeight,
    redrawRouteDraft,
    validateRouteDraft,
    clearRouteDraft,
    updateNodeAtIndex,
    insertNodeAfter,
    removeNodeAt,
    removeLastNode,
    saveRoute,
    loadRouteToDraft,
    overwriteSelectedRoute,
    deleteSelectedRoute,
    pickRouteHandleIndex,
  } = routeDraftApi;

  /** Прямое попадание луча в невидимую сферу электрической точки — надёжнее привязки только по расстоянию на плане. */
  const snapRouteNodeFromElectricalRay = (event) => {
    if (!rendererRef.current || !cameraRef.current || pointHoverMeshesRef.current.length === 0) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const hits = raycaster.intersectObjects(pointHoverMeshesRef.current, false);
    if (!hits.length) return null;
    const pointData = hits[0].object?.userData?.pointData;
    if (!pointData) return null;
    const px = toMeters(pointData.positionX);
    const pz = toMeters(pointData.positionY);
    const py = Math.max(toMeters(pointData.heightFromFloor || routeHeight), 0.05);
    return {
      point: new THREE.Vector3(px, py, pz),
      pointId: pointData.id,
      symbolType: pointData?.electricalSymbol?.type || '',
    };
  };

  const findNearestExistingPoint = (
    candidate,
    pointsForSnap = sceneData.points,
    maxRadiusM = ROUTE_EQUIPMENT_PLANAR_SNAP_RADIUS_M,
  ) => {
    let nearest = null;
    let minDistance = Number.POSITIVE_INFINITY;
    pointsForSnap.forEach((point) => {
      const px = toMeters(point.positionX);
      const pz = toMeters(point.positionY);
      const py = Math.max(toMeters(point.heightFromFloor || routeHeight), 0.05);
      /* По плану (X/Z): клик по стене часто не совпадает по Y с высотой прибора — оконцевание задаём по координатам точки (ТКП: в корпусе изделия). */
      const distance = Math.hypot(candidate.x - px, candidate.z - pz);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = {
          x: px,
          z: pz,
          y: py,
          pointId: point.id,
          symbolType: point?.electricalSymbol?.type || '',
        };
      }
    });
    if (!nearest || minDistance > maxRadiusM) {
      return { point: candidate, pointId: null, symbolType: null };
    }
    return {
      point: new THREE.Vector3(nearest.x, nearest.y, nearest.z),
      pointId: nearest.pointId,
      symbolType: nearest.symbolType,
    };
  };

  /** Превью трассы: только луч в символ — без «магнита» по плану. */
  const snapRouteEquipmentForPreview = (event, surfaceFallbackPoint) => {
    const ray = snapRouteNodeFromElectricalRay(event);
    if (ray?.pointId) return ray;
    return { point: surfaceFallbackPoint.clone(), pointId: null, symbolType: null };
  };

  useEffect(() => {
    redrawScene();
    redrawRouteDraft();
  }, [redrawRouteDraft, redrawScene]);

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
    let surface = effectiveSurface;
    if (surface === 'any' || surface == null) {
      if (point.y <= 0.12) surface = 'floor';
      else if (point.y >= activeRoomHeightM - 0.15) surface = 'ceiling';
      else surface = 'wall';
    }
    const clampedX = Math.min(Math.max(point.x, selectedRoomBounds.minX + WALL_INSET_M), selectedRoomBounds.maxX - WALL_INSET_M);
    const clampedZ = Math.min(Math.max(point.z, selectedRoomBounds.minZ + WALL_INSET_M), selectedRoomBounds.maxZ - WALL_INSET_M);
    if (surface === 'floor') {
      return new THREE.Vector3(clampedX, 0.05, clampedZ);
    }
    if (surface === 'ceiling') {
      return new THREE.Vector3(clampedX, activeRoomHeightM - 0.05, clampedZ);
    }
    return getWallSnapPointFromBounds(new THREE.Vector3(clampedX, 0, clampedZ), selectedRoomBounds, Math.max(toMeters(preferredHeightCm), 0.05));
  }, [WALL_INSET_M, activeRoomHeightM, getWallSnapPointFromBounds, pointHeight, selectedRoomBounds, surfaceMode, toMeters]);

  /** Высота установки на стене по вертикали попадания луча (см), а не по полю «Высота точки». */
  const getWallSnapPreferredHeightCm = useCallback((basePoint) => {
    if (!basePoint) return pointHeight;
    const yM = Math.min(Math.max(basePoint.y, 0.05), activeRoomHeightM - 0.02);
    return Math.round(toCentimeters(yM));
  }, [activeRoomHeightM, pointHeight, toCentimeters]);

  /**
   * Узел трассы — только на грани комнаты: луч к ближайшему попаданию (стена | пол | потолок) или срез у стены по базовой высоте.
   * modeFilter: auto — все варианты; иначе только выбранная поверхность.
   * pickContext: в режиме auto при согласованном наведении сужаем кандидатов (та же грань или явный переход стена↔пол/потолок по подсветке грани).
   */
  const pickRouteSurfaceAlongRay = useCallback((event, modeFilter = 'auto', pickContext = {}) => {
    if (!rendererRef.current || !cameraRef.current || !selectedRoomBounds || !sceneData.floorPlan) return null;
    const rect = rendererRef.current.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    const ray = raycaster.ray;

    const allow = (kind) => modeFilter === 'auto' || modeFilter === kind;

    const candidates = [];
    const floorY = 0.05;
    const ceilY = Math.max(activeRoomHeightM, 0.2) - 0.05;

    const clampXZ = (x, z) => ({
      x: Math.min(Math.max(x, selectedRoomBounds.minX + WALL_INSET_M), selectedRoomBounds.maxX - WALL_INSET_M),
      z: Math.min(Math.max(z, selectedRoomBounds.minZ + WALL_INSET_M), selectedRoomBounds.maxZ - WALL_INSET_M),
    });

    if (wallHoverMeshesRef.current.length > 0) {
      const hits = raycaster.intersectObjects(wallHoverMeshesRef.current, false);
      if (hits.length > 0) {
        const h = hits[0];
        const p = h.point.clone();
        if (isPointInsideBounds(p, selectedRoomBounds)) {
          const faceTag = h.object?.userData?.wallFace;
          const yClamped = Math.min(Math.max(p.y, floorY + 0.02), activeRoomHeightM - 0.02);
          const c = clampXZ(p.x, p.z);
          if (faceTag === 'floor' && allow('floor')) {
            candidates.push({ kind: 'floor', dist: h.distance, point: new THREE.Vector3(c.x, floorY, c.z) });
          } else if (faceTag === 'ceiling' && allow('ceiling')) {
            candidates.push({ kind: 'ceiling', dist: h.distance, point: new THREE.Vector3(c.x, ceilY, c.z) });
          } else if (faceTag && !['floor', 'ceiling'].includes(faceTag) && allow('wall')) {
            const wallSnapped = getWallSnapPointFromBounds(
              new THREE.Vector3(p.x, 0, p.z),
              selectedRoomBounds,
              yClamped,
            );
            candidates.push({ kind: 'wall', dist: h.distance, point: wallSnapped });
          }
        }
      }
    }

    if (allow('floor')) {
      const fp = new THREE.Vector3();
      const floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -floorY);
      if (ray.intersectPlane(floorPlane, fp)) {
        const c = clampXZ(fp.x, fp.z);
        const pt = new THREE.Vector3(c.x, floorY, c.z);
        if (isPointInsideBounds(pt, selectedRoomBounds)) {
          candidates.push({ kind: 'floor', dist: ray.origin.distanceTo(pt), point: pt });
        }
      }
    }

    if (allow('ceiling')) {
      const cp = new THREE.Vector3();
      const ceilPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ceilY);
      if (ray.intersectPlane(ceilPlane, cp)) {
        const c = clampXZ(cp.x, cp.z);
        const pt = new THREE.Vector3(c.x, ceilY, c.z);
        if (isPointInsideBounds(pt, selectedRoomBounds)) {
          candidates.push({ kind: 'ceiling', dist: ray.origin.distanceTo(pt), point: pt });
        }
      }
    }

    if (allow('wall')) {
      const routeH = Math.max(toMeters(getRouteModeHeight()), 0.05);
      const slice = new THREE.Vector3();
      const slicePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -routeH);
      if (ray.intersectPlane(slicePlane, slice) && isPointInsideBounds(slice, selectedRoomBounds)) {
        const wallSnapped = getWallSnapPointFromBounds(slice, selectedRoomBounds, routeH);
        if (wallSnapped && isPointInsideBounds(wallSnapped, selectedRoomBounds)) {
          candidates.push({ kind: 'wall', dist: ray.origin.distanceTo(wallSnapped), point: wallSnapped });
        }
      }
    }

    if (candidates.length === 0) return null;

    const { lastSurfaceKind = null, hoverFace = null } = pickContext;
    let pool = candidates;
    if (modeFilter === 'auto' && lastSurfaceKind && hoverFace) {
      const wallFaces = ['north', 'south', 'east', 'west'];
      /* Тот же тип поверхности + наведение на неё — удерживаем трассу на ней (не перехватывает пол по расстоянию). */
      const wantWall = lastSurfaceKind === 'wall' && wallFaces.includes(hoverFace);
      const wantFloor = lastSurfaceKind === 'floor' && hoverFace === 'floor';
      const wantCeil = lastSurfaceKind === 'ceiling' && hoverFace === 'ceiling';
      /* Переход на другую грань по наведению (стена→пол/потолок и обратно), иначе горизонтальный срез стены «перебивает» пол. */
      const toFloorFromWall = lastSurfaceKind === 'wall' && hoverFace === 'floor';
      const toCeilFromWall = lastSurfaceKind === 'wall' && hoverFace === 'ceiling';
      const toWallFromFloor = lastSurfaceKind === 'floor' && wallFaces.includes(hoverFace);
      const toWallFromCeil = lastSurfaceKind === 'ceiling' && wallFaces.includes(hoverFace);
      const toFloorFromCeil = lastSurfaceKind === 'ceiling' && hoverFace === 'floor';
      const toCeilFromFloor = lastSurfaceKind === 'floor' && hoverFace === 'ceiling';

      if (wantWall) {
        const ws = candidates.filter((c) => c.kind === 'wall');
        if (ws.length) pool = ws;
      } else if (wantFloor) {
        const fs = candidates.filter((c) => c.kind === 'floor');
        if (fs.length) pool = fs;
      } else if (wantCeil) {
        const cs = candidates.filter((c) => c.kind === 'ceiling');
        if (cs.length) pool = cs;
      } else if (toFloorFromWall || toFloorFromCeil) {
        const fs = candidates.filter((c) => c.kind === 'floor');
        if (fs.length) pool = fs;
      } else if (toCeilFromWall || toCeilFromFloor) {
        const cs = candidates.filter((c) => c.kind === 'ceiling');
        if (cs.length) pool = cs;
      } else if (toWallFromFloor || toWallFromCeil) {
        const ws = candidates.filter((c) => c.kind === 'wall');
        if (ws.length) pool = ws;
      }
    }

    pool.sort((a, b) => a.dist - b.dist);
    const best = pool[0];
    return { kind: best.kind, point: best.point };
  }, [
    activeRoomHeightM,
    getRouteModeHeight,
    getWallSnapPointFromBounds,
    isPointInsideBounds,
    sceneData.floorPlan,
    selectedRoomBounds,
    toMeters,
    WALL_INSET_M,
  ]);

  const selectedRoomPoints = useMemo(
    () => (selectedRoomId != null && selectedRoomId !== ''
      ? sceneData.points.filter((point) => String(point.roomId) === String(selectedRoomId))
      : []),
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

    // Determine effective surface: «Все поверхности» — по ближайшей грани луча; иначе наведение пол/потолок или режим.
    let effectiveSurface;
    if (tool === 'add-light') {
      effectiveSurface = 'ceiling';
    } else if (surfaceMode === 'any') {
      effectiveSurface = resolveAnyModePointer(event).kind;
    } else if (surfaceMode === 'wall') {
      /* Только стены: пол/потолок — через режим «Все поверхности» или отдельно «Пол» / «Потолок». */
      effectiveSurface = 'wall';
    } else {
      effectiveSurface = (hoveredWallFace === 'floor' || hoveredWallFace === 'ceiling')
        ? hoveredWallFace
        : surfaceMode;
    }

    // Get the best 3D click point for each surface type.
    // For walls when looking from inside the room, getGroundIntersection fails because
    // a near-horizontal ray lands far outside bounds. We use the wall mesh hit instead.
    const getBasePoint = () => {
      if (effectiveSurface === 'ceiling') {
        const ceilingHit = getIntersectionOnHeight(event, activeRoomHeightM - 0.05);
        if (tool === 'add-light') {
          return ceilingHit;
        }
        return ceilingHit ?? getGroundIntersection(event);
      }
      if (effectiveSurface === 'wall') {
        // Режим «Стены»: не цепляемся к оверлею пола/потолка — только вертикальные грани.
        const wallHit = surfaceMode === 'wall'
          ? getPointerVerticalWallHit(event)
          : getPointerWallHit(event);
        if (wallHit?.point) return wallHit.point;
        // Fallback: project to a mid-height plane (less accurate but better than y=0)
        return getIntersectionOnHeight(event, Math.max(toMeters(pointHeight), 0.3))
          ?? getGroundIntersection(event);
      }
      // floor
      return getGroundIntersection(event);
    };

    const basePoint = getBasePoint();
    if (!basePoint) {
      if (tool === 'add-light') {
        addToast('Светильник размещается только на потолке: наведите курсор на потолок комнаты и кликните.', 'warn');
      }
      return;
    }

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
        const switchHeightCm = effectiveSurface === 'wall'
          ? getWallSnapPreferredHeightCm(basePoint)
          : Math.round(toCentimeters(Math.min(Math.max(basePoint.y, 0.05), activeRoomHeightM - 0.02)));
        if (switchHeightCm < 80 || switchHeightCm > 170) {
          addToast(
            `ТКП 8.5.9: выключатель — высота 0.8–1.7 м от пола. По клику: ${switchHeightCm} см. Наведите на стену на нужной высоте.`,
            'warn',
          );
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
        const preferredHeightForSnap =
          effectiveSurface === 'wall' ? getWallSnapPreferredHeightCm(basePoint) : pointHeight;
        const snappedSurfacePoint = snapPointToSurface(basePoint, preferredHeightForSnap, effectiveSurface);
        if (!snappedSurfacePoint || !isPointInsideBounds(snappedSurfacePoint, selectedRoomBounds)) {
          addToast(
            tool === 'add-light'
              ? 'Не удалось привязать светильник к потолку. Наведите на потолок внутри комнаты и кликните.'
              : 'Не удалось привязать точку к поверхности. Наведите на стену, пол или потолок и кликните.',
            'warn',
          );
          return;
        }
        const payload = {
          symbolType,
          powerConsumption: tool === 'add-source' ? 10 : symbolType === 'light' ? 120 : 2200,
          positionX: Number(toCentimeters(snappedSurfacePoint.x).toFixed(2)),
          positionY: Number(toCentimeters(snappedSurfacePoint.z).toFixed(2)),
          heightFromFloor: Number(
            tool === 'add-source'
              ? (effectiveSurface === 'ceiling'
                ? toCentimeters(activeRoomHeightM - 0.05)
                : effectiveSurface === 'floor'
                  ? 5
                  : Math.max(Number(toCentimeters(snappedSurfacePoint.y).toFixed(0)), 120))
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
      const mode = routePlacementMode;
      const lastForPick = routeNodesRef.current.length
        ? routeNodesRef.current[routeNodesRef.current.length - 1]
        : null;
      const picked = pickRouteSurfaceAlongRay(event, mode, {
        lastSurfaceKind: lastForPick?.surfaceKind ?? null,
        hoverFace: getRoutePointerHoverFace(event),
      });
      if (!picked) {
        addToast('Наведите курсор на стену, пол или потолок комнаты (узел не в пустоте).', 'warn');
        return;
      }
      const pickKind = picked.kind;
      let surfaceKind = picked.kind;
      const routeHeightM = Math.max(toMeters(getRouteModeHeight()), 0.05);
      let routeBasePoint = picked.point.clone();

      const snapProbe = new THREE.Vector3(routeBasePoint.x, routeBasePoint.y, routeBasePoint.z);
      const raySnap = snapRouteNodeFromElectricalRay(event);
      let snappedPointResult = raySnap?.pointId ? raySnap : findNearestExistingPoint(snapProbe, selectedRoomPoints);
      if (!snappedPointResult.pointId && picked.kind === 'wall') {
        const wallHitSnap = getPointerWallHit(event);
        if (wallHitSnap?.point) {
          const whProbe = new THREE.Vector3(wallHitSnap.point.x, routeHeightM, wallHitSnap.point.z);
          const whRes = findNearestExistingPoint(whProbe, selectedRoomPoints);
          if (whRes.pointId) snappedPointResult = whRes;
        }
      }
      let snapped;
      if (snappedPointResult.pointId) {
        snapped = snappedPointResult.point.clone();
        surfaceKind = inferRouteSurfaceKindFromHeightM(snapped.y, activeRoomHeightM);
      } else {
        snapped = routeBasePoint;
      }
      if (!isPointInsideBounds(snapped, selectedRoomBounds)) {
        addToast('Узел трассы должен находиться в пределах выбранной комнаты.', 'warn');
        return;
      }
      if (routePointsRef.current.length === 0 && snappedPointResult.pointId) {
        const snappedHeightCm = Number(toCentimeters(snapped.y).toFixed(0));
        if (Number.isFinite(snappedHeightCm)) {
          setRouteHeight(snappedHeightCm);
        }
      }
      if (routePointsRef.current.length === 0) {
        routePointsRef.current.push(new THREE.Vector3(snapped.x, snapped.y, snapped.z));
        routeNodesRef.current.push({
          x: snapped.x,
          y: snapped.z,
          z: snapped.y,
          pointId: snappedPointResult.pointId,
          symbolType: snappedPointResult.symbolType,
          surfaceKind,
        });
      } else {
        const prevPt = routePointsRef.current[routePointsRef.current.length - 1];
        const chain = expandSurfaceRouteSegment(
          prevPt,
          snapped,
          selectedRoomBounds,
          activeRoomHeightM,
          WALL_INSET_M,
          {
            placementMode: routePlacementMode,
            fromSurfaceKind: lastForPick?.surfaceKind,
            toSurfaceKind: pickKind,
          },
        );
        for (let i = 1; i < chain.length; i += 1) {
          const pt = chain[i];
          const isLast = i === chain.length - 1;
          routePointsRef.current.push(pt.clone());
          routeNodesRef.current.push({
            x: pt.x,
            y: pt.z,
            z: pt.y,
            pointId: isLast ? snappedPointResult.pointId : null,
            symbolType: isLast ? snappedPointResult.symbolType : null,
            surfaceKind: inferRouteSurfaceKindFromHeightM(pt.y, activeRoomHeightM),
          });
        }
      }
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

    const anyPointer = surfaceMode === 'any' ? resolveAnyModePointer(event) : null;
    const verticalWallOnly = surfaceMode === 'wall' ? getPointerVerticalWallHit(event) : null;
    const workingFace = surfaceMode === 'any'
      ? anyPointer.faceForUi
      : surfaceMode === 'wall'
        ? verticalWallOnly?.wallFace ?? null
        : hoveredFace;

    if (selectedRoomBounds) {
      let contextPoint = null;
      let surfaceLabel = 'Пол';

      if (tool === 'add-light') {
        const ceilingHit = getIntersectionOnHeight(event, activeRoomHeightM - 0.05);
        if (ceilingHit && isPointInsideBounds(ceilingHit, selectedRoomBounds)) {
          contextPoint = new THREE.Vector3(ceilingHit.x, activeRoomHeightM - 0.05, ceilingHit.z);
          surfaceLabel = 'Потолок';
        }
      } else if (workingFace === 'floor') {
        const groundHit = getGroundIntersection(event);
        if (groundHit && isPointInsideBounds(groundHit, selectedRoomBounds)) {
          contextPoint = new THREE.Vector3(groundHit.x, 0.05, groundHit.z);
          surfaceLabel = 'Пол';
        }
      } else if (workingFace === 'ceiling') {
        const ceilingHit = getIntersectionOnHeight(event, activeRoomHeightM - 0.05);
        if (ceilingHit && isPointInsideBounds(ceilingHit, selectedRoomBounds)) {
          contextPoint = new THREE.Vector3(ceilingHit.x, activeRoomHeightM - 0.05, ceilingHit.z);
          surfaceLabel = 'Потолок';
        }
      } else if (workingFace) {
        const wallHit = surfaceMode === 'wall' ? verticalWallOnly : getPointerWallHit(event);
        if (wallHit?.point) {
          contextPoint = wallHit.point;
          surfaceLabel = getWallFaceLabel(workingFace);
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
        const wallHit = surfaceMode === 'wall' ? getPointerVerticalWallHit(event) : getPointerWallHit(event);
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
        const ghostSurface = tool === 'add-light'
          ? 'ceiling'
          : (surfaceMode === 'any'
            ? (anyPointer.kind === 'floor' || anyPointer.kind === 'ceiling' ? anyPointer.kind : 'wall')
            : surfaceMode === 'wall'
              ? 'wall'
              : ((hoveredFace === 'floor' || hoveredFace === 'ceiling') ? hoveredFace : surfaceMode));
        let snapBase = null;
        if (tool === 'add-light') {
          const ch = getIntersectionOnHeight(event, activeRoomHeightM - 0.05);
          if (ch && isPointInsideBounds(ch, selectedRoomBounds)) {
            snapBase = new THREE.Vector3(ch.x, activeRoomHeightM - 0.05, ch.z);
          }
        } else {
          snapBase = contextPoint ?? (workingFace === 'floor' ? getGroundIntersection(event) : null);
        }
        if (snapBase) {
          const ghostPreferredHeight =
            ghostSurface === 'wall' ? getWallSnapPreferredHeightCm(snapBase) : pointHeight;
          const snappedPos = snapPointToSurface(snapBase, ghostPreferredHeight, ghostSurface);
          if (snappedPos && isPointInsideBounds(snappedPos, selectedRoomBounds)) {
            updateGhostPreview(tool, snappedPos, selectedRoomBounds, activeRoomHeightM);
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
          const mode = routePlacementMode;
          const lastForGhost = routeNodesRef.current.length
            ? routeNodesRef.current[routeNodesRef.current.length - 1]
            : null;
          const picked = pickRouteSurfaceAlongRay(event, mode, {
            lastSurfaceKind: lastForGhost?.surfaceKind ?? null,
            hoverFace: getRoutePointerHoverFace(event),
          });
          if (!picked || !isPointInsideBounds(picked.point, selectedRoomBounds)) {
            clearGhostPreview();
          } else {
            const routeBasePoint = picked.point.clone();
            const snappedPointResult = snapRouteEquipmentForPreview(event, routeBasePoint);
            let snapped = null;
            if (snappedPointResult.pointId) {
              snapped = snappedPointResult.point.clone();
            } else {
              snapped = routeBasePoint;
            }
            if (!snapped || !isPointInsideBounds(snapped, selectedRoomBounds)) {
              clearGhostPreview();
            } else {
              clearGhostPreview();
              const g = ghostGroupRef.current;
              if (g && routePointsRef.current.length > 0) {
                const prev = routePointsRef.current[routePointsRef.current.length - 1];
                const ghostChain = expandSurfaceRouteSegment(
                  prev,
                  snapped,
                  selectedRoomBounds,
                  activeRoomHeightM,
                  WALL_INSET_M,
                  {
                    placementMode: routePlacementMode,
                    fromSurfaceKind: lastForGhost?.surfaceKind,
                    toSurfaceKind: picked.kind,
                  },
                );
                const geom = new THREE.BufferGeometry().setFromPoints(ghostChain);
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
    const dragMode =
      routePlacementMode === 'wall' || routePlacementMode === 'floor' || routePlacementMode === 'ceiling'
        ? routePlacementMode
        : (currentNode.surfaceKind && currentNode.surfaceKind !== 'auto'
          ? currentNode.surfaceKind
          : 'auto');
    const prevInChain = idx > 0 ? routeNodesRef.current[idx - 1] : null;
    const picked = pickRouteSurfaceAlongRay(event, dragMode, {
      lastSurfaceKind: prevInChain?.surfaceKind ?? currentNode.surfaceKind ?? null,
      hoverFace: getRoutePointerHoverFace(event),
    });
    if (!picked) return;

    const routeHeightM = Math.max(toMeters(getRouteModeHeight()), 0.05);
    const rawProbe = new THREE.Vector3(picked.point.x, picked.point.y, picked.point.z);
    const raySnap = snapRouteNodeFromElectricalRay(event);
    let snappedPointResult = raySnap?.pointId ? raySnap : findNearestExistingPoint(rawProbe, selectedRoomPoints);
    let snapped;
    let surfaceKind = picked.kind;
    if (snappedPointResult.pointId) {
      snapped = snappedPointResult.point.clone();
      surfaceKind = inferRouteSurfaceKindFromHeightM(snapped.y, activeRoomHeightM);
    } else {
      snapped = picked.point;
      if (!snappedPointResult.pointId && picked.kind === 'wall') {
        const wallHitSnap = getPointerWallHit(event);
        if (wallHitSnap?.point) {
          const whProbe = new THREE.Vector3(wallHitSnap.point.x, routeHeightM, wallHitSnap.point.z);
          const whRes = findNearestExistingPoint(whProbe, selectedRoomPoints);
          if (whRes.pointId) snappedPointResult = whRes;
        }
      }
      if (snappedPointResult.pointId) {
        snapped = snappedPointResult.point.clone();
        surfaceKind = inferRouteSurfaceKindFromHeightM(snapped.y, activeRoomHeightM);
      }
    }
    if (selectedRoomBounds && !isPointInsideBounds(snapped, selectedRoomBounds)) return;

    const nextNodes = routeNodesRef.current.map((node, i) =>
      i === idx
        ? {
          ...node,
          x: snapped.x,
          y: snapped.z,
          z: snapped.y,
          pointId: snappedPointResult.pointId || null,
          symbolType: snappedPointResult.symbolType || null,
          surfaceKind,
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
      setPointHeight((prev) => (prev > 0 ? prev : 30));
    } else if (tool === 'add-light') {
      setSurfaceMode('ceiling');
      // Светильник только на потолке — высота в панели для превью/контекста около уровня потолка
      setPointHeight((prev) => (prev >= 200 ? prev : 250));
    }
    const placementTools = ['add-outlet', 'add-switch', 'add-light', 'add-source', 'add-door', 'add-window', 'draw-route'];
    if (!placementTools.includes(tool)) {
      clearGhostPreview();
    }
  }, [clearGhostPreview, tool]);

  useEffect(() => {
    if (routePlacementMode === 'ceiling') {
      setRouteHeight((prev) => Math.max(prev, 240));
    } else if (routePlacementMode === 'floor') {
      setRouteHeight((prev) => Math.min(prev, 20));
    } else if (routePlacementMode === 'auto') {
      setRouteHeight((prev) => (prev >= 10 && prev <= 260 ? prev : 120));
    } else {
      setRouteHeight((prev) => (prev >= 10 && prev <= 230 ? prev : 120));
    }
  }, [routePlacementMode]);

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
      'draw-route': 'Кликайте по стене, полу или потолку — узлы только на поверхностях (режим «Авто»). Enter — сохранить черновик.',
      'add-outlet': 'Наведите курсор на стену, пол или потолок и кликните ЛКМ для добавления розетки.',
      'add-switch': 'Наведите курсор на стену и кликните ЛКМ для добавления выключателя.',
      'add-light': 'Наведите курсор на потолок комнаты и кликните ЛКМ для добавления светильника.',
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

    if (tool === 'add-switch') {
      stage3Warnings.push('Выключатель (ТКП 8.5.9): высоту задайте кликом по стене в диапазоне 0.8–1.7 м (поле «Высота точки» не задаёт высоту на стене).');
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

    return {
      stage1Errors,
      stage2Errors,
      stage3Warnings,
      isValid: stage1Errors.length === 0 && stage2Errors.length === 0,
    };
  }, [isWetRoom, pointHeight, sceneData.points, selectedCircuit, selectedRoom, selectedRoomId, tool]);

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
                <FloorPlan3DSidebar
          sceneData={sceneData}
          focusRoom={focusRoom}
          enterRoom={enterRoom}
          selectedRoomId={selectedRoomId}
          selectedRoom={selectedRoom}
          roomWidthCm={roomWidthCm}
          setRoomWidthCm={setRoomWidthCm}
          roomLengthCm={roomLengthCm}
          setRoomLengthCm={setRoomLengthCm}
          setLastEditedRoomSide={setLastEditedRoomSide}
          roomCeilingHeightM={roomCeilingHeightM}
          setRoomCeilingHeightM={setRoomCeilingHeightM}
          setRoomHeightById={setRoomHeightById}
          saveSelectedRoomGeometry={saveSelectedRoomGeometry}
          savingRoomGeometry={savingRoomGeometry}
          saveCalcName={saveCalcName}
          setSaveCalcName={setSaveCalcName}
          saveCurrent3DCalculation={saveCurrent3DCalculation}
          saved3DCalculations={saved3DCalculations}
          selectedSavedCalcId={selectedSavedCalcId}
          openSaved3DCalculation={openSaved3DCalculation}
          selectedSavedCalcDetails={selectedSavedCalcDetails}
          projectId={projectId}
          tool={tool}
          setTool={setTool}
          surfaceMode={surfaceMode}
          setSurfaceMode={setSurfaceMode}
          wallFaceMode={wallFaceMode}
          setWallFaceMode={setWallFaceMode}
          parallelOffsetCm={parallelOffsetCm}
          setParallelOffsetCm={setParallelOffsetCm}
          doorWidthCm={doorWidthCm}
          setDoorWidthCm={setDoorWidthCm}
          windowWidthCm={windowWidthCm}
          setWindowWidthCm={setWindowWidthCm}
          pointHeight={pointHeight}
          setPointHeight={setPointHeight}
          newRouteName={newRouteName}
          setNewRouteName={setNewRouteName}
          routeHeight={routeHeight}
          setRouteHeight={setRouteHeight}
          routePlacementMode={routePlacementMode}
          setRoutePlacementMode={setRoutePlacementMode}
          selectedCircuitId={selectedCircuitId}
          setSelectedCircuitId={setSelectedCircuitId}
          circuits={circuits}
          saveRoute={saveRoute}
          overwriteSelectedRoute={overwriteSelectedRoute}
          removeLastNode={removeLastNode}
          clearRouteDraft={clearRouteDraft}
          deleteSelectedRoute={deleteSelectedRoute}
          routePointCount={routePointCount}
          routeValidationMessages={routeValidationMessages}
          routeNodesRef={routeNodesRef}
          updateNodeAtIndex={updateNodeAtIndex}
          insertNodeAfter={insertNodeAfter}
          removeNodeAt={removeNodeAt}
          toCentimeters={toCentimeters}
          toMeters={toMeters}
          stats={stats}
          routeDraftLength={routeDraftLength}
          readinessText={readinessText}
          validationStages={validationStages}
          roomExistingStats={roomExistingStats}
          selectedRoomCalculation={selectedRoomCalculation}
          roomPlan={roomPlan}
          setRoomPlanData={setRoomPlanData}
          getRouteModeWarning={getRouteModeWarning}
          undoLastAction={undoLastAction}
          redoLastAction={redoLastAction}
          canUndo={canUndo}
          canRedo={canRedo}
          loadRouteToDraft={loadRouteToDraft}
          selectedRouteId={selectedRouteId}
        />

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
