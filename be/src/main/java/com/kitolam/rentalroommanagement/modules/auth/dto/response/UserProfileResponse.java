package com.kitolam.rentalroommanagement.modules.auth.dto.response;

import java.util.List;

public record UserProfileResponse(
        String id,
        String email,
        String fullName,
        List<String> roles,
        String phone,
        String dateOfBirth,
        String gender,
        String status
) {}
