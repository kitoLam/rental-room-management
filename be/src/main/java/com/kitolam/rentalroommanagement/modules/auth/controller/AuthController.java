package com.kitolam.rentalroommanagement.modules.auth.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.UnauthorizedException;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.*;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.*;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication")
public class AuthController {
    private final AuthService auth;

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public MessageResponse signup(@Valid @RequestBody SignupRequest request) {
        return auth.signup(request);
    }

    @GetMapping("/verify-email")
    public MessageResponse verifyEmail(
            @RequestParam @Pattern(regexp = "^[A-Za-z0-9_-]{43}$",
                    message = "Token xác thực không đúng định dạng") String token) {
        return auth.verifyEmail(token);
    }

    @PostMapping("/resend-verification")
    public MessageResponse resend(@Valid @RequestBody ResendVerificationRequest request) {
        return auth.resendVerification(request);
    }

    @PostMapping("/login")
    public TokenResponse login(@Valid @RequestBody LoginRequest request, HttpServletResponse response) {
        TokenResponse tokens = auth.login(request);
        setRefreshTokenCookie(response, tokens.refreshToken(), (int) tokens.refreshExpiresIn());
        return tokens;
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(
            @RequestBody(required = false) RefreshTokenRequest request,
            @CookieValue(name = "refreshToken", required = false) String cookieToken,
            HttpServletResponse response) {
        String tokenStr = (request != null && request.refreshToken() != null && !request.refreshToken().isBlank())
                ? request.refreshToken()
                : cookieToken;
        if (tokenStr == null || tokenStr.isBlank()) {
            throw new UnauthorizedException("Vui lòng đăng nhập lại");
        }
        TokenResponse tokens = auth.refresh(new RefreshTokenRequest(tokenStr));
        setRefreshTokenCookie(response, tokens.refreshToken(), (int) tokens.refreshExpiresIn());
        return tokens;
    }

    @PostMapping("/logout")
    public ResponseEntity<StandardResponse<Void>> logout(
            @RequestBody(required = false) RefreshTokenRequest request,
            @CookieValue(name = "refreshToken", required = false) String cookieToken,
            HttpServletResponse response) {
        String tokenStr = (request != null && request.refreshToken() != null && !request.refreshToken().isBlank())
                ? request.refreshToken()
                : cookieToken;
        if (tokenStr != null && !tokenStr.isBlank()) {
            auth.logout(new RefreshTokenRequest(tokenStr));
        }
        deleteRefreshTokenCookie(response);
        return ResponseEntity.ok(StandardResponse.success("Đăng xuất thành công", null));
    }

    private void setRefreshTokenCookie(HttpServletResponse response, String refreshToken, int maxAge) {
        ResponseCookie cookie = ResponseCookie.from("refreshToken", refreshToken)
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(maxAge)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    private void deleteRefreshTokenCookie(HttpServletResponse response) {
        ResponseCookie cookie = ResponseCookie.from("refreshToken", "")
                .httpOnly(true)
                .secure(false)
                .path("/")
                .maxAge(0)
                .sameSite("Lax")
                .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

    @GetMapping("/me")
    public StandardResponse<UserProfileResponse> getProfile(@AuthenticationPrincipal AuthPrincipal principal) {
        if (principal == null || principal.userId() == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập lại");
        }
        return StandardResponse.success(auth.getProfile(principal.userId()));
    }

    @PatchMapping("/me")
    public StandardResponse<UserProfileResponse> updateProfile(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody UpdateProfileRequest request) {
        if (principal == null || principal.userId() == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập lại");
        }
        return StandardResponse.success("Cập nhật thông tin thành công", auth.updateProfile(principal.userId(), request));
    }

    @PostMapping("/change-password")
    public StandardResponse<MessageResponse> changePassword(
            @AuthenticationPrincipal AuthPrincipal principal,
            @Valid @RequestBody ChangePasswordRequest request) {
        if (principal == null || principal.userId() == null) {
            throw new UnauthorizedException("Vui lòng đăng nhập lại");
        }
        return StandardResponse.success(auth.changePassword(principal.userId(), request));
    }
}
