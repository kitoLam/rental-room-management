package com.kitolam.rentalroommanagement.modules.upload.service;

import com.cloudinary.Cloudinary;
import com.cloudinary.utils.ObjectUtils;
import com.kitolam.rentalroommanagement.common.config.CloudinaryProperties;
import com.kitolam.rentalroommanagement.common.exception.exceptions.BadRequestException;
import com.kitolam.rentalroommanagement.common.exception.exceptions.InternalServerErrorException;
import com.kitolam.rentalroommanagement.modules.upload.dto.UploadResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.regex.Pattern;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class CloudinaryService {

    private final Cloudinary cloudinary;
    private final CloudinaryProperties properties;

    /**
     * Upload a single file to Cloudinary.
     *
     * @param file      the multipart file to upload
     * @param subFolder optional sub-folder under the default folder (nullable)
     * @return upload result details
     */
    public UploadResponse upload(MultipartFile file, String subFolder) {
        if (file.isEmpty()) {
            throw new BadRequestException("File không được để trống");
        }

        String folder = buildFolder(subFolder);

        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().upload(file.getBytes(), Map.of(
                    "folder", folder,
                    "resource_type", "auto"
            ));

            return UploadResponse.builder()
                    .publicId((String) result.get("public_id"))
                    .url((String) result.get("url"))
                    .secureUrl((String) result.get("secure_url"))
                    .format((String) result.get("format"))
                    .resourceType((String) result.get("resource_type"))
                    .bytes(((Number) result.get("bytes")).longValue())
                    .width(result.get("width") != null ? ((Number) result.get("width")).intValue() : 0)
                    .height(result.get("height") != null ? ((Number) result.get("height")).intValue() : 0)
                    .build();
        } catch (IOException e) {
            log.error("Cloudinary upload failed", e);
            throw new InternalServerErrorException("Upload file thất bại: " + e.getMessage());
        }
    }

    /**
     * Upload multiple files to Cloudinary.
     */
    public List<UploadResponse> uploadMultiple(List<MultipartFile> files, String subFolder) {
        if (files == null || files.isEmpty()) {
            throw new BadRequestException("Danh sách file không được để trống");
        }

        List<UploadResponse> results = new ArrayList<>();
        for (MultipartFile file : files) {
            results.add(upload(file, subFolder));
        }
        return results;
    }

    /**
     * Delete a file from Cloudinary by its public ID.
     */
    public boolean delete(String publicId) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> result = cloudinary.uploader().destroy(publicId, ObjectUtils.emptyMap());
            return "ok".equals(result.get("result"));
        } catch (IOException e) {
            log.error("Cloudinary delete failed for publicId={}", publicId, e);
            throw new InternalServerErrorException("Xóa file thất bại: " + e.getMessage());
        }
    }

    public ContractPdf uploadContractPdf(byte[] pdf, String revision, String fileName) throws IOException {
        String folder = properties.folder();
        String publicId = (folder == null || folder.isBlank() ? "contracts" : buildFolder("contracts"))
                + "/" + revision + "/" + fileName;
        Map<?, ?> result = cloudinary.uploader().upload(pdf, Map.of(
                "public_id", publicId,
                "resource_type", "raw",
                "type", "authenticated",
                "overwrite", true
        ));
        return new ContractPdf((String) result.get("public_id"), (String) result.get("secure_url"));
    }

    public String contractEvidenceDownloadUrl(String storedUrl, long expiresAt) {
        URI url;
        try {
            url = URI.create(storedUrl);
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Đường dẫn bản ký không hợp lệ.");
        }
        if (!"https".equalsIgnoreCase(url.getScheme()) || !"res.cloudinary.com".equalsIgnoreCase(url.getHost())
                || url.getPort() != -1 || url.getUserInfo() != null || url.getRawQuery() != null
                || url.getRawFragment() != null) {
            throw new BadRequestException("Đường dẫn bản ký Cloudinary không hợp lệ.");
        }

        String folder = buildFolder("contract-evidence");
        String prefix = "/" + properties.cloudName() + "/image/upload/";
        var asset = Pattern.compile(Pattern.quote(prefix) + "(?:v[0-9]+/)?("
                + Pattern.quote(folder) + "/[A-Za-z0-9_-]+)\\.(pdf|jpe?g|png)").matcher(url.getRawPath());
        if (!asset.matches()) {
            throw new BadRequestException("Không xác định được tệp bản ký trong thư mục Cloudinary của ứng dụng.");
        }
        try {
            return cloudinary.privateDownload(asset.group(1), asset.group(2), Map.of(
                    "resource_type", "image",
                    "type", "upload",
                    "expires_at", expiresAt,
                    "attachment", false
            ));
        } catch (Exception e) {
            throw new InternalServerErrorException("Không thể tạo link mở bản ký.");
        }
    }

    public String contractDownloadUrl(String publicId, long expiresAt) {
        try {
            return cloudinary.privateDownload(publicId, null, Map.of(
                    "resource_type", "raw",
                    "type", "authenticated",
                    "expires_at", expiresAt,
                    "attachment", true
            ));
        } catch (Exception e) {
            throw new InternalServerErrorException("Không thể tạo link tải hợp đồng.");
        }
    }

    public void deleteContractPdf(String publicId) throws IOException {
        cloudinary.uploader().destroy(publicId, Map.of("resource_type", "raw", "type", "authenticated"));
    }

    public record ContractPdf(String publicId, String url) { }

    private String buildFolder(String subFolder) {
        String base = properties.folder();
        if (subFolder != null && !subFolder.isBlank()) {
            return base + "/" + subFolder.strip();
        }
        return base;
    }
}
