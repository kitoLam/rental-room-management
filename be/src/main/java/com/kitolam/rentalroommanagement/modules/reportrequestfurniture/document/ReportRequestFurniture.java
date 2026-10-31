package com.kitolam.rentalroommanagement.modules.reportrequestfurniture.document;

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
@Document(collection = "report_request_furnitures")
@CompoundIndex(name = "report_request_id_furniture_id_idx", def = "{'reportRequestId': 1, 'furnitureId': 1}")
public class ReportRequestFurniture extends BaseDocument {

    @Indexed
    private String reportRequestId;

    @Indexed
    private String furnitureId;

    private String issueDescription;
}
