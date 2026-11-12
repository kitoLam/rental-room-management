package com.kitolam.rentalroommanagement.modules.auth.dto.response;

public record AdminRoleResponse(String id, String name, String description, String scope, String requirement,
        long userCount) {
}
