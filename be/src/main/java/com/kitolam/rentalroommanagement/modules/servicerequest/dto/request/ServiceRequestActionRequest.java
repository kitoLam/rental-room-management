package com.kitolam.rentalroommanagement.modules.servicerequest.dto.request;

import jakarta.validation.constraints.Size;

/** Body of approval, rejection and cancellation. Rejection requires a note (checked by the service). */
public record ServiceRequestActionRequest(
        @Size(max = 500) String note
) {
}
