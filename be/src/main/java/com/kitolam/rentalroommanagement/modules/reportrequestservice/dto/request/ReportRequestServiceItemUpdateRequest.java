package com.kitolam.rentalroommanagement.modules.reportrequestservice.dto.request;

/** PATCH semantics: null fields are left unchanged. */
public record ReportRequestServiceItemUpdateRequest(
        String note
) {
}
