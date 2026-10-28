package com.kitolam.rentalroommanagement.modules.appointment;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService.Actor;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentAccessService;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.base.BaseRepositoryImpl;
import com.kitolam.rentalroommanagement.common.exception.exceptions.*;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment;
import com.kitolam.rentalroommanagement.modules.appointment.dto.request.*;
import com.kitolam.rentalroommanagement.modules.appointment.enums.AppointmentStatus;
import com.kitolam.rentalroommanagement.modules.appointment.integration.*;
import com.kitolam.rentalroommanagement.modules.appointment.support.ViewingInventoryFixture;
import com.kitolam.rentalroommanagement.modules.appointment.repository.*;
import com.kitolam.rentalroommanagement.modules.appointment.service.impl.AppointmentServiceImpl;
import com.kitolam.rentalroommanagement.modules.shift.dto.request.ShiftUpdateRequest;
import com.kitolam.rentalroommanagement.modules.shift.repository.ShiftRepository;
import com.kitolam.rentalroommanagement.modules.shift.service.impl.ShiftServiceImpl;
import com.kitolam.rentalroommanagement.modules.appointment.mapper.AppointmentMapper;
import com.kitolam.rentalroommanagement.modules.appointment.service.support.AppointmentNotificationSupport;
import com.kitolam.rentalroommanagement.modules.appointment.service.impl.AppointmentAutomationServiceImpl;
import com.kitolam.rentalroommanagement.modules.notification.repository.NotificationRepository;
import com.kitolam.rentalroommanagement.modules.notification.service.impl.NotificationServiceImpl;
import com.kitolam.rentalroommanagement.modules.notification.mapper.NotificationMapper;
import org.mapstruct.factory.Mappers;
import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;
import com.mongodb.client.model.IndexOptions;
import org.bson.Document;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.mongodb.MongoTransactionManager;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.data.mongodb.repository.support.MongoRepositoryFactory;
import org.springframework.data.repository.core.support.RepositoryComposition.RepositoryFragments;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Critical creation and lifecycle invariants against a real local replica set. */
@EnabledIfEnvironmentVariable(named = "VIEWING_TEST_APPOINTMENTS", matches = "1")
class ViewingAppointmentMongoTest {
    private static final String ROOM = "710000000000000000000001";
    private static final String ROOM2 = "710000000000000000000002";
    private static final String BRANCH = "700000000000000000000001";
    private static final LocalDate DAY = LocalDate.of(2099, 10, 28);
    private MongoClient client;
    private MongoTemplate mongo;
    private AppointmentRepository appointments;
    private ShiftServiceImpl shifts;
    private AppointmentServiceImpl service;
    private ViewingInventoryGateway inventory;
    private AppointmentAccessService security;
    private NotificationRepository inboxRepository;
    private NotificationServiceImpl inbox;
    private AppointmentAutomationServiceImpl automation;
    private MutableClock clock;
    private final ThreadLocal<Actor> actor = new ThreadLocal<>();

    @BeforeEach
    void setup() {
        client = MongoClients.create("mongodb://127.0.0.1:27029/?replicaSet=viewing-rs&directConnection=true&serverSelectionTimeoutMS=3000");
        var database = new SimpleMongoClientDatabaseFactory(client, "viewing_creation_test_" + UUID.randomUUID().toString().replace("-", ""));
        mongo = new MongoTemplate(database);
        mongo.getCollection("appointments").createIndex(new Document("requesterAccountId", 1).append("idempotencyKey", 1), new IndexOptions().unique(true));
        var factory = new MongoRepositoryFactory(mongo);
        factory.setRepositoryBaseClass(BaseRepositoryImpl.class);
        appointments = factory.getRepository(AppointmentRepository.class,
                RepositoryFragments.just(new AppointmentOperationsImpl(mongo, new MongoTransactionManager(database))));
        shifts = new ShiftServiceImpl(factory.getRepository(ShiftRepository.class));
        security = mock(AppointmentAccessService.class);
        when(security.currentAccount()).thenAnswer(call -> Optional.ofNullable(actor.get()));
        when(security.managementAccounts(anyString())).thenReturn(List.of(owner()));
        inventory = spy(new ViewingInventoryFixture());
        clock = new MutableClock(Instant.parse("2099-10-27T00:00:00Z"));
        inboxRepository = factory.getRepository(NotificationRepository.class);
        inbox = new NotificationServiceImpl(inboxRepository, Mappers.getMapper(NotificationMapper.class));
        var notificationSupport = new AppointmentNotificationSupport(security);
        service = new AppointmentServiceImpl(appointments, security, inventory, shifts, clock,
                Mappers.getMapper(AppointmentMapper.class), notificationSupport, inbox);
        automation = new AppointmentAutomationServiceImpl(appointments, inventory, notificationSupport, inbox, clock);
        actor.set(user("a"));
    }

    @AfterEach
    void cleanup() {
        actor.remove();
        if (mongo != null && mongo.getDb().getName().startsWith("viewing_creation_test_")) mongo.getDb().drop();
        if (client != null) client.close();
    }

    @Test
    void createsSnapshotsAndReplaysSameKeyWithoutDuplicatingHistoryOrNotifications() {
        var input = input(ROOM, 0);
        var first = service.create(input, "request-one");
        var second = service.create(input, "request-one");
        assertEquals(first.id(), second.id()); assertEquals(AppointmentStatus.PENDING, first.status());
        assertEquals(Instant.parse("2099-10-28T01:00:00Z"), first.startAt());
        assertEquals(Instant.parse("2099-10-28T00:00:00Z"), first.expiresAt());
        var stored = appointments.findById(first.id()).orElseThrow();
        assertEquals("Account a", stored.getHistory().getFirst().actorName());
        assertEquals(1, stored.getHistory().size()); assertEquals(1, stored.getNotificationIntents().size());
        assertEquals(1, appointments.count());
        assertThrows(ConflictException.class, () -> service.create(new AppointmentCreateRequest(ROOM,
                input.shiftId(), DAY, input.configurationVersion(), "Tên khác", input.contactPhone()), "request-one"));
    }

    @Test
    void twoPeopleCompetingForOneRoomPeriodHaveExactlyOneWinner() throws Exception {
        var input = input(ROOM, 0);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var barrier = new CyclicBarrier(2);
            var first = pool.submit(() -> race(user("a"), input, "a-key", barrier));
            var second = pool.submit(() -> race(user("b"), input, "b-key", barrier));
            assertEquals(1, first.get(15, TimeUnit.SECONDS) + second.get(15, TimeUnit.SECONDS));
        }
        assertEquals(1, appointments.count());
    }

    @Test
    void samePersonCannotTakeSameTypeAcrossDifferentRoomsConcurrently() throws Exception {
        var input1 = input(ROOM, 0); var input2 = input(ROOM2, 0);
        try (var pool = Executors.newFixedThreadPool(2)) {
            var barrier = new CyclicBarrier(2);
            var first = pool.submit(() -> race(user("a"), input1, "room-one", barrier));
            var second = pool.submit(() -> race(user("a"), input2, "room-two", barrier));
            assertEquals(1, first.get(15, TimeUnit.SECONDS) + second.get(15, TimeUnit.SECONDS));
        }
        assertEquals(1, appointments.count());
    }

    @Test
    void exactExpiryReleasesTheHoldAndRecordsHistoryAndNotificationIntentsOnlyOnce() {
        var input = input(ROOM, 0);
        var first = service.create(input, "first");
        clock.value = first.expiresAt();
        actor.set(user("b"));
        var second = service.create(input, "second");
        assertNotEquals(first.id(), second.id());
        service.expirePendingRequests(); service.expirePendingRequests();
        actor.set(user("a"));
        var expired = service.getById(first.id());
        assertEquals(AppointmentStatus.EXPIRED, expired.status()); assertEquals(2, expired.history().size());
        assertEquals(3, appointments.findById(first.id()).orElseThrow().getNotificationIntents().size());
        assertEquals(AppointmentStatus.PENDING, appointments.findById(second.id()).orElseThrow().getStatus());
    }

    @Test
    void versionChangesCannotSilentlyChangeSelectedHoursOrHistoricalSnapshots() {
        var input = input(ROOM, 0);
        var first = service.create(input, "before-change");
        var configuration = shifts.getForRoom(ROOM);
        shifts.updateForRoom(ROOM, new ShiftUpdateRequest(configuration.getVersion(), configuration.getPeriods().stream()
                .map(p -> new ShiftUpdateRequest.PeriodInput(p.type(), p.type().ordinal() == 0 ? "09:00" : p.startTime(),
                        p.type().ordinal() == 0 ? "11:00" : p.endTime(), p.isActive())).toList()));
        assertEquals(first.id(), service.create(input, "before-change").id());
        actor.set(user("b"));
        assertThrows(ConflictException.class, () -> service.create(input, "after-change"));
        assertEquals(first.startAt(), appointments.findById(first.id()).orElseThrow().getStartAt());
    }

    @Test
    void listAndDetailUseServerIdentityScopeAndStoredContactData() {
        var first = service.create(input(ROOM, 0), "private");
        actor.set(user("b"));
        assertThrows(ForbiddenException.class, () -> service.getById(first.id()));
        var filter = new AppointmentFilterRequest(null, null, null, null, null, null);
        assertEquals(0, service.search(filter, PageRequest.of(0, 20)).getTotalElements());
        actor.set(owner());
        assertEquals(1, service.search(filter, PageRequest.of(0, 20)).getTotalElements());
        assertEquals("Người đặt thử", service.getById(first.id()).contactName());
        doThrow(new NotFoundException("Room removed")).when(inventory).getRoom(ROOM);
        assertEquals("Người đặt thử", service.getById(first.id()).contactName());
        actor.remove();
        assertThrows(UnauthorizedException.class, () -> service.create(input(ROOM2, 0), "guest"));
    }

    @Test
    void rejectionRequiresReasonReleasesThePeriodAndCannotBeOverwritten() {
        var pending = service.create(input(ROOM, 0), "reject");
        actor.set(user("b"));
        assertThrows(ForbiddenException.class, () -> service.reject(pending.id(), new AppointmentActionRequest.Rejection(0L, "Không phù hợp")));
        actor.set(owner());
        assertThrows(BadRequestException.class, () -> service.reject(pending.id(), new AppointmentActionRequest.Rejection(0L, "  ")));
        var rejected = service.reject(pending.id(), new AppointmentActionRequest.Rejection(0L, "Không tiếp khách được"));
        assertEquals(AppointmentStatus.REJECTED, rejected.status());
        assertEquals("Không tiếp khách được", rejected.rejectReason());
        assertEquals(2, rejected.history().size());
        assertThrows(ConflictException.class, () -> service.approve(pending.id(), new AppointmentActionRequest.Approval(0L)));
        actor.set(user("a"));
        assertNotEquals(pending.id(), service.create(input(ROOM, 0), "rebook").id());
    }

    @Test
    void approvalRechecksInventoryAndExpiryButKeepsTheBookedShiftSnapshot() {
        var pending = service.create(input(ROOM, 0), "approve");
        actor.set(owner());
        doReturn(new ViewingInventoryFixture().getRoom("710000000000000000000003")).when(inventory).getRoom(ROOM);
        assertThrows(ConflictException.class, () -> service.approve(pending.id(), new AppointmentActionRequest.Approval(0L)));
        reset(inventory);
        var configuration = shifts.getForRoom(ROOM);
        shifts.updateForRoom(ROOM, new ShiftUpdateRequest(configuration.getVersion(), configuration.getPeriods().stream()
                .map(p -> new ShiftUpdateRequest.PeriodInput(p.type(), p.startTime(), p.endTime(), false)).toList()));
        var approved = service.approve(pending.id(), new AppointmentActionRequest.Approval(0L));
        assertEquals(pending.startAt(), approved.startAt());
        assertEquals("Owner", approved.approvedByName());
        assertEquals(clock.value, approved.approvedAt());

        actor.set(user("a"));
        var expiring = service.create(input(ROOM2, 1), "expire-during-lookup");
        actor.set(owner());
        doAnswer(call -> { clock.value = expiring.expiresAt(); return call.callRealMethod(); }).when(inventory).getRoom(ROOM2);
        assertThrows(ConflictException.class, () -> service.approve(expiring.id(), new AppointmentActionRequest.Approval(0L)));
        assertEquals(AppointmentStatus.EXPIRED, appointments.findById(expiring.id()).orElseThrow().getStatus());
        assertNull(appointments.findById(expiring.id()).orElseThrow().getApprovedAt());
    }

    @Test
    void concurrentApprovalsRecordOnlyTheWinningApproverHistoryAndNotification() throws Exception {
        var pending = service.create(input(ROOM, 0), "concurrent-approve");
        var manager = new Actor(new AuthPrincipal("manager", "account@example.test", null, Role.MANAGER.name(), true, "Manager", null), null, Set.of(BRANCH));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var barrier = new CyclicBarrier(2);
            var first = pool.submit(() -> approveRace(owner(), pending.id(), barrier));
            var second = pool.submit(() -> approveRace(manager, pending.id(), barrier));
            assertEquals(1, first.get(15, TimeUnit.SECONDS) + second.get(15, TimeUnit.SECONDS));
        }
        var saved = appointments.findById(pending.id()).orElseThrow();
        assertEquals(AppointmentStatus.CONFIRMED, saved.getStatus());
        assertEquals(2, saved.getHistory().size());
        assertEquals(saved.getApprovedBy(), saved.getHistory().get(1).actorAccountId());
        assertEquals(2, saved.getNotificationIntents().size());
        assertEquals(1, saved.getActionVersion());
    }

    @Test
    void tenantCancellationHonorsExactTwoHourBoundaryAndManagerCancellationKeepsItsOwnReason() {
        var confirmed = confirmed(ROOM, 0, "cancel-exact");
        actor.set(user("a")); clock.value = confirmed.startAt().minus(Duration.ofHours(2));
        var cancelled = service.cancel(confirmed.id(), new AppointmentActionRequest.Cancellation(1L, null, null, null, null));
        assertEquals(AppointmentStatus.CANCELLED, cancelled.status());
        assertEquals(Appointment.CancellationCause.TENANT_REQUEST, cancelled.cancellationCause());
        assertThrows(ConflictException.class, () -> service.cancel(confirmed.id(), new AppointmentActionRequest.Cancellation(1L, null, null, null, null)));

        var later = confirmed(ROOM, 1, "cancel-too-late");
        actor.set(user("a")); clock.value = later.startAt().minus(Duration.ofHours(2)).plusMillis(1);
        assertThrows(ConflictException.class, () -> service.cancel(later.id(), new AppointmentActionRequest.Cancellation(1L, null, null, null, null)));
        actor.set(owner());
        var handled = service.cancel(later.id(), new AppointmentActionRequest.Cancellation(1L, "Người xem gọi xin hủy",
                Appointment.CancellationCause.TENANT_REQUEST, true, true));
        assertEquals(AppointmentStatus.CANCELLED, handled.status());
        assertEquals("Người xem gọi xin hủy", handled.cancellationReason());
        assertNull(handled.rejectReason()); assertNull(handled.result());
    }

    @Test
    void resultTimingCorrectionsAndVersionsPreserveBeforeAndAfterNotes() {
        var confirmed = confirmed(ROOM, 0, "results");
        assertThrows(ConflictException.class, () -> service.complete(confirmed.id(), new AppointmentActionRequest.Completion(1L, null, true)));
        clock.value = confirmed.startAt();
        var completed = service.complete(confirmed.id(), new AppointmentActionRequest.Completion(1L, "Đã xem xong", true));
        assertEquals(AppointmentStatus.COMPLETED, completed.status());
        assertThrows(ConflictException.class, () -> service.correctResult(confirmed.id(),
                new AppointmentActionRequest.Correction(2L, AppointmentActionRequest.Outcome.NO_SHOW, "Nhập nhầm", "Kiểm tra lại", null, true, true)));
        clock.value = confirmed.endAt();
        var corrected = service.correctResult(confirmed.id(), new AppointmentActionRequest.Correction(2L,
                AppointmentActionRequest.Outcome.NO_SHOW, "Không đến", "Đã nhập nhầm kết quả", null, true, true));
        assertEquals(AppointmentStatus.NO_SHOW, corrected.status());
        var audit = corrected.history().get(3);
        assertEquals("Đã xem xong", audit.previousNote()); assertEquals("Không đến", audit.note());
        assertEquals("Đã nhập nhầm kết quả", audit.reason());
        assertEquals(AppointmentStatus.COMPLETED, audit.before());
        assertThrows(ConflictException.class, () -> service.correctResult(confirmed.id(), new AppointmentActionRequest.Correction(2L,
                AppointmentActionRequest.Outcome.COMPLETED, null, "Ghi đè phiên bản cũ", true, null, null)));
        assertThrows(BadRequestException.class, () -> service.correctResult(confirmed.id(), new AppointmentActionRequest.Correction(3L,
                AppointmentActionRequest.Outcome.NO_SHOW, "a".repeat(501), "Ghi chú", null, true, true)));
        assertThrows(BadRequestException.class, () -> service.correctResult(confirmed.id(), new AppointmentActionRequest.Correction(3L,
                AppointmentActionRequest.Outcome.COMPLETED, null, "  ", true, null, null)));
        assertEquals(4, appointments.findById(confirmed.id()).orElseThrow().getHistory().size());
    }

    @Test
    void noShowRequiresEndOfShiftAndFactsAndTheNeedsResultFilterIsNotANewStatus() {
        var confirmed = confirmed(ROOM, 0, "no-show");
        clock.value = confirmed.endAt().minusMillis(1);
        assertThrows(ConflictException.class, () -> service.noShow(confirmed.id(), new AppointmentActionRequest.NoShow(1L, null, true, true)));
        clock.value = confirmed.endAt();
        var filter = new AppointmentFilterRequest(null, null, null, null, null, null, true);
        assertEquals(1, service.search(filter, PageRequest.of(0, 20)).getTotalElements());
        assertThrows(BadRequestException.class, () -> service.noShow(confirmed.id(), new AppointmentActionRequest.NoShow(1L, null, true, false)));
        assertEquals(AppointmentStatus.NO_SHOW, service.noShow(confirmed.id(), new AppointmentActionRequest.NoShow(1L, null, true, true)).status());
        assertEquals(0, service.search(filter, PageRequest.of(0, 20)).getTotalElements());
    }

    @Test
    void lateLandlordCancellationDoesNotBecomeNoShowAndNotificationFailureDoesNotUndoCancellation() {
        var confirmed = confirmed(ROOM, 0, "landlord");
        clock.value = confirmed.endAt().plus(Duration.ofDays(1));
        var cancelled = service.cancel(confirmed.id(), new AppointmentActionRequest.Cancellation(1L, "Chi nhánh không tiếp khách được",
                Appointment.CancellationCause.LANDLORD_UNAVAILABLE, null, true));
        assertEquals(AppointmentStatus.CANCELLED, cancelled.status());
        assertEquals(clock.value, cancelled.history().get(2).at());
        actor.set(user("a")); clock.value = Instant.parse("2099-10-27T00:00:00Z");
        var pending = service.create(input(ROOM2, 0), "notify-failure");
        when(security.managementAccounts(anyString())).thenThrow(new IllegalStateException("Gateway unavailable"));
        assertEquals(AppointmentStatus.CANCELLED, service.cancel(pending.id(), new AppointmentActionRequest.Cancellation(0L, null, null, null, null)).status());
        assertEquals(1, appointments.findById(pending.id()).orElseThrow().getNotificationRecipientRetries().size());
    }

    @Test
    void actionInputsRejectCallerSuppliedStatusAndOnlyAllowDeclaredActionFields() {
        var mapper = tools.jackson.databind.json.JsonMapper.builder().build();
        assertThrows(RuntimeException.class, () -> mapper.readValue("{\"version\":0,\"status\":\"CONFIRMED\"}", AppointmentActionRequest.Approval.class));
        assertThrows(RuntimeException.class, () -> mapper.readValue("{\"version\":0,\"approvedBy\":\"owner\"}", AppointmentActionRequest.Rejection.class));
    }

    @Test
    void databaseClockPreventsAnApprovalThatWaitedPastItsDeadline() {
        var pending = service.create(input(ROOM, 0), "database-deadline");
        mongo.updateFirst(org.springframework.data.mongodb.core.query.Query.query(
                org.springframework.data.mongodb.core.query.Criteria.where("id").is(pending.id())),
                new org.springframework.data.mongodb.core.query.Update().set("expiresAt", Instant.now().minusSeconds(1)), Appointment.class);
        // A stale application timestamp alone must not authorize the write.
        var saved = appointments.applyAction(pending.id(), AppointmentStatus.PENDING, 0L, Instant.parse("2000-01-01T00:00:00Z"),
                new org.springframework.data.mongodb.core.query.Update().set("status", AppointmentStatus.CONFIRMED));
        assertNull(saved);
        assertEquals(AppointmentStatus.PENDING, appointments.findById(pending.id()).orElseThrow().getStatus());
        assertEquals(1, appointments.findById(pending.id()).orElseThrow().getHistory().size());
    }

    private com.kitolam.rentalroommanagement.modules.appointment.dto.response.AppointmentResponse confirmed(String room, int period, String key) {
        actor.set(user("a"));
        var pending = service.create(input(room, period), key);
        actor.set(owner());
        return service.approve(pending.id(), new AppointmentActionRequest.Approval(0L));
    }

    @Test
    void fullFlowPublishesScopedNotificationsAndReadingPreservesTheFirstReadTimeAndStatus() {
        var pending = service.create(input(ROOM, 0), "inbox-flow");
        automation.runCycle(); automation.runCycle();
        actor.set(owner());
        var ownerInbox = service.notifications(null, PageRequest.of(0, 20));
        assertEquals(1, ownerInbox.getTotalElements());
        assertTrue(ownerInbox.getContent().getFirst().detailPath().startsWith("/manager/appointments/"));
        service.approve(pending.id(), new AppointmentActionRequest.Approval(0L));
        automation.runCycle();
        actor.set(user("a"));
        var userInbox = service.notifications(false, PageRequest.of(0, 20));
        assertEquals(1, userInbox.getTotalElements());
        var notification = userInbox.getContent().getFirst();
        assertEquals("APPROVED", notification.kind());
        Instant firstRead = service.readNotification(notification.id()).readAt();
        clock.value = clock.value.plusSeconds(10);
        assertEquals(firstRead, service.readNotification(notification.id()).readAt());
        assertEquals(AppointmentStatus.CONFIRMED, service.getById(pending.id()).status());
        actor.set(user("b"));
        assertEquals(0, service.notifications(null, PageRequest.of(0, 20)).getTotalElements());
        assertThrows(NotFoundException.class, () -> service.readNotification(notification.id()));
        actor.set(new Actor(new AuthPrincipal("owner", "account@example.test", null, Role.OWNER.name(), true, "Owner", null), null, Set.of()));
        assertEquals(0, service.notifications(null, PageRequest.of(0, 20)).getTotalElements());
        assertThrows(NotFoundException.class, () -> service.readNotification(ownerInbox.getContent().getFirst().id()));
    }

    @Test
    void pendingAndConfirmedRemindersAreSentOnceAndLateApprovalDoesNotReceiveACatchupReminder() {
        var pending = service.create(input(ROOM, 0), "pending-reminder");
        automation.runCycle();
        clock.value = pending.expiresAt().minus(Duration.ofHours(1));
        automation.runCycle(); automation.runCycle();
        assertEquals(1, inboxRepository.findAll().stream().filter(n -> "REMIND_APPROVAL".equals(n.getKind())).count());
        assertEquals(1, appointments.findById(pending.id()).orElseThrow().getHistory().size());
        actor.set(owner());
        service.approve(pending.id(), new AppointmentActionRequest.Approval(0L));
        clock.value = pending.startAt().minus(Duration.ofHours(1));
        automation.runCycle(); automation.runCycle();
        assertEquals(1, inboxRepository.findAll().stream().filter(n -> "REMIND_VIEWING".equals(n.getKind())).count());
        assertEquals(AppointmentStatus.CONFIRMED, appointments.findById(pending.id()).orElseThrow().getStatus());

        clock.value = pending.startAt().minus(Duration.ofMinutes(30));
        actor.set(user("b"));
        var late = service.create(input(ROOM2, 0), "late-approval");
        actor.set(owner()); service.approve(late.id(), new AppointmentActionRequest.Approval(0L));
        automation.runCycle();
        assertNull(appointments.findById(late.id()).orElseThrow().getPendingReminderQueuedAt());
        assertNull(appointments.findById(late.id()).orElseThrow().getConfirmedReminderQueuedAt());
        assertEquals(1, inboxRepository.findAll().stream().filter(n -> "REMIND_VIEWING".equals(n.getKind())).count());
    }

    @Test
    void expirationAutomationAndReadAllAreIdempotentAndNeverChangeAnAlreadyConfirmedAppointment() {
        var pending = service.create(input(ROOM, 0), "expiration-inbox");
        var confirmed = confirmed(ROOM2, 1, "confirmed-does-not-expire");
        clock.value = pending.expiresAt();
        automation.runCycle(); automation.runCycle();
        assertEquals(AppointmentStatus.EXPIRED, appointments.findById(pending.id()).orElseThrow().getStatus());
        assertEquals(AppointmentStatus.CONFIRMED, appointments.findById(confirmed.id()).orElseThrow().getStatus());
        assertEquals(2, appointments.findById(pending.id()).orElseThrow().getHistory().size());
        assertEquals(2, inboxRepository.findAll().stream().filter(n -> "EXPIRED".equals(n.getKind())).count());
        actor.set(user("a"));
        assertTrue(service.readAllNotifications() > 0);
        assertEquals(0, service.readAllNotifications());
        assertEquals(0, service.notifications(false, PageRequest.of(0, 20)).getTotalElements());
    }

    @Test
    void slotTemporaryHoldDoesNotCancelButOfficialExhaustionCancelsOnlyFutureAffectedAppointments() {
        var slot = confirmed(ROOM2, 0, "slot-auto-cancel");
        actor.set(user("b")); var otherRoom = service.create(input(ROOM, 0), "other-room");
        doReturn(snapshot(ROOM2, 4, 2, 1, 0, true, true)).when(inventory).getRoom(ROOM2);
        automation.runCycle();
        assertEquals(AppointmentStatus.CONFIRMED, appointments.findById(slot.id()).orElseThrow().getStatus());
        doReturn(snapshot(ROOM2, 4, 2, 1, 1, true, true)).when(inventory).getRoom(ROOM2);
        automation.runCycle();
        assertEquals(AppointmentStatus.CONFIRMED, appointments.findById(slot.id()).orElseThrow().getStatus());
        doReturn(snapshot(ROOM2, 4, 2, 2, 0, true, true)).when(inventory).getRoom(ROOM2);
        automation.runCycle(); automation.runCycle();
        var cancelled = appointments.findById(slot.id()).orElseThrow();
        assertEquals(AppointmentStatus.CANCELLED, cancelled.getStatus());
        assertEquals(Appointment.CancellationCause.OFFICIAL_BOOKING, cancelled.getCancellationCause());
        assertEquals(List.of("official-booking-test"), cancelled.getHistory().getLast().relatedBookingIds());
        assertEquals("inventory-test-v2", cancelled.getHistory().getLast().sourceRevision());
        assertNull(cancelled.getHistory().getLast().actorAccountId());
        assertEquals(AppointmentStatus.PENDING, appointments.findById(otherRoom.id()).orElseThrow().getStatus());
        doReturn(snapshot(ROOM2, 4, 0, 0, 0, true, true)).when(inventory).getRoom(ROOM2);
        automation.runCycle();
        assertEquals(AppointmentStatus.CANCELLED, appointments.findById(slot.id()).orElseThrow().getStatus());
    }

    @Test
    void disablingShiftPreservesAppointmentsAndInactiveBranchCancelsFutureButNeverPastConfirmedAppointments() {
        var future = confirmed(ROOM, 0, "branch-unavailable");
        var configuration = shifts.getForRoom(ROOM);
        shifts.updateForRoom(ROOM, new ShiftUpdateRequest(configuration.getVersion(), configuration.getPeriods().stream()
                .map(p -> new ShiftUpdateRequest.PeriodInput(p.type(), p.startTime(), p.endTime(), false)).toList()));
        automation.runCycle();
        assertEquals(AppointmentStatus.CONFIRMED, appointments.findById(future.id()).orElseThrow().getStatus());
        doReturn(snapshot(ROOM, 1, 0, 0, 0, false, true)).when(inventory).getRoom(ROOM);
        automation.runCycle();
        assertEquals(Appointment.CancellationCause.ROOM_UNAVAILABLE, appointments.findById(future.id()).orElseThrow().getCancellationCause());
        var past = confirmed(ROOM2, 1, "past-confirmed");
        clock.value = past.startAt();
        doReturn(snapshot(ROOM2, 4, 2, 2, 0, true, true)).when(inventory).getRoom(ROOM2);
        automation.runCycle();
        assertEquals(AppointmentStatus.CONFIRMED, appointments.findById(past.id()).orElseThrow().getStatus());
    }

    @Test
    void notificationDeliveryFailureDoesNotUndoSystemCancellationAndRetryCannotDuplicateMessages() {
        var pending = service.create(input(ROOM, 0), "delivery-failure");
        doReturn(snapshot(ROOM, 1, 0, 1, 0, true, true)).when(inventory).getRoom(ROOM);
        var failingInbox = spy(inbox);
        doThrow(new IllegalStateException("Inbox unavailable")).when(failingInbox).publish(any());
        var worker = new AppointmentAutomationServiceImpl(appointments, inventory, new AppointmentNotificationSupport(security), failingInbox, clock);
        worker.runCycle();
        assertEquals(AppointmentStatus.CANCELLED, appointments.findById(pending.id()).orElseThrow().getStatus());
        assertEquals(2, appointments.findById(pending.id()).orElseThrow().getHistory().size());
        assertEquals(0, inboxRepository.count());
        assertFalse(appointments.findById(pending.id()).orElseThrow().getNotificationIntents().isEmpty());
        reset(failingInbox); worker.runCycle(); worker.runCycle();
        assertEquals(3, inboxRepository.count());
        assertTrue(appointments.findById(pending.id()).orElseThrow().getNotificationIntents().isEmpty());
    }

    @Test
    void failedRecipientLookupIsRetriedAndStaleReminderIsDiscardedAfterRejection() {
        when(security.managementAccounts(anyString())).thenThrow(new IllegalStateException("Security unavailable"));
        var pending = service.create(input(ROOM, 0), "lookup-retry");
        assertEquals(1, appointments.findById(pending.id()).orElseThrow().getNotificationRecipientRetries().size());
        doReturn(List.of(owner())).when(security).managementAccounts(anyString());
        automation.runCycle();
        assertEquals(1, inboxRepository.count());
        var failingInbox = spy(inbox);
        doThrow(new IllegalStateException("Reminder delivery unavailable")).when(failingInbox).publish(any());
        var worker = new AppointmentAutomationServiceImpl(appointments, inventory, new AppointmentNotificationSupport(security), failingInbox, clock);
        clock.value = pending.expiresAt().minus(Duration.ofHours(1)); worker.runCycle();
        actor.set(owner()); service.reject(pending.id(), new AppointmentActionRequest.Rejection(0L, "Không bố trí được lịch"));
        reset(failingInbox); worker.runCycle();
        assertEquals(0, inboxRepository.findAll().stream().filter(n -> "REMIND_APPROVAL".equals(n.getKind())).count());
        assertTrue(appointments.findById(pending.id()).orElseThrow().getNotificationIntents().isEmpty());
    }

    @Test
    void concurrentWorkersQueueAndDeliverEachReminderOnlyOnce() throws Exception {
        var pending = service.create(input(ROOM, 0), "worker-race");
        clock.value = pending.expiresAt().minus(Duration.ofHours(1));
        try (var pool = Executors.newFixedThreadPool(2)) {
            var barrier = new CyclicBarrier(2);
            var task = (Callable<Boolean>) () -> { barrier.await(5, TimeUnit.SECONDS); automation.runCycle(); return true; };
            var first = pool.submit(task); var second = pool.submit(task);
            first.get(15, TimeUnit.SECONDS); second.get(15, TimeUnit.SECONDS);
        }
        automation.runCycle();
        assertEquals(2, inboxRepository.count());
        assertEquals(1, inboxRepository.findAll().stream().filter(n -> "REMIND_APPROVAL".equals(n.getKind())).count());
        assertEquals(1, appointments.findById(pending.id()).orElseThrow().getHistory().size());
    }

    @Test
    void sameKeyAcrossDifferentDatesCannotCreateDuplicatesEvenWithoutSecondaryIndexes() throws Exception {
        mongo.getCollection("appointments").dropIndexes();
        var firstInput = input(ROOM, 0);
        var secondInput = new AppointmentCreateRequest(firstInput.roomId(), firstInput.shiftId(), DAY.plusDays(1),
                firstInput.configurationVersion(), firstInput.contactName(), firstInput.contactPhone());
        try (var pool = Executors.newFixedThreadPool(2)) {
            var barrier = new CyclicBarrier(2);
            var first = pool.submit(() -> race(user("a"), firstInput, "same-key", barrier));
            var second = pool.submit(() -> race(user("a"), secondInput, "same-key", barrier));
            assertEquals(1, first.get(15, TimeUnit.SECONDS) + second.get(15, TimeUnit.SECONDS));
        }
        assertEquals(1, appointments.count());
    }

    private ViewingRoomSnapshot snapshot(String roomId, int total, int occupied, int official, int temporary, boolean activeBranch, boolean operational) {
        return new ViewingRoomSnapshot(roomId, BRANCH, "Phòng thử", "Chi nhánh thử", "0900000000", true,
                activeBranch, operational, total == 1 ? ViewingRoomSnapshot.RentalMode.ROOM : ViewingRoomSnapshot.RentalMode.SLOT,
                total, occupied, official, temporary, official > 0 ? List.of("official-booking-test") : List.of(), "inventory-test-v2", clock.value);
    }

    private int approveRace(Actor account, String id, CyclicBarrier barrier) throws Exception {
        actor.set(account);
        try { barrier.await(5, TimeUnit.SECONDS); service.approve(id, new AppointmentActionRequest.Approval(0L)); return 1; }
        catch (ConflictException conflict) { return 0; }
        finally { actor.remove(); }
    }

    private int race(Actor account, AppointmentCreateRequest input, String key, CyclicBarrier barrier) throws Exception {
        actor.set(account);
        try { barrier.await(5, TimeUnit.SECONDS); service.create(input, key); return 1; }
        catch (ConflictException conflict) { return 0; }
        finally { actor.remove(); }
    }

    private AppointmentCreateRequest input(String room, int period) {
        var configuration = shifts.getForRoom(room);
        return new AppointmentCreateRequest(room, configuration.getPeriods().get(period).id(), DAY,
                configuration.getVersion(), "Người đặt thử", "0901234567");
    }
    private Actor user(String id) {
        return new Actor(new AuthPrincipal(id, "account@example.test", null, Role.TENANT.name(), true, "Account " + id, "0901234567"), null, Set.of());
    }
    private Actor owner() {
        return new Actor(new AuthPrincipal("owner", "account@example.test", null, Role.OWNER.name(), true, "Owner", null), null, Set.of(BRANCH));
    }
    private static class MutableClock extends Clock {
        volatile Instant value;
        MutableClock(Instant value) { this.value = value; }
        public ZoneId getZone() { return ZoneOffset.UTC; }
        public Clock withZone(ZoneId zone) { return this; }
        public Instant instant() { return value; }
    }
}
