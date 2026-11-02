package com.kitolam.rentalroommanagement.modules.serviceitem.config;

import com.kitolam.rentalroommanagement.common.exception.exceptions.ConflictException;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemCreateRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.request.ServiceItemFilterRequest;
import com.kitolam.rentalroommanagement.modules.serviceitem.dto.response.ServiceItemResponse;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.CalculationType;
import com.kitolam.rentalroommanagement.modules.serviceitem.enums.ServiceScope;
import com.kitolam.rentalroommanagement.modules.serviceitem.service.ServiceItemService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Demo catalog for "Dịch vụ tham khảo" and the service registration flow. Opt-in, and only creates
 * codes that do not exist yet, so data edited by an admin is never overwritten.
 */
@Slf4j
@Component
@ConditionalOnProperty(name = "app.seed.services.enabled", havingValue = "true")
@RequiredArgsConstructor
public class ServiceCatalogSeeder implements CommandLineRunner {

    private static final List<ServiceItemCreateRequest> CATALOG = List.of(
            item("DIEN", "Điện", "kWh", 3_500, CalculationType.METERED, ServiceScope.ROOM, true),
            item("NUOC", "Nước", "m³", 18_000, CalculationType.METERED, ServiceScope.ROOM, true),
            item("RAC", "Vệ sinh / rác", "phòng/tháng", 30_000, CalculationType.FIXED, ServiceScope.ROOM, true),
            item("THANG_MAY", "Thang máy", "người/tháng", 20_000, CalculationType.PER_PERSON, ServiceScope.ROOM, true),
            item("WIFI", "Wi-Fi", "phòng/tháng", 100_000, CalculationType.FIXED, ServiceScope.ROOM, false),
            item("GUI_XE", "Gửi xe máy", "xe/tháng", 100_000, CalculationType.FIXED, ServiceScope.ROOM, false),
            item("GIAT_SAY", "Giặt sấy", "người/tháng", 80_000, CalculationType.PER_PERSON, ServiceScope.ROOM, false),
            item("DON_PHONG", "Dọn phòng định kỳ", "lần", 60_000, CalculationType.FIXED, ServiceScope.ROOM, false),
            item("TU_DO", "Tủ đồ cá nhân", "chỗ/tháng", 50_000, CalculationType.PER_SLOT, ServiceScope.SLOT, false)
    );

    private final ServiceItemService serviceItems;

    @Override
    public void run(String... args) {
        int created = 0;
        for (ServiceItemCreateRequest request : CATALOG) {
            if (exists(request.code())) continue;
            try {
                serviceItems.create(request);
                created++;
            } catch (ConflictException alreadyThere) {
                // Code reserved by a deleted entry or created concurrently: leave it as is.
            }
        }
        log.info("Service catalog seed: {} created, {} already present", created, CATALOG.size() - created);
    }

    private boolean exists(String code) {
        List<ServiceItemResponse> matches = serviceItems
                .search(new ServiceItemFilterRequest(null, null, null, code), PageRequest.of(0, 50)).getContent();
        return matches.stream().anyMatch(service -> code.equals(service.code()));
    }

    private static ServiceItemCreateRequest item(String code, String name, String unit, long price,
                                                 CalculationType type, ServiceScope scope, boolean mandatory) {
        return new ServiceItemCreateRequest(code, name, unit, BigDecimal.valueOf(price), type, scope, mandatory);
    }
}
