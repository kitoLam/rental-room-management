package com.kitolam.rentalroommanagement.modules.room;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.dto.response.BranchResponse;
import com.kitolam.rentalroommanagement.modules.branch.mapper.BranchMapper;
import com.kitolam.rentalroommanagement.modules.branch.repository.BranchRepository;
import com.kitolam.rentalroommanagement.modules.branch.service.BranchService;
import com.kitolam.rentalroommanagement.modules.branch.service.impl.BranchServiceImpl;
import com.kitolam.rentalroommanagement.modules.manager.dto.response.ManagerResponse;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.mapper.RoomMapper;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.room.service.impl.RoomServiceImpl;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.UtilityRatesRequest;
import org.junit.jupiter.api.Test;
import org.mapstruct.factory.Mappers;
import org.springframework.data.mongodb.core.MongoTemplate;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UtilityRatesTest {
    final RoomRepository rooms = mock(RoomRepository.class);
    final BranchService branches = mock(BranchService.class);
    final MongoTemplate mongo = mock(MongoTemplate.class);
    final Room room = new Room();
    final BranchResponse branch = mock(BranchResponse.class);
    final RoomServiceImpl service = new RoomServiceImpl(rooms, Mappers.getMapper(RoomMapper.class), branches, mongo, Clock.systemUTC());

    UtilityRatesTest() {
        room.setId("room"); room.setBranchId("branch");
        when(rooms.findByIdAndIsDeletedFalse("room")).thenReturn(Optional.of(room));
        when(branches.getById("branch")).thenReturn(branch);
        when(branch.electricityRate()).thenReturn(new BigDecimal("3500"));
        when(branch.waterRate()).thenReturn(new BigDecimal("15000"));
        when(branch.parkingRate()).thenReturn(new BigDecimal("100000"));
    }

    @Test void missingRoomRatesInheritEachBranchRate() {
        var rates = service.publicUtilityRates("room");
        assertEquals(new BigDecimal("3500"), rates.electricityRate());
        assertEquals(new BigDecimal("15000"), rates.waterRate());
        assertEquals(new BigDecimal("100000"), rates.parkingRate());
    }

    @Test void zeroAndExplicitRoomRatesOverrideBranchDefaults() {
        room.setParkingRate(BigDecimal.ZERO);
        room.setElectricityRate(new BigDecimal("4000"));
        var rates = service.publicUtilityRates("room");
        assertEquals(BigDecimal.ZERO, rates.parkingRate());
        assertEquals(new BigDecimal("4000"), rates.electricityRate());
        assertEquals(new BigDecimal("15000"), rates.waterRate());
    }

    @Test void unconfiguredRateStaysUnknownInsteadOfBecomingFree() {
        when(branch.waterRate()).thenReturn(null);
        assertNull(service.publicUtilityRates("room").waterRate());
    }

    @Test void unauthorizedRoomWriteNeverReachesDatabase() {
        var tenant = new AuthPrincipal("tenant", "tenant@example.test", "TENANT");
        doThrow(new ForbiddenException("Denied")).when(branches).requireManagementAccess("branch", tenant);
        assertThrows(ForbiddenException.class, () -> service.updateUtilityRates("room", new UtilityRatesRequest(null, null, null), tenant));
        verifyNoInteractions(mongo);
    }

    @Test void ownerAndActiveManagerMustBelongToTheBranch() {
        var repository = mock(BranchRepository.class);
        var managers = mock(ManagerService.class);
        var entity = new Branch(); entity.setId("branch"); entity.setOwnerAccountId("owner");
        when(repository.findByIdAndIsDeletedFalse("branch")).thenReturn(Optional.of(entity));
        var access = new BranchServiceImpl(repository, Mappers.getMapper(BranchMapper.class), managers, mongo, Clock.systemUTC());
        assertDoesNotThrow(() -> access.requireManagementAccess("branch", new AuthPrincipal("owner", "owner@example.test", "OWNER")));
        assertThrows(ForbiddenException.class, () -> access.requireManagementAccess("branch", new AuthPrincipal("other", "other@example.test", "OWNER")));
        var assignment = mock(ManagerResponse.class);
        when(assignment.status()).thenReturn(ManagerStatus.ACTIVE); when(assignment.branchId()).thenReturn("branch");
        when(managers.findAssignment("manager@example.test")).thenReturn(Optional.of(assignment));
        var manager = new AuthPrincipal("manager", "manager@example.test", "MANAGER");
        assertDoesNotThrow(() -> access.requireManagementAccess("branch", manager));
        when(assignment.status()).thenReturn(ManagerStatus.INACTIVE);
        assertThrows(ForbiddenException.class, () -> access.requireManagementAccess("branch", manager));
    }
}
