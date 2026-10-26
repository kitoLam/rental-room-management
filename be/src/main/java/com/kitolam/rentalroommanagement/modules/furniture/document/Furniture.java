package com.kitolam.rentalroommanagement.modules.furniture.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import com.kitolam.rentalroommanagement.modules.furniture.enums.FurnitureCondition;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "furnitures")
public class Furniture extends BaseDocument {

    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String roomId;

    private String name;

    private Integer quantity;

    private FurnitureCondition condition = FurnitureCondition.GOOD;
}
