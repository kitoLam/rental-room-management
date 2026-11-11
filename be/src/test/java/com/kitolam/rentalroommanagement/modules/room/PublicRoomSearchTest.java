package com.kitolam.rentalroommanagement.modules.room;

import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.branch.document.Branch;
import com.kitolam.rentalroommanagement.modules.branch.repository.BranchRepository;
import com.kitolam.rentalroommanagement.modules.room.document.Room;
import com.kitolam.rentalroommanagement.modules.room.repository.RoomRepository;
import com.kitolam.rentalroommanagement.modules.room.service.PublicRoomService;
import com.kitolam.rentalroommanagement.modules.room.service.RoomService;
import com.kitolam.rentalroommanagement.modules.roomtype.document.RoomType;
import com.kitolam.rentalroommanagement.modules.roomtype.repository.RoomTypeRepository;
import org.bson.Document;
import org.bson.types.ObjectId;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.ArgumentCaptor;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Query;

import java.util.List;
import java.util.Collection;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class PublicRoomSearchTest {
    @ParameterizedTest
    @CsvSource({
            "anh, branchId", "ÁNH, branchId",
            "duc, branchId", "ĐỨC, branchId",
            "trọ, branchId", "TRO, branchId",
            "đơn, roomTypeId", "DON, roomTypeId"
    })
    void matchesVietnameseOwnerAddressBranchAndRoomTypeRegardlessOfCase(String keyword, String field) {
        var mongo = mock(MongoTemplate.class);
        var types = mock(RoomTypeRepository.class);
        var users = mock(UserRepository.class);
        var service = new PublicRoomService(mock(RoomRepository.class), mock(BranchRepository.class),
                types, users, mongo, mock(RoomService.class), java.time.Clock.systemUTC());
        var branch = new Branch();
        branch.setId("000000000000000000000001");
        branch.setName("Nhà TRỌ");
        branch.setAddress("Thủ ĐỨC");
        branch.setOwnerAccountId("000000000000000000000002");
        var owner = new User();
        owner.setId(branch.getOwnerAccountId());
        owner.setFullName("Nguyễn ÁNH");
        var type = new RoomType();
        type.setId("000000000000000000000003");
        type.setName("Phòng ĐƠN");
        when(mongo.find(any(Query.class), eq(Branch.class))).thenReturn(List.of(branch));
        when(types.findAll()).thenReturn(List.of(type));
        when(users.findAllById(any())).thenReturn(List.of(owner));

        service.search(keyword, null, null, null, null, null, null, null, 0, 6, null);

        var query = ArgumentCaptor.forClass(Query.class);
        verify(mongo).count(query.capture(), eq(Room.class));
        List<Document> clauses = query.getValue().getQueryObject().getList("$and", Document.class);
        List<Document> matches = clauses.getLast().getList("$or", Document.class);
        String expectedId = field.equals("branchId") ? branch.getId() : type.getId();
        assertTrue(matches.stream().anyMatch(match -> match.containsKey(field)
                && match.get(field, Document.class).get("$in", Collection.class)
                .contains(new ObjectId(expectedId))), "Keyword must include the matching " + field);
    }
}
