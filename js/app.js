/**
 * ============================================================================
 * HERRAMIENTAS PDF - MAIN APPLICATION CONTROLLER
 * Solo 4 herramientas esenciales:
 * 1. UNIR PDF
 * 2. DIVIDIR PDF
 * 3. JPG A PDF
 * 4. COMPRIMIR PDF
 * 
 * 100% Procesamiento Local en el Navegador con PDF-Lib y PDF.js
 * ============================================================================
 */

(function () {
  'use strict';

  // --- APPLICATION STATE ---
  const state = {
    theme: localStorage.getItem('theme') || 'light',
    currentTool: null,
    // For single file tools (dividir, comprimir)
    primaryFile: null,
    primaryFileBuffer: null,
    primaryPdfInfo: null,
    // For multi file tools (unir, jpg2pdf)
    filesList: [], // { id, file, buffer, info, previewUrl }
    // Processing results
    currentResultBlob: null,
    lastResultFilename: ''
  };

  // --- 4 HERRAMIENTAS DEFINITION ---
  const TOOLS = {
    unir: {
      id: 'unir',
      name: 'Unir PDF',
      badge: 'Popular',
      iconClass: 'tool-icon-blue',
      lucideIcon: 'files',
      desc: 'Combina múltiples documentos PDF en un solo archivo organizado en el orden que tú decidas.',
      category: 'organizar',
      accept: '.pdf,application/pdf',
      multiple: true,
      actionBtnText: 'Unir archivos PDF'
    },
    dividir: {
      id: 'dividir',
      name: 'Dividir PDF',
      badge: 'Popular',
      iconClass: 'tool-icon-rose',
      lucideIcon: 'scissors',
      desc: 'Extrae páginas individuales o rangos específicos (ej. 1, 1-3, 1,3,5 o 2-4,7) para crear un nuevo PDF.',
      category: 'organizar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Dividir PDF'
    },
    jpg2pdf: {
      id: 'jpg2pdf',
      name: 'JPG a PDF',
      badge: 'Convertidor',
      iconClass: 'tool-icon-purple',
      lucideIcon: 'image',
      desc: 'Convierte una o varias imágenes JPG o JPEG en un documento PDF de alta calidad con márgenes personalizados.',
      category: 'convertir',
      accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
      multiple: true,
      actionBtnText: 'Convertir a PDF'
    },
    comprimir: {
      id: 'comprimir',
      name: 'Comprimir PDF',
      badge: 'Optimización',
      iconClass: 'tool-icon-green',
      lucideIcon: 'minimize-2',
      desc: 'Reduce el peso de tu archivo PDF manteniendo la máxima nitidez visual en textos y gráficos sin compresión excesiva.',
      category: 'optimizar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Comprimir PDF'
    }
  };

  // --- DOM ELEMENTS ---
  const els = {
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    mobileMenuBtn: document.getElementById('mobileMenuBtn'),
    navMenu: document.getElementById('navMenu'),
    heroSection: document.getElementById('inicio'),
    toolsSection: document.getElementById('herramientas'),
    workspaceSection: document.getElementById('workspaceSection'),
    backToToolsBtn: document.getElementById('backToToolsBtn'),
    btnResetTool: document.getElementById('btnResetTool'),
    toolsGrid: document.getElementById('toolsGrid'),

    // Active tool info in workspace
    activeToolIcon: document.getElementById('activeToolIcon'),
    activeToolName: document.getElementById('activeToolName'),
    activeToolDesc: document.getElementById('activeToolDesc'),

    // Dropzone
    uploadDropzone: document.getElementById('uploadDropzone'),
    dropzoneText: document.getElementById('dropzoneText'),
    fileInput: document.getElementById('fileInput'),

    // Single file bar
    fileDetailsBar: document.getElementById('fileDetailsBar'),
    fileMainName: document.getElementById('fileMainName'),
    fileSubStats: document.getElementById('fileSubStats'),
    btnChangeFile: document.getElementById('btnChangeFile'),
    btnClearFile: document.getElementById('btnClearFile'),

    // Multi-file container
    multiFilesContainer: document.getElementById('multiFilesContainer'),
    multiFilesList: document.getElementById('multiFilesList'),
    btnAddMoreFiles: document.getElementById('btnAddMoreFiles'),
    moreFileInput: document.getElementById('moreFileInput'),

    // Options panel
    toolOptionsPanel: document.getElementById('toolOptionsPanel'),
    toolOptionsDynamicContent: document.getElementById('toolOptionsDynamicContent'),

    // Progress & status
    processingStatusArea: document.getElementById('processingStatusArea'),
    progressBarFill: document.getElementById('progressBarFill'),
    statusMessage: document.getElementById('statusMessage'),

    // Result card
    resultSuccessBox: document.getElementById('resultSuccessBox'),
    resultTitle: document.getElementById('resultTitle'),
    resultDesc: document.getElementById('resultDesc'),
    resultCustomStats: document.getElementById('resultCustomStats'),
    btnDownloadMain: document.getElementById('btnDownloadMain'),
    btnProcessAnother: document.getElementById('btnProcessAnother'),

    // Execute button
    btnExecuteTool: document.getElementById('btnExecuteTool'),

    // Contact form
    contactForm: document.getElementById('contactForm'),
    contactSuccessAlert: document.getElementById('contactSuccessAlert'),

    // Toast container
    toastContainer: document.getElementById('toastContainer')
  };

  // --- INITIALIZATION ---
  function init() {
    setupTheme();
    renderToolsGrid();
    setupEventListeners();
    setupMobileMenu();
    setupContactForm();
    if (window.lucide) {
      window.lucide.createIcons();
    }
  }

  // --- THEME MANAGEMENT ---
  function setupTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();

    if (els.themeToggleBtn) {
      els.themeToggleBtn.addEventListener('click', () => {
        state.theme = state.theme === 'light' ? 'dark' : 'light';
        localStorage.setItem('theme', state.theme);
        document.documentElement.setAttribute('data-theme', state.theme);
        updateThemeIcon();
      });
    }
  }

  function updateThemeIcon() {
    if (!els.themeToggleBtn) return;
    const icon = els.themeToggleBtn.querySelector('i');
    if (icon) {
      icon.setAttribute('data-lucide', state.theme === 'dark' ? 'sun' : 'moon');
      if (window.lucide) window.lucide.createIcons();
    }
  }

  // --- MOBILE MENU ---
  function setupMobileMenu() {
    if (els.mobileMenuBtn && els.navMenu) {
      els.mobileMenuBtn.addEventListener('click', () => {
        els.navMenu.classList.toggle('active');
      });

      // Close menu when clicking any nav link
      els.navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
          els.navMenu.classList.remove('active');
        });
      });
    }
  }

  // --- RENDER TOOLS GRID (ONLY 4 TOOLS) ---
  function renderToolsGrid() {
    if (!els.toolsGrid) return;
    els.toolsGrid.innerHTML = '';

    const toolKeys = ['unir', 'dividir', 'jpg2pdf', 'comprimir'];

    toolKeys.forEach((key, index) => {
      const tool = TOOLS[key];
      if (!tool) return;

      const card = document.createElement('div');
      card.className = 'tool-card';
      card.id = `tool-card-${tool.id}`;
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      card.innerHTML = `
        <div class="tool-card-icon-wrapper ${tool.iconClass}">
          <i data-lucide="${tool.lucideIcon}"></i>
        </div>
        <div class="tool-card-title">
          <span>${index + 1}. ${tool.name}</span>
          <span class="tool-card-badge">${tool.badge}</span>
        </div>
        <p class="tool-card-desc">${tool.desc}</p>
        <div class="tool-card-footer">
          <span class="tool-card-action">
            Comenzar <i data-lucide="arrow-right" style="width: 15px; height: 15px;"></i>
          </span>
        </div>
      `;

      card.addEventListener('click', () => openTool(tool.id));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openTool(tool.id);
        }
      });

      els.toolsGrid.appendChild(card);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  // --- WORKSPACE NAVIGATION ---
  function openTool(toolId) {
    const tool = TOOLS[toolId];
    if (!tool) return;

    // Revoke any existing image object URLs
    clearImagePreviews();

    state.currentTool = toolId;
    state.primaryFile = null;
    state.primaryFileBuffer = null;
    state.primaryPdfInfo = null;
    state.filesList = [];
    state.currentResultBlob = null;
    state.lastResultFilename = '';

    // Update workspace header info
    if (els.activeToolName) els.activeToolName.textContent = tool.name;
    if (els.activeToolDesc) els.activeToolDesc.textContent = tool.desc;
    if (els.activeToolIcon) {
      els.activeToolIcon.className = `activeToolIcon ${tool.iconClass}`;
      els.activeToolIcon.innerHTML = `<i data-lucide="${tool.lucideIcon}"></i>`;
    }

    // Configure file input accept and multiple
    if (els.fileInput) {
      els.fileInput.accept = tool.accept;
      els.fileInput.multiple = tool.multiple;
    }
    if (els.moreFileInput) {
      els.moreFileInput.accept = tool.accept;
    }

    // Dropzone text
    if (els.dropzoneText) {
      if (tool.id === 'jpg2pdf') {
        els.dropzoneText.textContent = 'Selecciona una o varias imágenes (JPG, JPEG, PNG o WebP)';
      } else if (tool.multiple) {
        els.dropzoneText.textContent = 'Selecciona dos o más documentos PDF para unir';
      } else {
        els.dropzoneText.textContent = 'Selecciona un archivo PDF desde tu dispositivo';
      }
    }

    // Reset views
    resetToolUI();

    // Show workspace
    if (els.workspaceSection) els.workspaceSection.style.display = 'block';

    // Smooth scroll to workspace
    els.workspaceSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (window.lucide) window.lucide.createIcons();
  }

  function closeTool() {
    clearImagePreviews();
    state.currentTool = null;
    state.primaryFile = null;
    state.primaryFileBuffer = null;
    state.primaryPdfInfo = null;
    state.filesList = [];
    state.currentResultBlob = null;

    if (els.workspaceSection) els.workspaceSection.style.display = 'none';

    if (els.toolsSection) {
      els.toolsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function resetToolWorkspace() {
    if (!state.currentTool) return;
    openTool(state.currentTool);
    showToast('Herramienta reiniciada.', 'info');
  }

  function clearImagePreviews() {
    if (state.filesList && state.filesList.length > 0) {
      state.filesList.forEach(item => {
        if (item.previewUrl) {
          try { URL.revokeObjectURL(item.previewUrl); } catch (e) { /* silent */ }
        }
      });
    }
  }

  function resetToolUI() {
    if (els.uploadDropzone) els.uploadDropzone.style.display = 'block';
    if (els.fileDetailsBar) els.fileDetailsBar.style.display = 'none';
    if (els.multiFilesContainer) els.multiFilesContainer.style.display = 'none';
    if (els.toolOptionsPanel) {
      els.toolOptionsPanel.style.display = 'none';
      if (els.toolOptionsDynamicContent) els.toolOptionsDynamicContent.innerHTML = '';
    }
    if (els.processingStatusArea) els.processingStatusArea.style.display = 'none';
    if (els.resultSuccessBox) els.resultSuccessBox.style.display = 'none';
    if (els.btnExecuteTool) {
      els.btnExecuteTool.disabled = true;
      const tool = TOOLS[state.currentTool];
      els.btnExecuteTool.textContent = tool ? tool.actionBtnText : 'Ejecutar acción';
    }
  }

  // --- EVENT LISTENERS ---
  function setupEventListeners() {
    // Back to tools button
    if (els.backToToolsBtn) {
      els.backToToolsBtn.addEventListener('click', closeTool);
    }

    // Reset tool button
    if (els.btnResetTool) {
      els.btnResetTool.addEventListener('click', resetToolWorkspace);
    }

    // Process another button inside success card
    if (els.btnProcessAnother) {
      els.btnProcessAnother.addEventListener('click', resetToolWorkspace);
    }

    // Dropzone click
    if (els.uploadDropzone && els.fileInput) {
      els.uploadDropzone.addEventListener('click', () => els.fileInput.click());
      els.uploadDropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          els.fileInput.click();
        }
      });

      // Drag and drop
      ['dragenter', 'dragover'].forEach(eventName => {
        els.uploadDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          els.uploadDropzone.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        els.uploadDropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          els.uploadDropzone.classList.remove('dragover');
        });
      });

      els.uploadDropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files.length > 0) {
          handleIncomingFiles(dt.files);
        }
      });

      els.fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleIncomingFiles(e.target.files);
          e.target.value = ''; // Reset for re-selection
        }
      });
    }

    // Add more files button (for unir and jpg2pdf)
    if (els.btnAddMoreFiles && els.moreFileInput) {
      els.btnAddMoreFiles.addEventListener('click', () => els.moreFileInput.click());
      els.moreFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleIncomingFiles(e.target.files, true);
          e.target.value = '';
        }
      });
    }

    // Change and clear single file
    if (els.btnChangeFile && els.fileInput) {
      els.btnChangeFile.addEventListener('click', () => els.fileInput.click());
    }
    if (els.btnClearFile) {
      els.btnClearFile.addEventListener('click', resetToolWorkspace);
    }

    // Main action execute button
    if (els.btnExecuteTool) {
      els.btnExecuteTool.addEventListener('click', executeCurrentTool);
    }

    // Download button
    if (els.btnDownloadMain) {
      els.btnDownloadMain.addEventListener('click', () => {
        if (state.currentResultBlob && state.lastResultFilename) {
          PDFEngine.downloadBlob(state.currentResultBlob, state.lastResultFilename);
          showToast('Descarga iniciada exitosamente.', 'success');
        }
      });
    }

    // Make global methods available for onclick links
    window.openTool = openTool;
    window.closeTool = closeTool;
  }

  // --- FILE SELECTION & PROCESSING DISPATCHER ---
  async function handleIncomingFiles(fileList, isAppend = false) {
    if (!state.currentTool) return;
    const tool = TOOLS[state.currentTool];

    try {
      if (tool.multiple) {
        // Multi-file tools: 'unir' or 'jpg2pdf'
        await handleMultiFiles(fileList, isAppend);
      } else {
        // Single file tools: 'dividir' or 'comprimir'
        await handleSinglePdfFile(fileList[0]);
      }
    } catch (err) {
      console.error('Error al cargar archivo:', err);
      showToast(err.message || 'Error al leer el archivo.', 'error');
    }
  }

  // --- SINGLE FILE HANDLER (Dividir, Comprimir) ---
  async function handleSinglePdfFile(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      throw new Error('Por favor selecciona un archivo con formato PDF válido.');
    }

    showStatus('Cargando y analizando documento...', 30);
    const buffer = await file.arrayBuffer();

    let info;
    try {
      info = await PDFEngine.getPdfInfo(buffer);
    } catch (e) {
      hideStatus();
      throw new Error('No se pudo abrir el PDF. Comprueba que el archivo no esté protegido con contraseña o dañado.');
    }

    state.primaryFile = file;
    state.primaryFileBuffer = buffer;
    state.primaryPdfInfo = info;

    hideStatus();

    // Update single file details bar
    if (els.fileMainName) els.fileMainName.textContent = file.name;
    if (els.fileSubStats) {
      els.fileSubStats.textContent = `${PDFEngine.formatBytes(file.size)} • ${info.pageCount} ${info.pageCount === 1 ? 'página' : 'páginas'}`;
    }

    if (els.uploadDropzone) els.uploadDropzone.style.display = 'none';
    if (els.fileDetailsBar) els.fileDetailsBar.style.display = 'flex';
    if (els.resultSuccessBox) els.resultSuccessBox.style.display = 'none';

    // Setup tool-specific options
    if (state.currentTool === 'dividir') {
      setupDividirWorkspace();
    } else if (state.currentTool === 'comprimir') {
      setupComprimirWorkspace();
    }

    if (els.btnExecuteTool) els.btnExecuteTool.disabled = false;
    showToast(`Archivo "${file.name}" cargado correctamente.`, 'success');
  }

  // --- MULTI FILE HANDLER (Unir, JPG a PDF) ---
  async function handleMultiFiles(fileList, isAppend = false) {
    if (!isAppend) {
      clearImagePreviews();
      state.filesList = [];
    }

    const filesArray = Array.from(fileList);
    const isImageTool = state.currentTool === 'jpg2pdf';

    let addedCount = 0;

    for (const file of filesArray) {
      if (isImageTool) {
        // Valid image formats: jpeg, png, webp
        const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        const isImageExt = /\.(jpe?g|png|webp)$/i.test(file.name);
        if (!validTypes.includes(file.type) && !isImageExt) {
          continue; // Skip non-images quietly
        }

        const previewUrl = URL.createObjectURL(file);
        state.filesList.push({
          id: 'file_' + Math.random().toString(36).substring(2, 9),
          file: file,
          name: file.name,
          size: file.size,
          previewUrl: previewUrl
        });
        addedCount++;
      } else {
        // Unir PDF: valid PDF
        if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
          continue;
        }

        const buffer = await file.arrayBuffer();
        let pageCount = 0;
        try {
          const info = await PDFEngine.getPdfInfo(buffer);
          pageCount = info.pageCount;
        } catch (e) {
          console.warn('PDF info check skipped for:', file.name);
        }

        state.filesList.push({
          id: 'file_' + Math.random().toString(36).substring(2, 9),
          file: file,
          name: file.name,
          size: file.size,
          buffer: buffer,
          pageCount: pageCount
        });
        addedCount++;
      }
    }

    if (state.filesList.length === 0) {
      throw new Error(isImageTool ? 'No se seleccionó ninguna imagen válida.' : 'No se seleccionaron archivos PDF válidos.');
    }

    renderMultiFilesList();

    if (els.uploadDropzone) els.uploadDropzone.style.display = 'none';
    if (els.multiFilesContainer) els.multiFilesContainer.style.display = 'block';
    if (els.resultSuccessBox) els.resultSuccessBox.style.display = 'none';

    // Tool specific options
    if (state.currentTool === 'jpg2pdf') {
      setupJpg2PdfWorkspace();
    } else {
      if (els.toolOptionsPanel) els.toolOptionsPanel.style.display = 'none';
    }

    // Enable/disable execute button
    updateMultiToolExecuteButton();

    showToast(`${addedCount} archivo(s) agregado(s) a la lista.`, 'success');
  }

  function updateMultiToolExecuteButton() {
    if (!els.btnExecuteTool) return;
    if (state.currentTool === 'unir') {
      const canExecute = state.filesList.length >= 2;
      els.btnExecuteTool.disabled = !canExecute;
      els.btnExecuteTool.textContent = canExecute 
        ? `Unir ${state.filesList.length} archivos PDF`
        : 'Selecciona al menos 2 archivos PDF';
    } else if (state.currentTool === 'jpg2pdf') {
      const canExecute = state.filesList.length >= 1;
      els.btnExecuteTool.disabled = !canExecute;
      els.btnExecuteTool.textContent = canExecute
        ? `Convertir ${state.filesList.length} ${state.filesList.length === 1 ? 'imagen' : 'imágenes'} a PDF`
        : 'Selecciona al menos una imagen';
    }
  }

  function renderMultiFilesList() {
    if (!els.multiFilesList) return;
    els.multiFilesList.innerHTML = '';

    const isImageTool = state.currentTool === 'jpg2pdf';

    state.filesList.forEach((item, index) => {
      const row = document.createElement('div');
      row.className = 'multi-file-item';
      row.id = `item-${item.id}`;

      let thumbHtml = '';
      if (isImageTool && item.previewUrl) {
        thumbHtml = `<img src="${item.previewUrl}" alt="${item.name}" class="multi-file-thumb" />`;
      } else {
        thumbHtml = `
          <div class="file-icon-badge" style="width: 32px; height: 32px;">
            <i data-lucide="file-text" style="width: 16px; height: 16px;"></i>
          </div>
        `;
      }

      const metaStats = isImageTool
        ? PDFEngine.formatBytes(item.size)
        : `${PDFEngine.formatBytes(item.size)}${item.pageCount ? ` • ${item.pageCount} pág.` : ''}`;

      row.innerHTML = `
        <div class="multi-file-left">
          <div class="multi-file-order">${index + 1}</div>
          ${thumbHtml}
          <div class="file-meta-text">
            <div class="file-main-name" style="max-width: 320px;">${item.name}</div>
            <div class="file-sub-stats">${metaStats}</div>
          </div>
        </div>
        <div class="multi-file-controls">
          <button type="button" class="mini-icon-btn btn-move-up" title="Mover arriba" ${index === 0 ? 'disabled style="opacity: 0.35;"' : ''}>
            <i data-lucide="arrow-up"></i>
          </button>
          <button type="button" class="mini-icon-btn btn-move-down" title="Mover abajo" ${index === state.filesList.length - 1 ? 'disabled style="opacity: 0.35;"' : ''}>
            <i data-lucide="arrow-down"></i>
          </button>
          <button type="button" class="mini-icon-btn btn-remove-item" title="Eliminar de la lista" style="color: var(--accent-danger);">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // Button actions
      const btnUp = row.querySelector('.btn-move-up');
      if (btnUp && index > 0) {
        btnUp.addEventListener('click', () => moveMultiItem(index, index - 1));
      }

      const btnDown = row.querySelector('.btn-move-down');
      if (btnDown && index < state.filesList.length - 1) {
        btnDown.addEventListener('click', () => moveMultiItem(index, index + 1));
      }

      const btnRemove = row.querySelector('.btn-remove-item');
      if (btnRemove) {
        btnRemove.addEventListener('click', () => removeMultiItem(index));
      }

      els.multiFilesList.appendChild(row);
    });

    if (window.lucide) window.lucide.createIcons();
  }

  function moveMultiItem(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= state.filesList.length) return;
    const item = state.filesList.splice(fromIndex, 1)[0];
    state.filesList.splice(toIndex, 0, item);
    renderMultiFilesList();
    updateMultiToolExecuteButton();
  }

  function removeMultiItem(index) {
    const item = state.filesList[index];
    if (item && item.previewUrl) {
      try { URL.revokeObjectURL(item.previewUrl); } catch (e) { /* silent */ }
    }
    state.filesList.splice(index, 1);

    if (state.filesList.length === 0) {
      resetToolWorkspace();
    } else {
      renderMultiFilesList();
      updateMultiToolExecuteButton();
    }
  }

  // --- TOOL 2: DIVIDIR PDF WORKSPACE SETUP ---
  function setupDividirWorkspace() {
    const totalPages = state.primaryPdfInfo.pageCount;
    if (!els.toolOptionsPanel || !els.toolOptionsDynamicContent) return;

    els.toolOptionsPanel.style.display = 'block';
    els.toolOptionsDynamicContent.innerHTML = `
      <div class="options-grid">
        <div class="option-group" style="grid-column: 1 / -1;">
          <div class="split-info-header">
            <span class="badge-page-count">
              <i data-lucide="layers" style="width: 16px; height: 16px;"></i>
              Total de páginas en el documento: <strong>${totalPages}</strong>
            </span>
            <span class="badge-hint">Indica las páginas exactas que deseas incluir en tu nuevo PDF</span>
          </div>
        </div>

        <div class="option-group" id="splitRangeGroup" style="grid-column: 1 / -1;">
          <label class="option-label" for="splitRangeInput">Páginas individuales o rangos:</label>
          <input type="text" id="splitRangeInput" class="option-input" 
                 placeholder="Ejemplos: 1, 1-3, 1,3,5 o 2-4,7" 
                 value="1-${Math.min(3, totalPages)}">
          
          <div class="range-examples-bar">
            <span style="font-size: 0.8125rem; color: var(--text-muted); font-weight: 600;">Ejemplos rápidos:</span>
            <button type="button" class="btn-range-chip" data-range="1">1 (Página 1)</button>
            <button type="button" class="btn-range-chip" data-range="1-${Math.min(3, totalPages)}">1-${Math.min(3, totalPages)}</button>
            ${totalPages >= 5 ? `<button type="button" class="btn-range-chip" data-range="1,3,5">1,3,5</button>` : ''}
            ${totalPages >= 7 ? `<button type="button" class="btn-range-chip" data-range="2-4,7">2-4,7</button>` : ''}
            <button type="button" class="btn-range-chip" data-range="1-${totalPages}">Todas (1-${totalPages})</button>
          </div>

          <div class="split-feedback-box" id="splitFeedbackBox"></div>
        </div>

        <div class="option-group" style="grid-column: 1 / -1; margin-top: 0.5rem; padding-top: 0.75rem; border-top: 1px dashed var(--border-color);">
          <label class="option-label" for="splitModeSelect">Modo de extracción:</label>
          <select id="splitModeSelect" class="option-select">
            <option value="range" selected>Crear un nuevo PDF con las páginas seleccionadas</option>
            <option value="all-zip">Separar todas las páginas (${totalPages}) en archivos PDF individuales (.ZIP)</option>
          </select>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    const rangeInput = document.getElementById('splitRangeInput');
    const rangeGroup = document.getElementById('splitRangeGroup');
    const modeSelect = document.getElementById('splitModeSelect');
    const feedbackBox = document.getElementById('splitFeedbackBox');

    function updateFeedback() {
      if (!rangeInput || !feedbackBox) return;
      const val = rangeInput.value.trim();
      const parsedIndices = PDFEngine.parsePageRanges(val, totalPages);

      if (parsedIndices.length > 0) {
        const readableList = parsedIndices.map(idx => idx + 1).join(', ');
        feedbackBox.innerHTML = `
          <div class="feedback-success">
            <i data-lucide="check-circle" style="width: 16px; height: 16px; color: var(--accent-success);"></i>
            <span>Se generará un PDF con <strong>${parsedIndices.length}</strong> ${parsedIndices.length === 1 ? 'página' : 'páginas'}: <code>${readableList}</code></span>
          </div>
        `;
        if (els.btnExecuteTool) {
          els.btnExecuteTool.disabled = false;
          els.btnExecuteTool.textContent = `Crear PDF con ${parsedIndices.length} páginas`;
        }
      } else {
        feedbackBox.innerHTML = `
          <div class="feedback-error">
            <i data-lucide="alert-circle" style="width: 16px; height: 16px; color: var(--accent-danger);"></i>
            <span>Por favor escribe números de página válidos entre 1 y ${totalPages} (ejemplo: 1-3 o 1,3,5).</span>
          </div>
        `;
        if (els.btnExecuteTool) {
          els.btnExecuteTool.disabled = true;
          els.btnExecuteTool.textContent = 'Indica páginas válidas para continuar';
        }
      }
      if (window.lucide) window.lucide.createIcons();
    }

    if (rangeInput) {
      rangeInput.addEventListener('input', updateFeedback);
    }

    // Quick range chips
    const chips = els.toolOptionsDynamicContent.querySelectorAll('.btn-range-chip');
    chips.forEach(chip => {
      chip.addEventListener('click', () => {
        const range = chip.getAttribute('data-range');
        if (range && rangeInput) {
          rangeInput.value = range;
          updateFeedback();
        }
      });
    });

    // Mode select
    if (modeSelect) {
      modeSelect.addEventListener('change', () => {
        if (modeSelect.value === 'all-zip') {
          if (rangeGroup) rangeGroup.style.display = 'none';
          if (els.btnExecuteTool) {
            els.btnExecuteTool.disabled = false;
            els.btnExecuteTool.textContent = `Separar las ${totalPages} páginas en ZIP`;
          }
        } else {
          if (rangeGroup) rangeGroup.style.display = 'flex';
          updateFeedback();
        }
      });
    }

    // Initial feedback run
    updateFeedback();
  }

  // --- TOOL 3: JPG A PDF WORKSPACE SETUP ---
  function setupJpg2PdfWorkspace() {
    if (!els.toolOptionsPanel || !els.toolOptionsDynamicContent) return;

    els.toolOptionsPanel.style.display = 'block';
    els.toolOptionsDynamicContent.innerHTML = `
      <div class="options-grid">
        <div class="option-group">
          <label class="option-label" for="jpgFitSelect">Formato y Orientación:</label>
          <select id="jpgFitSelect" class="option-select">
            <option value="a4-portrait" selected>A4 - Vertical (Estándar de documento)</option>
            <option value="a4-landscape">A4 - Horizontal (Apaisado)</option>
            <option value="original">Ajuste al tamaño original de cada imagen</option>
          </select>
        </div>

        <div class="option-group">
          <label class="option-label" for="jpgMarginSelect">Márgenes de página:</label>
          <select id="jpgMarginSelect" class="option-select">
            <option value="small" selected>Margen pequeño (15 pt)</option>
            <option value="normal">Margen normal (36 pt)</option>
            <option value="none">Sin margen (Al borde de la hoja)</option>
          </select>
        </div>
      </div>
    `;
  }

  // --- TOOL 4: COMPRIMIR PDF WORKSPACE SETUP ---
  function setupComprimirWorkspace() {
    if (!els.toolOptionsPanel || !els.toolOptionsDynamicContent) return;
    const origSizeText = PDFEngine.formatBytes(state.primaryFile.size);

    els.toolOptionsPanel.style.display = 'block';
    els.toolOptionsDynamicContent.innerHTML = `
      <div class="options-grid">
        <div class="option-group" style="grid-column: 1 / -1;">
          <div class="split-info-header">
            <span class="badge-page-count">
              <i data-lucide="file" style="width: 16px; height: 16px;"></i>
              Tamaño actual del archivo: <strong>${origSizeText}</strong>
            </span>
            <span class="badge-hint">Compresión visual equilibrada y no agresiva</span>
          </div>
        </div>

        <div class="option-group" style="grid-column: 1 / -1;">
          <label class="option-label">Selecciona el nivel de compresión:</label>
          
          <div class="compression-levels-grid">
            <label class="compression-level-card active">
              <input type="radio" name="compressionLevel" value="recommended" checked />
              <div class="level-card-body">
                <div class="level-card-title">
                  <strong>Compresión recomendada (Equilibrada)</strong>
                  <span class="badge-recommended">Recomendado</span>
                </div>
                <p class="level-card-desc">
                  Reduce moderadamente el tamaño del archivo conservando la máxima nitidez en textos y fotografías. Ideal para trámites, currículums y envíos por correo electrónico.
                </p>
              </div>
            </label>

            <label class="compression-level-card">
              <input type="radio" name="compressionLevel" value="light" />
              <div class="level-card-body">
                <div class="level-card-title">
                  <strong>Compresión ligera (Máxima fidelidad)</strong>
                </div>
                <p class="level-card-desc">
                  Optimización sutil que preserva intacto cada mínimo detalle visual. Diseñado para documentos con planos, tablas complejas o gráficos de alta precisión.
                </p>
              </div>
            </label>

            <label class="compression-level-card">
              <input type="radio" name="compressionLevel" value="high" />
              <div class="level-card-body">
                <div class="level-card-title">
                  <strong>Compresión alta</strong>
                </div>
                <p class="level-card-desc">
                  Mayor reducción de tamaño para archivos excepcionalmente pesados donde se requiere cumplir con un límite estricto de megabytes.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div class="option-group" style="grid-column: 1 / -1; margin-top: 0.25rem;">
          <div class="quality-assurance-note">
            <i data-lucide="info" style="width: 18px; height: 18px; flex-shrink: 0; color: var(--brand-primary);"></i>
            <span>
              <strong>Garantía de calidad:</strong> Si tu PDF ya está optimizado internamente, el motor protegerá su estructura para que el documento resultante no aumente de tamaño ni degrade su contenido.
            </span>
          </div>
        </div>
      </div>
    `;

    if (window.lucide) window.lucide.createIcons();

    // Visual radio selection
    const levelCards = els.toolOptionsDynamicContent.querySelectorAll('.compression-level-card');
    levelCards.forEach(card => {
      const radio = card.querySelector('input[type="radio"]');
      card.addEventListener('click', () => {
        levelCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        if (radio) radio.checked = true;
      });
    });
  }

  // --- TOOL EXECUTION DISPATCHER ---
  async function executeCurrentTool() {
    if (!state.currentTool) return;

    if (els.btnExecuteTool) els.btnExecuteTool.disabled = true;
    if (els.resultSuccessBox) els.resultSuccessBox.style.display = 'none';

    try {
      switch (state.currentTool) {
        case 'unir':
          await runUnirTool();
          break;
        case 'dividir':
          await runDividirTool();
          break;
        case 'jpg2pdf':
          await runJpg2PdfTool();
          break;
        case 'comprimir':
          await runComprimirTool();
          break;
        default:
          throw new Error('Herramienta no reconocida.');
      }
    } catch (err) {
      console.error('Error durante el procesamiento:', err);
      hideStatus();
      if (els.btnExecuteTool) els.btnExecuteTool.disabled = false;
      showToast(err.message || 'Ocurrió un error inesperado al procesar tu documento.', 'error');
    }
  }

  // --- TOOL 1: UNIR PDF RUNNER ---
  async function runUnirTool() {
    if (state.filesList.length < 2) {
      throw new Error('Selecciona al menos 2 documentos PDF para poder unirlos.');
    }

    showStatus('Iniciando unión de documentos...', 10);

    const buffers = [];
    for (let i = 0; i < state.filesList.length; i++) {
      const item = state.filesList[i];
      if (item.buffer) {
        buffers.push(item.buffer);
      } else {
        const b = await item.file.arrayBuffer();
        item.buffer = b;
        buffers.push(b);
      }
    }

    const mergedBytes = await PDFEngine.mergePDFs(buffers, (pct, msg) => {
      showStatus(msg, pct);
    });

    const resultBlob = new Blob([mergedBytes], { type: 'application/pdf' });
    const filename = 'documentos_unidos.pdf';

    displayResultSuccess({
      blob: resultBlob,
      filename: filename,
      title: '¡PDFs unidos con éxito!',
      desc: `Se combinaron ${state.filesList.length} documentos en un solo archivo PDF correlativo y listo para descargar.`,
      statsHtml: `
        <div class="result-stats-pill">
          <span>Total de archivos unidos: <strong>${state.filesList.length}</strong></span>
          <span>•</span>
          <span>Tamaño final: <strong>${PDFEngine.formatBytes(resultBlob.size)}</strong></span>
        </div>
      `
    });
  }

  // --- TOOL 2: DIVIDIR PDF RUNNER ---
  async function runDividirTool() {
    if (!state.primaryFileBuffer || !state.primaryPdfInfo) {
      throw new Error('Carga un archivo PDF válido primero.');
    }

    const modeSelect = document.getElementById('splitModeSelect');
    const mode = modeSelect ? modeSelect.value : 'range';
    const baseName = state.primaryFile.name.replace(/\.pdf$/i, '');

    if (mode === 'all-zip') {
      showStatus('Separando páginas individuales...', 10);
      const zipBlob = await PDFEngine.splitAllPagesToZip(
        state.primaryFileBuffer,
        baseName,
        (pct, msg) => showStatus(msg, pct)
      );

      const filename = `${baseName}_paginas_separadas.zip`;

      displayResultSuccess({
        blob: zipBlob,
        filename: filename,
        title: '¡Páginas separadas con éxito!',
        desc: `Se generó un archivo ZIP con las ${state.primaryPdfInfo.pageCount} páginas del documento en archivos PDF individuales.`,
        statsHtml: `
          <div class="result-stats-pill">
            <span>Páginas extraídas: <strong>${state.primaryPdfInfo.pageCount}</strong></span>
            <span>•</span>
            <span>Tamaño ZIP: <strong>${PDFEngine.formatBytes(zipBlob.size)}</strong></span>
          </div>
        `
      });
    } else {
      // Range mode
      const rangeInput = document.getElementById('splitRangeInput');
      const rangeStr = rangeInput ? rangeInput.value.trim() : '';

      if (!rangeStr) {
        throw new Error('Indica las páginas o rangos que deseas extraer (ejemplo: 1-3, 5).');
      }

      showStatus('Extrayendo páginas seleccionadas...', 15);
      const splitResult = await PDFEngine.splitPDF(
        state.primaryFileBuffer,
        rangeStr,
        (pct, msg) => showStatus(msg, pct)
      );

      const resultBlob = new Blob([splitResult.bytes], { type: 'application/pdf' });
      const filename = `${baseName}_dividido.pdf`;

      displayResultSuccess({
        blob: resultBlob,
        filename: filename,
        title: '¡División de PDF completada!',
        desc: `Se extrajeron correctamente ${splitResult.pagesExtracted} ${splitResult.pagesExtracted === 1 ? 'página' : 'páginas'} en tu nuevo documento PDF.`,
        statsHtml: `
          <div class="result-stats-pill">
            <span>Páginas en el nuevo documento: <strong>${splitResult.pagesExtracted}</strong> de ${state.primaryPdfInfo.pageCount}</span>
            <span>•</span>
            <span>Tamaño final: <strong>${PDFEngine.formatBytes(resultBlob.size)}</strong></span>
          </div>
        `
      });
    }
  }

  // --- TOOL 3: JPG A PDF RUNNER ---
  async function runJpg2PdfTool() {
    if (state.filesList.length === 0) {
      throw new Error('Selecciona al menos una imagen para convertir a PDF.');
    }

    showStatus('Cargando imágenes para conversión...', 10);

    const fitSelect = document.getElementById('jpgFitSelect');
    const marginSelect = document.getElementById('jpgMarginSelect');

    const options = {
      fit: fitSelect ? fitSelect.value : 'a4-portrait',
      margin: marginSelect ? marginSelect.value : 'small'
    };

    const imageFiles = state.filesList.map(item => item.file);

    const pdfBytes = await PDFEngine.imagesToPDF(imageFiles, options, (pct, msg) => {
      showStatus(msg, pct);
    });

    const resultBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = 'imagenes_convertidas.pdf';

    displayResultSuccess({
      blob: resultBlob,
      filename: filename,
      title: '¡Imágenes convertidas a PDF con éxito!',
      desc: `Se crearon ${state.filesList.length} ${state.filesList.length === 1 ? 'página' : 'páginas'} en un nuevo documento PDF con alta calidad de imagen.`,
      statsHtml: `
        <div class="result-stats-pill">
          <span>Imágenes convertidas: <strong>${state.filesList.length}</strong></span>
          <span>•</span>
          <span>Tamaño final del PDF: <strong>${PDFEngine.formatBytes(resultBlob.size)}</strong></span>
        </div>
      `
    });
  }

  // --- TOOL 4: COMPRIMIR PDF RUNNER ---
  async function runComprimirTool() {
    if (!state.primaryFileBuffer) {
      throw new Error('Carga un archivo PDF para comprimir.');
    }

    showStatus('Iniciando compresión de alta calidad...', 8);

    const selectedRadio = document.querySelector('input[name="compressionLevel"]:checked');
    const level = selectedRadio ? selectedRadio.value : 'recommended';

    const result = await PDFEngine.compressPDF(
      state.primaryFileBuffer,
      level,
      (pct, msg) => showStatus(msg, pct)
    );

    const resultBlob = new Blob([result.bytes], { type: 'application/pdf' });
    const baseName = state.primaryFile.name.replace(/\.pdf$/i, '');
    const filename = `${baseName}_comprimido.pdf`;

    const diff = result.originalSize - result.compressedSize;
    const savingsPct = result.originalSize > 0 ? Math.round((diff / result.originalSize) * 100) : 0;

    let statsCardHtml = '';
    if (diff > 0) {
      statsCardHtml = `
        <div class="compression-comparison-card">
          <div class="comp-stat-item">
            <span class="comp-stat-label">Tamaño original:</span>
            <span class="comp-stat-value orig">${PDFEngine.formatBytes(result.originalSize)}</span>
          </div>
          <div class="comp-stat-arrow">
            <i data-lucide="arrow-right"></i>
          </div>
          <div class="comp-stat-item">
            <span class="comp-stat-label">Tamaño optimizado:</span>
            <span class="comp-stat-value final">${PDFEngine.formatBytes(result.compressedSize)}</span>
          </div>
          <div class="comp-stat-item highlight">
            <span class="comp-stat-label">Reducción lograda:</span>
            <span class="comp-stat-value savings">-${savingsPct}% (${PDFEngine.formatBytes(diff)})</span>
          </div>
        </div>
      `;
    } else {
      statsCardHtml = `
        <div class="compression-comparison-card">
          <div class="comp-stat-item">
            <span class="comp-stat-label">Tamaño original:</span>
            <span class="comp-stat-value">${PDFEngine.formatBytes(result.originalSize)}</span>
          </div>
          <div class="comp-stat-item">
            <span class="comp-stat-label">Tamaño final:</span>
            <span class="comp-stat-value">${PDFEngine.formatBytes(result.compressedSize)}</span>
          </div>
          <div class="comp-stat-item" style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 0.8125rem;">
            Tu documento ya contaba con una compresión óptima. Se mantuvo su tamaño y nitidez original sin alterar la calidad visual.
          </div>
        </div>
      `;
    }

    displayResultSuccess({
      blob: resultBlob,
      filename: filename,
      title: '¡Compresión completada con éxito!',
      desc: 'El archivo ha sido optimizado protegiendo la nitidez del texto y la calidad visual de las imágenes.',
      statsHtml: statsCardHtml
    });
  }

  // --- RESULT DISPLAY & DOWNLOAD ---
  function displayResultSuccess({ blob, filename, title, desc, statsHtml }) {
    hideStatus();

    state.currentResultBlob = blob;
    state.lastResultFilename = filename;

    if (els.resultTitle) els.resultTitle.textContent = title;
    if (els.resultDesc) els.resultDesc.textContent = desc;
    if (els.resultCustomStats) els.resultCustomStats.innerHTML = statsHtml || '';

    if (els.btnDownloadMain) {
      els.btnDownloadMain.innerHTML = `
        <i data-lucide="download"></i>
        <span>Descargar ${filename}</span>
      `;
    }

    if (els.resultSuccessBox) {
      els.resultSuccessBox.style.display = 'block';
      els.resultSuccessBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    if (els.btnExecuteTool) els.btnExecuteTool.disabled = false;

    if (window.lucide) window.lucide.createIcons();
    showToast('Proceso finalizado. Tu archivo está listo para descargar.', 'success');
  }

  // --- STATUS & PROGRESS UI ---
  function showStatus(message, percentage = 0) {
    if (els.processingStatusArea) els.processingStatusArea.style.display = 'block';
    if (els.statusMessage) els.statusMessage.textContent = message;
    if (els.progressBarFill) els.progressBarFill.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  }

  function hideStatus() {
    if (els.processingStatusArea) els.processingStatusArea.style.display = 'none';
  }

  // --- CONTACT FORM HANDLER ---
  function setupContactForm() {
    if (!els.contactForm) return;

    els.contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('contactName')?.value;
      const email = document.getElementById('contactEmail')?.value;
      const message = document.getElementById('contactMessage')?.value;

      if (!name || !email || !message) {
        showToast('Por favor completa todos los campos requeridos.', 'error');
        return;
      }

      // Show immediate confirmation
      if (els.contactSuccessAlert) {
        els.contactSuccessAlert.style.display = 'flex';
      }
      els.contactForm.reset();
      showToast('¡Mensaje enviado con éxito! Te responderemos a la brevedad.', 'success');
      if (window.lucide) window.lucide.createIcons();
    });
  }

  // --- TOAST NOTIFICATIONS ---
  function showToast(message, type = 'info') {
    if (!els.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast-item toast-${type}`;

    let iconName = 'info';
    if (type === 'success') iconName = 'check-circle';
    if (type === 'error') iconName = 'alert-triangle';

    toast.innerHTML = `
      <i data-lucide="${iconName}" style="width: 18px; height: 18px; flex-shrink: 0;"></i>
      <span>${message}</span>
    `;

    els.toastContainer.appendChild(toast);
    if (window.lucide) window.lucide.createIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 300);
    }, 4500);
  }

  // Kickstart app when DOM is loaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
