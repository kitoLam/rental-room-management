package com.kitolam.rentalroommanagement.modules.roomtype.document;

import com.kitolam.rentalroommanagement.common.base.BaseDocument;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

@Getter
@Setter
@NoArgsConstructor
@Document(collection = "room_types")
public class RoomType extends BaseDocument {

    @Indexed
    private String name;

    private String description;

    private Integer maxOccupants;
}
