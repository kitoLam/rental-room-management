package com.kitolam.rentalroommanagement.modules.servicerequest.service;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceDateConfirmationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRegistrationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRequestActionRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceRequestFilterRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.request.ServiceTerminationRequest;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.ServiceRequestResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.ServiceTenancyResponse;
import com.kitolam.rentalroommanagement.modules.servicerequest.dto.response.TenantServiceOverviewResponse;
import org.springframework.data.domain.Pageable;

import java.util.List;

/** Use cases of the "Đăng ký và ngừng dịch vụ" flow. */
public interface ServiceRequestService {

    // Tenant

    ServiceTenancyResponse currentTenancy(AuthPrincipal principal);

    List<TenantServiceOverviewResponse> catalog(AuthPrincipal principal);

    ServiceRequestResponse register(ServiceRegistrationRequest request, AuthPrincipal principal);

    ServiceRequestResponse terminate(ServiceTerminationRequest request, AuthPrincipal principal);

    PagedResponse<ServiceRequestResponse> mine(ServiceRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    ServiceRequestResponse cancel(String id, ServiceRequestActionRequest request, AuthPrincipal principal);

    // Tenant (own request) or management (own branches)

    ServiceRequestResponse getById(String id, AuthPrincipal principal);

    // Management

    PagedResponse<ServiceRequestResponse> search(ServiceRequestFilterRequest filter, Pageable pageable, AuthPrincipal principal);

    ServiceRequestResponse approve(String id, ServiceRequestActionRequest request, AuthPrincipal principal);

    ServiceRequestResponse reject(String id, ServiceRequestActionRequest request, AuthPrincipal principal);

    ServiceRequestResponse confirmInstallation(String id, ServiceDateConfirmationRequest request, AuthPrincipal principal);

    ServiceRequestResponse confirmTermination(String id, ServiceDateConfirmationRequest request, AuthPrincipal principal);
}
