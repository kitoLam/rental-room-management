package com.kitolam.rentalroommanagement.modules.auth.service;

public record VerificationMailEvent(String email, String token) {
    @Override public String toString() { return "VerificationMailEvent[REDACTED]"; }
}
