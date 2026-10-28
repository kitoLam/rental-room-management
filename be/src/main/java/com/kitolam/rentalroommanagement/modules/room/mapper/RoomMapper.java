package com.kitolam.rentalroommanagement.modules.room.mapper;

import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.dto.response.RoomResponse;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.response.UtilityRatesResponse;
import org.mapstruct.Mapper;

@Mapper(componentModel = "spring")
public interface RoomMapper {
    UtilityRatesResponse toUtilityRates(Room room);
    UtilityRatesResponse toUtilityRates(BranchResponse branch);
    RoomResponse toResponse(Room room);
}
