package com.kitolam.rentalroommanagement.modules.furniture.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureCreateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureFilterRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.request.FurnitureUpdateRequest;
import com.kitolam.rentalroommanagement.modules.furniture.dto.response.FurnitureResponse;
import org.springframework.data.domain.Pageable;

public interface FurnitureService {

    FurnitureResponse create(FurnitureCreateRequest request);

    FurnitureResponse getById(String id);

    PagedResponse<FurnitureResponse> search(FurnitureFilterRequest filter, Pageable pageable);

    FurnitureResponse update(String id, FurnitureUpdateRequest request);

    void delete(String id);
}
