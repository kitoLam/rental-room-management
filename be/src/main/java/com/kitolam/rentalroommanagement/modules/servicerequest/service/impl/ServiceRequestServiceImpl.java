package com.kitolam.rentalroommanagement.modules.servicerequest.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.roomservice.dto.request.RoomServiceActivationRequest;
import com.kitolam.rentalroommanagement.modules.roomservice.service.RoomServiceService;
import com.kitolam.rentalroommanagement.modules.servicerequest.document.ServiceRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceDateConfirmationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRegistrationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRequestActionRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceTerminationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.ServiceRequestResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.ServiceTenancyResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.TenantServiceOverviewResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.TenantServiceOverviewResponse.Subscription;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceDisplayStatus;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestAction;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestOperation;
import com.kitolam.rentalroommanagement.modules.servicerequest.enums.ServiceRequestStatus;
import com.kitolam.rentalroommanagement.modules.servicerequest.integration.ActiveTenancySnapshot;
import com.kitolam.rentalroommanagement.modules.servicerequest.mapper.ServiceRequestMapper;
import com.kitolam.rentalroommanagement.modules.servicerequest.repository.ServiceRequestRepository;
import com.kitolam.rentalroommanagement.modules.servicerequest.service.ServiceRequestService;
import com.kitolam.rentalroommanagement.modules.servicerequest.service.support.ServiceRequestAccessSupport;
import com.kitolam.rentalroommanagement.modules.servicerequest.service.support.ServiceRequestAccessSupport.ManagementScope;
import com.kitolam.rentalroommanagement.modules.servicerequest.service.support.ServiceRequestNotificationSupport;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceStatus;
import com.kitolam.rentalroommanagement.modules.serviceitem.service.ServiceItemService;
import com.kitolam.rentalroommanagement.modules.slotservice.dto.request.SlotServiceActivationRequest;
import com.kitolam.rentalroommanagement.modules.slotservice.service.SlotServiceService;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ServiceRequestServiceImpl implements ServiceRequestService {

    private static final List<String> OPEN_STATUSES =
            List.of(ServiceRequestStatus.PENDING.name(), ServiceRequestStatus.APPROVED.name());

    private final ServiceRequestRepository serviceRequestRepository;
    private final ServiceRequestMapper mapper;
    private final MongoTemplate mongoTemplate;
    private final ServiceRequestAccessSupport access;
    private final ServiceRequestNotificationSupport notifications;
    private final ServiceItemService serviceItems;
    private final RoomServiceService roomServices;
    private final SlotServiceService slotServices;

    // ===== Tenant =====

    @Override
    public ServiceTenancyResponse currentTenancy(AuthPrincipal principal) {
        return mapper.toTenancy(access.requireTenancy(principal));
    }

    @Override
    public List<TenantServiceOverviewResponse> catalog(AuthPrincipal principal) {
        ActiveTenancySnapshot tenancy = access.requireTenancy(principal);
        Map<String, Subscription> subscriptions = activeSubscriptions(tenancy).stream()
                .collect(Collectors.toMap(Subscription::serviceId, Function.identity(), (first, second) -> first));
        Map<String, ServiceRequest> openRequests = openRequests(tenancy).stream()
                .collect(Collectors.toMap(ServiceRequest::getServiceId, Function.identity(), (first, second) -> first));

        Map<String, ServiceItemResponse> services = new LinkedHashMap<>();
        serviceItems.listSubscribable(scopesOf(tenancy)).forEach(service -> services.put(service.id(), service));
        // A service withdrawn from the catalog still shows while in use, so the tenant can ask to stop it.
        subscriptions.keySet().stream().filter(serviceId -> !services.containsKey(serviceId))
                .forEach(serviceId -> services.put(serviceId, serviceItems.getById(serviceId)));

        return services.values().stream()
                .map(service -> overview(service, subscriptions.get(service.id()), openRequests.get(service.id())))
                .toList();
    }

    @Override
    public ServiceRequestResponse register(ServiceRegistrationRequest request, AuthPrincipal principal) {
        ActiveTenancySnapshot tenancy = access.requireTenancy(principal);
        ServiceItemResponse service = serviceItems.requireActive(request.serviceId());
        if (service.calculationType() == CalculationType.METERED) {
            throw new BadRequestException("Dịch vụ tính theo chỉ số được cấu hình theo phòng, không cần đăng ký");
        }
        String targetId = targetId(service.scope(), tenancy);
        if (hasActiveSubscription(service.scope(), targetId, service.id())) {
            throw new ConflictException("Dịch vụ này đang được sử dụng");
        }
        requireProposedDate(request.proposedDate(), tenancy.contractEndDate());

        ServiceRequest serviceRequest = newRequest(ServiceRequestAction.REGISTER, tenancy, service, principal,
                request.proposedDate(), request.note());
        serviceRequest.setScope(service.scope());
        serviceRequest.setUnitPrice(service.unitPrice());
        serviceRequest.setQuantity(service.scope() == ServiceScope.SLOT && request.quantity() != null ? request.quantity() : 1);
        return submit(serviceRequest, targetId, principal);
    }

    @Override
    public ServiceRequestResponse terminate(ServiceTerminationRequest request, AuthPrincipal principal) {
        ActiveTenancySnapshot tenancy = access.requireTenancy(principal);
        Subscription subscription = activeSubscriptions(tenancy).stream()
                .filter(candidate -> candidate.id().equals(request.subscriptionId()))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Không tìm thấy dịch vụ đang sử dụng của bạn"));
        requireProposedDate(request.proposedDate(), tenancy.contractEndDate());
        if (request.proposedDate().isBefore(subscription.startDate())) {
            throw new BadRequestException("Ngày đề nghị ngừng không được trước ngày bắt đầu sử dụng");
        }

        ServiceItemResponse service = serviceItems.getById(subscription.serviceId());
        ServiceRequest serviceRequest = newRequest(ServiceRequestAction.STOP, tenancy, service, principal,
                request.proposedDate(), request.note());
        serviceRequest.setScope(subscription.scope());
        serviceRequest.setSubscriptionId(subscription.id());
        serviceRequest.setUnitPrice(subscription.unitPrice());
        serviceRequest.setQuantity(subscription.quantity());
        return submit(serviceRequest, targetId(subscription.scope(), tenancy), principal);
    }

    @Override
    public PagedResponse<ServiceRequestResponse> mine(ServiceRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        ManagementScope scope = access.managementScope(principal);
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("requesterAccountId").is(principal.userId()));
        addFilters(criteria, filter);
        return page(criteria, pageable, principal, scope);
    }

    @Override
    public ServiceRequestResponse cancel(String id, ServiceRequestActionRequest request, AuthPrincipal principal) {
        ManagementScope scope = access.managementScope(principal);
        ServiceRequest serviceRequest = find(id);
        if (!isRequester(serviceRequest, principal)) {
            throw new NotFoundException("Không tìm thấy yêu cầu dịch vụ");
        }
        Instant now = access.now();
        serviceRequest.cancel(principal.userId(), note(request), now);
        ServiceRequest saved = serviceRequestRepository.save(serviceRequest);
        notifications.cancelled(saved, now);
        return toResponse(saved, principal, scope);
    }

    // ===== Tenant or management =====

    @Override
    public ServiceRequestResponse getById(String id, AuthPrincipal principal) {
        ManagementScope scope = access.managementScope(principal);
        ServiceRequest serviceRequest = find(id);
        if (!isRequester(serviceRequest, principal) && !scope.includes(serviceRequest.getBranchId())) {
            throw new NotFoundException("Không tìm thấy yêu cầu dịch vụ");
        }
        return toResponse(serviceRequest, principal, scope);
    }

    // ===== Management =====

    @Override
    public PagedResponse<ServiceRequestResponse> search(ServiceRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        ManagementScope scope = access.requireManagementScope(principal);
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        if (!scope.all()) {
            if (filter.branchId() != null && !scope.includes(filter.branchId())) {
                throw new ForbiddenException("Bạn không quản lý chi nhánh này");
            }
            criteria.add(Criteria.where("branchId").in(scope.branchIds().stream().map(MongoQueryHelper::toObjectId).toList()));
        }
        MongoQueryHelper.addObjectIdEquals(criteria, "branchId", filter.branchId());
        addFilters(criteria, filter);
        return page(criteria, pageable, principal, scope);
    }

    @Override
    public ServiceRequestResponse approve(String id, ServiceRequestActionRequest request, AuthPrincipal principal) {
        ManagementScope scope = access.requireManagementScope(principal);
        ServiceRequest serviceRequest = findManaged(id, scope);
        Instant now = access.now();
        serviceRequest.approve(principal.userId(), note(request), now);
        ServiceRequest saved = serviceRequestRepository.save(serviceRequest);
        notifications.approved(saved, now);
        return toResponse(saved, principal, scope);
    }

    @Override
    public ServiceRequestResponse reject(String id, ServiceRequestActionRequest request, AuthPrincipal principal) {
        String reason = note(request);
        if (reason == null) {
            throw new BadRequestException("Vui lòng nhập lý do từ chối");
        }
        ManagementScope scope = access.requireManagementScope(principal);
        ServiceRequest serviceRequest = findManaged(id, scope);
        Instant now = access.now();
        serviceRequest.reject(principal.userId(), reason, now);
        ServiceRequest saved = serviceRequestRepository.save(serviceRequest);
        notifications.rejected(saved, now);
        return toResponse(saved, principal, scope);
    }

    @Override
    @Transactional
    public ServiceRequestResponse confirmInstallation(String id, ServiceDateConfirmationRequest request, AuthPrincipal principal) {
        ManagementScope scope = access.requireManagementScope(principal);
        ServiceRequest serviceRequest = findManaged(id, scope);
        if (serviceRequest.getAction() != ServiceRequestAction.REGISTER) {
            throw new BadRequestException("Đây không phải yêu cầu đăng ký dịch vụ");
        }
        serviceRequest.ensureCompletable();
        LocalDate installedDate = request.effectiveDate();
        if (serviceRequest.getCreatedAt() != null && installedDate.isBefore(access.dateOf(serviceRequest.getCreatedAt()))) {
            throw new BadRequestException("Ngày lắp đặt không được trước ngày gửi yêu cầu");
        }
        requireWithinContract(installedDate, serviceRequest.getContractEndDate(), "Ngày lắp đặt");

        // Billing starts from the confirmed installation date, not from the request date.
        String subscriptionId = serviceRequest.getScope() == ServiceScope.ROOM
                ? roomServices.activate(new RoomServiceActivationRequest(serviceRequest.getRoomId(),
                        serviceRequest.getServiceId(), serviceRequest.getUnitPrice(), installedDate, serviceRequest.getId())).id()
                : slotServices.activate(new SlotServiceActivationRequest(serviceRequest.getRoomSlotId(),
                        serviceRequest.getServiceId(), serviceRequest.getQuantity(), serviceRequest.getUnitPrice(),
                        installedDate, serviceRequest.getId())).id();

        return complete(serviceRequest, installedDate, subscriptionId, request.note(), principal, scope);
    }

    @Override
    @Transactional
    public ServiceRequestResponse confirmTermination(String id, ServiceDateConfirmationRequest request, AuthPrincipal principal) {
        ManagementScope scope = access.requireManagementScope(principal);
        ServiceRequest serviceRequest = findManaged(id, scope);
        if (serviceRequest.getAction() != ServiceRequestAction.STOP) {
            throw new BadRequestException("Đây không phải yêu cầu ngừng dịch vụ");
        }
        serviceRequest.ensureCompletable();
        LocalDate endDate = request.effectiveDate();
        requireWithinContract(endDate, serviceRequest.getContractEndDate(), "Ngày kết thúc");

        String reason = StringUtils.hasText(serviceRequest.getNote()) ? serviceRequest.getNote() : "Người thuê yêu cầu ngừng";
        String subscriptionId = serviceRequest.getScope() == ServiceScope.ROOM
                ? roomServices.terminate(serviceRequest.getSubscriptionId(), endDate, reason).id()
                : slotServices.terminate(serviceRequest.getSubscriptionId(), endDate, reason).id();

        return complete(serviceRequest, endDate, subscriptionId, request.note(), principal, scope);
    }

    // ===== Helpers =====

    private ServiceRequestResponse complete(ServiceRequest serviceRequest, LocalDate effectiveDate, String subscriptionId,
                                            String comment, AuthPrincipal principal, ManagementScope scope) {
        Instant now = access.now();
        serviceRequest.complete(effectiveDate, subscriptionId, principal.userId(), trimToNull(comment), now);
        ServiceRequest saved = serviceRequestRepository.save(serviceRequest);
        notifications.completed(saved, now);
        return toResponse(saved, principal, scope);
    }

    private ServiceRequest newRequest(ServiceRequestAction action, ActiveTenancySnapshot tenancy, ServiceItemResponse service,
                                      AuthPrincipal principal, LocalDate proposedDate, String note) {
        ServiceRequest serviceRequest = new ServiceRequest();
        serviceRequest.setAction(action);
        serviceRequest.setTenantId(tenancy.tenantId());
        serviceRequest.setRequesterAccountId(principal.userId());
        serviceRequest.setContractId(tenancy.contractId());
        serviceRequest.setContractTenantId(tenancy.contractTenantId());
        serviceRequest.setBranchId(tenancy.branchId());
        serviceRequest.setRoomId(tenancy.roomId());
        serviceRequest.setRoomSlotId(tenancy.roomSlotId());
        serviceRequest.setServiceId(service.id());
        serviceRequest.setProposedDate(proposedDate);
        serviceRequest.setContractEndDate(tenancy.contractEndDate());
        serviceRequest.setNote(trimToNull(note));
        serviceRequest.setServiceName(service.name());
        serviceRequest.setTenantName(StringUtils.hasText(principal.fullName()) ? principal.fullName() : principal.email());
        serviceRequest.setRoomNumber(tenancy.roomNumber());
        serviceRequest.setSlotCode(tenancy.slotCode());
        return serviceRequest;
    }

    private ServiceRequestResponse submit(ServiceRequest serviceRequest, String targetId, AuthPrincipal principal) {
        Instant now = access.now();
        serviceRequest.submit(targetId, principal.userId(), now);
        ServiceRequest saved;
        try {
            saved = serviceRequestRepository.save(serviceRequest);
        } catch (DuplicateKeyException duplicate) {
            throw new ConflictException("Đã có yêu cầu đang chờ xử lý cho dịch vụ này");
        }
        notifications.submitted(saved, now);
        return toResponse(saved, principal, access.managementScope(principal));
    }

    private TenantServiceOverviewResponse overview(ServiceItemResponse service, Subscription subscription, ServiceRequest openRequest) {
        ServiceDisplayStatus displayStatus;
        List<ServiceRequestOperation> allowed;
        if (openRequest != null) {
            displayStatus = openRequest.getAction() == ServiceRequestAction.STOP ? ServiceDisplayStatus.STOP_PENDING
                    : openRequest.getStatus() == ServiceRequestStatus.APPROVED ? ServiceDisplayStatus.APPROVED
                    : ServiceDisplayStatus.PENDING;
            allowed = openRequest.getStatus() == ServiceRequestStatus.PENDING ? List.of(ServiceRequestOperation.CANCEL) : List.of();
        } else if (subscription != null) {
            displayStatus = ServiceDisplayStatus.ACTIVE;
            allowed = List.of(ServiceRequestOperation.STOP);
        } else {
            displayStatus = ServiceDisplayStatus.AVAILABLE;
            allowed = service.status() == ServiceStatus.ACTIVE ? List.of(ServiceRequestOperation.REGISTER) : List.of();
        }
        return mapper.toOverview(service, subscription, openRequest == null ? null : mapper.toOpenRequest(openRequest),
                displayStatus, allowed);
    }

    private List<ServiceRequestOperation> allowedActions(ServiceRequest serviceRequest, AuthPrincipal principal, ManagementScope scope) {
        List<ServiceRequestOperation> allowed = new ArrayList<>();
        ServiceRequestStatus status = serviceRequest.getStatus();
        if (isRequester(serviceRequest, principal) && status == ServiceRequestStatus.PENDING) {
            allowed.add(ServiceRequestOperation.CANCEL);
        }
        if (scope.includes(serviceRequest.getBranchId())) {
            boolean register = serviceRequest.getAction() == ServiceRequestAction.REGISTER;
            if (register && status == ServiceRequestStatus.PENDING) {
                allowed.addAll(List.of(ServiceRequestOperation.APPROVE, ServiceRequestOperation.REJECT));
            } else if (register && status == ServiceRequestStatus.APPROVED) {
                allowed.addAll(List.of(ServiceRequestOperation.CONFIRM_INSTALLATION, ServiceRequestOperation.REJECT));
            } else if (!register && status == ServiceRequestStatus.PENDING) {
                allowed.addAll(List.of(ServiceRequestOperation.CONFIRM_TERMINATION, ServiceRequestOperation.REJECT));
            }
        }
        return allowed;
    }

    private ServiceRequestResponse toResponse(ServiceRequest serviceRequest, AuthPrincipal principal, ManagementScope scope) {
        return mapper.toResponse(serviceRequest, allowedActions(serviceRequest, principal, scope));
    }

    private PagedResponse<ServiceRequestResponse> page(List<Criteria> criteria, Pageable pageable,
                                                       AuthPrincipal principal, ManagementScope scope) {
        return PagedResponse.from(MongoQueryHelper.page(mongoTemplate, criteria, pageable, ServiceRequest.class),
                serviceRequest -> toResponse(serviceRequest, principal, scope));
    }

    private void addFilters(List<Criteria> criteria, ServiceRequestFilterRequest filter) {
        MongoQueryHelper.addEquals(criteria, "status", filter.status());
        MongoQueryHelper.addEquals(criteria, "action", filter.action());
        MongoQueryHelper.addObjectIdEquals(criteria, "roomId", filter.roomId());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "serviceName", "tenantName", "roomNumber");
    }

    private ServiceRequest find(String id) {
        return serviceRequestRepository.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy yêu cầu dịch vụ"));
    }

    /** Requests of branches outside the caller's scope are reported as missing, not forbidden. */
    private ServiceRequest findManaged(String id, ManagementScope scope) {
        ServiceRequest serviceRequest = find(id);
        if (!scope.includes(serviceRequest.getBranchId())) {
            throw new NotFoundException("Không tìm thấy yêu cầu dịch vụ");
        }
        return serviceRequest;
    }

    private List<ServiceRequest> openRequests(ActiveTenancySnapshot tenancy) {
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        criteria.add(Criteria.where("status").in(OPEN_STATUSES));
        Criteria room = Criteria.where("scope").is(ServiceScope.ROOM.name())
                .and("roomId").is(MongoQueryHelper.toObjectId(tenancy.roomId()));
        if (tenancy.roomSlotId() == null) {
            criteria.add(room);
        } else {
            Criteria slot = Criteria.where("scope").is(ServiceScope.SLOT.name())
                    .and("roomSlotId").is(MongoQueryHelper.toObjectId(tenancy.roomSlotId()));
            criteria.add(new Criteria().orOperator(room, slot));
        }
        return mongoTemplate.find(new Query(new Criteria().andOperator(criteria)), ServiceRequest.class);
    }

    private List<Subscription> activeSubscriptions(ActiveTenancySnapshot tenancy) {
        List<Subscription> subscriptions = new ArrayList<>();
        roomServices.listActiveByRoom(tenancy.roomId()).stream().map(mapper::toSubscription).forEach(subscriptions::add);
        if (tenancy.roomSlotId() != null) {
            slotServices.listActiveBySlot(tenancy.roomSlotId()).stream().map(mapper::toSubscription).forEach(subscriptions::add);
        }
        return subscriptions;
    }

    private boolean hasActiveSubscription(ServiceScope scope, String targetId, String serviceId) {
        return scope == ServiceScope.ROOM
                ? roomServices.findActive(targetId, serviceId).isPresent()
                : slotServices.findActive(targetId, serviceId).isPresent();
    }

    private static Set<ServiceScope> scopesOf(ActiveTenancySnapshot tenancy) {
        return tenancy.roomSlotId() == null ? EnumSet.of(ServiceScope.ROOM) : EnumSet.allOf(ServiceScope.class);
    }

    private static String targetId(ServiceScope scope, ActiveTenancySnapshot tenancy) {
        if (scope == ServiceScope.ROOM) return tenancy.roomId();
        if (tenancy.roomSlotId() == null) {
            throw new BadRequestException("Dịch vụ này áp dụng theo chỗ ở, nhưng bạn đang thuê nguyên phòng");
        }
        return tenancy.roomSlotId();
    }

    private void requireProposedDate(LocalDate proposedDate, LocalDate contractEndDate) {
        if (proposedDate.isBefore(access.today())) {
            throw new BadRequestException("Ngày đề nghị không được trước hôm nay");
        }
        requireWithinContract(proposedDate, contractEndDate, "Ngày đề nghị");
    }

    private static void requireWithinContract(LocalDate date, LocalDate contractEndDate, String label) {
        if (contractEndDate != null && date.isAfter(contractEndDate)) {
            throw new BadRequestException(label + " không được sau ngày kết thúc hợp đồng " + contractEndDate);
        }
    }

    private static boolean isRequester(ServiceRequest serviceRequest, AuthPrincipal principal) {
        return principal != null && principal.userId().equals(serviceRequest.getRequesterAccountId());
    }

    private static String note(ServiceRequestActionRequest request) {
        return request == null ? null : trimToNull(request.note());
    }

    private static String trimToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }
}
