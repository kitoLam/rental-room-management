package com.kitolam.rentalroommanagement.modules.servicerequest;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.servicerequest.document.ServiceRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestStatus;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/** State machine of {@link ServiceRequest}; pure unit tests, no Spring context or database. */
class ServiceRequestTest {

    private static final String ROOM_ID = "64b000000000000000000001";
    private static final String SERVICE_ID = "64b000000000000000000002";
    private static final String TENANT = "tenant-account";
    private static final String MANAGER = "manager-account";
    private static final Instant AT = Instant.parse("2026-11-02T03:00:00Z");
    private static final LocalDate DATE = LocalDate.of(2026, 11, 10);

    private static ServiceRequest submitted(ServiceRequestAction action) {
        ServiceRequest request = new ServiceRequest();
        request.setAction(action);
        request.setScope(ServiceScope.ROOM);
        request.setServiceId(SERVICE_ID);
        request.submit(ROOM_ID, TENANT, AT);
        return request;
    }

    private static List<ServiceRequestStatus> statusTrail(ServiceRequest request) {
        return request.getHistory().stream().map(ServiceRequest.HistoryEntry::statusTo).toList();
    }

    @Test
    void submitOpensPendingRequestWithOpenKey() {
        ServiceRequest request = submitted(ServiceRequestAction.REGISTER);

        assertEquals(ServiceRequestStatus.PENDING, request.getStatus());
        assertEquals("ROOM:" + ROOM_ID + ":" + SERVICE_ID, request.getOpenKey());
        assertEquals(List.of(ServiceRequestStatus.PENDING), statusTrail(request));
    }

    @Test
    void registerIsApprovedThenCompletedWithConfirmedDate() {
        ServiceRequest request = submitted(ServiceRequestAction.REGISTER);

        request.approve(MANAGER, null, AT);
        assertEquals(ServiceRequestStatus.APPROVED, request.getStatus());
        assertNotNull(request.getOpenKey(), "approved request still blocks a duplicate");

        request.complete(DATE, "sub-1", MANAGER, "installed", AT);
        assertEquals(ServiceRequestStatus.COMPLETED, request.getStatus());
        assertEquals(DATE, request.getConfirmedDate());
        assertEquals("sub-1", request.getSubscriptionId());
        assertEquals(MANAGER, request.getProcessedByAccountId());
        assertNull(request.getOpenKey());
        assertEquals(List.of(ServiceRequestStatus.PENDING, ServiceRequestStatus.APPROVED, ServiceRequestStatus.COMPLETED),
                statusTrail(request));
    }

    @Test
    void registerCannotBeCompletedBeforeApproval() {
        ServiceRequest request = submitted(ServiceRequestAction.REGISTER);

        assertThrows(ConflictException.class, () -> request.complete(DATE, "sub-1", MANAGER, null, AT));
        assertEquals(ServiceRequestStatus.PENDING, request.getStatus());
        assertNull(request.getConfirmedDate());
    }

    @Test
    void stopIsCompletedInOneStep() {
        ServiceRequest request = submitted(ServiceRequestAction.STOP);

        request.complete(DATE, "sub-1", MANAGER, null, AT);

        assertEquals(ServiceRequestStatus.COMPLETED, request.getStatus());
        assertEquals(DATE, request.getConfirmedDate());
        assertNull(request.getOpenKey());
    }

    @Test
    void stopCannotBeApproved() {
        ServiceRequest request = submitted(ServiceRequestAction.STOP);

        assertThrows(ConflictException.class, () -> request.approve(MANAGER, null, AT));
        assertEquals(ServiceRequestStatus.PENDING, request.getStatus());
    }

    @Test
    void approveTwiceIsRejected() {
        ServiceRequest request = submitted(ServiceRequestAction.REGISTER);
        request.approve(MANAGER, null, AT);

        assertThrows(ConflictException.class, () -> request.approve(MANAGER, null, AT));
    }

    @Test
    void rejectStoresReasonAndClosesRequest() {
        ServiceRequest request = submitted(ServiceRequestAction.REGISTER);

        request.reject(MANAGER, "Hết cổng mạng", AT);

        assertEquals(ServiceRequestStatus.REJECTED, request.getStatus());
        assertEquals("Hết cổng mạng", request.getRejectReason());
        assertNull(request.getOpenKey());
    }

    @Test
    void approvedRegisterCanStillBeRejected() {
        ServiceRequest request = submitted(ServiceRequestAction.REGISTER);
        request.approve(MANAGER, null, AT);

        request.reject(MANAGER, "Không lắp đặt được", AT);

        assertEquals(ServiceRequestStatus.REJECTED, request.getStatus());
        assertNull(request.getOpenKey());
    }

    @Test
    void closedRequestCannotBeRejected() {
        ServiceRequest request = submitted(ServiceRequestAction.STOP);
        request.complete(DATE, "sub-1", MANAGER, null, AT);

        assertThrows(ConflictException.class, () -> request.reject(MANAGER, "late", AT));
        assertEquals(ServiceRequestStatus.COMPLETED, request.getStatus());
    }

    @Test
    void pendingRequestCanBeCancelled() {
        ServiceRequest request = submitted(ServiceRequestAction.REGISTER);

        request.cancel(TENANT, null, AT);

        assertEquals(ServiceRequestStatus.CANCELLED, request.getStatus());
        assertNull(request.getOpenKey());
    }

    @Test
    void approvedRequestCannotBeCancelled() {
        ServiceRequest request = submitted(ServiceRequestAction.REGISTER);
        request.approve(MANAGER, null, AT);

        assertThrows(ConflictException.class, () -> request.cancel(TENANT, null, AT));
        assertEquals(ServiceRequestStatus.APPROVED, request.getStatus());
    }

    @Test
    void cancelledRequestCannotBeCompleted() {
        ServiceRequest request = submitted(ServiceRequestAction.STOP);
        request.cancel(TENANT, null, AT);

        assertThrows(ConflictException.class, () -> request.complete(DATE, "sub-1", MANAGER, null, AT));
    }
}
