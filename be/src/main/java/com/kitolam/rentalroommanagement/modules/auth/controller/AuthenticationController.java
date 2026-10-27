package com.kitolam.rentalroommanagement.modules.auth.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.AuthenticationRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.IntrospectRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.LogoutRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.RefreshRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.RegisterRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AuthenticationResponse;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.IntrospectResponse;
import com.kitolam.rentalroommanagement.modules.auth.service.AuthenticationService;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import com.nimbusds.jose.JOSEException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.text.ParseException;

@RestController
@RequestMapping("/api/v1/auth")
@RequiredArgsConstructor
@Tag(name = "Authentication")
public class AuthenticationController {

    private final AuthenticationService authenticationService;

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Đăng ký tài khoản người thuê (role TENANT)")
    public StandardResponse<TenantResponse> register(@Valid @RequestBody RegisterRequest request) {
        return StandardResponse.success("Đăng ký thành công", authenticationService.register(request));
    }

    @PostMapping("/login")
    @Operation(summary = "Đăng nhập bằng email và mật khẩu")
    public StandardResponse<AuthenticationResponse> login(@Valid @RequestBody AuthenticationRequest request) {
        return StandardResponse.success("Đăng nhập thành công", authenticationService.authenticate(request));
    }

    @PostMapping("/introspect")
    @Operation(summary = "Kiểm tra token còn hợp lệ")
    public StandardResponse<IntrospectResponse> introspect(@Valid @RequestBody IntrospectRequest request)
            throws ParseException, JOSEException {
        return StandardResponse.success(authenticationService.introspect(request));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Làm mới token")
    public StandardResponse<AuthenticationResponse> refresh(@Valid @RequestBody RefreshRequest request)
            throws ParseException, JOSEException {
        return StandardResponse.success(authenticationService.refreshToken(request));
    }

    @PostMapping("/logout")
    @Operation(summary = "Đăng xuất (vô hiệu hoá token)")
    public StandardResponse<Void> logout(@Valid @RequestBody LogoutRequest request)
            throws ParseException, JOSEException {
        authenticationService.logout(request);
        return StandardResponse.success("Đăng xuất thành công", null);
    }
}
