package com.kitolam.rentalroommanagement.modules.auth.controller;

import com.kitolam.rentalroommanagement.modules.auth.dto.request.*;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.*;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/auth")
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
    public TokenResponse login(@Valid @RequestBody LoginRequest request) {
        return auth.login(request);
    }

    @PostMapping("/refresh")
    public TokenResponse refresh(@Valid @RequestBody RefreshTokenRequest request) {
        return auth.refresh(request);
    }

    @PostMapping("/logout")
    public MessageResponse logout(@Valid @RequestBody RefreshTokenRequest request) {
        return auth.logout(request);
    }
}
