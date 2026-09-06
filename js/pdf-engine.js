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
   * Renderizar miniaturas visuales de un PDF con PDF.js
   */
  async renderPageThumbnails(fileBuffer, onPageReady, maxPages = 150) {
    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = Math.min(pdfDoc.numPages, maxPages);

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 0.45 });
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      await page.render({
        canvasContext: context,
        viewport: viewport
      }).promise;

      if (onPageReady) {
        onPageReady(pageNum, canvas, pdfDoc.numPages);
      }
    }

    return pdfDoc.numPages;
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
   */
  async compressPDF(fileBuffer, level = 'recommended', onProgress) {
    if (onProgress) onProgress(15, "Iniciando análisis de compresión...");
    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    let scale = 1.35;
    let jpegQuality = 0.70;

    if (level === 'high') {
      scale = 1.0;
      jpegQuality = 0.48;
    } else if (level === 'light') {
      scale = 1.75;
      jpegQuality = 0.85;
    }

    const compressedPdf = await PDFLib.PDFDocument.create();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        const pct = Math.round(15 + ((pageNum / numPages) * 75));
        onProgress(pct, `Optimizando página ${pageNum} de ${numPages}...`);
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Fill white background for clean transparency handling
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      // Convert canvas to JPEG blob
      const jpegDataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
      const embeddedImage = await compressedPdf.embedJpg(jpegDataUrl);

      // Add page with original viewport dimensions (in standard PDF points: 72 dpi)
      const baseViewport = page.getViewport({ scale: 1.0 });
      const newPage = compressedPdf.addPage([baseViewport.width, baseViewport.height]);
      newPage.drawImage(embeddedImage, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height
      });
    }

    if (onProgress) onProgress(95, "Empaquetando documento optimizado...");
    const resultBytes = await compressedPdf.save();
    if (onProgress) onProgress(100, "¡Compresión completada!");

    return {
      bytes: resultBytes,
      originalSize: fileBuffer.byteLength,
      compressedSize: resultBytes.byteLength
    };
  },

  /**
   * 4. GIRAR PDF (Rotate PDF)
   */
  async rotatePDF(fileBuffer, rotationsMap, onProgress) {
    if (onProgress) onProgress(20, "Cargando páginas para rotar...");
    const pdf = await PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const pages = pdf.getPages();
    const total = pages.length;

    for (let i = 0; i < total; i++) {
      if (onProgress) {
        onProgress(20 + Math.round(((i + 1) / total) * 70), `Aplicando rotación página ${i + 1}...`);
      }
      const page = pages[i];
      const additionalDegrees = rotationsMap[i] || 0;
      if (additionalDegrees !== 0) {
        const currentRotation = page.getRotation().angle;
        const newRotation = (currentRotation + additionalDegrees + 360) % 360;
        page.setRotation(PDFLib.degrees(newRotation));
      }
    }

    if (onProgress) onProgress(95, "Generando documento con nueva orientación...");
    const resultBytes = await pdf.save();
    if (onProgress) onProgress(100, "¡Documento rotado con éxito!");

    return resultBytes;
  },

  /**
   * 5. JPG A PDF (Images to PDF)
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

      if (file.type === 'image/jpeg' || file.type === 'image/jpg') {
        embeddedImage = await pdfDoc.embedJpg(buffer);
        imgWidth = embeddedImage.width;
        imgHeight = embeddedImage.height;
      } else {
        // PNG or other: convert or embed PNG
        try {
          embeddedImage = await pdfDoc.embedPng(buffer);
          imgWidth = embeddedImage.width;
          imgHeight = embeddedImage.height;
        } catch (e) {
          // Fallback via Image & Canvas
          const dataUrl = await new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, canvas.width, canvas.height);
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
          });
          embeddedImage = await pdfDoc.embedJpg(dataUrl);
          imgWidth = embeddedImage.width;
          imgHeight = embeddedImage.height;
        }
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
  },

  /**
   * 6. PDF A JPG (PDF to Images)
   */
  async pdfToJPG(fileBuffer, baseName, quality = 'high', onProgress) {
    if (onProgress) onProgress(10, "Abriendo documento para renderizado...");
    const loadingTask = pdfjsLib.getDocument({ data: fileBuffer });
    const pdfDoc = await loadingTask.promise;
    const numPages = pdfDoc.numPages;

    const scale = quality === 'high' ? 2.0 : 1.3;
    const jpegQuality = quality === 'high' ? 0.92 : 0.82;

    const results = [];
    const zip = new JSZip();

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      if (onProgress) {
        const pct = Math.round(10 + ((pageNum / numPages) * 75));
        onProgress(pct, `Renderizando imagen página ${pageNum} de ${numPages}...`);
      }

      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      // Solid background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', jpegQuality));
      const padNum = String(pageNum).padStart(3, '0');
      const fileName = `${baseName}_pagina_${padNum}.jpg`;

      zip.file(fileName, blob);
      results.push({
        pageNum,
        fileName,
        blob,
        dataUrl: canvas.toDataURL('image/jpeg', 0.8)
      });
    }

    if (onProgress) onProgress(90, "Empaquetando imágenes en archivo ZIP...");
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    if (onProgress) onProgress(100, "¡Conversión a JPG completada!");

    return {
      images: results,
      zipBlob
    };
  },

  /**
   * 7. ELIMINAR PÁGINAS DE PDF (Delete Pages)
   */
  async deletePages(fileBuffer, pagesToDeleteIndices, onProgress) {
    if (onProgress) onProgress(20, "Cargando documento...");
    const originalPdf = await PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });
    const totalPages = originalPdf.getPageCount();

    const deleteSet = new Set(pagesToDeleteIndices);
    const keepIndices = [];
    for (let i = 0; i < totalPages; i++) {
      if (!deleteSet.has(i)) {
        keepIndices.push(i);
      }
    }

    if (keepIndices.length === 0) {
      throw new Error("No puedes eliminar todas las páginas del PDF.");
    }

    if (onProgress) onProgress(60, `Conservando ${keepIndices.length} páginas...`);
    const newPdf = await PDFLib.PDFDocument.create();
    const copiedPages = await newPdf.copyPages(originalPdf, keepIndices);
    copiedPages.forEach(p => newPdf.addPage(p));

    if (onProgress) onProgress(95, "Creando documento final...");
    const resultBytes = await newPdf.save();
    if (onProgress) onProgress(100, "¡Páginas eliminadas correctamente!");

    return {
      bytes: resultBytes,
      remainingCount: keepIndices.length
    };
  },

  /**
   * 8. EXTRAER PÁGINAS DE PDF (Extract Pages)
   */
  async extractPages(fileBuffer, pagesToKeepIndices, onProgress) {
    if (onProgress) onProgress(20, "Cargando documento...");
    const originalPdf = await PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });

    if (!pagesToKeepIndices || pagesToKeepIndices.length === 0) {
      throw new Error("Selecciona al menos una página para extraer.");
    }

    if (onProgress) onProgress(60, `Extrayendo ${pagesToKeepIndices.length} páginas...`);
    const newPdf = await PDFLib.PDFDocument.create();
    const copiedPages = await newPdf.copyPages(originalPdf, pagesToKeepIndices);
    copiedPages.forEach(p => newPdf.addPage(p));

    if (onProgress) onProgress(95, "Guardando nuevo PDF...");
    const resultBytes = await newPdf.save();
    if (onProgress) onProgress(100, "¡Páginas extraídas correctamente!");

    return {
      bytes: resultBytes,
      extractedCount: pagesToKeepIndices.length
    };
  },

  /**
   * 9. ORDENAR PÁGINAS DE PDF (Reorder Pages)
   */
  async reorderPages(fileBuffer, newOrderIndices, onProgress) {
    if (onProgress) onProgress(20, "Cargando estructura del PDF...");
    const originalPdf = await PDFLib.PDFDocument.load(fileBuffer, { ignoreEncryption: true });

    if (onProgress) onProgress(60, "Reordenando páginas en el nuevo orden...");
    const newPdf = await PDFLib.PDFDocument.create();
    const copiedPages = await newPdf.copyPages(originalPdf, newOrderIndices);
    copiedPages.forEach(p => newPdf.addPage(p));

    if (onProgress) onProgress(95, "Guardando documento reordenado...");
    const resultBytes = await newPdf.save();
    if (onProgress) onProgress(100, "¡Orden guardado exitosamente!");

    return resultBytes;
  },

  /**
   * 10. AÑADIR PÁGINAS A PDF (Add Pages / Insert into PDF)
   */
  async addPagesToPDF(basePdfBuffer, additionalBuffer, isAdditionalPdf, insertMode = 'end', insertAfterPage = 1, onProgress) {
    if (onProgress) onProgress(20, "Cargando documento base...");
    const basePdf = await PDFLib.PDFDocument.load(basePdfBuffer, { ignoreEncryption: true });
    const finalPdf = await PDFLib.PDFDocument.create();

    const baseCount = basePdf.getPageCount();

    // Prepare pages to insert
    let pagesToInsert = [];
    if (isAdditionalPdf) {
      if (onProgress) onProgress(40, "Cargando documento adicional...");
      const addPdf = await PDFLib.PDFDocument.load(additionalBuffer, { ignoreEncryption: true });
      pagesToInsert = await finalPdf.copyPages(addPdf, addPdf.getPageIndices());
    } else {
      // It is an image: embed into a single page
      if (onProgress) onProgress(40, "Insertando imagen...");
      let img;
      try {
        img = await finalPdf.embedJpg(additionalBuffer);
      } catch (e) {
        img = await finalPdf.embedPng(additionalBuffer);
      }
      const page = finalPdf.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      // remove from finalPdf for ordered placement
      pagesToInsert = [page];
    }

    if (onProgress) onProgress(60, "Copiando páginas del documento base...");
    const basePages = await finalPdf.copyPages(basePdf, basePdf.getPageIndices());

    // Build ordered list
    if (insertMode === 'start') {
      pagesToInsert.forEach(p => finalPdf.addPage(p));
      basePages.forEach(p => finalPdf.addPage(p));
    } else if (insertMode === 'after') {
      const splitPoint = Math.max(1, Math.min(insertAfterPage, baseCount));
      for (let i = 0; i < splitPoint; i++) {
        finalPdf.addPage(basePages[i]);
      }
      pagesToInsert.forEach(p => finalPdf.addPage(p));
      for (let i = splitPoint; i < baseCount; i++) {
        finalPdf.addPage(basePages[i]);
      }
    } else {
      // Default: 'end'
      basePages.forEach(p => finalPdf.addPage(p));
      pagesToInsert.forEach(p => finalPdf.addPage(p));
    }

    if (onProgress) onProgress(95, "Compilando documento combinado...");
    const resultBytes = await finalPdf.save();
    if (onProgress) onProgress(100, "¡Páginas añadidas con éxito!");

    return resultBytes;
  }

};

window.PDFEngine = PDFEngine;
