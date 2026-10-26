package com.kitolam.rentalroommanagement.modules.manager.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.manager.enums.ManagerStatus;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "managers")
public class Manager extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String branchId;

    private String fullName;

    @Indexed
    private String email;

    @Indexed
    private String phone;

    private String passwordHash;

    private List<String> permissions = new ArrayList<>();

    private ManagerStatus status = ManagerStatus.ACTIVE;
}
