package com.kitolam.rentalroommanagement.modules.auth.service;

import com.kitolam.rentalroommanagement.modules.auth.dto.request.*;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.*;
import java.util.List;
import java.util.Optional;

public interface AuthService {
    Optional<AccountIdentityResponse> findAccount(String id);
    List<AccountIdentityResponse> activeManagementAccounts();
    MessageResponse signup(SignupRequest request);
    MessageResponse verifyEmail(String token);
    MessageResponse setupPassword(SetupPasswordRequest request);
    MessageResponse resendVerification(ResendVerificationRequest request);
    AccountIdentityResponse createManagedTenantAccount(String fullName, String email, String phone, String branchName);
    MessageResponse resendManagedTenantVerification(String email, String branchName);
    TokenResponse login(LoginRequest request);
    TokenResponse refresh(RefreshTokenRequest request);
    MessageResponse logout(RefreshTokenRequest request);
    MessageResponse changePassword(String userId, ChangePasswordRequest request);
    UserProfileResponse getProfile(String userId);
    UserProfileResponse updateProfile(String userId, UpdateProfileRequest request);
}
