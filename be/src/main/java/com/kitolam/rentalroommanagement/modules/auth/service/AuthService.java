package com.kitolam.rentalroommanagement.modules.auth.service;

import com.kitolam.rentalroommanagement.modules.auth.dto.request.*;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.*;

public interface AuthService {
    MessageResponse signup(SignupRequest request);
    MessageResponse verifyEmail(String token);
    MessageResponse resendVerification(ResendVerificationRequest request);
    TokenResponse login(LoginRequest request);
    TokenResponse refresh(RefreshTokenRequest request);
    MessageResponse logout(RefreshTokenRequest request);
}
