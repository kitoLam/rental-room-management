package com.kitolam.rentalroommanagement.modules.auth.dto.response;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record MessageResponse(
        String message,
        Boolean requiresPasswordSetup,
        String setupToken
) {
    public MessageResponse(String message) {
        this(message, null, null);
    }
}
