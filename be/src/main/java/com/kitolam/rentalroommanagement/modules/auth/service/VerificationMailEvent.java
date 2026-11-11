package com.kitolam.rentalroommanagement.modules.auth.service;

public record VerificationMailEvent(String email, String token, boolean createdByManager, String branchName) {
    public VerificationMailEvent(String email, String token) {
        this(email, token, false, null);
    }

    @Override public String toString() { return "VerificationMailEvent[REDACTED]"; }
}
