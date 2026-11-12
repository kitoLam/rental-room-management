package com.kitolam.rentalroommanagement.modules.auth.dto.response;

public record AccountIdentityResponse(String id, String email, String fullName, String phone, String role, boolean active) { }
