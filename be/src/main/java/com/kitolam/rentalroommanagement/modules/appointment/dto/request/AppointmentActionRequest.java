package com.kitolam.rentalroommanagement.modules.appointment.dto.request;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import com.kitolam.rentalroommanagement.modules.appointment.document.Appointment.CancellationCause;
import jakarta.validation.constraints.*;

/** Separate contracts keep each action from accepting arbitrary appointment fields. */
public final class AppointmentActionRequest {
    private AppointmentActionRequest() { }

    public interface StrictInput {
        @JsonAnySetter
        default void rejectUnknown(String field, Object value) {
            throw new IllegalArgumentException("Trường không được phép: " + field);
        }
    }

    public record Approval(@NotNull @PositiveOrZero Long version) implements StrictInput { }
    public record Rejection(@NotNull @PositiveOrZero Long version,
                            @NotBlank @Size(max = 500) String reason) implements StrictInput { }
    public record Cancellation(@NotNull @PositiveOrZero Long version,
                               @Size(max = 500) String reason, CancellationCause cause,
                               Boolean tenantRequestConfirmed, Boolean viewingDidNotOccur) implements StrictInput { }
    public record Completion(@NotNull @PositiveOrZero Long version, @Size(max = 500) String note,
                             @NotNull @AssertTrue Boolean viewingFinished) implements StrictInput { }
    public record NoShow(@NotNull @PositiveOrZero Long version, @Size(max = 500) String note,
                         @NotNull @AssertTrue Boolean tenantAbsent,
                         @NotNull @AssertTrue Boolean landlordAvailable) implements StrictInput { }
    public enum Outcome { COMPLETED, NO_SHOW }
    public record Correction(@NotNull @PositiveOrZero Long version, @NotNull Outcome outcome,
                             @Size(max = 500) String note, @NotBlank @Size(max = 500) String reason,
                             Boolean viewingFinished, Boolean tenantAbsent,
                             Boolean landlordAvailable) implements StrictInput { }
}
