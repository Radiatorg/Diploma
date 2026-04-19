package com.verchuk.electro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProjectSnapshotResponse {
    private List<RoomResponse> rooms;
    private List<ProjectApplianceResponse> appliances;
    private List<ElectricalPointResponse> electricalPoints;
    private List<WallResponse> walls;
    private List<CableRunResponse> routes;
    private FloorPlanResponse floorPlan;
}

