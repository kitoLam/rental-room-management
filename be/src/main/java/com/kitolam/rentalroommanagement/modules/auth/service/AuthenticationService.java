package com.kitolam.rentalroommanagement.modules.auth.service;

import com.kitolam.rentalroommanagement.modules.auth.dto.request.AuthenticationRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.IntrospectRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.LogoutRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.RefreshRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.RegisterRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AuthenticationResponse;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.IntrospectResponse;
import com.kitolam.rentalroommanagement.modules.tenant.dto.response.TenantResponse;
import com.nimbusds.jose.JOSEException;

import java.text.ParseException;

public interface AuthenticationService {
    TenantResponse register(RegisterRequest request);
    AuthenticationResponse authenticate(AuthenticationRequest request);
    IntrospectResponse introspect(IntrospectRequest request) throws JOSEException, ParseException;
    void logout(LogoutRequest request) throws ParseException, JOSEException;
    AuthenticationResponse refreshToken(RefreshRequest request) throws ParseException, JOSEException;
}
