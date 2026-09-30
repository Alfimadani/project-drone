// Global State
let imageFiles = []; 
const PRESET_STORAGE_KEY = 'crop_watermark_named_presets_v1';

// DOM Elements
const fileInput = document.getElementById('fileInput');
const dropZone = document.getElementById('dropZone');
const imageListContainer = document.getElementById('imageListContainer');
const emptyState = document.getElementById('emptyState');
const btnDownloadZip = document.getElementById('btnDownloadZip');

// Preset Elements
const presetSelect = document.getElementById('presetSelect');
const btnLoadPreset = document.getElementById('btnLoadPreset');
const btnAddPreset = document.getElementById('btnAddPreset');
const btnEditPreset = document.getElementById('btnEditPreset');
const btnDownloadPreset = document.getElementById('btnDownloadPreset');
const presetFileInput = document.getElementById('presetFileInput');
const btnDeletePreset = document.getElementById('btnDeletePreset');

// Controls
const txtTemplate = document.getElementById('txtTemplate');
const fontFamily = document.getElementById('fontFamily');
const fontSize = document.getElementById('fontSize');
const textColor = document.getElementById('textColor');
const chkBold = document.getElementById('chkBold');
const chkItalic = document.getElementById('chkItalic');
const textOpacity = document.getElementById('textOpacity');
const lblTextOpacity = document.getElementById('lblTextOpacity');

const chkApplyOutline = document.getElementById('chkApplyOutline');
const outlineColor = document.getElementById('outlineColor');
const outlineThickness = document.getElementById('outlineThickness');

const chkApplyShadow = document.getElementById('chkApplyShadow');
const shadowColor = document.getElementById('shadowColor');
const shadowBlur = document.getElementById('shadowBlur');
const shadowOpacity = document.getElementById('shadowOpacity');
const lblShadowOpacity = document.getElementById('lblShadowOpacity');
const shadowX = document.getElementById('shadowX');
const shadowY = document.getElementById('shadowY');

const anchorPosition = document.getElementById('anchorPosition');
const offsetX = document.getElementById('offsetX');
const offsetY = document.getElementById('offsetY');

const chkShowOriginal = document.getElementById('chkShowOriginal');
const chkIncludeOriginalsZip = document.getElementById('chkIncludeOriginalsZip');

// Live Preview Events
const allInputs = [
  txtTemplate, fontFamily, fontSize, textColor, chkBold, chkItalic, textOpacity,
  chkApplyOutline, outlineColor, outlineThickness,
  chkApplyShadow, shadowColor, shadowBlur, shadowOpacity, shadowX, shadowY,
  anchorPosition, offsetX, offsetY, chkShowOriginal
];

allInputs.forEach(input => {
  if (input) {
    input.addEventListener('input', () => { updateLabels(); renderAllCanvases(); });
    input.addEventListener('change', () => { updateLabels(); renderAllCanvases(); });
  }
});

document.querySelectorAll('input[name="outlineMode"]').forEach(radio => {
  radio.addEventListener('change', renderAllCanvases);
});

function updateLabels() {
  if (lblTextOpacity && textOpacity) lblTextOpacity.textContent = textOpacity.value + '%';
  if (lblShadowOpacity && shadowOpacity) lblShadowOpacity.textContent = shadowOpacity.value + '%';
}

// --- DRAG AND DROP & FOLDER DETECTION ---
dropZone.addEventListener('dragover', (e) => { 
  e.preventDefault(); 
  dropZone.classList.add('border-blue-500'); 
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('border-blue-500'));

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('border-blue-500');
  
  const items = e.dataTransfer.items;
  const files = [];

  if (items && items.length > 0) {
    const promises = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
        if (entry) {
          promises.push(traverseFileTree(entry));
        } else {
          const file = item.getAsFile();
          if (file) files.push(file);
        }
      }
    }
    
    const nestedFiles = await Promise.all(promises);
    nestedFiles.forEach(arr => files.push(...arr));
  } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    files.push(...Array.from(e.dataTransfer.files));
  }

  if (files.length > 0) {
    handleFiles(files);
  }
});

// Rekursif membaca seluruh isi Folder
function traverseFileTree(item) {
  return new Promise((resolve) => {
    if (item.isFile) {
      item.file((file) => {
        if (file && file.type && file.type.startsWith('image/')) {
          resolve([file]);
        } else {
          resolve([]);
        }
      }, () => resolve([]));
    } else if (item.isDirectory) {
      const dirReader = item.createReader();
      let entries = [];

      const readAllEntries = () => {
        dirReader.readEntries(async (results) => {
          if (results.length === 0) {
            const promises = entries.map(entry => traverseFileTree(entry));
            const childFiles = await Promise.all(promises);
            resolve(childFiles.flat());
          } else {
            entries = entries.concat(Array.from(results));
            readAllEntries();
          }
        }, () => resolve([]));
      };

      readAllEntries();
    } else {
      resolve([]);
    }
  });
}

fileInput.addEventListener('change', (e) => {
  if (e.target.files?.length > 0) handleFiles(Array.from(e.target.files));
});

// --- HELPER METADATA WAKTU & PENGURUTAN (RENDAH KE TINGGI) ---
function getFileTimestamp(file) {
  const name = file.name || "";
  // Cek jika ada format DJI YYYYMMDDHHMMSS
  const matchDji = name.match(/DJI_(\d{14})/);
  if (matchDji) {
    return parseInt(matchDji[1], 10);
  }
  // Alternatif: Ambil timestamp dari properti lastModified file
  return file.lastModified || 0;
}

function sortByTimestamp(a, b) {
  const timeA = getFileTimestamp(a.file);
  const timeB = getFileTimestamp(b.file);
  if (timeA !== timeB) {
    return timeA - timeB;
  }
  return a.file.name.localeCompare(b.file.name);
}

// --- PENANGANAN FILE & PROSES BATCH ---
function handleFiles(files) {
  const validFiles = files.filter(f => f.type && f.type.startsWith('image/'));
  if (validFiles.length === 0) return;

  let loadedCount = 0;
  const newItems = [];

  validFiles.forEach(file => {
    const modDate = new Date(file.lastModified);
    const dateStr = formatDate(modDate);
    const timeStr = formatTime(modDate);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const img = new Image();
      img.onload = () => {
        const item = {
          id: 'img_' + Math.random().toString(36).substr(2, 9),
          file: file,
          imgObj: img,
          dateStr: dateStr,
          timeStr: timeStr,
          focalX: 0.5,
          focalY: 0.5
        };
        newItems.push(item);
        loadedCount++;

        if (loadedCount === validFiles.length) {
          imageFiles.push(...newItems);
          // Urutkan seluruh gambar dari waktu terendah ke tinggi
          reorderAndRenderAll();
        }
      };
      img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Merapikan Urutan UI & Memuat Ulang Kartu Canvas Sesuai Urutan Waktu
function reorderAndRenderAll() {
  imageFiles.sort(sortByTimestamp);
  
  // Terapkan posisi focal jika ada preset aktif
  const activePresetName = presetSelect.value;
  if (activePresetName) {
    const presets = getSavedPresets();
    if (presets[activePresetName]?.focalPositions) {
      applyFocalPositions(presets[activePresetName].focalPositions);
    }
  }

  imageListContainer.innerHTML = '';
  imageFiles.forEach(item => {
    createCardElement(item);
    renderCanvas(item);
  });

  updateUIState();
}

function formatDate(date) {
  const months = ["JAN", "FEB", "MAR", "APR", "MEI", "JUN", "JUL", "AGU", "SEP", "OKT", "NOV", "DES"];
  return `${String(date.getDate()).padStart(2, '0')} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function updateUIState() {
  if (imageFiles.length > 0) {
    emptyState.classList.add('hidden');
    imageListContainer.classList.remove('hidden');
    btnDownloadZip.removeAttribute('disabled');
  } else {
    emptyState.classList.remove('hidden');
    imageListContainer.classList.add('hidden');
    btnDownloadZip.setAttribute('disabled', 'true');
  }
}

function createCardElement(item) {
  const card = document.createElement('div');
  card.id = `card_${item.id}`;
  card.className = "bg-gray-800 border border-gray-700 rounded-xl overflow-hidden shadow-lg p-4 flex flex-col md:flex-row gap-4 items-start";

  card.innerHTML = `
    <div class="flex-1 w-full">
      <div class="flex justify-between items-center mb-2">
        <div>
          <span class="text-xs font-bold text-gray-200">${item.file.name}</span>
          <span class="text-[10px] text-gray-400 block">
            Resolusi Asli: ${item.imgObj.naturalWidth} x ${item.imgObj.naturalHeight} px | Waktu: ${item.dateStr} ${item.timeStr}
          </span>
        </div>
        <button onclick="removeImage('${item.id}')" class="text-xs text-red-400 hover:text-red-300 font-semibold flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
          Hapus
        </button>
      </div>

      <div class="relative checkerboard rounded-lg overflow-hidden border border-gray-700 group cursor-crosshair">
        <canvas id="canvas_${item.id}" class="w-full h-auto block"></canvas>
        <div id="focalPoint_${item.id}" class="absolute w-6 h-6 border-2 border-yellow-400 rounded-full -translate-x-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center shadow-md">
          <div class="w-1.5 h-1.5 bg-yellow-400 rounded-full"></div>
        </div>
        <div class="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-[10px] text-white px-2 py-0.5 rounded opacity-0 group-hover:opacity-100 transition">
          Klik pada foto untuk atur titik fokus (16:9)
        </div>
      </div>
    </div>

    <div id="origCol_${item.id}" class="w-full md:w-64 flex-shrink-0 ${chkShowOriginal.checked ? '' : 'hidden'}">
      <div class="flex justify-between items-center mb-2">
        <span class="text-xs font-semibold text-amber-400">Original (Tanpa Edit)</span>
      </div>
      <div class="rounded-lg overflow-hidden border border-gray-700 bg-gray-900">
        <img src="${item.imgObj.src}" class="w-full h-auto block opacity-80">
      </div>
    </div>
  `;

  imageListContainer.appendChild(card);

  const canvas = document.getElementById(`canvas_${item.id}`);
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    item.focalX = (e.clientX - rect.left) / rect.width;
    item.focalY = (e.clientY - rect.top) / rect.height;
    renderCanvas(item);
  });
}

function removeImage(id) {
  imageFiles = imageFiles.filter(i => i.id !== id);
  document.getElementById(`card_${id}`)?.remove();
  updateUIState();
}

function renderAllCanvases() {
  imageFiles.forEach(item => {
    const origCol = document.getElementById(`origCol_${item.id}`);
    if (origCol) {
      if (chkShowOriginal.checked) origCol.classList.remove('hidden');
      else origCol.classList.add('hidden');
    }
    renderCanvas(item);
  });
}

// --- CANVAS RENDERING (RESOLUSI ASLI) ---
function renderCanvas(item) {
  const canvas = document.getElementById(`canvas_${item.id}`);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const img = item.imgObj;
  const srcW = img.naturalWidth;
  const srcH = img.naturalHeight;

  const targetRatio = 16 / 9;
  let cropW, cropH;

  if (srcW / srcH > targetRatio) {
    cropH = srcH;
    cropW = srcH * targetRatio;
  } else {
    cropW = srcW;
    cropH = srcW / targetRatio;
  }

  let cropX = (srcW * item.focalX) - (cropW / 2);
  let cropY = (srcH * item.focalY) - (cropH / 2);

  cropX = Math.max(0, Math.min(srcW - cropW, cropX));
  cropY = Math.max(0, Math.min(srcH - cropH, cropY));

  canvas.width = Math.round(cropW);
  canvas.height = Math.round(cropH);

  ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
  drawWatermark(ctx, canvas.width, canvas.height, item);

  const focalMarker = document.getElementById(`focalPoint_${item.id}`);
  if (focalMarker) {
    const normFocalX = ((srcW * item.focalX) - cropX) / cropW;
    const normFocalY = ((srcH * item.focalY) - cropY) / cropH;
    focalMarker.style.left = `${normFocalX * 100}%`;
    focalMarker.style.top = `${normFocalY * 100}%`;
  }
}

function drawWatermark(ctx, canvasW, canvasH, item) {
  let text = txtTemplate.value;
  text = text.replace(/\[DATE\]/g, item.dateStr);
  text = text.replace(/\[TIME\]/g, item.timeStr);
  text = text.replace(/\[FILENAME\]/g, item.file.name);

  ctx.save();

  const scaleFactor = canvasH / 900;
  const baseFontSize = parseInt(fontSize.value) || 38;
  const scaledFontSize = Math.round(baseFontSize * scaleFactor);

  const fontStyle = chkItalic.checked ? 'italic ' : '';
  const fontWeight = chkBold.checked ? 'bold ' : '';
  ctx.font = `${fontStyle}${fontWeight}${scaledFontSize}px ${fontFamily.value}, sans-serif`;

  const textMetrics = ctx.measureText(text);
  const textWidth = textMetrics.width;
  const textHeight = scaledFontSize;

  const anchor = anchorPosition.value;
  const offX = (parseInt(offsetX.value) || 0) * scaleFactor;
  const offY = (parseInt(offsetY.value) || 0) * scaleFactor;

  let posX = offX;
  let posY = offY;

  ctx.textAlign = "left";
  ctx.textBaseline = "top";

  switch (anchor) {
    case 'bottom-right':
      posX = canvasW - textWidth + offX;
      posY = canvasH - textHeight + offY;
      break;
    case 'bottom-left':
      posX = offX < 0 ? -offX : offX;
      posY = canvasH - textHeight + offY;
      break;
    case 'bottom-center':
      posX = (canvasW - textWidth) / 2 + offX;
      posY = canvasH - textHeight + offY;
      break;
    case 'top-right':
      posX = canvasW - textWidth + offX;
      posY = Math.abs(offY);
      break;
    case 'top-left':
      posX = Math.abs(offX);
      posY = Math.abs(offY);
      break;
    case 'center':
      posX = (canvasW - textWidth) / 2 + offX;
      posY = (canvasH - textHeight) / 2 + offY;
      break;
  }

  // Shadow
  if (chkApplyShadow.checked) {
    ctx.save();
    const sColor = shadowColor.value;
    const sOpacity = parseFloat(shadowOpacity.value) / 100;
    ctx.shadowColor = hexToRgba(sColor, sOpacity);
    ctx.shadowBlur = (parseInt(shadowBlur.value) || 0) * scaleFactor;
    ctx.shadowOffsetX = (parseInt(shadowX.value) || 0) * scaleFactor;
    ctx.shadowOffsetY = (parseInt(shadowY.value) || 0) * scaleFactor;
    ctx.fillStyle = hexToRgba(textColor.value, parseFloat(textOpacity.value) / 100);
    ctx.fillText(text, posX, posY);
    ctx.restore();
  }

  // Outline
  const outlineRadio = document.querySelector('input[name="outlineMode"]:checked');
  const outlineMode = outlineRadio ? outlineRadio.value : 'both';
  if (chkApplyOutline.checked) {
    ctx.strokeStyle = outlineColor.value;
    ctx.lineWidth = (parseInt(outlineThickness.value) || 6) * scaleFactor;
    ctx.lineJoin = "round";
    ctx.strokeText(text, posX, posY);
  }

  // Text Fill
  if (outlineMode !== 'outlineOnly') {
    ctx.fillStyle = hexToRgba(textColor.value, parseFloat(textOpacity.value) / 100);
    ctx.fillText(text, posX, posY);
  }

  ctx.restore();
}

function hexToRgba(hex, alpha) {
  let c = hex.replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  return `rgba(${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}, ${alpha})`;
}

// --- FITUR MANAJEMEN PRESET LENGKAP ---

function getSavedPresets() {
  try {
    const json = localStorage.getItem(PRESET_STORAGE_KEY);
    return json ? JSON.parse(json) : {};
  } catch (e) { return {}; }
}

function saveSavedPresets(presetsObj) {
  localStorage.setItem(PRESET_STORAGE_KEY, JSON.stringify(presetsObj));
}

function refreshPresetDropdown(selectedName = null) {
  const presets = getSavedPresets();
  presetSelect.innerHTML = '';

  const keys = Object.keys(presets);
  if (keys.length === 0) {
    const opt = document.createElement('option');
    opt.value = "";
    opt.textContent = "-- Belum Ada Preset --";
    presetSelect.appendChild(opt);
    return;
  }

  keys.forEach(key => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = key;
    if (selectedName && selectedName === key) opt.selected = true;
    presetSelect.appendChild(opt);
  });
}

function getCurrentPresetData(name) {
  const focalPositions = imageFiles.map(img => ({
    fileName: img.file.name,
    focalX: img.focalX,
    focalY: img.focalY
  }));

  const outlineRadio = document.querySelector('input[name="outlineMode"]:checked');

  return {
    name: name,
    updatedAt: new Date().toISOString(),
    txtTemplate: txtTemplate.value,
    fontFamily: fontFamily.value,
    fontSize: fontSize.value,
    textColor: textColor.value,
    chkBold: chkBold.checked,
    chkItalic: chkItalic.checked,
    textOpacity: textOpacity.value,
    chkApplyOutline: chkApplyOutline.checked,
    outlineColor: outlineColor.value,
    outlineThickness: outlineThickness.value,
    outlineMode: outlineRadio ? outlineRadio.value : 'both',
    chkApplyShadow: chkApplyShadow.checked,
    shadowColor: shadowColor.value,
    shadowBlur: shadowBlur.value,
    shadowOpacity: shadowOpacity.value,
    shadowX: shadowX.value,
    shadowY: shadowY.value,
    anchorPosition: anchorPosition.value,
    offsetX: offsetX.value,
    offsetY: offsetY.value,
    focalPositions: focalPositions
  };
}

// 1. TAMBAH PRESET BARU
btnAddPreset.addEventListener('click', () => {
  const presetName = prompt('Masukkan Nama Preset Baru:', 'Preset Utama');
  if (!presetName || !presetName.trim()) return;

  const cleanName = presetName.trim();
  const presets = getSavedPresets();

  presets[cleanName] = getCurrentPresetData(cleanName);

  saveSavedPresets(presets);
  refreshPresetDropdown(cleanName);
  alert(`Preset "${cleanName}" berhasil ditambahkan!`);
});

// 2. EDIT / UPDATE PRESET
btnEditPreset.addEventListener('click', () => {
  const selectedName = presetSelect.value;
  if (!selectedName) {
    alert('Pilih preset dari daftar yang ingin diperbarui!');
    return;
  }

  if (confirm(`Apakah Anda yakin ingin memperbarui isi preset "${selectedName}" dengan pengaturan saat ini?`)) {
    const presets = getSavedPresets();
    presets[selectedName] = getCurrentPresetData(selectedName);

    saveSavedPresets(presets);
    refreshPresetDropdown(selectedName);
    alert(`Preset "${selectedName}" berhasil diperbarui!`);
  }
});

// 3. MUAT PRESET TERPILIH
btnLoadPreset.addEventListener('click', () => {
  const selectedName = presetSelect.value;
  if (!selectedName) return;

  const presets = getSavedPresets();
  const p = presets[selectedName];
  if (!p) return;

  applyPresetData(p);
  alert(`Preset "${selectedName}" berhasil dimuat!`);
});

function applyFocalPositions(focalPositions) {
  if (!focalPositions || !Array.isArray(focalPositions)) return;
  focalPositions.forEach(savedPos => {
    const match = imageFiles.find(i => i.file.name === savedPos.fileName);
    if (match) {
      match.focalX = savedPos.focalX;
      match.focalY = savedPos.focalY;
    }
  });
}

function applyPresetData(p) {
  txtTemplate.value = p.txtTemplate ?? txtTemplate.value;
  fontFamily.value = p.fontFamily ?? fontFamily.value;
  fontSize.value = p.fontSize ?? fontSize.value;
  textColor.value = p.textColor ?? textColor.value;
  chkBold.checked = p.chkBold ?? chkBold.checked;
  chkItalic.checked = p.chkItalic ?? chkItalic.checked;
  textOpacity.value = p.textOpacity ?? textOpacity.value;

  chkApplyOutline.checked = p.chkApplyOutline ?? chkApplyOutline.checked;
  outlineColor.value = p.outlineColor ?? outlineColor.value;
  outlineThickness.value = p.outlineThickness ?? outlineThickness.value;

  if (p.outlineMode) {
    const radio = document.querySelector(`input[name="outlineMode"][value="${p.outlineMode}"]`);
    if (radio) radio.checked = true;
  }

  chkApplyShadow.checked = p.chkApplyShadow ?? chkApplyShadow.checked;
  shadowColor.value = p.shadowColor ?? shadowColor.value;
  shadowBlur.value = p.shadowBlur ?? shadowBlur.value;
  shadowOpacity.value = p.shadowOpacity ?? shadowOpacity.value;
  shadowX.value = p.shadowX ?? shadowX.value;
  shadowY.value = p.shadowY ?? shadowY.value;

  anchorPosition.value = p.anchorPosition ?? anchorPosition.value;
  offsetX.value = p.offsetX ?? offsetX.value;
  offsetY.value = p.offsetY ?? offsetY.value;

  applyFocalPositions(p.focalPositions);

  updateLabels();
  renderAllCanvases();
}

// 4. DOWNLOAD PRESET (.JSON)
btnDownloadPreset.addEventListener('click', () => {
  const selectedName = presetSelect.value;
  const presets = getSavedPresets();

  if (!selectedName || !presets[selectedName]) {
    alert('Pilih preset yang ingin di-download!');
    return;
  }

  const presetData = presets[selectedName];
  const jsonStr = JSON.stringify(presetData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  
  saveAs(blob, `Preset_${selectedName.replace(/\s+/g, '_')}.json`);
});

// 5. UPLOAD PRESET (.JSON)
presetFileInput.addEventListener('change', (e) => {
  const file = e.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    try {
      const importedPreset = JSON.parse(evt.target.result);

      if (!importedPreset.name || !importedPreset.txtTemplate) {
        alert('Format file JSON preset tidak valid!');
        return;
      }

      const presets = getSavedPresets();
      let presetName = importedPreset.name;

      if (presets[presetName]) {
        const rename = prompt(`Preset dengan nama "${presetName}" sudah ada. Masukkan nama baru jika tidak ingin menimpa:`, `${presetName}_Impor`);
        if (rename && rename.trim()) presetName = rename.trim();
      }

      importedPreset.name = presetName;
      presets[presetName] = importedPreset;

      saveSavedPresets(presets);
      refreshPresetDropdown(presetName);
      applyPresetData(importedPreset);

      alert(`Preset "${presetName}" berhasil diunggah dan diterapkan!`);
    } catch (err) {
      alert('Gagal membaca file preset JSON. Pastikan filenya valid.');
    }
  };
  reader.readAsText(file);
  presetFileInput.value = '';
});

// 6. HAPUS PRESET
btnDeletePreset.addEventListener('click', () => {
  const selectedName = presetSelect.value;
  if (!selectedName) return;

  if (confirm(`Apakah Anda yakin ingin menghapus preset "${selectedName}"?`)) {
    const presets = getSavedPresets();
    delete presets[selectedName];
    saveSavedPresets(presets);
    refreshPresetDropdown();
  }
});

// --- PROSES DOWNLOAD ZIP ---
btnDownloadZip.addEventListener('click', async () => {
  if (imageFiles.length === 0) return;

  btnDownloadZip.disabled = true;
  btnDownloadZip.textContent = "Memproses ZIP...";

  const zip = new JSZip();
  const includeOriginals = chkIncludeOriginalsZip.checked;

  let originalsFolder = null;
  if (includeOriginals) {
    originalsFolder = zip.folder("Originals");
  }

  for (let i = 0; i < imageFiles.length; i++) {
    const item = imageFiles[i];
    const canvas = document.getElementById(`canvas_${item.id}`);

    const blob16x9 = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.95));
    const cleanName = item.file.name.substring(0, item.file.name.lastIndexOf('.')) || item.file.name;
    
    // Penamaan file urut sesuai indeks kronologis
    const indexPrefix = String(i + 1).padStart(2, '0');
    zip.file(`${indexPrefix}_${cleanName}_16x9.jpg`, blob16x9);

    if (includeOriginals && originalsFolder) {
      originalsFolder.file(`${indexPrefix}_${item.file.name}`, item.file);
    }
  }

  zip.generateAsync({ type: "blob" }).then(content => {
    saveAs(content, "Hasil_Crop_16x9_Urut.zip");
    btnDownloadZip.disabled = false;
    btnDownloadZip.innerHTML = `
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
      Download All (.ZIP)
    `;
  });
});

window.addEventListener('DOMContentLoaded', () => {
  updateLabels();
  refreshPresetDropdown();
});