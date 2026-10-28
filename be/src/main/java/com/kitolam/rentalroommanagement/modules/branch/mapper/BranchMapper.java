package com.kitolam.rentalroommanagement.modules.branch.mapper;

import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface BranchMapper {
    UtilityRatesResponse toUtilityRates(Branch branch);
    BranchResponse toResponse(Branch branch);
}
