/**
 * ============================================================================
 * HERRAMIENTAS PDF - APPLICATION CONTROLLER
 * Gestión de interfaz, herramientas activas, drag & drop, renderizado visual.
 * ============================================================================
 */

(function () {
  'use strict';

  // --- STATE ---
  const state = {
    currentTool: null,
    theme: localStorage.getItem('pdf_tools_theme') || 'light',
    
    // Single file operations
    primaryFile: null,
    primaryBuffer: null,
    primaryPdfInfo: null,
    
    // Multi-file operations (Unir PDF, JPG a PDF)
    filesList: [], // array of { file, buffer, info }
    
    // Secondary file for "Añadir páginas"
    secondaryFile: null,
    secondaryBuffer: null,
    secondaryPdfInfo: null,
    
    // Visual Pages metadata for rotate, delete, extract, order
    pagesData: [], // array of { pageNum: 1, originalIndex: 0, rotation: 0, selected: false, canvas: null }
    
    // Processing / Output
    isProcessing: false,
    lastResultBlob: null,
    lastResultFilename: '',
  };

  // --- TOOLS DEFINITION ---
  const TOOLS = {
    unir: {
      id: 'unir',
      name: 'Unir PDF',
      badge: 'Popular',
      iconClass: 'tool-icon-blue',
      iconEmoji: '📎',
      lucideIcon: 'files',
      desc: 'Combina múltiples documentos PDF en un solo archivo en el orden que tú decidas.',
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
      iconEmoji: '✂️',
      lucideIcon: 'split',
      desc: 'Extrae rangos de páginas o divide cada página en un documento individual.',
      category: 'organizar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Dividir PDF'
    },
    comprimir: {
      id: 'comprimir',
      name: 'Comprimir PDF',
      badge: 'Optimización',
      iconClass: 'tool-icon-green',
      iconEmoji: '🗜️',
      lucideIcon: 'minimize-2',
      desc: 'Reduce el peso de tus archivos PDF manteniendo la mejor calidad visual en tu navegador.',
      category: 'optimizar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Comprimir PDF'
    },
    girar: {
      id: 'girar',
      name: 'Girar PDF',
      badge: 'Páginas',
      iconClass: 'tool-icon-amber',
      iconEmoji: '🔄',
      lucideIcon: 'rotate-cw',
      desc: 'Rota todas las páginas o páginas individuales en incrementos de 90° con vista previa.',
      category: 'editar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Guardar y rotar PDF'
    },
    jpg2pdf: {
      id: 'jpg2pdf',
      name: 'JPG a PDF',
      badge: 'Convertidor',
      iconClass: 'tool-icon-purple',
      iconEmoji: '🖼️',
      lucideIcon: 'image',
      desc: 'Convierte imágenes JPG, PNG o WebP en documentos PDF de alta calidad con márgenes personalizados.',
      category: 'optimizar',
      accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
      multiple: true,
      actionBtnText: 'Convertir imágenes a PDF'
    },
    pdf2jpg: {
      id: 'pdf2jpg',
      name: 'PDF a JPG',
      badge: 'Convertidor',
      iconClass: 'tool-icon-cyan',
      iconEmoji: '📄',
      lucideIcon: 'file-image',
      desc: 'Convierte cada página de tu documento PDF en imágenes JPG de alta resolución o descárgalas en ZIP.',
      category: 'optimizar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Convertir PDF a JPG'
    },
    eliminar: {
      id: 'eliminar',
      name: 'Eliminar páginas',
      badge: 'Páginas',
      iconClass: 'tool-icon-rose',
      iconEmoji: '🗑️',
      lucideIcon: 'file-minus',
      desc: 'Selecciona visualmente las páginas innecesarias de tu PDF y elimínalas al instante.',
      category: 'editar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Eliminar páginas seleccionadas'
    },
    extraer: {
      id: 'extraer',
      name: 'Extraer páginas',
      badge: 'Páginas',
      iconClass: 'tool-icon-indigo',
      iconEmoji: '📑',
      lucideIcon: 'file-plus',
      desc: 'Elige visualmente solo las páginas que necesitas para crear un documento nuevo y limpio.',
      category: 'editar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Extraer páginas'
    },
    ordenar: {
      id: 'ordenar',
      name: 'Ordenar páginas',
      badge: 'Organizar',
      iconClass: 'tool-icon-teal',
      iconEmoji: '🔢',
      lucideIcon: 'arrow-down-up',
      desc: 'Reordena, mueve y organiza las páginas de tu archivo PDF en la posición exacta que desees.',
      category: 'organizar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Guardar nuevo orden'
    },
    anadir: {
      id: 'anadir',
      name: 'Añadir páginas a PDF',
      badge: 'Organizar',
      iconClass: 'tool-icon-orange',
      iconEmoji: '➕',
      lucideIcon: 'layers',
      desc: 'Inserta páginas adicionales de otro PDF o imágenes al inicio, al final o entre páginas.',
      category: 'organizar',
      accept: '.pdf,application/pdf',
      multiple: false,
      actionBtnText: 'Insertar páginas y descargar'
    }
  };

  // --- DOM ELEMENTS ---
  const els = {
    themeToggleBtn: document.getElementById('themeToggleBtn'),
    heroSection: document.getElementById('heroSection'),
    toolsSection: document.getElementById('herramientas') || document.getElementById('toolsSection'),
    workspaceSection: document.getElementById('workspaceSection'),
    backToToolsBtn: document.getElementById('backToToolsBtn'),
    toolsGrid: document.getElementById('toolsGrid'),
    filterBtns: document.querySelectorAll('.filter-btn'),

    // Workspace elements
    activeToolIcon: document.getElementById('activeToolIcon'),
    activeToolName: document.getElementById('activeToolName'),
    activeToolDesc: document.getElementById('activeToolDesc'),
    uploadDropzone: document.getElementById('uploadDropzone'),
    fileInput: document.getElementById('fileInput'),
    dropzoneText: document.getElementById('dropzoneText'),
    
    // File details bar
    fileDetailsBar: document.getElementById('fileDetailsBar'),
    fileMainName: document.getElementById('fileMainName'),
    fileSubStats: document.getElementById('fileSubStats'),
    btnChangeFile: document.getElementById('btnChangeFile'),
    btnClearFile: document.getElementById('btnClearFile'),

    // Multi-files list
    multiFilesContainer: document.getElementById('multiFilesContainer'),
    multiFilesList: document.getElementById('multiFilesList'),
    btnAddMoreFiles: document.getElementById('btnAddMoreFiles'),
    moreFileInput: document.getElementById('moreFileInput'),

    // Options & Controls
    toolOptionsPanel: document.getElementById('toolOptionsPanel'),
    toolOptionsDynamicContent: document.getElementById('toolOptionsDynamicContent'),

    // Page Thumbnails Grid
    pageThumbnailsWrapper: document.getElementById('pageThumbnailsWrapper'),
    thumbnailsStats: document.getElementById('thumbnailsStats'),
    thumbnailsActions: document.getElementById('thumbnailsActions'),
    pageGrid: document.getElementById('pageGrid'),

    // Progress
    processingStatusArea: document.getElementById('processingStatusArea'),
    progressBarFill: document.getElementById('progressBarFill'),
    statusMessage: document.getElementById('statusMessage'),

    // Result
    resultSuccessBox: document.getElementById('resultSuccessBox'),
    resultTitle: document.getElementById('resultTitle'),
    resultDesc: document.getElementById('resultDesc'),
    btnDownloadMain: document.getElementById('btnDownloadMain'),
    btnProcessAnother: document.getElementById('btnProcessAnother'),

    // Main action
    btnExecuteTool: document.getElementById('btnExecuteTool'),

    // Modals
    modalAbout: document.getElementById('modalAbout'),
    modalPrivacy: document.getElementById('modalPrivacy'),
    toastContainer: document.getElementById('toastContainer'),
  };

  // --- INITIALIZATION ---
  function init() {
    initTheme();
    renderToolsGrid();
    setupEventListeners();
    refreshLucideIcons();

    // Check URL query param or hash (e.g. #unir or ?tool=comprimir)
    const hash = window.location.hash.replace('#', '');
    if (TOOLS[hash]) {
      openTool(hash);
    }
  }

  // --- THEME ---
  function initTheme() {
    document.documentElement.setAttribute('data-theme', state.theme);
    updateThemeIcon();
    if (els.themeToggleBtn) {
      els.themeToggleBtn.addEventListener('click', toggleTheme);
    }
  }

  function toggleTheme() {
    state.theme = state.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', state.theme);
    localStorage.setItem('pdf_tools_theme', state.theme);
    updateThemeIcon();
    showToast(`Modo ${state.theme === 'dark' ? 'oscuro' : 'claro'} activado`, 'info');
  }

  function updateThemeIcon() {
    if (!els.themeToggleBtn) return;
    if (state.theme === 'dark') {
      els.themeToggleBtn.innerHTML = '<i data-lucide="sun"></i>';
      els.themeToggleBtn.title = 'Cambiar a modo claro';
    } else {
      els.themeToggleBtn.innerHTML = '<i data-lucide="moon"></i>';
      els.themeToggleBtn.title = 'Cambiar a modo oscuro';
    }
    refreshLucideIcons();
  }

  function refreshLucideIcons() {
    if (window.lucide) {
      lucide.createIcons();
    }
  }

  // --- RENDER TOOLS GRID ---
  function renderToolsGrid(category = 'all') {
    if (!els.toolsGrid) return;
    els.toolsGrid.innerHTML = '';

    Object.values(TOOLS).forEach(tool => {
      if (category !== 'all' && tool.category !== category) return;

      const card = document.createElement('div');
      card.className = 'tool-card';
      card.id = `tool-card-${tool.id}`;
      card.innerHTML = `
        <div class="tool-card-icon-wrapper ${tool.iconClass}">
          <i data-lucide="${tool.lucideIcon}"></i>
        </div>
        <div class="tool-card-title">
          <span>${tool.name}</span>
          <span class="tool-card-badge">${tool.badge}</span>
        </div>
        <p class="tool-card-desc">${tool.desc}</p>
        <div class="tool-card-footer">
          <span class="tool-card-badge">Gratis</span>
          <span class="tool-card-action">Usar herramienta →</span>
        </div>
      `;

      card.addEventListener('click', () => openTool(tool.id));
      els.toolsGrid.appendChild(card);
    });

    refreshLucideIcons();
  }

  // --- OPEN / CLOSE TOOL WORKSPACE ---
  function openTool(toolId) {
    const tool = TOOLS[toolId];
    if (!tool) return;

    state.currentTool = toolId;
    resetToolWorkspace();

    // Update Header Info
    els.activeToolName.textContent = tool.name;
    els.activeToolDesc.textContent = tool.desc;
    els.activeToolIcon.className = `active-tool-icon ${tool.iconClass}`;
    els.activeToolIcon.innerHTML = `<i data-lucide="${tool.lucideIcon}"></i>`;
    els.btnExecuteTool.textContent = tool.actionBtnText;
    els.btnExecuteTool.disabled = true;

    // File input configuration
    els.fileInput.accept = tool.accept;
    els.fileInput.multiple = tool.multiple;

    if (tool.id === 'jpg2pdf') {
      els.dropzoneText.textContent = 'o selecciona imágenes JPG, PNG o WebP desde tu dispositivo';
    } else {
      els.dropzoneText.textContent = tool.multiple
        ? 'o selecciona dos o más archivos PDF para unirlos'
        : 'o selecciona un archivo PDF desde tu dispositivo';
    }

    // Hide hero & tools list, show workspace safely
    if (els.heroSection) els.heroSection.style.display = 'none';
    if (els.toolsSection) els.toolsSection.style.display = 'none';
    if (els.workspaceSection) els.workspaceSection.style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
    history.pushState(null, '', `#${toolId}`);
    refreshLucideIcons();
  }

  function closeTool() {
    state.currentTool = null;
    resetToolWorkspace();

    if (els.heroSection) els.heroSection.style.display = 'block';
    if (els.toolsSection) els.toolsSection.style.display = 'block';
    if (els.workspaceSection) els.workspaceSection.style.display = 'none';

    history.pushState(null, '', window.location.pathname);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    refreshLucideIcons();
  }

  function resetToolWorkspace() {
    state.primaryFile = null;
    state.primaryBuffer = null;
    state.primaryPdfInfo = null;
    state.filesList = [];
    state.secondaryFile = null;
    state.secondaryBuffer = null;
    state.secondaryPdfInfo = null;
    state.pagesData = [];
    state.lastResultBlob = null;
    state.isProcessing = false;

    // Reset UI blocks
    if (els.uploadDropzone) els.uploadDropzone.style.display = 'block';
    if (els.fileDetailsBar) els.fileDetailsBar.style.display = 'none';
    if (els.multiFilesContainer) els.multiFilesContainer.style.display = 'none';
    if (els.multiFilesList) els.multiFilesList.innerHTML = '';
    if (els.toolOptionsPanel) els.toolOptionsPanel.style.display = 'none';
    if (els.toolOptionsDynamicContent) els.toolOptionsDynamicContent.innerHTML = '';
    if (els.pageThumbnailsWrapper) els.pageThumbnailsWrapper.style.display = 'none';
    if (els.pageGrid) els.pageGrid.innerHTML = '';
    if (els.processingStatusArea) els.processingStatusArea.style.display = 'none';
    if (els.resultSuccessBox) els.resultSuccessBox.style.display = 'none';
    if (els.btnExecuteTool) {
      els.btnExecuteTool.style.display = 'inline-flex';
      els.btnExecuteTool.disabled = true;
      if (state.currentTool && TOOLS[state.currentTool]) {
        els.btnExecuteTool.textContent = TOOLS[state.currentTool].actionBtnText;
      }
    }
    if (els.fileInput) els.fileInput.value = '';
    if (els.moreFileInput) els.moreFileInput.value = '';
  }

  // --- FILE HANDLING & DRAG AND DROP ---
  function setupEventListeners() {
    // Navigation back button
    if (els.backToToolsBtn) {
      els.backToToolsBtn.addEventListener('click', closeTool);
    }

    // Header navigation shortcuts
    const navHerramientas = document.getElementById('navLinkHerramientas');
    if (navHerramientas) {
      navHerramientas.addEventListener('click', (e) => {
        e.preventDefault();
        closeTool();
        const target = document.getElementById('herramientas');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    }

    const navVentajas = document.getElementById('navLinkVentajas');
    if (navVentajas) {
      navVentajas.addEventListener('click', (e) => {
        e.preventDefault();
        closeTool();
        const target = document.getElementById('ventajas');
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    }

    // Filter buttons
    els.filterBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        els.filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderToolsGrid(btn.dataset.category);
      });
    });

    // Dropzone events
    const dropzone = els.uploadDropzone;
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzone.classList.remove('dragover');
      });
    });

    dropzone.addEventListener('drop', (e) => {
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFilesSelected(files);
      }
    });

    dropzone.addEventListener('click', () => {
      els.fileInput.value = '';
      els.fileInput.click();
    });

    els.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesSelected(e.target.files);
      }
    });

    // Change / Clear file buttons
    els.btnChangeFile.addEventListener('click', () => {
      els.fileInput.value = '';
      els.fileInput.click();
    });

    els.btnClearFile.addEventListener('click', () => {
      resetToolWorkspace();
      showToast('Archivos retirados', 'info');
    });

    // Add more files button (for Merge PDF / JPG to PDF)
    if (els.btnAddMoreFiles && els.moreFileInput) {
      els.btnAddMoreFiles.addEventListener('click', () => {
        els.moreFileInput.value = '';
        els.moreFileInput.click();
      });
      els.moreFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          appendMoreFiles(e.target.files);
        }
      });
    }

    // Main action button execute
    els.btnExecuteTool.addEventListener('click', executeCurrentTool);

    // Process another
    els.btnProcessAnother.addEventListener('click', () => {
      resetToolWorkspace();
    });

    // Modals
    setupModals();

    // Handle browser back button
    window.addEventListener('popstate', () => {
      const hash = window.location.hash.replace('#', '');
      if (TOOLS[hash]) {
        openTool(hash);
      } else {
        closeTool();
      }
    });
  }

  // --- FILE PROCESSOR ROUTER ---
  async function handleFilesSelected(fileList) {
    const tool = TOOLS[state.currentTool];
    if (!tool) return;

    if (tool.multiple) {
      // Multiple files tool (Unir PDF or JPG a PDF)
      await handleMultiFiles(fileList);
    } else {
      // Single file tool
      const file = fileList[0];
      await handleSingleFile(file);
    }
  }

  async function handleSingleFile(file) {
    try {
      showLoadingProgress(true, 10, 'Leyendo archivo...');

      state.primaryFile = file;
      state.primaryBuffer = await file.arrayBuffer();

      // Validate PDF if required
      if (state.currentTool !== 'jpg2pdf') {
        const info = await PDFEngine.getPdfInfo(state.primaryBuffer);
        state.primaryPdfInfo = info;
        
        // Show Details Bar
        els.fileMainName.textContent = file.name;
        els.fileSubStats.textContent = `${PDFEngine.formatBytes(file.size)} • ${info.pageCount} ${info.pageCount === 1 ? 'página' : 'páginas'}`;
      } else {
        els.fileMainName.textContent = file.name;
        els.fileSubStats.textContent = `${PDFEngine.formatBytes(file.size)}`;
      }

      els.uploadDropzone.style.display = 'none';
      els.fileDetailsBar.style.display = 'flex';

      // Set initial state of execute button depending on tool requirements
      if (state.currentTool === 'eliminar' || state.currentTool === 'extraer' || state.currentTool === 'anadir') {
        els.btnExecuteTool.disabled = true;
      } else {
        els.btnExecuteTool.disabled = false;
      }

      // Render tool specific options and preview
      await setupToolSpecificWorkspace();
      showLoadingProgress(false);

    } catch (err) {
      console.error(err);
      showLoadingProgress(false);
      showToast('Error al leer el archivo PDF. Asegúrate de que sea un PDF válido.', 'error');
      resetToolWorkspace();
    }
  }

  async function handleMultiFiles(fileList) {
    showLoadingProgress(true, 15, 'Procesando lista de archivos...');
    const filesArray = Array.from(fileList);

    for (let f of filesArray) {
      const buffer = await f.arrayBuffer();
      let info = null;
      if (state.currentTool === 'unir') {
        try {
          info = await PDFEngine.getPdfInfo(buffer);
        } catch (e) {
          console.warn('PDF inválido ignorado:', f.name);
          continue;
        }
      }
      state.filesList.push({ file: f, buffer, info });
    }

    if (state.filesList.length === 0) {
      showLoadingProgress(false);
      showToast('No se encontraron archivos válidos.', 'error');
      return;
    }

    els.uploadDropzone.style.display = 'none';
    els.multiFilesContainer.style.display = 'block';
    els.fileDetailsBar.style.display = 'none';

    renderMultiFilesList();
    setupToolSpecificWorkspace();

    els.btnExecuteTool.disabled = state.currentTool === 'unir' ? (state.filesList.length < 2) : false;
    showLoadingProgress(false);
    showToast(`${state.filesList.length} archivo(s) cargado(s)`, 'success');
  }

  async function appendMoreFiles(fileList) {
    await handleMultiFiles(fileList);
  }

  function renderMultiFilesList() {
    els.multiFilesList.innerHTML = '';

    state.filesList.forEach((item, index) => {
      const el = document.createElement('div');
      el.className = 'multi-file-item';
      const stats = item.info ? `${PDFEngine.formatBytes(item.file.size)} • ${item.info.pageCount} págs.` : PDFEngine.formatBytes(item.file.size);

      el.innerHTML = `
        <div class="multi-file-left">
          <span class="multi-file-order">${index + 1}</span>
          <div class="file-icon-badge">
            <i data-lucide="${state.currentTool === 'jpg2pdf' ? 'image' : 'file-text'}"></i>
          </div>
          <div class="file-meta-text">
            <div class="file-main-name">${item.file.name}</div>
            <div class="file-sub-stats">${stats}</div>
          </div>
        </div>
        <div class="multi-file-controls">
          <button class="mini-icon-btn btn-move-up" title="Mover arriba" ${index === 0 ? 'disabled style="opacity:0.3"' : ''}>
            <i data-lucide="arrow-up"></i>
          </button>
          <button class="mini-icon-btn btn-move-down" title="Mover abajo" ${index === state.filesList.length - 1 ? 'disabled style="opacity:0.3"' : ''}>
            <i data-lucide="arrow-down"></i>
          </button>
          <button class="mini-icon-btn btn-remove-file" title="Quitar archivo" style="color:var(--accent-danger)">
            <i data-lucide="trash-2"></i>
          </button>
        </div>
      `;

      // Handlers
      el.querySelector('.btn-move-up').addEventListener('click', () => {
        if (index > 0) {
          const temp = state.filesList[index];
          state.filesList[index] = state.filesList[index - 1];
          state.filesList[index - 1] = temp;
          renderMultiFilesList();
        }
      });

      el.querySelector('.btn-move-down').addEventListener('click', () => {
        if (index < state.filesList.length - 1) {
          const temp = state.filesList[index];
          state.filesList[index] = state.filesList[index + 1];
          state.filesList[index + 1] = temp;
          renderMultiFilesList();
        }
      });

      el.querySelector('.btn-remove-file').addEventListener('click', () => {
        state.filesList.splice(index, 1);
        if (state.filesList.length === 0) {
          resetToolWorkspace();
        } else {
          renderMultiFilesList();
          els.btnExecuteTool.disabled = state.currentTool === 'unir' ? (state.filesList.length < 2) : (state.filesList.length === 0);
        }
      });

      els.multiFilesList.appendChild(el);
    });

    refreshLucideIcons();
  }

  // --- TOOL SPECIFIC WORKSPACE LOGIC ---
  async function setupToolSpecificWorkspace() {
    const tool = state.currentTool;
    els.toolOptionsPanel.style.display = 'none';
    els.toolOptionsDynamicContent.innerHTML = '';
    els.pageThumbnailsWrapper.style.display = 'none';
    els.pageGrid.innerHTML = '';

    switch (tool) {
      case 'dividir':
        setupDividirWorkspace();
        break;
      case 'comprimir':
        setupComprimirWorkspace();
        break;
      case 'girar':
        await setupVisualPagesWorkspace('girar');
        break;
      case 'eliminar':
        await setupVisualPagesWorkspace('eliminar');
        break;
      case 'extraer':
        await setupVisualPagesWorkspace('extraer');
        break;
      case 'ordenar':
        await setupVisualPagesWorkspace('ordenar');
        break;
      case 'jpg2pdf':
        setupJpg2PdfWorkspace();
        break;
      case 'pdf2jpg':
        setupPdf2JpgWorkspace();
        break;
      case 'anadir':
        setupAnadirWorkspace();
        break;
    }
  }

  // 2. Dividir
  function setupDividirWorkspace() {
    const totalPages = state.primaryPdfInfo.pageCount;
    els.toolOptionsPanel.style.display = 'block';
    els.toolOptionsDynamicContent.innerHTML = `
      <div class="options-grid">
        <div class="option-group">
          <label class="option-label">Modo de división:</label>
          <select id="splitModeSelect" class="option-select">
            <option value="range">Extraer por rango personalizado (ej. 1-3, 5)</option>
            <option value="all-zip">Dividir todas las páginas en archivos individuales (.ZIP)</option>
          </select>
        </div>
        <div class="option-group" id="splitRangeGroup">
          <label class="option-label">Páginas o rangos a extraer (Total: ${totalPages} páginas):</label>
          <input type="text" id="splitRangeInput" class="option-input" placeholder="Ejemplo: 1-3, 5, 8" value="1-${Math.min(3, totalPages)}">
          <span style="font-size:0.75rem; color:var(--text-muted)">Usa comas para separar páginas o guiones para rangos.</span>
        </div>
      </div>
    `;

    const modeSelect = document.getElementById('splitModeSelect');
    const rangeGroup = document.getElementById('splitRangeGroup');
    modeSelect.addEventListener('change', () => {
      rangeGroup.style.display = modeSelect.value === 'range' ? 'flex' : 'none';
    });
  }

  // 3. Comprimir
  function setupComprimirWorkspace() {
    els.toolOptionsPanel.style.display = 'block';
    els.toolOptionsDynamicContent.innerHTML = `
      <div class="options-grid">
        <div class="option-group">
          <label class="option-label">Nivel de compresión:</label>
          <select id="compressionLevelSelect" class="option-select">
            <option value="recommended" selected>Compresión recomendada: buena reducción manteniendo alta calidad</option>
            <option value="high">Compresión alta: mayor reducción con pérdida de calidad moderada</option>
            <option value="maximum">Compresión máxima: mayor reducción (puede disminuir nitidez)</option>
          </select>
          <span style="font-size:0.8125rem; color:var(--text-muted); margin-top:0.4rem; display:block; line-height:1.4;">
            La opción recomendada equilibra la reducción de tamaño con texto completamente nítido e imágenes con gran detalle.
          </span>
        </div>
        <div class="option-group">
          <label class="option-label">Tamaño actual del archivo:</label>
          <div style="font-size:1.125rem; font-weight:700; color:var(--brand-primary); margin-top:0.4rem;">
            ${PDFEngine.formatBytes(state.primaryFile.size)}
          </div>
          <span style="font-size:0.75rem; color:var(--text-muted); margin-top:0.25rem; display:block;">
            100% procesado localmente en tu navegador sin enviar datos a servidores.
          </span>
        </div>
      </div>
    `;
  }

  // 5. JPG a PDF
  function setupJpg2PdfWorkspace() {
    els.toolOptionsPanel.style.display = 'block';
    els.toolOptionsDynamicContent.innerHTML = `
      <div class="options-grid">
        <div class="option-group">
          <label class="option-label">Formato de página:</label>
          <select id="jpgPageFitSelect" class="option-select">
            <option value="a4-portrait">A4 Vertical</option>
            <option value="a4-landscape">A4 Horizontal</option>
            <option value="fit-image">Ajustar al tamaño de la imagen</option>
          </select>
        </div>
        <div class="option-group">
          <label class="option-label">Márgenes:</label>
          <select id="jpgMarginsSelect" class="option-select">
            <option value="small">Margen pequeño (20px)</option>
            <option value="none">Sin margen</option>
            <option value="normal">Margen normal (40px)</option>
          </select>
        </div>
      </div>
    `;
  }

  // 6. PDF a JPG
  function setupPdf2JpgWorkspace() {
    els.toolOptionsPanel.style.display = 'block';
    els.toolOptionsDynamicContent.innerHTML = `
      <div class="options-grid">
        <div class="option-group">
          <label class="option-label">Calidad de las imágenes:</label>
          <select id="pdf2JpgQualitySelect" class="option-select">
            <option value="high">Alta Calidad (2x resolución, ideal para lectura y presentaciones)</option>
            <option value="standard">Estándar (1x resolución, peso más ligero)</option>
          </select>
        </div>
        <div class="option-group">
          <label class="option-label">Formato de salida:</label>
          <div style="font-size:0.875rem; color:var(--text-secondary); margin-top:0.5rem;">
            Se generará un archivo .ZIP con todas las páginas en formato JPG de alta nitidez.
          </div>
        </div>
      </div>
    `;
  }

  // 10. Añadir páginas a PDF
  function setupAnadirWorkspace() {
    els.toolOptionsPanel.style.display = 'block';
    const totalPages = state.primaryPdfInfo.pageCount;
    els.toolOptionsDynamicContent.innerHTML = `
      <div class="options-grid">
        <div class="option-group">
          <label class="option-label">Posición donde insertar:</label>
          <select id="insertPositionSelect" class="option-select">
            <option value="end">Al final del documento</option>
            <option value="start">Al principio del documento</option>
            <option value="after">Después de una página específica</option>
          </select>
        </div>
        <div class="option-group" id="insertAfterPageGroup" style="display:none;">
          <label class="option-label">Insertar después de la página (1 a ${totalPages}):</label>
          <input type="number" id="insertAfterPageInput" class="option-input" min="1" max="${totalPages}" value="1">
        </div>
        <div class="option-group" style="grid-column: 1 / -1;">
          <label class="option-label">Documento o imagen adicional a insertar:</label>
          <div style="display:flex; gap:0.75rem; align-items:center; margin-top:0.35rem;">
            <input type="file" id="secondaryFileInput" accept=".pdf,image/jpeg,image/png" style="display:none">
            <button type="button" class="btn-secondary-sm" id="btnSelectSecondaryFile">
              <i data-lucide="paperclip"></i> Seleccionar PDF o Imagen adicional
            </button>
            <span id="secondaryFileName" style="font-size:0.875rem; font-weight:600; color:var(--brand-primary);">Ningún archivo seleccionado</span>
          </div>
        </div>
      </div>
    `;

    const posSelect = document.getElementById('insertPositionSelect');
    const afterGroup = document.getElementById('insertAfterPageGroup');
    posSelect.addEventListener('change', () => {
      afterGroup.style.display = posSelect.value === 'after' ? 'flex' : 'none';
    });

    const secInput = document.getElementById('secondaryFileInput');
    const btnSelect = document.getElementById('btnSelectSecondaryFile');
    const nameLabel = document.getElementById('secondaryFileName');

    els.btnExecuteTool.disabled = !state.secondaryFile;

    btnSelect.addEventListener('click', () => {
      secInput.value = '';
      secInput.click();
    });
    secInput.addEventListener('change', async (e) => {
      if (e.target.files && e.target.files.length > 0) {
        state.secondaryFile = e.target.files[0];
        state.secondaryBuffer = await state.secondaryFile.arrayBuffer();
        nameLabel.textContent = `✓ ${state.secondaryFile.name} (${PDFEngine.formatBytes(state.secondaryFile.size)})`;
        els.btnExecuteTool.disabled = false;
        showToast('Documento secundario listo para insertar', 'success');
      }
    });

    refreshLucideIcons();
  }

  // --- VISUAL PAGES WORKSPACE (Girar, Eliminar, Extraer, Ordenar) ---
  async function setupVisualPagesWorkspace(mode) {
    els.pageThumbnailsWrapper.style.display = 'block';
    els.pageGrid.innerHTML = '';
    state.pagesData = [];

    const totalPages = state.primaryPdfInfo.pageCount;
    showLoadingProgress(true, 25, `Generando vista previa de ${totalPages} páginas...`);

    // Render toolbar buttons depending on mode
    let actionsHtml = '';
    if (mode === 'girar') {
      actionsHtml = `
        <button class="btn-secondary-sm" id="btnRotateAll90">
          <i data-lucide="rotate-cw"></i> Rotar todas +90°
        </button>
        <button class="btn-secondary-sm" id="btnRotateAll180">
          <i data-lucide="refresh-cw"></i> Rotar todas 180°
        </button>
        <button class="btn-secondary-sm" id="btnResetRotations">
          <i data-lucide="undo"></i> Restablecer
        </button>
      `;
    } else if (mode === 'eliminar') {
      actionsHtml = `
        <button class="btn-secondary-sm" id="btnSelectEvenPages">Seleccionar Pares</button>
        <button class="btn-secondary-sm" id="btnSelectOddPages">Seleccionar Impares</button>
        <button class="btn-secondary-sm" id="btnClearSelections">Limpiar selección</button>
      `;
    } else if (mode === 'extraer') {
      actionsHtml = `
        <button class="btn-secondary-sm" id="btnSelectAll">Seleccionar todas</button>
        <button class="btn-secondary-sm" id="btnInvertSelection">Invertir selección</button>
        <button class="btn-secondary-sm" id="btnClearSelections">Limpiar selección</button>
      `;
    } else if (mode === 'ordenar') {
      actionsHtml = `
        <button class="btn-secondary-sm" id="btnReverseOrder">Invertir orden</button>
        <button class="btn-secondary-sm" id="btnResetOrder">Restablecer orden original</button>
      `;
    }

    els.thumbnailsActions.innerHTML = actionsHtml;
    refreshLucideIcons();

    // Prepare Pages state
    for (let i = 0; i < totalPages; i++) {
      state.pagesData.push({
        pageNum: i + 1,
        originalIndex: i,
        rotation: 0,
        selected: false,
        canvas: null
      });
    }

    // Render placeholder cards immediately for instant interaction
    renderThumbnailsGrid(mode);
    updateThumbnailsToolbar(mode);
    setupThumbnailToolbarListeners(mode);

    // Asynchronously render thumbnails and update canvas preview boxes
    PDFEngine.renderPageThumbnails(state.primaryBuffer, (pageNum, canvas) => {
      if (state.currentTool !== mode) return;
      const pageIndex = pageNum - 1;
      if (state.pagesData[pageIndex]) {
        state.pagesData[pageIndex].canvas = canvas;
        const box = document.getElementById(`canvas-box-${state.pagesData[pageIndex].originalIndex}`);
        if (box) {
          box.innerHTML = '';
          box.appendChild(cloneCanvas(canvas));
        }
      }
    }).then(() => {
      if (state.currentTool === mode) {
        showLoadingProgress(false);
      }
    }).catch(err => {
      console.warn('Error al renderizar vistas previas:', err);
      if (state.currentTool === mode) {
        showLoadingProgress(false);
      }
    });
  }

  function cloneCanvas(oldCanvas) {
    if (!oldCanvas) return null;
    const newCanvas = document.createElement('canvas');
    newCanvas.width = oldCanvas.width;
    newCanvas.height = oldCanvas.height;
    const ctx = newCanvas.getContext('2d');
    ctx.drawImage(oldCanvas, 0, 0);
    return newCanvas;
  }

  function renderThumbnailsGrid(mode) {
    els.pageGrid.innerHTML = '';

    state.pagesData.forEach((pageItem, currentIndex) => {
      const card = document.createElement('div');
      card.className = 'page-thumbnail-card';
      card.id = `thumb-card-${pageItem.originalIndex}`;

      if (mode === 'eliminar' && pageItem.selected) {
        card.classList.add('selected-for-action');
      } else if (mode === 'extraer' && pageItem.selected) {
        card.classList.add('selected-for-extract');
      }

      // Canvas preview box with rotation transform
      const canvasBox = document.createElement('div');
      canvasBox.className = 'thumbnail-canvas-box';
      canvasBox.id = `canvas-box-${pageItem.originalIndex}`;
      if (pageItem.rotation !== 0) {
        canvasBox.style.transform = `rotate(${pageItem.rotation}deg)`;
      }

      if (pageItem.canvas) {
        canvasBox.appendChild(cloneCanvas(pageItem.canvas));
      } else {
        canvasBox.innerHTML = '<span style="font-size:0.75rem;color:var(--text-muted)">Pág. ' + pageItem.pageNum + '</span>';
      }

      // Page tag and controls
      const tag = document.createElement('div');
      tag.className = 'page-number-tag';
      tag.textContent = `Página ${pageItem.pageNum}`;

      // Mode specific controls on card
      const controls = document.createElement('div');
      controls.className = 'page-card-controls';

      if (mode === 'girar') {
        controls.innerHTML = `
          <button class="mini-icon-btn btn-rotate-single" title="Rotar esta página 90°">
            <i data-lucide="rotate-cw"></i>
          </button>
        `;
        controls.querySelector('.btn-rotate-single').addEventListener('click', (e) => {
          e.stopPropagation();
          pageItem.rotation = (pageItem.rotation + 90) % 360;
          canvasBox.style.transform = `rotate(${pageItem.rotation}deg)`;
          updateThumbnailsToolbar(mode);
        });
      } else if (mode === 'eliminar') {
        controls.innerHTML = `
          <button class="mini-icon-btn ${pageItem.selected ? 'btn-danger-sm' : ''}" title="Marcar para eliminar">
            <i data-lucide="${pageItem.selected ? 'x' : 'trash-2'}"></i>
          </button>
        `;
      } else if (mode === 'extraer') {
        controls.innerHTML = `
          <button class="mini-icon-btn" title="Seleccionar para extraer">
            <i data-lucide="${pageItem.selected ? 'check' : 'plus'}"></i>
          </button>
        `;
      } else if (mode === 'ordenar') {
        controls.innerHTML = `
          <button class="mini-icon-btn btn-move-left" title="Mover a la izquierda" ${currentIndex === 0 ? 'disabled style="opacity:0.3"' : ''}>
            <i data-lucide="chevron-left"></i>
          </button>
          <button class="mini-icon-btn btn-move-right" title="Mover a la derecha" ${currentIndex === state.pagesData.length - 1 ? 'disabled style="opacity:0.3"' : ''}>
            <i data-lucide="chevron-right"></i>
          </button>
        `;

        controls.querySelector('.btn-move-left').addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentIndex > 0) {
            const tmp = state.pagesData[currentIndex];
            state.pagesData[currentIndex] = state.pagesData[currentIndex - 1];
            state.pagesData[currentIndex - 1] = tmp;
            renderThumbnailsGrid(mode);
          }
        });

        controls.querySelector('.btn-move-right').addEventListener('click', (e) => {
          e.stopPropagation();
          if (currentIndex < state.pagesData.length - 1) {
            const tmp = state.pagesData[currentIndex];
            state.pagesData[currentIndex] = state.pagesData[currentIndex + 1];
            state.pagesData[currentIndex + 1] = tmp;
            renderThumbnailsGrid(mode);
          }
        });
      }

      // Click card to toggle selection (for Eliminar / Extraer)
      if (mode === 'eliminar' || mode === 'extraer') {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => {
          pageItem.selected = !pageItem.selected;
          renderThumbnailsGrid(mode);
          updateThumbnailsToolbar(mode);
        });
      }

      card.appendChild(canvasBox);
      card.appendChild(tag);
      card.appendChild(controls);
      els.pageGrid.appendChild(card);
    });

    refreshLucideIcons();
  }

  function updateThumbnailsToolbar(mode) {
    if (mode === 'girar') {
      const rotatedCount = state.pagesData.filter(p => p.rotation !== 0).length;
      els.thumbnailsStats.textContent = rotatedCount === 0
        ? `Todas las páginas en orientación original (${state.pagesData.length} págs.)`
        : `${rotatedCount} de ${state.pagesData.length} páginas rotadas`;
    } else if (mode === 'eliminar') {
      const deleteCount = state.pagesData.filter(p => p.selected).length;
      const remainCount = state.pagesData.length - deleteCount;
      els.thumbnailsStats.textContent = `Páginas a eliminar: ${deleteCount} • Quedarán: ${remainCount} págs.`;
      els.btnExecuteTool.disabled = deleteCount === 0 || remainCount === 0;
    } else if (mode === 'extraer') {
      const extractCount = state.pagesData.filter(p => p.selected).length;
      els.thumbnailsStats.textContent = `Páginas seleccionadas para extraer: ${extractCount} de ${state.pagesData.length}`;
      els.btnExecuteTool.disabled = extractCount === 0;
    } else if (mode === 'ordenar') {
      els.thumbnailsStats.textContent = `Páginas: ${state.pagesData.length} • Reordena con las flechas de cada tarjeta`;
    }
  }

  function setupThumbnailToolbarListeners(mode) {
    if (mode === 'girar') {
      const btn90 = document.getElementById('btnRotateAll90');
      const btn180 = document.getElementById('btnRotateAll180');
      const btnReset = document.getElementById('btnResetRotations');

      if (btn90) btn90.addEventListener('click', () => {
        state.pagesData.forEach(p => p.rotation = (p.rotation + 90) % 360);
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });

      if (btn180) btn180.addEventListener('click', () => {
        state.pagesData.forEach(p => p.rotation = (p.rotation + 180) % 360);
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });

      if (btnReset) btnReset.addEventListener('click', () => {
        state.pagesData.forEach(p => p.rotation = 0);
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });
    } else if (mode === 'eliminar') {
      const btnEven = document.getElementById('btnSelectEvenPages');
      const btnOdd = document.getElementById('btnSelectOddPages');
      const btnClear = document.getElementById('btnClearSelections');

      if (btnEven) btnEven.addEventListener('click', () => {
        state.pagesData.forEach(p => p.selected = (p.pageNum % 2 === 0));
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });

      if (btnOdd) btnOdd.addEventListener('click', () => {
        state.pagesData.forEach(p => p.selected = (p.pageNum % 2 !== 0));
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });

      if (btnClear) btnClear.addEventListener('click', () => {
        state.pagesData.forEach(p => p.selected = false);
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });
    } else if (mode === 'extraer') {
      const btnAll = document.getElementById('btnSelectAll');
      const btnInvert = document.getElementById('btnInvertSelection');
      const btnClear = document.getElementById('btnClearSelections');

      if (btnAll) btnAll.addEventListener('click', () => {
        state.pagesData.forEach(p => p.selected = true);
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });

      if (btnInvert) btnInvert.addEventListener('click', () => {
        state.pagesData.forEach(p => p.selected = !p.selected);
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });

      if (btnClear) btnClear.addEventListener('click', () => {
        state.pagesData.forEach(p => p.selected = false);
        renderThumbnailsGrid(mode);
        updateThumbnailsToolbar(mode);
      });
    } else if (mode === 'ordenar') {
      const btnReverse = document.getElementById('btnReverseOrder');
      const btnReset = document.getElementById('btnResetOrder');

      if (btnReverse) btnReverse.addEventListener('click', () => {
        state.pagesData.reverse();
        renderThumbnailsGrid(mode);
      });

      if (btnReset) btnReset.addEventListener('click', () => {
        state.pagesData.sort((a, b) => a.pageNum - b.pageNum);
        renderThumbnailsGrid(mode);
      });
    }
  }

  // --- EXECUTE CURRENT TOOL ---
  async function executeCurrentTool() {
    if (state.isProcessing) return;
    state.isProcessing = true;
    els.btnExecuteTool.disabled = true;

    try {
      showLoadingProgress(true, 5, 'Iniciando proceso...');

      const progressCallback = (pct, msg) => {
        showLoadingProgress(true, pct, msg);
      };

      const tool = state.currentTool;
      let outputBlob = null;
      let outputFilename = '';

      switch (tool) {
        case 'unir': {
          const buffers = state.filesList.map(item => item.buffer);
          const bytes = await PDFEngine.mergePDFs(buffers, progressCallback);
          outputBlob = new Blob([bytes], { type: 'application/pdf' });
          outputFilename = 'Documentos-Unidos.pdf';
          showSuccessResult('¡PDFs unidos correctamente!', `Se han combinado con éxito ${buffers.length} documentos en uno solo.`);
          break;
        }

        case 'dividir': {
          const mode = document.getElementById('splitModeSelect').value;
          const baseName = state.primaryFile.name.replace(/\.[^/.]+$/, "");
          if (mode === 'all-zip') {
            outputBlob = await PDFEngine.splitAllPagesToZip(state.primaryBuffer, baseName, progressCallback);
            outputFilename = `${baseName}-paginas-divididas.zip`;
            showSuccessResult('¡Páginas separadas con éxito!', 'Se ha creado un archivo ZIP con cada página del PDF por separado.');
          } else {
            const rangeStr = document.getElementById('splitRangeInput').value;
            const res = await PDFEngine.splitPDF(state.primaryBuffer, rangeStr, progressCallback);
            outputBlob = new Blob([res.bytes], { type: 'application/pdf' });
            outputFilename = `${baseName}-extraido.pdf`;
            showSuccessResult('¡PDF dividido correctamente!', `Se extrajeron con éxito ${res.pagesExtracted} páginas seleccionadas.`);
          }
          break;
        }

        case 'comprimir': {
          const level = document.getElementById('compressionLevelSelect').value;
          const baseName = state.primaryFile.name.replace(/\.[^/.]+$/, "");
          const res = await PDFEngine.compressPDF(state.primaryBuffer, level, progressCallback);
          outputBlob = new Blob([res.bytes], { type: 'application/pdf' });
          outputFilename = `${baseName}-comprimido.pdf`;
          
          const savings = Math.max(0, Math.round(((res.originalSize - res.compressedSize) / res.originalSize) * 100));
          let detailMessage = `De ${PDFEngine.formatBytes(res.originalSize)} a ${PDFEngine.formatBytes(res.compressedSize)} (${savings}% de reducción manteniendo alta calidad visual).`;
          if (savings === 0) {
            detailMessage = `Tu archivo original ya se encontraba en su tamaño óptimo (${PDFEngine.formatBytes(res.originalSize)}). Se mantuvo intacta su calidad original.`;
          }
          showSuccessResult(
            '¡Documento optimizado con éxito!',
            detailMessage
          );
          break;
        }

        case 'girar': {
          const rotationsMap = {};
          let anyRotated = false;
          state.pagesData.forEach((p, idx) => {
            if (p.rotation !== 0) {
              rotationsMap[idx] = p.rotation;
              anyRotated = true;
            }
          });
          if (!anyRotated) {
            throw new Error('No has rotado ninguna página. Rota al menos una página usando los botones antes de guardar.');
          }
          const baseName = state.primaryFile.name.replace(/\.[^/.]+$/, "");
          const bytes = await PDFEngine.rotatePDF(state.primaryBuffer, rotationsMap, progressCallback);
          outputBlob = new Blob([bytes], { type: 'application/pdf' });
          outputFilename = `${baseName}-rotado.pdf`;
          showSuccessResult('¡Páginas rotadas exitosamente!', 'La nueva orientación ha sido guardada en tu nuevo documento PDF.');
          break;
        }

        case 'jpg2pdf': {
          const fit = document.getElementById('jpgPageFitSelect').value;
          const margin = document.getElementById('jpgMarginsSelect').value;
          const imageFiles = state.filesList.map(item => item.file);
          const bytes = await PDFEngine.imagesToPDF(imageFiles, { fit, margin }, progressCallback);
          outputBlob = new Blob([bytes], { type: 'application/pdf' });
          outputFilename = 'Imagenes-Convertidas.pdf';
          showSuccessResult('¡Imágenes convertidas a PDF!', `Se creó un PDF compuesto por ${imageFiles.length} imágenes.`);
          break;
        }

        case 'pdf2jpg': {
          const quality = document.getElementById('pdf2JpgQualitySelect').value;
          const baseName = state.primaryFile.name.replace(/\.[^/.]+$/, "");
          const res = await PDFEngine.pdfToJPG(state.primaryBuffer, baseName, quality, progressCallback);
          outputBlob = res.zipBlob;
          outputFilename = `${baseName}-imagenes-jpg.zip`;
          showSuccessResult('¡Conversión a JPG completada!', `Se generaron ${res.images.length} imágenes JPG contenidas en un archivo ZIP.`);
          break;
        }

        case 'eliminar': {
          const deleteIndices = state.pagesData.filter(p => p.selected).map(p => p.originalIndex);
          const baseName = state.primaryFile.name.replace(/\.[^/.]+$/, "");
          const res = await PDFEngine.deletePages(state.primaryBuffer, deleteIndices, progressCallback);
          outputBlob = new Blob([res.bytes], { type: 'application/pdf' });
          outputFilename = `${baseName}-limpio.pdf`;
          showSuccessResult('¡Páginas eliminadas con éxito!', `Se eliminaron ${deleteIndices.length} páginas. El nuevo PDF tiene ${res.remainingCount} páginas.`);
          break;
        }

        case 'extraer': {
          const extractIndices = state.pagesData.filter(p => p.selected).map(p => p.originalIndex);
          const baseName = state.primaryFile.name.replace(/\.[^/.]+$/, "");
          const res = await PDFEngine.extractPages(state.primaryBuffer, extractIndices, progressCallback);
          outputBlob = new Blob([res.bytes], { type: 'application/pdf' });
          outputFilename = `${baseName}-extraidas.pdf`;
          showSuccessResult('¡Páginas extraídas con éxito!', `Se creó un nuevo PDF con las ${res.extractedCount} páginas seleccionadas.`);
          break;
        }

        case 'ordenar': {
          const newOrderIndices = state.pagesData.map(p => p.originalIndex);
          const baseName = state.primaryFile.name.replace(/\.[^/.]+$/, "");
          const bytes = await PDFEngine.reorderPages(state.primaryBuffer, newOrderIndices, progressCallback);
          outputBlob = new Blob([bytes], { type: 'application/pdf' });
          outputFilename = `${baseName}-reordenado.pdf`;
          showSuccessResult('¡Páginas reordenadas con éxito!', 'El nuevo orden de páginas se ha guardado en el archivo PDF.');
          break;
        }

        case 'anadir': {
          if (!state.secondaryFile) {
            throw new Error('Debes seleccionar el archivo secundario que deseas insertar.');
          }
          const mode = document.getElementById('insertPositionSelect').value;
          const afterPage = parseInt(document.getElementById('insertAfterPageInput')?.value || '1', 10);
          const isPdf = state.secondaryFile.type.includes('pdf') || state.secondaryFile.name.endsWith('.pdf');
          const baseName = state.primaryFile.name.replace(/\.[^/.]+$/, "");

          const bytes = await PDFEngine.addPagesToPDF(
            state.primaryBuffer,
            state.secondaryBuffer,
            isPdf,
            mode,
            afterPage,
            progressCallback
          );

          outputBlob = new Blob([bytes], { type: 'application/pdf' });
          outputFilename = `${baseName}-paginas-anadidas.pdf`;
          showSuccessResult('¡Páginas añadidas con éxito!', 'El contenido adicional ha sido integrado al documento original.');
          break;
        }
      }

      state.lastResultBlob = outputBlob;
      state.lastResultFilename = outputFilename;

      // Configure Download button
      els.btnDownloadMain.onclick = () => {
        PDFEngine.downloadBlob(state.lastResultBlob, state.lastResultFilename);
      };

    } catch (err) {
      console.error(err);
      showLoadingProgress(false);
      showToast(err.message || 'Ocurrió un error al procesar el archivo.', 'error');
      els.btnExecuteTool.disabled = false;
    } finally {
      state.isProcessing = false;
    }
  }

  // --- PROGRESS AND SUCCESS UI ---
  function showLoadingProgress(show, percent = 0, message = '') {
    if (!els.processingStatusArea) return;

    if (show) {
      els.processingStatusArea.style.display = 'block';
      els.progressBarFill.style.width = `${percent}%`;
      els.statusMessage.textContent = message;
    } else {
      els.processingStatusArea.style.display = 'none';
      els.progressBarFill.style.width = '0%';
    }
  }

  function showSuccessResult(title, description) {
    showLoadingProgress(false);
    els.resultSuccessBox.style.display = 'block';
    els.resultTitle.textContent = title;
    els.resultDesc.textContent = description;
    els.btnExecuteTool.style.display = 'none';

    els.resultSuccessBox.scrollIntoView({ behavior: 'smooth' });
    showToast(title, 'success');
  }

  // --- MODALS (Acerca de & Privacidad) ---
  function setupModals() {
    const aboutLinks = document.querySelectorAll('.nav-link-about, .footer-link-about');
    const privacyLinks = document.querySelectorAll('.nav-link-privacy, .footer-link-privacy');

    aboutLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(els.modalAbout);
      });
    });

    privacyLinks.forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        openModal(els.modalPrivacy);
      });
    });

    // Close buttons
    document.querySelectorAll('.modal-close-btn, .modal-backdrop').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target === el || el.classList.contains('modal-close-btn') || el.closest('.modal-close-btn')) {
          closeAllModals();
        }
      });
    });

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeAllModals();
      }
    });
  }

  function openModal(modal) {
    if (!modal) return;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeAllModals() {
    document.querySelectorAll('.modal-backdrop').forEach(m => m.classList.remove('open'));
    document.body.style.overflow = '';
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
      <i data-lucide="${iconName}"></i>
      <span>${message}</span>
    `;

    els.toastContainer.appendChild(toast);
    refreshLucideIcons();

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // Expose global methods for inline triggers
  window.openTool = openTool;
  window.closeTool = closeTool;

  // Run on page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
