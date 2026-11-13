package com.kitolam.rentalroommanagement.modules.furniture.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureGroupUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureGroupResponse;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

/**
 * Furniture (cơ sở vật chất) is one document per room. Every change also keeps the furniture name
 * in Room.amenities in sync; other entries of Room.amenities are never touched.
 */
public interface FurnitureService {

    // ----- per room document

    FurnitureResponse getById(String id, AuthPrincipal principal);

    PagedResponse<FurnitureResponse> search(FurnitureFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    FurnitureResponse update(String id, FurnitureUpdateRequest request, AuthPrincipal principal);

    void delete(String id, AuthPrincipal principal);

    // ----- grouped by name within a branch

    /** Creates one document per room; fails if the branch already has furniture with that name. */
    FurnitureGroupResponse create(FurnitureCreateRequest request, AuthPrincipal principal);

    List<FurnitureGroupResponse> groups(String branchId, String keyword, AuthPrincipal principal);

    FurnitureGroupResponse updateGroup(FurnitureGroupUpdateRequest request, AuthPrincipal principal);

    void deleteGroup(String branchId, String name, AuthPrincipal principal);
}
