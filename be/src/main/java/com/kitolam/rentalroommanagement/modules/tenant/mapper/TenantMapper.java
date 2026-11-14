package com.kitolam.rentalroommanagement.modules.tenant.mapper;

import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.manager.document.Manager;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import com.kitolam.rentalroommanagement.modules.tenant.document.Tenant;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import org.mapstruct.Mapper;

import java.util.List;

@Mapper(componentModel = "spring")
public interface TenantMapper {

    default TenantResponse toBasicResponse(
            Tenant tenant,
            User user,
            String effectiveRole,
            TenantStatus branchStatus,
            List<String> scopedBranchIds,
            List<String> scopedBranchNames,
            List<String> scopedInactiveBranchIds,
            String currentRoomNumber
    ) {
        if (tenant == null) {
            return null;
        }
        boolean emailVerified = user != null && user.isEmailVerified();
        boolean passwordSet = user != null && user.getPasswordHash() != null && !user.getPasswordHash().isBlank();
        String accountStatus;
        if (user == null) {
            accountStatus = "NO_ACCOUNT";
        } else if (!emailVerified) {
            accountStatus = "PENDING_VERIFICATION";
        } else if (!passwordSet) {
            accountStatus = "PENDING_PASSWORD";
        } else if (user.isEnabled()) {
            accountStatus = "ACTIVE";
        } else {
            accountStatus = "DISABLED";
        }

        String role = (effectiveRole != null && !effectiveRole.isBlank())
                ? effectiveRole
                : (user != null && user.getRole() != null ? user.getRole().name() : "TENANT");
        String profileGender = user == null || user.getGender() == null ? "" : user.getGender();
        Gender gender = switch (profileGender) {
            case "MALE" -> Gender.MALE;
            case "FEMALE" -> Gender.FEMALE;
            case "OTHER" -> Gender.OTHER;
            default -> tenant.getGender();
        };

        return new TenantResponse(
                tenant.getId(),
                user != null ? user.getId() : null,
                tenant.getFullName(),
                tenant.getEmail(),
                tenant.getPhone(),
                role,
                tenant.getDateOfBirth(),
                gender,
                tenant.getAvatarUrl(),
                branchStatus,
                accountStatus,
                emailVerified,
                passwordSet,
                scopedBranchIds,
                scopedBranchNames,
                scopedInactiveBranchIds,
                currentRoomNumber,
                tenant.getCreatedAt(),
                tenant.getUpdatedAt()
        );
    }

    default TenantResponse fromManager(
            Manager manager,
            User user,
            String branchName
    ) {
        if (manager == null) {
            return null;
        }
        boolean emailVerified = user == null || user.isEmailVerified();
        boolean passwordSet = user == null || (user.getPasswordHash() != null && !user.getPasswordHash().isBlank());
        String accountStatus = (user != null && !user.isEnabled()) ? "DISABLED" : "ACTIVE";
        TenantStatus status = manager.getStatus() == ManagerStatus.ACTIVE
                ? TenantStatus.ACTIVE
                : TenantStatus.INACTIVE;
        List<String> branchIds = manager.getBranchId() != null ? List.of(manager.getBranchId()) : List.of();
        List<String> branchNames = (branchName != null && !branchName.isBlank()) ? List.of(branchName) : List.of();
        List<String> inactiveBranchIds = status == TenantStatus.INACTIVE ? branchIds : List.of();

        return new TenantResponse(
                manager.getId(),
                user != null ? user.getId() : null,
                manager.getFullName(),
                manager.getEmail(),
                manager.getPhone(),
                "MANAGER",
                null,
                null,
                null,
                status,
                accountStatus,
                emailVerified,
                passwordSet,
                branchIds,
                branchNames,
                inactiveBranchIds,
                null,
                manager.getCreatedAt(),
                manager.getUpdatedAt()
        );
    }
}
