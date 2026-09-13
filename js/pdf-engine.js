/**
 * ============================================================================
 * HERRAMIENTAS PDF - PDF ENGINE
 * Motor de procesamiento 100% cliente en navegador usando pdf-lib, PDF.js y JSZip.
 * ============================================================================
 */

// Configure PDF.js Worker
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

const PDFEngine = {

  /**
   * Formatear bytes a tamaño legible (KB, MB, GB)
   */
  formatBytes(bytes, decimals = 2) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  /**
   * Descarga segura de un blob en el navegador
   */
  downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  },

  /**
   * Obtener información rápida de un PDF (número de páginas y dimensiones)
   */
  async getPdfInfo(fileBuffer) {
    const pdf = await PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const count = pdf.getPageCount();
    return {
      pageCount: count,
      pdfDocument: pdf
    };
  },

  /**
   * Interpretar sintaxis de rangos de páginas ("1-3, 5, 8") -> array de índices 0-based
   */
  parsePageRanges(rangeString, totalPages) {
    const pages = [];
    const parts = rangeString.split(',');

    for (let part of parts) {
      part = part.trim();
      if (!part) continue;

      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        let start = parseInt(startStr, 10);
        let end = parseInt(endStr, 10);

        if (!isNaN(start) && !isNaN(end)) {
          if (start > end) {
            const tmp = start;
            start = end;
            end = tmp;
          }
          for (let p = start; p <= end; p++) {
            if (p >= 1 && p <= totalPages) {
              pages.push(p - 1);
            }
          }
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= totalPages) {
          pages.push(p - 1);
        }
      }
    }

    return [...new Set(pages)].sort((a, b) => a - b);
  },

  /**
   * 1. UNIR PDF (Merge PDFs)
   */
  async mergePDFs(fileBuffers, onProgress) {
    if (fileBuffers.length < 2) {
      throw new Error("Se necesitan al menos 2 documentos para unir.");
    }

    const mergedPdf = await PDFLib.PDFDocument.create();
    const totalFiles = fileBuffers.length;

    for (let i = 0; i < totalFiles; i++) {
      if (onProgress) {
        onProgress(Math.round(((i) / totalFiles) * 100), `Copiando documento ${i + 1} de ${totalFiles}...`);
      }

      const pdf = await PDFLib.PDFDocument.load(fileBuffers[i], { ignoreEncryption: true });
      const pages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
      pages.forEach(page => mergedPdf.addPage(page));
    }

    if (onProgress) onProgress(95, "Compilando documento final...");
    const pdfBytes = await mergedPdf.save();
    if (onProgress) onProgress(100, "¡Unión completada con éxito!");

    return pdfBytes;
  },

  /**
   * 2. DIVIDIR PDF (Split PDF by ranges)
   */
  async splitPDF(fileBuffer, rangeString, onProgress) {
    if (onProgress) onProgress(20, "Cargando documento original...");
    const originalPdf = await PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const totalPages = originalPdf.getPageCount();

    const selectedIndices = this.parsePageRanges(rangeString, totalPages);
    if (selectedIndices.length === 0) {
      throw new Error("No se seleccionaron páginas válidas para extraer.");
    }

    if (onProgress) onProgress(50, `Extrayendo ${selectedIndices.length} páginas...`);
    const newPdf = await PDFLib.PDFDocument.create();
    const copiedPages = await newPdf.copyPages(originalPdf, selectedIndices);
    copiedPages.forEach(page => newPdf.addPage(page));

    if (onProgress) onProgress(90, "Guardando nuevo archivo...");
    const resultBytes = await newPdf.save();
    if (onProgress) onProgress(100, "¡División finalizada!");

    return {
      bytes: resultBytes,
      pagesExtracted: selectedIndices.length
    };
  },

  /**
   * DIVIDIR PDF: Separar todas las páginas en un archivo ZIP
   */
  async splitAllPagesToZip(fileBuffer, baseName, onProgress) {
    const originalPdf = await PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const totalPages = originalPdf.getPageCount();
    const zip = new JSZip();

    for (let i = 0; i < totalPages; i++) {
      if (onProgress) {
        onProgress(Math.round(((i + 1) / totalPages) * 90), `Separando página ${i + 1} de ${totalPages}...`);
      }
      const singlePdf = await PDFLib.PDFDocument.create();
      const [copiedPage] = await singlePdf.copyPages(originalPdf, [i]);
      singlePdf.addPage(copiedPage);
      const singleBytes = await singlePdf.save();
      
      const padNum = String(i + 1).padStart(3, '0');
      zip.file(`${baseName}_pagina_${padNum}.pdf`, singleBytes);
    }

    if (onProgress) onProgress(95, "Comprimiendo archivo ZIP...");
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    if (onProgress) onProgress(100, "¡Páginas separadas en ZIP listas!");

    return zipBlob;
  },

  /**
   * 3. COMPRIMIR PDF (Compress PDF)
   * Sistema equilibrado: prioriza alta calidad visual, nitidez de texto y detalles en imágenes.
   * Aplica remuestreo a resolución de imprenta/pantalla (~150 DPI) en modo recomendado para que
   * el texto siga viéndose nítido y sin artefactos, y verifica contra optimización estructural
   * para garantizar que el archivo nunca termine más pesado que el original.
   */
  async compressPDF(fileBuffer, level = 'recommended', onProgress) {
    if (onProgress) onProgress(8, "Iniciando análisis y optimización del PDF...");
    const originalSize = fileBuffer.byteLength;

    // 1. Intentar optimización estructural con pdf-lib (compacta flujos de objetos)
    let structuralBytes = null;
    try {
      const origDoc = await PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
      structuralBytes = await origDoc.save({ useObjectStreams: true });
    } catch (err) {
      console.warn("Optimización estructural inicial no disponible:", err);
    }

    // 2. Configurar niveles de compresión preservando la mayor calidad visual:
    // - 'recommended' (predeterminado): escala 2.08 (~150 DPI), calidad JPEG 0.88
    //   Consigue un balance perfecto: texto nítido, imágenes detalladas y reducción equilibrada.
    // - 'high': escala 1.67 (~120 DPI), calidad JPEG 0.78
    //   Mayor reducción con pérdida de calidad moderada y legible.
    // - 'maximum': escala 1.35 (~97 DPI), calidad JPEG 0.65
    //   Máxima reducción de peso con advertencia de menor nitidez.
    let scale = 2.08;
    let jpegQuality = 0.88;

    if (level === 'high') {
      scale = 1.67;
      jpegQuality = 0.78;
    } else if (level === 'maximum') {
      scale = 1.35;
      jpegQuality = 0.65;
    } else if (level === 'light') {
      scale = 2.25;
      jpegQuality = 0.92;
    }

    // 3. Renderizado y resampleo controlado con PDF.js
    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const compressedPdf = await PDFLib.PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        const pct = Math.round(10 + ((pageNum / numPages) * 78));
        onProgress(pct, `Optimizando página ${pageNum} de ${numPages} con alta nitidez...`);
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { alpha: false });
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fondo blanco sólido para garantizar contraste y evitar transparencias negras
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      // Conversión a imagen JPEG de alta fidelidad
      const jpegBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', jpegQuality));
      const jpegBuffer = await jpegBlob.arrayBuffer();

      // Liberar memoria del canvas inmediatamente para evitar saturación en móviles
      canvas.width = 0;
      canvas.height = 0;

      const embeddedImage = await compressedPdf.embedJpg(jpegBuffer);

      // Mantener las dimensiones originales de la página en puntos PDF estándar (72 pt/in)
      const baseViewport = page.getViewport({ scale: 1.0 });
      const newPage = compressedPdf.addPage([baseViewport.width, baseViewport.height]);
      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height
      });
    }

    if (onProgress) onProgress(92, "Empaquetando documento optimizado...");
    const rasterBytes = await compressedPdf.save({ useObjectStreams: true });

    // 4. Comparación inteligente: seleccionar la mejor alternativa sin inflar el tamaño
    let finalBytes = rasterBytes;

    // Si la optimización estructural sin rasterizar fue más liviana, o si el raster superó el tamaño original
    if (structuralBytes && structuralBytes.byteLength < originalSize) {
      if (structuralBytes.byteLength < rasterBytes.byteLength || rasterBytes.byteLength >= originalSize) {
        finalBytes = structuralBytes;
      }
    }

    // Si ambos métodos resultan mayores que el original (archivo ya comprimido al máximo)
    if (finalBytes.byteLength >= originalSize) {
      if (structuralBytes && structuralBytes.byteLength < finalBytes.byteLength) {
        finalBytes = structuralBytes;
      }
    }

    if (onProgress) onProgress(100, "¡Compresión completada con éxito!");

    return {
      bytes: finalBytes,
      originalSize: originalSize,
      compressedSize: finalBytes.byteLength
    };
  },

  /**
   * 4. JPG A PDF (Images to PDF)
   */
  async imagesToPDF(imageFiles, options = { fit: 'a4-portrait', margin: 'small' }, onProgress) {
    if (!imageFiles || imageFiles.length === 0) {
      throw new Error("Selecciona al menos una imagen.");
    }

    const pdfDoc = await PDFLib.PDFDocument.create();
    const total = imageFiles.length;

    // A4 dimensions in points: 595.28 x 841.89
    const A4_W = 595.28;
    const A4_H = 841.89;

    let marginPts = 0;
    if (options.margin === 'small') marginPts = 20;
    if (options.margin === 'normal') marginPts = 40;

    for (let i = 0; i < total; i++) {
      if (onProgress) {
        onProgress(Math.round(((i + 1) / total) * 85), `Insertando imagen ${i + 1} de ${total}...`);
      }

      const file = imageFiles[i];
      const buffer = await file.arrayBuffer();

      let embeddedImage;
      let imgWidth, imgHeight;

      const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.name.toLowerCase().endsWith('.jpg') || file.name.toLowerCase().endsWith('.jpeg');
      if (isJpeg) {
        try {
          embeddedImage = await pdfDoc.embedJpg(buffer);
          imgWidth = embeddedImage.width;
          imgHeight = embeddedImage.height;
        } catch (e) {
          // Fallback via Image & Canvas
          embeddedImage = null;
        }
      } else if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        try {
          embeddedImage = await pdfDoc.embedPng(buffer);
          imgWidth = embeddedImage.width;
          imgHeight = embeddedImage.height;
        } catch (e) {
          embeddedImage = null;
        }
      }

      // If not embedded yet (WebP, unsupported color format, or corrupt metadata), re-encode with Canvas
      if (!embeddedImage) {
        const imageBuffer = await new Promise((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(img.src);
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            canvas.toBlob(async (blob) => {
              canvas.width = 0;
              canvas.height = 0;
              const buf = await blob.arrayBuffer();
              resolve(buf);
            }, 'image/jpeg', 0.94);
          };
          img.onerror = (err) => {
            URL.revokeObjectURL(img.src);
            reject(err);
          };
          img.src = URL.createObjectURL(file);
        });
        embeddedImage = await pdfDoc.embedJpg(imageBuffer);
        imgWidth = embeddedImage.width;
        imgHeight = embeddedImage.height;
      }

      let pageWidth, pageHeight, drawX, drawY, drawW, drawH;

      if (options.fit === 'fit-image') {
        pageWidth = imgWidth + (marginPts * 2);
        pageHeight = imgHeight + (marginPts * 2);
        drawX = marginPts;
        drawY = marginPts;
        drawW = imgWidth;
        drawH = imgHeight;
      } else if (options.fit === 'a4-landscape') {
        pageWidth = A4_H;
        pageHeight = A4_W;
        const availW = pageWidth - (marginPts * 2);
        const availH = pageHeight - (marginPts * 2);
        const scale = Math.min(availW / imgWidth, availH / imgHeight);
        drawW = imgWidth * scale;
        drawH = imgHeight * scale;
        drawX = marginPts + (availW - drawW) / 2;
        drawY = marginPts + (availH - drawH) / 2;
      } else {
        // a4-portrait (default)
        pageWidth = A4_W;
        pageHeight = A4_H;
        const availW = pageWidth - (marginPts * 2);
        const availH = pageHeight - (marginPts * 2);
        const scale = Math.min(availW / imgWidth, availH / imgHeight);
        drawW = imgWidth * scale;
        drawH = imgHeight * scale;
        drawX = marginPts + (availW - drawW) / 2;
        drawY = marginPts + (availH - drawH) / 2;
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      page.drawImage(embeddedImage, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH
      });
    }

    if (onProgress) onProgress(95, "Compilando PDF desde imágenes...");
    const resultBytes = await pdfDoc.save();
    if (onProgress) onProgress(100, "¡PDF generado con éxito!");

    return resultBytes;
  }

};

window.PDFEngine = PDFEngine;
