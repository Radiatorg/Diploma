# Electro Frontend: Electrical Points & Appliances Structure Analysis

## Executive Summary
- **Electrical Points** (outlets, switches, lamps) are stored separately from **Project Appliances** (equipment)
- Electrical points are differentiated by **type field** (`outlet | switch | light`)
- **Lamps/lights are NOT excluded from snapping** during route creation—they snap like any other electrical point
- Appliances vs Electrical Points serve different purposes in the design workflow

---

## 1. Data Storage & API Endpoints

### Electrical Points Storage
**File**: [electro-frontend/src/api/api.js](electro-frontend/src/api/api.js)

```javascript
// Electrical Point API - Lines 239-245
export const electricalPointAPI = {
  getByProject: (projectId) => api.get(`/designer/projects/${projectId}/electrical-points`),
  create: (projectId, data) => api.post(`/designer/projects/${projectId}/electrical-points`, data),
  saveBatch: (projectId, data) => api.post(`/designer/projects/${projectId}/electrical-points/batch`, data),
  update: (projectId, pointId, data) => api.put(`/designer/projects/${projectId}/electrical-points/${pointId}`, data),
  delete: (projectId, pointId) => api.delete(`/designer/projects/${projectId}/electrical-points/${pointId}`),
};
```

### Project Appliances Storage
**File**: [electro-frontend/src/api/api.js](electro-frontend/src/api/api.js)

```javascript
// Project Appliance API - Lines 113-117
export const projectApplianceAPI = {
  getByProject: (projectId) => api.get(`/designer/projects/${projectId}/appliances`),
  add: (projectId, data) => api.post(`/designer/projects/${projectId}/appliances`, data),
  update: (projectId, projectApplianceId, data) => api.put(`/designer/projects/${projectId}/appliances/${projectApplianceId}`, data),
  delete: (projectId, projectApplianceId) => api.delete(`/designer/projects/${projectId}/appliances/${projectApplianceId}`),
};
```

### Electrical Symbols (Type Definitions)
**File**: [electro-frontend/src/api/api.js](electro-frontend/src/api/api.js)

```javascript
// Electrical Symbol API - Lines 266-269
export const electricalSymbolAPI = {
  getAll: () => api.get('/electrical-symbols'),
  getByType: (type) => api.get(`/electrical-symbols/type/${type}`),
  getByCategory: (category) => api.get(`/electrical-symbols/category/${category}`),
  getById: (id) => api.get(`/electrical-symbols/${id}`),
};
```

---

## 2. Electrical Points: Type Differentiation

### Point Type Structure
Each electrical point has a **type** field stored in its **electricalSymbol** object:

```javascript
// Types: 'outlet', 'switch', 'light'
const point = {
  id: 123,
  roomId: 1,
  positionX: 150,  // cm
  positionY: 200,  // cm
  heightFromFloor: 90,  // cm
  electricalSymbol: {
    type: 'outlet',  // or 'switch' or 'light'
    id: 1,
    svgPath: "..." // TKP 339 visual representation
  },
  powerConsumption: 2200,  // Watts
  notes: "Created in 3D editor"
};
```

### 3D Visual Builder Logic
**File**: [electro-frontend/src/pages/floorPlan3D/builders3D.js](electro-frontend/src/pages/floorPlan3D/builders3D.js) (Lines 127-133)

The `buildPointGroup()` function creates 3D meshes based on electrical symbol type:

```javascript
export function buildPointGroup(point) {
  const type = point?.electricalSymbol?.type || '';
  const isSource = isSourcePointByNotes(point);
  
  if (type === 'outlet')   return buildOutletGroup(0x10b981);      // Green outlet
  if (type === 'switch')   return buildSwitchGroup(0x60a5fa);      // Blue switch
  if (type === 'light' && !isSource) return buildLightGroup(0xffc857);  // Yellow lamp
  
  return buildSourceGroup();  // Gray source/box (for start points)
}
```

#### Visual Representations:
- **Outlet** (розетка): 3 holes with green accent border
- **Switch** (выключатель): Plate with rocker switch and blue accent border
- **Light/Lamp** (лампа): Ceiling-mounted fixture with bulb, yellow accent, gold rim
- **Source point**: Gray enclosure box with LED indicator (can be any symbol type marked as source)

---

## 3. Appliances vs Electrical Points

### Key Differences

| Aspect | Electrical Points | Project Appliances |
|--------|-------------------|-------------------|
| **Purpose** | Interface elements on floor plan (outlets, switches, lights) | Equipment using power (washer, microwave, HVAC) |
| **Storage** | `electrical-points` collection | `project-appliances` collection |
| **Placement** | Specific X/Y/Z coordinates on walls or ceiling | Typically one per room with optional position |
| **Symbol** | Always has `electricalSymbol` (type field) | No mandatory symbol—references appliance catalog |
| **Power Consumption** | Low (outlets ~2200W, switches ~0W, lights ~120W) | High (washer ~2000W, microwave ~3000W) |
| **Snappable** | YES—during route drawing | NO—not visible in 3D editor snapping |
| **Counted in TKP339** | YES—minimum outlet/switch requirements | NO—separate load calculation category |

### Connection Between Them
An **electrical point can reference an appliance**:

```javascript
// In RoomAppliancesManager.js (line 43-44)
const applianceId = point.applianceId || (point.electricalSymbol && point.electricalSymbol.applianceId);
```

This allows:
- User drags an appliance onto floor plan
- System creates an electrical point at that location
- Point stores reference to appliance via `applianceId`

---

## 4. Snapping Logic During Route Drawing

### Snap Radius Constants
**File**: [electro-frontend/src/pages/floorPlan3D/routeConstants.js](electro-frontend/src/pages/floorPlan3D/routeConstants.js) (Lines 1-9)

```javascript
/** Ray hit radius for detecting symbol collision, meters */
export const ROUTE_EQUIPMENT_RAY_HIT_RADIUS_M = 0.1;  // 10cm sphere around each point

/**
 * Fallback planar snap radius (X/Z) if ray misses sphere, meters.
 * Primary snapping only via ray detection into sphere.
 */
export const ROUTE_EQUIPMENT_PLANAR_SNAP_RADIUS_M = 0.1;  // 0.1m = 10cm on floor plan
```

### Snapping Functions
**File**: [electro-frontend/src/pages/FloorPlan3D.js](electro-frontend/src/pages/FloorPlan3D.js) (Lines 1095-1225)

#### 1. Ray-Based Snapping (Primary)
```javascript
const snapRouteNodeFromElectricalRay = (event) => {
  // Cast ray from camera through mouse position
  // Check intersection with invisible spheres around all electrical points
  const hits = raycaster.intersectObjects(pointHoverMeshesRef.current, false);
  
  if (!hits.length) return null;  // No point hit
  
  const pointData = hits[0].object?.userData?.pointData;
  const worldPos = new THREE.Vector3();
  hits[0].object.getWorldPosition(worldPos);  // Get world position of hit sphere
  
  return {
    point: worldPos,
    pointId: pointData.id,
    symbolType: pointData?.electricalSymbol?.type || '',  // 'outlet' | 'switch' | 'light'
  };
};
```

#### 2. Fallback Planar Snapping (Secondary)
```javascript
const findNearestExistingPoint = (
  candidate,
  pointsForSnap = sceneData.points,
  maxRadiusM = ROUTE_EQUIPMENT_PLANAR_SNAP_RADIUS_M,  // 0.1m
) => {
  let minDistance = Number.POSITIVE_INFINITY;
  
  pointsForSnap.forEach((point) => {
    const px = toMeters(point.positionX);
    const pz = toMeters(point.positionY);
    
    // Distance on floor plan (X/Z) only—height comes from route height
    const distance = Math.hypot(candidate.x - px, candidate.z - pz);
    
    if (distance < minDistance) {
      minDistance = distance;
      nearestPoint = point;
    }
  });
  
  // Return snapped point if within threshold
  if (!nearest || minDistance > maxRadiusM) {
    return { point: candidate, pointId: null, symbolType: null };
  }
  
  return {
    point: new THREE.Vector3(visualX, nearest.y, visualZ),
    pointId: nearestPoint.id,
    symbolType: nearestPoint?.electricalSymbol?.type || '',  // ← ALL types snap!
  };
};
```

#### 3. Preview Snapping (During Mouse Movement)
```javascript
const snapRouteEquipmentForPreview = (event, surfaceFallbackPoint) => {
  const ray = snapRouteNodeFromElectricalRay(event);
  if (ray?.pointId) return ray;  // Ray hit—snap to point
  return { point: surfaceFallbackPoint.clone(), pointId: null, symbolType: null };  // Miss—use surface
};
```

---

## 5. Lamp/Light Snapping Behavior

### NO EXCLUSION OF LAMPS FROM SNAPPING
**Finding**: Lamps **ARE included** in snappable points during route drawing.

#### Where Lamps Can Snap:
1. **Ray detection** - Invisible sphere around lamp symbol catches ray hits
2. **Planar fallback** - Lamp position included in `pointsForSnap` array
3. **Preview visualization** - Shows lamp symbol in candidate list

#### Code Evidence:
**File**: [electro-frontend/src/pages/FloorPlan3D.js](electro-frontend/src/pages/FloorPlan3D.js)

Line 484 - All points iterated for rendering:
```javascript
sceneData.points.forEach((point) => {
  // ... builds group for ALL point types: outlet, switch, light, source
  const group = buildPointGroup(point);  // No type filtering!
});
```

Line 1112 - All points snappable during route creation:
```javascript
pointsForSnap.forEach((point) => {
  const distance = Math.hypot(candidate.x - px, candidate.z - pz);
  if (distance < minDistance) {  // No filter checking symbolType !== 'light'
    minDistance = distance;
    nearestPoint = point;
  }
});
```

#### Lamp-Specific UI Note:
**File**: [electro-frontend/src/pages/FloorPlan3DSidebar.js](electro-frontend/src/pages/FloorPlan3DSidebar.js) (Line 296-298)

```javascript
{tool === 'add-light' && (
  <div className="floor-plan-3d-tip">
    Светильник размещается только на потолке; режим «Потолок» включается автоматически.
  </div>
)}
```

This only restricts **placement** of new lamps to ceiling; it does NOT exclude them from snapping.

---

## 6. Electrical Points Differentiation During Route Drawing

### Tools Available
**File**: [electro-frontend/src/pages/FloorPlan3DSidebar.js](electro-frontend/src/pages/FloorPlan3DSidebar.js) (Lines 265-290)

```javascript
<button onClick={() => setTool('add-outlet')}>Розетка</button>
<button onClick={() => setTool('add-switch')}>Выключатель</button>
<button onClick={() => setTool('add-light')} title="Только на потолок">Лампа</button>
<button onClick={() => setTool('add-source')}>Точка старта линии</button>
```

### Route Placement Logic
**File**: [electro-frontend/src/pages/FloorPlan3D.js](electro-frontend/src/pages/FloorPlan3D.js) (Lines 1633-1710)

When creating electrical point:
```javascript
if (tool === 'add-source' || tool === 'add-outlet' || tool === 'add-switch' || tool === 'add-light') {
  const ghostSymbolType =
    tool === 'add-source' ? 'source'
    : tool === 'add-outlet' ? 'outlet'
    : tool === 'add-switch' ? 'switch'
    : 'light';  // ← Each tool has distinct type

  const newPoint = {
    electricalSymbolId: symbolId,
    roomId: selectedRoomId,
    positionX: Math.round(newPos.x * 100),
    positionY: Math.round(newPos.z * 100),
    heightFromFloor: Math.round(toMeters(routeHeight) * 100),
    powerConsumption: 
      tool === 'add-source' ? 10 
      : symbolType === 'light' ? 120  // Lamps: 120W default
      : 2200,  // Outlets/switches: 2200W
    notes: tool === 'add-source' ? 'Стартовая точка линии (3D)' : 'Создано в 3D-редакторе',
  };
}
```

---

## 7. Room Statistics (Points Broken Down by Type)

### Statistics Computed
**File**: [electro-frontend/src/pages/FloorPlan3DSidebar.js](electro-frontend/src/pages/FloorPlan3DSidebar.js) (Line 517)

```javascript
<div>Точек: {roomExistingStats.points} 
  (розетки {roomExistingStats.outlets}, 
   выключатели {roomExistingStats.switches}, 
   свет {roomExistingStats.lights})
</div>
```

This breaks down points into three categories but all remain part of `sceneData.points` array.

---

## 8. Source Point Detection

### Special Case: Source Points
**File**: [electro-frontend/src/pages/floorPlan3D/builders3D.js](electro-frontend/src/pages/floorPlan3D/builders3D.js) (Lines 122-124)

```javascript
export function isSourcePointByNotes(point) {
  const notes = (point?.notes || '').toLowerCase();
  return notes.includes('стартов') || notes.includes('start');
}
```

Source points have special rendering:
- Any electrical point (outlet, switch, light) can become a **source point** if notes contain "стартов" or "start"
- Source points are rendered with gray enclosure box instead of their symbol appearance
- Used for marking cable route entry points

---

## 9. Snapping Summary Table

| Snap Aspect | Details |
|-------------|---------|
| **Snap Radius (Ray)** | 0.1m (10cm) invisible sphere |
| **Snap Radius (Planar)** | 0.1m (10cm) on floor plan X/Z |
| **Priority** | Ray detection > Planar fallback |
| **Outlet Snappable** | ✅ YES |
| **Switch Snappable** | ✅ YES |
| **Light Snappable** | ✅ YES (NOT EXCLUDED) |
| **Source Snappable** | ✅ YES |
| **Height Considered** | Route height used, not point height |
| **Applies To** | Route node creation only |

---

## 10. File Paths Reference

| Concept | File Path | Lines |
|---------|-----------|-------|
| API Endpoints | `electro-frontend/src/api/api.js` | 239-245 (points), 113-117 (appliances) |
| Point Types Reference | `electro-frontend/src/pages/FloorPlan3D.js` | 171-174 |
| Builder Logic | `electro-frontend/src/pages/floorPlan3D/builders3D.js` | 127-133 |
| Snapping Functions | `electro-frontend/src/pages/FloorPlan3D.js` | 1095-1225 |
| Snap Constants | `electro-frontend/src/pages/floorPlan3D/routeConstants.js` | 1-9 |
| Tools/UI | `electro-frontend/src/pages/FloorPlan3DSidebar.js` | 265-290 |
| Statistics | `electro-frontend/src/pages/FloorPlan3DSidebar.js` | 517 |
| Appliances Manager | `electro-frontend/src/components/RoomAppliancesManager/RoomAppliancesManager.js` | 1-70 |

---

## Conclusion

✅ **Electrical Points** are stored separately from **Project Appliances**  
✅ **All types** (outlet, switch, light) are differentiated by `electricalSymbol.type` field  
✅ **Lamps ARE snappable** during route drawing—no exclusion filter exists  
✅ **Snapping uses ray detection** (primary) + planar fallback (secondary)  
✅ **Source points** are special markers on any electrical point type  
✅ **Appliances** are visible in UI but NOT visible/snappable in 3D route editor
