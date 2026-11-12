package com.kitolam.rentalroommanagement.modules.dashboard.dto.request;

import com.kitolam.rentalroommanagement.common.validation.ValidObjectId;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ManagementReportRequest {
    @ValidObjectId
    private String branchId;
    @ValidObjectId
    private String roomId;
    private String fromMonth;
    private String toMonth;
    @Min(0)
    @Max(10000)
    private int page = 0;
    @Pattern(regexp = "receipts|leases|roomNumber")
    private String sort = "receipts";
}
