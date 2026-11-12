package com.kitolam.rentalroommanagement.modules.tenant.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.tenant.enums.Gender;
import com.kitolam.rentalroommanagement.modules.tenant.enums.TenantStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.Set;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "tenants")
public class Tenant extends BaseDocument {

    private String fullName;

    @Indexed
    private String email;

    @Indexed
    private String phone;

    private LocalDate dateOfBirth;

    private Gender gender;

    @Indexed
    private String idCardNumber;

    private String address;

    private String avatarUrl;

    private TenantStatus status = TenantStatus.ACTIVE;

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private Set<String> branchIds = new HashSet<>();

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private Set<String> inactiveBranchIds = new HashSet<>();

    public void addBranch(String branchId) {
        if (branchId == null || branchId.isBlank()) return;
        if (this.branchIds == null) {
            this.branchIds = new HashSet<>();
        }
        this.branchIds.add(branchId);
    }

    public boolean isInactiveInBranch(String branchId) {
        return branchId != null && this.inactiveBranchIds != null && this.inactiveBranchIds.contains(branchId);
    }

    public void setBranchActiveStatus(String branchId, boolean active) {
        if (branchId == null || branchId.isBlank()) return;
        addBranch(branchId);
        if (this.inactiveBranchIds == null) {
            this.inactiveBranchIds = new HashSet<>();
        }
        if (active) {
            this.inactiveBranchIds.remove(branchId);
        } else {
            this.inactiveBranchIds.add(branchId);
        }
    }
}
