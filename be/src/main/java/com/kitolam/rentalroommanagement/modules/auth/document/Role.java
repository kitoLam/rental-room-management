package com.kitolam.rentalroommanagement.modules.auth.document;

// Stored as a fixed enum in User; signup never accepts a role from the client.
public enum Role {
    TENANT, MANAGER, ADMIN, OWNER
}
