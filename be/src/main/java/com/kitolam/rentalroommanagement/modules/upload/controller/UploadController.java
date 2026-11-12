package com.kitolam.rentalroommanagement.modules.upload.controller;

import com.kitolam.rentalroommanagement.common.base.StandardResponse;
import com.kitolam.rentalroommanagement.modules.upload.dto.UploadResponse;
import com.kitolam.rentalroommanagement.modules.upload.service.CloudinaryService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/v1/public/upload")
@RequiredArgsConstructor
@Tag(name = "Upload", description = "Public file upload API (Cloudinary)")
public class UploadController {

    private final CloudinaryService cloudinaryService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Upload một file", description = "Upload một file lên Cloudinary. Không yêu cầu đăng nhập.")
    public StandardResponse<UploadResponse> uploadFile(
            @RequestPart("file") MultipartFile file,
            @RequestParam(value = "folder", required = false) String folder) {
        UploadResponse result = cloudinaryService.upload(file, folder);
        return StandardResponse.success("Upload thành công", result);
    }

    @PostMapping(value = "/multiple", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(summary = "Upload nhiều file", description = "Upload nhiều file cùng lúc lên Cloudinary. Không yêu cầu đăng nhập.")
    public StandardResponse<List<UploadResponse>> uploadMultipleFiles(
            @RequestPart("files") List<MultipartFile> files,
            @RequestParam(value = "folder", required = false) String folder) {
        List<UploadResponse> results = cloudinaryService.uploadMultiple(files, folder);
        return StandardResponse.success("Upload " + results.size() + " file thành công", results);
    }

    @DeleteMapping
    @Operation(summary = "Xóa file", description = "Xóa một file trên Cloudinary theo public ID. Không yêu cầu đăng nhập.")
    public StandardResponse<Void> deleteFile(@RequestParam("publicId") String publicId) {
        cloudinaryService.delete(publicId);
        return StandardResponse.success("Xóa file thành công", null);
    }
}
