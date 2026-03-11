const fileInput = document.getElementById("fileInput");
const emptyState = document.getElementById("emptyState");
const stage = document.getElementById("stage");
const imagePreview = document.getElementById("imagePreview");
const selectionBox = document.getElementById("selectionBox");
const resetImageBtn = document.getElementById("resetImageBtn");
const resetSelectionBtn = document.getElementById("resetSelectionBtn");
const processBtn = document.getElementById("processBtn");
const downloadBtn = document.getElementById("downloadBtn");
const selectionInfo = document.getElementById("selectionInfo");
const statusBox = document.getElementById("statusBox");
const fileTypeTag = document.getElementById("fileTypeTag");

const state = {
  file: null,
  originalUrl: "",
  previewUrl: "",
  selection: null,
  dragging: false,
  dragPointerId: null,
  dragStart: null,
  processedBlob: null,
  outputName: "",
};

const workCanvas = document.createElement("canvas");
const workCtx = workCanvas.getContext("2d");
const patchCanvas = document.createElement("canvas");
const patchCtx = patchCanvas.getContext("2d");

function setStatus(title, detail) {
  statusBox.innerHTML = `<strong>${title}</strong><p>${detail}</p>`;
}

function revokeObjectUrl(key) {
  if (state[key]) {
    URL.revokeObjectURL(state[key]);
    state[key] = "";
  }
}

function resetProcessedOutput() {
  state.processedBlob = null;
  state.outputName = "";
  downloadBtn.disabled = true;
  resetImageBtn.disabled = true;
}

function clearSelection() {
  state.selection = null;
  state.dragging = false;
  state.dragPointerId = null;
  state.dragStart = null;
  selectionBox.classList.add("hidden");
  selectionInfo.textContent = "尚未框选区域";
  processBtn.disabled = true;
}

function resetSelection() {
  clearSelection();
  resetProcessedOutput();
}

function resetWorkspace() {
  revokeObjectUrl("originalUrl");
  revokeObjectUrl("previewUrl");
  resetSelection();
  imagePreview.classList.add("hidden");
  stage.classList.add("hidden");
  emptyState.classList.remove("hidden");
  state.file = null;
  fileTypeTag.textContent = "未选择";
  setStatus("等待上传文件", "导出将保持原始格式与原始分辨率。");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function updateSelectionBox(selection) {
  selectionBox.style.left = `${selection.x}px`;
  selectionBox.style.top = `${selection.y}px`;
  selectionBox.style.width = `${selection.width}px`;
  selectionBox.style.height = `${selection.height}px`;
  selectionBox.classList.remove("hidden");
}

function getNormalizedSelection() {
  if (!state.selection || !imagePreview.naturalWidth || !imagePreview.naturalHeight) {
    return null;
  }

  const displayWidth = imagePreview.clientWidth;
  const displayHeight = imagePreview.clientHeight;

  if (!displayWidth || !displayHeight) {
    return null;
  }

  return {
    x: Math.round((state.selection.x / displayWidth) * imagePreview.naturalWidth),
    y: Math.round((state.selection.y / displayHeight) * imagePreview.naturalHeight),
    width: Math.round((state.selection.width / displayWidth) * imagePreview.naturalWidth),
    height: Math.round((state.selection.height / displayHeight) * imagePreview.naturalHeight),
  };
}

function updateSelectionInfo() {
  const normalized = getNormalizedSelection();
  if (!normalized) {
    selectionInfo.textContent = "尚未框选区域";
    return;
  }

  selectionInfo.textContent = `X:${normalized.x} / Y:${normalized.y} / W:${normalized.width} / H:${normalized.height}`;
}

function getFileBaseName(filename) {
  return filename.replace(/\.[^.]+$/, "");
}

function getFileExtension(filename) {
  const match = filename.match(/(\.[^.]+)$/);
  return match ? match[1].toLowerCase() : "";
}

function getSafeImageMimeType(file) {
  const supportedMimes = new Set(["image/png", "image/jpeg", "image/webp"]);
  return supportedMimes.has(file.type) ? file.type : null;
}

function getImageQuality(mimeType) {
  return mimeType === "image/jpeg" || mimeType === "image/webp" ? 0.96 : 1;
}

function getImageExtensionForMimeType(mimeType, fallbackExtension) {
  if (mimeType === "image/jpeg") {
    return fallbackExtension === ".jpeg" ? ".jpeg" : ".jpg";
  }

  if (mimeType === "image/webp") {
    return ".webp";
  }

  return ".png";
}

function activateStage() {
  emptyState.classList.add("hidden");
  stage.classList.remove("hidden");
}

function loadFile(file) {
  if (!file.type.startsWith("image/")) {
    setStatus("文件类型不支持", "当前版本仅支持上传图片文件。");
    return;
  }

  revokeObjectUrl("originalUrl");
  revokeObjectUrl("previewUrl");
  resetSelection();

  state.file = file;
  state.originalUrl = URL.createObjectURL(file);
  fileTypeTag.textContent = "图片文件";
  activateStage();

  imagePreview.src = state.originalUrl;
  imagePreview.onload = () => {
    updateSelectionInfo();
    setStatus("图片已载入", "请直接在图片上拖拽框选水印区域。");
  };
  imagePreview.classList.remove("hidden");
}

function getRelativePoint(event) {
  const rect = imagePreview.getBoundingClientRect();
  return {
    x: clamp(event.clientX - rect.left, 0, rect.width),
    y: clamp(event.clientY - rect.top, 0, rect.height),
  };
}

function beginSelection(event) {
  if (!state.file || event.button !== 0) {
    return;
  }

  event.preventDefault();
  const point = getRelativePoint(event);
  state.dragging = true;
  state.dragPointerId = event.pointerId;
  state.dragStart = point;
  state.selection = { x: point.x, y: point.y, width: 0, height: 0 };
  updateSelectionBox(state.selection);
  imagePreview.setPointerCapture(event.pointerId);
}

function moveSelection(event) {
  if (!state.dragging || state.dragPointerId !== event.pointerId) {
    return;
  }

  const point = getRelativePoint(event);
  const x = Math.min(point.x, state.dragStart.x);
  const y = Math.min(point.y, state.dragStart.y);
  const width = Math.abs(point.x - state.dragStart.x);
  const height = Math.abs(point.y - state.dragStart.y);

  state.selection = { x, y, width, height };
  updateSelectionBox(state.selection);
  updateSelectionInfo();
}

function endSelection(event) {
  if (!state.dragging || state.dragPointerId !== event.pointerId) {
    return;
  }

  state.dragging = false;
  state.dragPointerId = null;

  if (imagePreview.hasPointerCapture(event.pointerId)) {
    imagePreview.releasePointerCapture(event.pointerId);
  }

  if (!state.selection || state.selection.width < 8 || state.selection.height < 8) {
    resetSelection();
    return;
  }

  processBtn.disabled = false;
  updateSelectionInfo();
  setStatus("选区已更新", "可以开始去除并导出当前图片。");
}

function drawPatchedRegion(ctx, source, rect) {
  const sourceHeight = source.height;
  const patchHeight = Math.max(8, Math.min(20, rect.height));
  const aboveY = rect.y - patchHeight;
  const belowY = rect.y + rect.height;

  ctx.save();
  ctx.filter = "blur(5px)";

  if (aboveY >= 0) {
    ctx.drawImage(
      source,
      rect.x,
      aboveY,
      rect.width,
      patchHeight,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
  } else if (belowY + patchHeight <= sourceHeight) {
    ctx.drawImage(
      source,
      rect.x,
      belowY,
      rect.width,
      patchHeight,
      rect.x,
      rect.y,
      rect.width,
      rect.height
    );
  } else {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
  }

  ctx.restore();
}

async function processImage() {
  const rect = getNormalizedSelection();
  if (!rect) {
    return;
  }

  workCanvas.width = imagePreview.naturalWidth;
  workCanvas.height = imagePreview.naturalHeight;
  patchCanvas.width = workCanvas.width;
  patchCanvas.height = workCanvas.height;
  workCtx.clearRect(0, 0, workCanvas.width, workCanvas.height);
  workCtx.drawImage(imagePreview, 0, 0);
  patchCtx.clearRect(0, 0, patchCanvas.width, patchCanvas.height);
  patchCtx.drawImage(workCanvas, 0, 0);
  drawPatchedRegion(workCtx, patchCanvas, rect);

  const sourceExtension = getFileExtension(state.file.name);
  const mimeType = getSafeImageMimeType(state.file);
  if (!mimeType) {
    throw new Error("当前图片仅支持 PNG、JPG、JPEG、WebP 原格式导出。");
  }
  const targetExtension = getImageExtensionForMimeType(mimeType, sourceExtension);

  const blob = await new Promise((resolve) => {
    workCanvas.toBlob(resolve, mimeType, getImageQuality(mimeType));
  });

  state.processedBlob = blob;
  state.outputName = `${getFileBaseName(state.file.name)}-clean${targetExtension}`;
  revokeObjectUrl("previewUrl");
  state.previewUrl = URL.createObjectURL(blob);
  imagePreview.src = state.previewUrl;
  await imagePreview.decode();
  downloadBtn.disabled = false;
  resetImageBtn.disabled = false;
  clearSelection();
  setStatus("图片处理完成", "预览图已更新为去除结果，可继续框选处理或导出。");
}

async function handleProcess() {
  if (!state.file || !state.selection) {
    return;
  }

  processBtn.disabled = true;
  downloadBtn.disabled = true;
  setStatus("处理中", "正在生成无水印图片...");

  try {
    await processImage();
  } catch (error) {
    setStatus("处理失败", error.message || "当前图片处理失败。");
  } finally {
    processBtn.disabled = false;
  }
}

function handleDownload() {
  if (!state.processedBlob) {
    return;
  }

  const url = URL.createObjectURL(state.processedBlob);
  const link = document.createElement("a");
  link.href = url;
  link.download = state.outputName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function handleResetImage() {
  if (!state.file || !state.originalUrl) {
    return;
  }

  revokeObjectUrl("previewUrl");
  imagePreview.src = state.originalUrl;
  resetSelection();
  setStatus("已恢复原图", "预览区已切回第一版上传图片，请重新框选需要处理的区域。");
}

fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (file) {
    loadFile(file);
  }
});

imagePreview.addEventListener("dragstart", (event) => {
  event.preventDefault();
});
imagePreview.addEventListener("pointerdown", beginSelection);
imagePreview.addEventListener("pointermove", moveSelection);
imagePreview.addEventListener("pointerup", endSelection);
imagePreview.addEventListener("pointercancel", endSelection);

resetSelectionBtn.addEventListener("click", () => {
  resetSelection();
  if (state.file) {
    setStatus("选区已重置", "请直接在图片上重新框选需要处理的区域。");
  }
});

resetImageBtn.addEventListener("click", handleResetImage);
processBtn.addEventListener("click", handleProcess);
downloadBtn.addEventListener("click", handleDownload);

["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
  document.addEventListener(eventName, (event) => {
    event.preventDefault();
  });
});

document.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer?.files || [];
  if (file) {
    loadFile(file);
  }
});

window.addEventListener("beforeunload", () => {
  revokeObjectUrl("originalUrl");
  revokeObjectUrl("previewUrl");
});

resetWorkspace();
