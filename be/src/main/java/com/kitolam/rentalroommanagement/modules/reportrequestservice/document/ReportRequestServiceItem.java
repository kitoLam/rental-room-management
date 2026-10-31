package com.kitolam.rentalroommanagement.modules.reportrequestservice.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.CompoundIndex;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "report_request_services")
@CompoundIndex(name = "report_request_id_room_service_id_idx", def = "{'reportRequestId': 1, 'roomServiceId': 1}")
public class ReportRequestServiceItem extends BaseDocument {

    @Indexed
    private String reportRequestId;

    @Indexed
    private String roomServiceId;

    private String note;
}
