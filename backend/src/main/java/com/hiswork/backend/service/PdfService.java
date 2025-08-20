package com.hiswork.backend.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.font.PdfFont;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.kernel.pdf.PdfDocument;
import com.itextpdf.kernel.pdf.PdfReader;
import com.itextpdf.kernel.pdf.PdfWriter;
import com.itextpdf.kernel.pdf.canvas.PdfCanvas;
import com.itextpdf.layout.Canvas;
import com.itextpdf.layout.element.Paragraph;
import com.itextpdf.layout.properties.TextAlignment;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;
import com.itextpdf.io.image.ImageData;
import com.itextpdf.io.image.ImageDataFactory;
import java.util.Base64;
import com.itextpdf.kernel.colors.Color;
import com.itextpdf.kernel.colors.ColorConstants;
import com.itextpdf.kernel.colors.DeviceRgb;
import com.itextpdf.kernel.font.PdfFontFactory;
import com.itextpdf.io.font.constants.StandardFonts;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;

@Service
@RequiredArgsConstructor
@Slf4j
public class PdfService {
    
    @Value("${app.file.pdf-templates-dir}")
    private String pdfTemplatesDir;
    
    @Value("${app.file.upload-dir}")
    private String uploadDir;
    
    /**
     * PDF 파일을 업로드하고 이미지로 변환
     */
    public PdfUploadResult uploadPdfTemplate(MultipartFile file) throws IOException {
        // 업로드 디렉토리 생성
        createDirectoriesIfNotExists();
        
        // 파일 확장자 검증
        if (!isPdfFile(file)) {
            throw new IllegalArgumentException("PDF 파일만 업로드 가능합니다.");
        }
        
        // 고유한 파일명 생성
        String originalFilename = file.getOriginalFilename();
        String fileExtension = getFileExtension(originalFilename);
        String uniqueFilename = UUID.randomUUID().toString() + fileExtension;
        
        // PDF 파일 저장
        Path pdfPath = Paths.get(pdfTemplatesDir, uniqueFilename);
        Files.copy(file.getInputStream(), pdfPath, StandardCopyOption.REPLACE_EXISTING);
        
        // PDF를 이미지로 변환
        String imagePath = convertPdfToImage(pdfPath.toString());
        
        log.info("PDF 템플릿 업로드 완료: PDF={}, Image={}", pdfPath, imagePath);
        
        return PdfUploadResult.builder()
                .pdfFilePath(pdfPath.toString())
                .pdfImagePath(imagePath)
                .originalFilename(originalFilename)
                .build();
    }
    
    /**
     * PDF 파일을 이미지로 변환
     */
    private String convertPdfToImage(String pdfFilePath) throws IOException {
        try (PDDocument document = PDDocument.load(new File(pdfFilePath))) {
            PDFRenderer pdfRenderer = new PDFRenderer(document);
            
            // 첫 번째 페이지만 이미지로 변환 (템플릿이므로 보통 1페이지)
            BufferedImage bufferedImage = pdfRenderer.renderImageWithDPI(0, 150); // 150 DPI로 렌더링
            
            // 이미지 파일 경로 생성
            String pdfBaseName = getBaseName(pdfFilePath);
            String imagePath = pdfTemplatesDir + File.separator + pdfBaseName + ".png";
            
            // 이미지 저장
            ImageIO.write(bufferedImage, "PNG", new File(imagePath));
            
            return imagePath;
        }
    }
    
    /**
     * 완성된 PDF 생성 (필드 값과 서명 포함)
     */
    public String generateCompletedPdf(String templatePdfPath, JsonNode coordinateFields, JsonNode documentData, String documentTitle) throws IOException {
        log.info("PDF 생성 시작 - 템플릿: {}, 필드 수: {}, 문서 데이터: {}", 
                templatePdfPath, 
                coordinateFields != null && coordinateFields.isArray() ? coordinateFields.size() : 0,
                documentData != null ? documentData.toString() : "null");
        
        String outputFilename = "completed_" + UUID.randomUUID().toString() + ".pdf";
        String outputPath = pdfTemplatesDir + File.separator + outputFilename;
        
        try (PdfReader reader = new PdfReader(templatePdfPath);
             PdfWriter writer = new PdfWriter(outputPath);
             PdfDocument pdfDoc = new PdfDocument(reader, writer)) {
            
            PdfCanvas canvas = new PdfCanvas(pdfDoc.getFirstPage());
            
            // documentData에서 coordinateData와 signatures 추출
            JsonNode coordinateData = documentData.has("coordinateData") ? documentData.get("coordinateData") : null;
            JsonNode signatures = documentData.has("signatures") ? documentData.get("signatures") : null;
            
            log.info("추출된 coordinateData: {}", coordinateData);
            log.info("추출된 signatures: {}", signatures);
            
            // 좌표 필드들을 순회하며 값 삽입 (표 제외)
            if (coordinateFields != null && coordinateFields.isArray()) {
                log.info("좌표 필드 처리 시작 - 총 {}개 필드", coordinateFields.size());
                
                for (JsonNode field : coordinateFields) {
                    // 표 타입은 별도 처리 (아래)
                    if (field.has("type") && "table".equals(field.get("type").asText())) {
                        continue;
                    }
                    String fieldId = field.get("id").asText();
                    String fieldType = field.has("type") ? field.get("type").asText() : "text";
                    
                    log.info("필드 처리 중 - ID: {}, 타입: {}", fieldId, fieldType);
                    
                    float x = (float) field.get("x").asDouble();
                    float y = (float) field.get("y").asDouble();
                    float width = (float) field.get("width").asDouble();
                    float height = (float) field.get("height").asDouble();
                    
                    // PDF 좌표계는 왼쪽 하단이 원점이므로 Y 좌표 변환 필요
                    float pageHeight = pdfDoc.getFirstPage().getPageSize().getHeight();
                    float adjustedY = pageHeight - y - height;
                    
                    if ("signature".equals(fieldType)) {
                        // 서명 필드 처리
                        String reviewerEmail = field.has("reviewerEmail") ? field.get("reviewerEmail").asText() : null;
                        log.info("서명 필드 처리 - 검토자: {}", reviewerEmail);
                        
                        if (reviewerEmail != null && signatures != null && signatures.has(reviewerEmail)) {
                            String signatureData = signatures.get(reviewerEmail).asText();
                            log.info("서명 데이터 발견 - 길이: {}", signatureData.length());
                            
                            // base64 이미지 데이터에서 "data:image/png;base64," 부분 제거
                            if (signatureData.startsWith("data:image")) {
                                signatureData = signatureData.substring(signatureData.indexOf(",") + 1);
                            }
                            
                            try {
                                byte[] imageBytes = Base64.getDecoder().decode(signatureData);
                                ImageData imageData = ImageDataFactory.create(imageBytes);
                                
                                // 서명 이미지를 PDF에 추가
                                canvas.addImageWithTransformationMatrix(imageData, width, 0, 0, height, x, adjustedY, false);
                                log.info("서명 이미지 추가 완료");
                            } catch (Exception e) {
                                log.warn("서명 이미지 처리 실패: {}", e.getMessage());
                                // 서명 이미지 처리 실패 시 텍스트로 대체
                                canvas.beginText()
                                        .setFontAndSize(PdfFontFactory.createFont(StandardFonts.HELVETICA), 12)
                                        .moveText(x, adjustedY + height/2)
                                        .showText("[서명: " + reviewerEmail + "]")
                                        .endText();
                            }
                        } else {
                            log.warn("서명 데이터 없음 - 검토자: {}", reviewerEmail);
                        }
                    } else {
                        // 일반 텍스트 필드 처리
                        String value = "";
                        if (coordinateData != null && coordinateData.has(fieldId)) {
                            value = coordinateData.get(fieldId).asText();
                            log.info("텍스트 필드 값 발견 - ID: {}, 값: {}", fieldId, value);
                        } else {
                            log.warn("텍스트 필드 값 없음 - ID: {}", fieldId);
                        }
                        
                        if (!value.isEmpty()) {
                            // 폰트 크기와 색상 설정
                            int fontSize = field.has("fontSize") ? field.get("fontSize").asInt() : 12;
                            String fontColor = field.has("fontColor") ? field.get("fontColor").asText() : "#000000";
                            
                            // 색상 변환 (hex to RGB)
                            Color color = ColorConstants.BLACK;
                            if (fontColor.startsWith("#")) {
                                try {
                                    int r = Integer.parseInt(fontColor.substring(1, 3), 16);
                                    int g = Integer.parseInt(fontColor.substring(3, 5), 16);
                                    int b = Integer.parseInt(fontColor.substring(5, 7), 16);
                                    color = new DeviceRgb(r, g, b);
                                } catch (Exception e) {
                                    log.warn("색상 변환 실패: {}", fontColor);
                                }
                            }
                            
                            // 텍스트 추가
                            canvas.beginText()
                                  .setFontAndSize(PdfFontFactory.createFont(StandardFonts.HELVETICA), fontSize)
                                  .setColor(color, true)
                                  .moveText(x + 2, adjustedY + 2)
                                  .showText(value)
                                  .endText();
                            
                            log.info("텍스트 필드 추가 완료 - ID: {}, 값: {}", fieldId, value);
                        }
                    }
                }
            } else {
                log.warn("좌표 필드가 없거나 배열이 아님: {}", coordinateFields);
            }

            // 표 데이터 렌더링
            if (documentData != null && documentData.has("table init Fields")) {
                ArrayNode tables = (ArrayNode) documentData.get("table init Fields");
                ArrayNode tableData = documentData.has("table data") && documentData.get("table data").isArray()
                        ? (ArrayNode) documentData.get("table data")
                        : null;
                for (JsonNode table : tables) {
                    float x = table.has("x") ? (float) table.get("x").asDouble() : 0f;
                    float y = table.has("y") ? (float) table.get("y").asDouble() : 0f;
                    float width = table.has("width") ? (float) table.get("width").asDouble() : 300f;
                    float height = table.has("height") ? (float) table.get("height").asDouble() : 120f;
                    float pageHeight = pdfDoc.getFirstPage().getPageSize().getHeight();
                    float adjustedY = pageHeight - y - height;

                    // 헤더 높이 및 행 수 추정
                    float headerHeight = Math.min(30f, Math.max(20f, height * 0.12f));
                    int rows = 0;
                    if (tableData != null) {
                        // 해당 tableId의 최대 row index + 1로 계산
                        String tblId = table.has("tableId") ? table.get("tableId").asText() : null;
                        for (JsonNode cell : tableData) {
                            if (tblId != null && cell.has("tableId") && tblId.equals(cell.get("tableId").asText())) {
                                rows = Math.max(rows, cell.has("location_row") ? cell.get("location_row").asInt() + 1 : rows);
                            }
                        }
                    }
                    if (rows == 0) rows = 3;

                    // 컬럼 폭 계산
                    java.util.List<Integer> colWidths = new java.util.ArrayList<>();
                    int cols = 0;
                    if (table.has("columns") && table.get("columns").isArray()) {
                        for (JsonNode col : table.get("columns")) {
                            int w = 0;
                            if (col.has("width")) {
                                try { w = Integer.parseInt(col.get("width").asText()); } catch (Exception ignored) {}
                            }
                            if (w <= 0) { w = (int) Math.floor(width / Math.max(1, table.get("columns").size())); }
                            colWidths.add(w);
                            cols++;
                        }
                    }
                    if (cols == 0) { cols = 2; for (int i=0;i<cols;i++) colWidths.add((int) (width/cols)); }

                    // 헤더 라인
                    canvas.setStrokeColor(ColorConstants.LIGHT_GRAY);
                    canvas.rectangle(x, adjustedY + height - headerHeight, width, headerHeight).stroke();
                    // 외곽선
                    canvas.rectangle(x, adjustedY, width, height).stroke();
                    // 세로 구분선 및 헤더 텍스트는 생략(간단화)

                    // 셀 텍스트 채우기
                    if (tableData != null) {
                        for (JsonNode cell : tableData) {
                            String tblId = table.has("tableId") ? table.get("tableId").asText() : null;
                            if (tblId != null && cell.has("tableId") && !tblId.equals(cell.get("tableId").asText())) continue;
                            String value = cell.has("value") ? cell.get("value").asText() : "";
                            int r = cell.has("location_row") ? cell.get("location_row").asInt() : 0;
                            int c = cell.has("location_column") ? Integer.parseInt(cell.get("location_column").asText()) : 0;
                            if (r < 0 || c < 0 || c >= cols) continue;

                            // 좌표 계산
                            float colStartX = x;
                            for (int i = 0; i < c; i++) colStartX += colWidths.get(i);
                            float colWidth = colWidths.get(c);
                            float rowHeight = (height - headerHeight) / Math.max(1, rows);
                            float cellY = adjustedY + height - headerHeight - (r + 1) * rowHeight;

                            // 텍스트 렌더
                            if (!value.isEmpty()) {
                                canvas.beginText()
                                      .setFontAndSize(PdfFontFactory.createFont(StandardFonts.HELVETICA), 10)
                                      .moveText(colStartX + 2, cellY + rowHeight / 2 - 4)
                                      .showText(value)
                                      .endText();
                            }
                        }
                    }
                }
            }
            
            pdfDoc.close();
            log.info("완성된 PDF 생성: {}", outputPath);
            return outputPath;
        } catch (Exception e) {
            log.error("PDF 생성 중 오류 발생", e);
            throw new IOException("PDF 생성 실패: " + e.getMessage());
        }
    }

    private void fillCoordinateFields(PdfCanvas canvas, JsonNode templateFields, JsonNode documentData, PdfDocument pdfDoc) throws IOException {
        if (!templateFields.has("coordinateFields") || !documentData.has("coordinateData")) {
            return;
        }
        
        ArrayNode coordinateFields = (ArrayNode) templateFields.get("coordinateFields");
        ObjectNode coordinateData = (ObjectNode) documentData.get("coordinateData");
        ObjectNode signatures = documentData.has("signatures") ? (ObjectNode) documentData.get("signatures") : null;
        
        for (JsonNode field : coordinateFields) {
            String fieldId = field.get("id").asText();
            String fieldType = field.has("type") ? field.get("type").asText() : "text";
            
            float x = (float) field.get("x").asDouble();
            float y = (float) field.get("y").asDouble();
            float width = (float) field.get("width").asDouble();
            float height = (float) field.get("height").asDouble();
            
            // PDF 좌표계는 bottom-left 기준이므로 y 좌표 변환
            float pageHeight = pdfDoc.getFirstPage().getPageSize().getHeight();
            float adjustedY = pageHeight - y - height;
            
            if ("signature".equals(fieldType)) {
                // 서명 필드 처리
                String reviewerEmail = field.has("reviewerEmail") ? field.get("reviewerEmail").asText() : null;
                if (reviewerEmail != null && signatures != null && signatures.has(reviewerEmail)) {
                    String signatureData = signatures.get(reviewerEmail).asText();
                    
                    // base64 이미지 데이터에서 "data:image/png;base64," 부분 제거
                    if (signatureData.startsWith("data:image")) {
                        signatureData = signatureData.substring(signatureData.indexOf(",") + 1);
                    }
                    
                    try {
                        byte[] imageBytes = Base64.getDecoder().decode(signatureData);
                        ImageData imageData = ImageDataFactory.create(imageBytes);
                        
                        // 서명 이미지를 PDF에 추가 (크기 조정하여)
                        canvas.addImageWithTransformationMatrix(imageData, width, 0, 0, height, x, adjustedY, false);
                    } catch (Exception e) {
                        // 서명 이미지 처리 실패 시 텍스트로 대체
                        canvas.beginText()
                                .setFontAndSize(PdfFontFactory.createFont(StandardFonts.HELVETICA), 12)
                                .moveText(x, adjustedY + height/2)
                                .showText("[서명: " + reviewerEmail + "]")
                                .endText();
                    }
                }
            } else {
                // 일반 텍스트 필드 처리 (기존 로직)
                if (coordinateData.has(fieldId)) {
                    String value = coordinateData.get(fieldId).asText();
                    if (!value.isEmpty()) {
                        float fontSize = field.has("fontSize") ? (float) field.get("fontSize").asDouble() : 12f;
                        String fontColor = field.has("fontColor") ? field.get("fontColor").asText() : "#000000";
                        
                        // 색상 처리
                        Color color = ColorConstants.BLACK;
                        if (fontColor.startsWith("#") && fontColor.length() == 7) {
                            try {
                                int r = Integer.parseInt(fontColor.substring(1, 3), 16);
                                int g = Integer.parseInt(fontColor.substring(3, 5), 16);
                                int b = Integer.parseInt(fontColor.substring(5, 7), 16);
                                color = new DeviceRgb(r, g, b);
                            } catch (NumberFormatException ignored) {}
                        }
                        
                        canvas.beginText()
                                .setFontAndSize(PdfFontFactory.createFont(StandardFonts.HELVETICA), fontSize)
                                .setColor(color, true)
                                .moveText(x + 2, adjustedY + height/2 - fontSize/4)
                                .showText(value)
                                .endText();
                    }
                }
            }
        }
    }
    
    /**
     * 디렉토리 생성
     */
    private void createDirectoriesIfNotExists() throws IOException {
        Files.createDirectories(Paths.get(uploadDir));
        Files.createDirectories(Paths.get(pdfTemplatesDir));
    }
    
    /**
     * PDF 파일인지 확인
     */
    private boolean isPdfFile(MultipartFile file) {
        String contentType = file.getContentType();
        String filename = file.getOriginalFilename();
        
        return (contentType != null && contentType.equals("application/pdf")) ||
               (filename != null && filename.toLowerCase().endsWith(".pdf"));
    }
    
    /**
     * 파일 확장자 추출
     */
    private String getFileExtension(String filename) {
        if (filename == null || !filename.contains(".")) {
            return ".pdf";
        }
        return filename.substring(filename.lastIndexOf("."));
    }
    
    /**
     * 파일 확장자 제외한 기본 이름 추출
     */
    private String getBaseName(String filePath) {
        String filename = Paths.get(filePath).getFileName().toString();
        if (filename.contains(".")) {
            return filename.substring(0, filename.lastIndexOf("."));
        }
        return filename;
    }
    
    /**
     * PDF를 이미지로 변환 (150 DPI)
     */
    public byte[] convertPdfToImage(java.io.InputStream pdfInputStream, int dpi) throws IOException {
        try (PDDocument document = PDDocument.load(pdfInputStream)) {
            PDFRenderer pdfRenderer = new PDFRenderer(document);
            
            // 첫 번째 페이지만 렌더링 (150 DPI)
            BufferedImage image = pdfRenderer.renderImageWithDPI(0, dpi);
            
            // BufferedImage를 PNG 바이트 배열로 변환
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            ImageIO.write(image, "PNG", baos);
            
            return baos.toByteArray();
        }
    }
    
    /**
     * PDF 업로드 결과 DTO
     */
    @lombok.Data
    @lombok.Builder
    public static class PdfUploadResult {
        private String pdfFilePath;
        private String pdfImagePath;
        private String originalFilename;
    }
} 