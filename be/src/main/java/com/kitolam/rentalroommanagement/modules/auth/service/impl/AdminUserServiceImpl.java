package com.kitolam.rentalroommanagement.modules.auth.service.impl;

import com.kitolam.rentalroommanagement.common.base.PagedResponse;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.ForbiddenException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.NotFoundException;
import com.kitolam.rentalroommanagement.common.security.AuthPrincipal;
import com.kitolam.rentalroommanagement.common.util.MongoQueryHelper;
import com.kitolam.rentalroommanagement.modules.auth.document.Role;
import com.kitolam.rentalroommanagement.modules.auth.document.User;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.AdminUserFilterRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.request.AdminUserRoleUpdateRequest;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminRoleResponse;
import com.kitolam.rentalroommanagement.modules.auth.dto.response.AdminUserResponse;
import com.kitolam.rentalroommanagement.modules.auth.repository.UserRepository;
import com.kitolam.rentalroommanagement.modules.auth.service.AdminUserService;
import com.kitolam.rentalroommanagement.modules.manager.service.ManagerService;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminUserServiceImpl implements AdminUserService {
    private final MongoTemplate mongo;
    private final UserRepository users;
    private final ManagerService managers;

    @Override
    public PagedResponse<AdminUserResponse> search(AdminUserFilterRequest filter, Pageable pageable, AuthPrincipal principal) {
        requireAdmin(principal);
        List<Criteria> criteria = MongoQueryHelper.baseCriteria();
        MongoQueryHelper.addEquals(criteria, "role", filter.role());
        MongoQueryHelper.addKeyword(criteria, filter.keyword(), "fullName", "email", "phone");
        return PagedResponse.from(MongoQueryHelper.page(mongo, criteria, pageable, User.class), this::toResponse);
    }

    @Override
    public AdminUserResponse updateRole(String id, AdminUserRoleUpdateRequest request, AuthPrincipal principal) {
        requireAdmin(principal);
        if (id.equals(principal.userId())) throw new ForbiddenException("Không thể thay đổi vai trò của chính bạn");
        User user = users.findByIdAndIsDeletedFalse(id)
                .orElseThrow(() -> new NotFoundException("Không tìm thấy người dùng"));
        Role current = user.getRole(), target = request.role();
        if (current == Role.TENANT && target == Role.OWNER) {
            user.setRole(Role.OWNER);
        } else if (current == Role.MANAGER && target == Role.TENANT) {
            user.setRole(Role.TENANT);
            managers.deactivateByEmail(user.getEmail());
        } else {
            throw new BadRequestException("Chỉ được đổi vai trò Người thuê → Chủ trọ hoặc Quản lý → Người thuê");
        }
        return toResponse(users.save(user));
    }

    @Override
    public List<AdminRoleResponse> roles(AuthPrincipal principal) {
        requireAdmin(principal);
        Map<String, Long> counts = new HashMap<>();
        for (var group : users.readAccountGroups()) counts.merge(String.valueOf(group.role()), group.count(), Long::sum);
        return List.of(
                role(Role.TENANT, "Người thuê", "Thuê phòng, xem hợp đồng, hóa đơn và gửi yêu cầu hỗ trợ.",
                        "Dữ liệu thuê của chính tài khoản.", "Có thể được nâng thành Chủ trọ bởi Quản trị viên.", counts),
                role(Role.MANAGER, "Quản lý", "Vận hành cơ sở được phân công: giữ phòng, hợp đồng, hóa đơn, công nợ.",
                        "Các cơ sở được Chủ trọ phân công.", "Có thể được hạ xuống Người thuê bởi Quản trị viên.", counts),
                role(Role.OWNER, "Chủ trọ", "Sở hữu cơ sở, phân công quản lý và theo dõi doanh thu.",
                        "Các cơ sở thuộc quyền sở hữu.", "Nâng từ Người thuê bởi Quản trị viên.", counts),
                role(Role.ADMIN, "Quản trị viên", "Quản trị người dùng và nền tảng.",
                        "Toàn hệ thống.", "Tài khoản hệ thống, không đổi vai trò từ giao diện.", counts));
    }

    private AdminRoleResponse role(Role role, String name, String description, String scope, String requirement,
            Map<String, Long> counts) {
        return new AdminRoleResponse(role.name(), name, description, scope, requirement, counts.getOrDefault(role.name(), 0L));
    }

    private AdminUserResponse toResponse(User user) {
        String status = !user.isEmailVerified() ? "PENDING_VERIFICATION" : user.isEnabled() ? "ACTIVE" : "DISABLED";
        return new AdminUserResponse(user.getId(), user.getFullName(), user.getEmail(), user.getPhone(),
                user.getRole() == null ? null : user.getRole().name(), status, user.isEmailVerified(), user.getCreatedAt());
    }

    private void requireAdmin(AuthPrincipal principal) {
        if (principal == null || !"ADMIN".equals(principal.role()))
            throw new ForbiddenException("Chỉ Quản trị viên được quản lý người dùng");
    }
}
