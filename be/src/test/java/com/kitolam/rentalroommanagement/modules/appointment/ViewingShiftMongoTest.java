package com.kitolam.rentalroommanagement.modules.appointment;

import com.kitolam.rentalroommanagement.common.base.BaseRepositoryImpl;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.modules.shift.document.Shift;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest.PeriodInput;
import com.kitolam.rentalroommanagement.modules.shift.enums.ShiftType;
import com.kitolam.rentalroommanagement.modules.shift.repository.ShiftRepository;
import com.kitolam.rentalroommanagement.modules.shift.service.impl.ShiftServiceImpl;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.AdditionalAnswers.delegatesTo;

/** Opt-in local Mongo only. Uses a fresh isolated test database, never project .env data. */
@EnabledIfEnvironmentVariable(named = "VIEWING_TEST_MONGO", matches = "1")
class ViewingShiftMongoTest {
    private static final String ROOM = "710000000000000000000001";
    private MongoClient client;
    private MongoTemplate template;
    private ShiftRepository repository;

    @BeforeEach
    void setup() {
        client = MongoClients.create("mongodb://127.0.0.1:27028/?serverSelectionTimeoutMS=3000");
        template = new MongoTemplate(client, "viewing_step2_test_" + UUID.randomUUID().toString().replace("-", ""));
        var factory = new MongoRepositoryFactory(template);
        factory.setRepositoryBaseClass(BaseRepositoryImpl.class);
        repository = factory.getRepository(ShiftRepository.class);
    }

    @AfterEach
    void cleanup() {
        if (template != null && template.getDb().getName().startsWith("viewing_step2_test_")) template.getDb().drop();
        if (client != null) client.close();
    }

    @Test
    void configurationRoundTripsAndStaleWritesCannotOverwriteNewerVersion() {
        var service = new ShiftServiceImpl(repository);
        Shift initial = service.getForRoom(ROOM);
        var ids = initial.getPeriods().stream().map(Shift.Period::id).toList();
        assertNotNull(initial.getVersion());
        var input = request(initial.getVersion(), "10:00", "14:00");
        var saved = service.updateForRoom(ROOM, input);
        assertTrue(saved.getVersion() > initial.getVersion());
        assertEquals(ids, new ShiftServiceImpl(repository).getForRoom(ROOM).getPeriods().stream().map(Shift.Period::id).toList());
        assertThrows(ConflictException.class, () -> service.updateForRoom(ROOM, input));
        assertEquals(1, template.getCollection("shifts").countDocuments());
    }

    @Test
    void concurrentEditsCannotCombineIntoOverlappingHours() throws Exception {
        var service = new ShiftServiceImpl(repository);
        Shift initial = service.getForRoom(ROOM);
        var barrier = new CyclicBarrier(2);
        ShiftRepository racing = mock(ShiftRepository.class, delegatesTo(repository));
        doAnswer(call -> { barrier.await(5, TimeUnit.SECONDS); return repository.save(call.getArgument(0)); })
                .when(racing).save(any(Shift.class));
        var racingService = new ShiftServiceImpl(racing);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> update(racingService, request(initial.getVersion(), "13:00", "14:00")));
            var second = pool.submit(() -> update(racingService, request(initial.getVersion(), "10:00", "11:00")));
            assertEquals(1, first.get(10, TimeUnit.SECONDS) + second.get(10, TimeUnit.SECONDS));
        }
        var stored = service.getForRoom(ROOM);
        assertTrue(stored.getPeriods().getFirst().endTime().compareTo(stored.getPeriods().get(1).startTime()) <= 0);
    }

    @Test
    void concurrentInitialReadsCreateOnlyOneConfigurationAndThreeStablePeriods() throws Exception {
        var barrier = new CyclicBarrier(2);
        ShiftRepository racing = mock(ShiftRepository.class, delegatesTo(repository));
        doAnswer(call -> { barrier.await(5, TimeUnit.SECONDS); return repository.insert((Shift) call.getArgument(0)); })
                .when(racing).insert(any(Shift.class));
        var service = new ShiftServiceImpl(racing);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var first = pool.submit(() -> service.getForRoom(ROOM));
            var second = pool.submit(() -> service.getForRoom(ROOM));
            assertEquals(first.get(10, TimeUnit.SECONDS).getPeriods(), second.get(10, TimeUnit.SECONDS).getPeriods());
        }
        assertEquals(1, template.getCollection("shifts").countDocuments());
    }

    private int update(ShiftServiceImpl service, ShiftUpdateRequest request) {
        try { service.updateForRoom(ROOM, request); return 1; }
        catch (ConflictException expected) { return 0; }
    }

    private ShiftUpdateRequest request(Long version, String morningEnd, String afternoonStart) {
        return new ShiftUpdateRequest(version, List.of(new PeriodInput(ShiftType.MORNING, "08:00", morningEnd, true),
                new PeriodInput(ShiftType.AFTERNOON, afternoonStart, "16:00", true),
                new PeriodInput(ShiftType.EVENING, "18:00", "20:00", true)));
    }
}
