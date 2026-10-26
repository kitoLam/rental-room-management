package com.kitolam.rentalroommanagement.modules.branch.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.branch.enums.BranchStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "branches")
public class Branch extends BaseDocument {

    @Indexed
    private String name;

    private String address;

    private String phone;

    private String email;

    private String description;

    private BranchStatus status = BranchStatus.ACTIVE;
}
