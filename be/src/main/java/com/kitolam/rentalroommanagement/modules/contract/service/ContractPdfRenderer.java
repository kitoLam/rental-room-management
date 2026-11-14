package com.kitolam.rentalroommanagement.modules.contract.service;

import com.kitolam.rentalroommanagement.modules.contract.document.Contract;
import com.kitolam.rentalroommanagement.modules.contract.document.ContractServiceSnapshot;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTRow;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.DosFileAttributeView;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Component
@Slf4j
class ContractPdfRenderer {
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("dd-MM-uuuu");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\{\\{(\\w+)}}");
    private static final ClassPathResource TEMPLATE = new ClassPathResource("contracts/Mau_Hop_Dong.docx");

    private final String officeCommand;

    ContractPdfRenderer(@Value("${contract.pdf.libreoffice-command}") String officeCommand) {
        this.officeCommand = officeCommand;
    }

    byte[] render(Contract contract) throws IOException, InterruptedException {
        Path directory = Files.createTempDirectory("contract-pdf-");
        try {
            Path input = Files.createDirectory(directory.resolve("input"));
            Path outputDirectory = Files.createDirectory(directory.resolve("output"));
            Path docx = input.resolve("contract.docx");
            try (OutputStream output = Files.newOutputStream(docx)) {
                writeDocx(contract, output);
            }
            ProcessBuilder converter = new ProcessBuilder(resolveOfficeCommand(),
                    "-env:UserInstallation=" + directory.resolve("profile").toUri().toASCIIString(),
                    "--headless", "--nolockcheck", "--convert-to", "pdf:writer_pdf_Export",
                    "--outdir", outputDirectory.toString(), docx.toString())
                    .redirectErrorStream(true).redirectOutput(ProcessBuilder.Redirect.DISCARD);
            Process process;
            try {
                process = converter.start();
            } catch (IOException cause) {
                throw new ConversionException(
                        "Could not start LibreOffice Writer. Install it and set CONTRACT_PDF_LIBREOFFICE_COMMAND "
                                + "to the executable, or make soffice available on PATH.", cause);
            }
            try {
                if (!process.waitFor(60, TimeUnit.SECONDS)) {
                    throw new ConversionException("LibreOffice Writer did not finish conversion within 60 seconds.");
                }
                if (process.exitValue() != 0) {
                    throw new ConversionException("LibreOffice Writer exited with code " + process.exitValue() + ".");
                }
            } finally {
                if (process.isAlive()) {
                    process.descendants().forEach(ProcessHandle::destroyForcibly);
                    process.destroyForcibly();
                }
            }
            Path pdf = outputDirectory.resolve("contract.pdf");
            if (!Files.isRegularFile(pdf) || Files.size(pdf) == 0) {
                throw new ConversionException("LibreOffice Writer finished without producing a PDF.");
            }
            return Files.readAllBytes(pdf);
        } finally {
            cleanTemporaryFiles(directory);
        }
    }

    private String resolveOfficeCommand() {
        if (!"soffice".equals(officeCommand) || !System.getProperty("os.name").startsWith("Windows")) {
            return officeCommand;
        }
        for (String variable : List.of("ProgramFiles", "ProgramFiles(x86)")) {
            String programFiles = System.getenv(variable);
            if (programFiles == null) continue;
            Path executable = Path.of(programFiles, "LibreOffice", "program", "soffice.com");
            if (Files.isRegularFile(executable)) return executable.toString();
        }
        return officeCommand;
    }

    static final class ConversionException extends IOException {
        private ConversionException(String message) {
            super(message);
        }

        private ConversionException(String message, IOException cause) {
            super(message, cause);
        }
    }

    private static void cleanTemporaryFiles(Path directory) {
        try (var paths = Files.walk(directory)) {
            for (Path path : paths.sorted(Comparator.reverseOrder()).toList()) {
                try {
                    if (path.getFileName().toString().startsWith(".~lock.")) {
                        var attributes = Files.getFileAttributeView(path, DosFileAttributeView.class);
                        if (attributes != null) attributes.setReadOnly(false);
                    }
                    Files.deleteIfExists(path);
                } catch (IOException e) {
                    log.warn("A temporary contract PDF file could not be removed ({})", e.getClass().getSimpleName());
                }
            }
        } catch (IOException e) {
            log.warn("Contract PDF temporary directory could not be read ({})", e.getClass().getSimpleName());
        }
    }

    void writeDocx(Contract contract, OutputStream output) throws IOException {
        try (var input = TEMPLATE.getInputStream(); var document = new XWPFDocument(input)) {
            Map<String, String> values = fields(contract);
            fillParagraphs(document.getParagraphs(), values);
            for (var table : List.copyOf(document.getTables())) {
                if ("{{servicesLabel}}".equals(table.getRow(0).getCell(0).getText())) {
                    XWPFTableRow template = table.getRow(0);
                    var services = selectedServices(contract).stream()
                            .filter(service -> !ContractTemplateService.isWaterService(service)).toList();
                    if (services.isEmpty()) {
                        document.removeBodyElement(document.getPosOfTable(table));
                        continue;
                    }
                    for (int i = 0; i < services.size(); i++) {
                        var service = services.get(i);
                        var row = new XWPFTableRow((CTRow) template.getCtRow().copy(), table);
                        fillRow(row, Map.of(
                                "servicesLabel", i == 0 ? "Dịch vụ khác:" : "",
                                "serviceName", text(service.getName()) + ":",
                                "serviceAmount", service.getUnitPrice() == null ? "" : amount(service.getUnitPrice()) + " đ",
                                "serviceUnit", text(service.getUnit())
                                        + (service.getQuantity() == null ? "" : " × " + service.getQuantity())
                        ));
                        table.addRow(row);
                    }
                    table.removeRow(0);
                    continue;
                }
                for (var row : table.getRows()) {
                    fillRow(row, values);
                }
            }
            document.write(output);
        }
    }

    private static void fillRow(XWPFTableRow row, Map<String, String> values) {
        for (var cell : row.getTableCells()) {
            fillParagraphs(cell.getParagraphs(), values);
        }
    }

    private static void fillParagraphs(List<XWPFParagraph> paragraphs, Map<String, String> values) {
        for (XWPFParagraph paragraph : paragraphs) {
            for (XWPFRun run : paragraph.getRuns()) {
                String text = run.getText(0);
                if (text == null || !text.contains("{{")) continue;
                String replaced = PLACEHOLDER.matcher(text).replaceAll(
                        match -> java.util.regex.Matcher.quoteReplacement(values.getOrDefault(match.group(1), "")));
                String[] lines = replaced.split("\\R", -1);
                run.setText(lines[0], 0);
                for (int i = 1; i < lines.length; i++) {
                    run.addBreak();
                    run.setText(lines[i]);
                }
            }
        }
    }

    private static Map<String, String> fields(Contract contract) {
        Map<String, String> values = new HashMap<>();
        values.put("contractNumber", text(contract.getContractNumber()));
        values.put("signingAddress", text(contract.getSigningAddress()));
        values.put("landlordName", text(contract.getLandlordName()));
        values.put("landlordDateOfBirth", date(contract.getLandlordDateOfBirth()));
        values.put("landlordAddress", text(contract.getLandlordAddress()));
        values.put("landlordIdNumber", text(contract.getLandlordIdNumber()));
        values.put("landlordIdIssueDate", date(contract.getLandlordIdIssueDate()));
        values.put("landlordIdIssuePlace", text(contract.getLandlordIdIssuePlace()));
        values.put("landlordPhone", text(contract.getLandlordPhone()));
        values.put("tenantName", text(contract.getTenantName()));
        values.put("tenantDateOfBirth", date(contract.getTenantDateOfBirth()));
        values.put("tenantAddress", text(contract.getTenantAddress()));
        values.put("tenantIdNumber", text(contract.getTenantIdNumber()));
        values.put("tenantIdIssueDate", date(contract.getTenantIdIssueDate()));
        values.put("tenantIdIssuePlace", text(contract.getTenantIdIssuePlace()));
        values.put("tenantPhone", text(contract.getTenantPhone()));
        String[] location = text(contract.getRoomAddress()).split(" · ");
        int parts = location.length;
        boolean hasSlot = parts >= 3 && location[parts - 1].startsWith("Chỗ ");
        values.put("roomAddress", hasSlot ? String.join(" · ", Arrays.copyOf(location, parts - 2))
                : text(contract.getRoomAddress()));
        values.put("roomNumber", hasSlot ? text(location[parts - 2]) : "");
        values.put("slotCode", hasSlot ? text(location[parts - 1].substring("Chỗ ".length())) : "");
        values.put("rentPrice", contract.getRentPrice() == null ? "" : amount(contract.getRentPrice()) + " đ/tháng");
        String paymentMethod = contract.getPaymentMethod();
        values.put("paymentMethod", paymentMethod == null || paymentMethod.isBlank() ? "Chuyển khoản" : paymentMethod.strip());
        values.put("electricityRate", contract.getElectricityRate() == null ? "" : amount(contract.getElectricityRate()) + " đ/kWh");
        values.put("deposit", contract.getContractDepositAmount() == null ? "" : amount(contract.getContractDepositAmount()) + " đ");
        values.put("startDate", contract.getStartDate() == null ? "" : DATE.format(contract.getStartDate()));
        values.put("endDate", contract.getEndDate() == null ? "" : DATE.format(contract.getEndDate()) + ".");

        String waterRate = selectedServices(contract).stream().filter(ContractTemplateService::isWaterService)
                .map(ContractPdfRenderer::servicePrice).filter(price -> !price.isEmpty())
                .collect(Collectors.joining(", "));
        values.put("waterService", waterRate);
        return values;
    }

    private static List<ContractServiceSnapshot> selectedServices(Contract contract) {
        return contract.getServices() == null ? List.of()
                : contract.getServices().stream().filter(ContractServiceSnapshot::isSelected).toList();
    }

    private static String servicePrice(ContractServiceSnapshot service) {
        return service.getUnitPrice() == null ? ""
                : amount(service.getUnitPrice()) + " đ" + (service.getUnit() == null ? "" : "/" + service.getUnit());
    }

    private static String date(String value) {
        if (value == null || value.isBlank()) return "";
        try {
            return DATE.format(LocalDate.parse(value.strip()));
        } catch (java.time.format.DateTimeParseException e) {
            return value.strip();
        }
    }

    private static String amount(BigDecimal value) {
        return value == null ? "" : NumberFormat.getNumberInstance(Locale.forLanguageTag("vi-VN")).format(value);
    }

    private static String text(String value) {
        return value == null ? "" : value.strip();
    }
}
