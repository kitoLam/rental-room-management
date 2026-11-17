package com.kitolam.rentalroommanagement.modules.upload.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UploadResponse {
    private String publicId;
    private String url;
    private String secureUrl;
    private String format;
    private String resourceType;
    private long bytes;
    private int width;
    private int height;
}
