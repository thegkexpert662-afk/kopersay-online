const fileInput = document.getElementById('fileInput');
const chooseBtn = document.getElementById('chooseBtn');
const dropZone = document.getElementById('dropZone');
const editor = document.getElementById('editor');
const previewImage = document.getElementById('previewImage');
const originalInfo = document.getElementById('originalInfo');
const outputInfo = document.getElementById('outputInfo');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const lockRatio = document.getElementById('lockRatio');
const formatSelect = document.getElementById('formatSelect');
const qualityInput = document.getElementById('qualityInput');
const qualityValue = document.getElementById('qualityValue');
const targetMbInput = document.getElementById('targetMbInput');
const resizeBtn = document.getElementById('resizeBtn');
const resetBtn = document.getElementById('resetBtn');
const statusEl = document.getElementById('status');
const presetButtons = document.querySelectorAll('[data-width]');

let currentFile = null;
let sourceImage = null;
let aspectRatio = 1;

chooseBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => handleFile(fileInput.files?.[0]));

['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
});
['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, event => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
  });
});
dropZone.addEventListener('drop', event => handleFile(event.dataTransfer.files?.[0]));

widthInput.addEventListener('input', () => {
  if (!lockRatio.checked || !aspectRatio) return;
  const width = Number(widthInput.value);
  if (width > 0) heightInput.value = Math.max(1, Math.round(width / aspectRatio));
});

heightInput.addEventListener('input', () => {
  if (!lockRatio.checked || !aspectRatio) return;
  const height = Number(heightInput.value);
  if (height > 0) widthInput.value = Math.max(1, Math.round(height * aspectRatio));
});

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = `${qualityInput.value}%`;
});

formatSelect.addEventListener('change', () => {
  const isPng = formatSelect.value === 'image/png';
  qualityInput.disabled = isPng;
  targetMbInput.disabled = isPng;
  setStatus(isPng ? 'PNG is lossless. For a smaller file, choose JPG or WebP.' : '');
});

presetButtons.forEach(button => {
  button.addEventListener('click', () => {
    widthInput.value = button.dataset.width;
    heightInput.value = button.dataset.height;
  });
});

resizeBtn.addEventListener('click', resizeAndDownload);
resetBtn.addEventListener('click', resetTool);

function handleFile(file) {
  if (!file || !file.type.startsWith('image/')) {
    setStatus('Please choose a valid image file.');
    return;
  }

  currentFile = file;
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    sourceImage = image;
    aspectRatio = image.width / image.height;
    widthInput.value = image.width;
    heightInput.value = image.height;
    previewImage.src = url;
    originalInfo.textContent = `Original: ${image.width} × ${image.height}px • ${formatBytes(file.size)}`;
    outputInfo.textContent = '';
    dropZone.classList.add('hidden');
    editor.classList.remove('hidden');
    setStatus('');
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    setStatus('This image could not be opened.');
  };
  image.src = url;
}

async function resizeAndDownload() {
  if (!sourceImage || !currentFile) return;

  const width = Number(widthInput.value);
  const height = Number(heightInput.value);
  const outputType = formatSelect.value;
  const targetMb = Number(targetMbInput.value);

  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000) {
    setStatus('Enter width and height between 1 and 10,000 pixels.');
    return;
  }
  if (targetMbInput.value && (!Number.isFinite(targetMb) || targetMb <= 0 || targetMb > 50)) {
    setStatus('Maximum file size must be between 0.01 and 50 MB.');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: outputType !== 'image/jpeg' });
  if (!ctx) {
    setStatus('Your browser could not prepare the image.');
    return;
  }

  if (outputType === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImage, 0, 0, width, height);

  resizeBtn.disabled = true;
  setStatus('Preparing your compressed image...');

  let quality = Math.max(0.1, Math.min(1, Number(qualityInput.value) / 100));
  let blob = await canvasToBlob(canvas, outputType, quality);

  if (targetMbInput.value && outputType !== 'image/png') {
    const targetBytes = targetMb * 1024 * 1024;
    let low = 0.1;
    let high = quality;
    for (let i = 0; i < 7; i++) {
      if (blob.size <= targetBytes) break;
      high = quality;
      quality = (low + high) / 2;
      blob = await canvasToBlob(canvas, outputType, quality);
      if (blob.size > targetBytes) low = quality;
    }
  }

  if (!blob) {
    resizeBtn.disabled = false;
    setStatus('Could not create the resized image.');
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const extension = outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg';
  const baseName = currentFile.name.replace(/\.[^/.]+$/, '') || 'image';
  link.href = url;
  link.download = `${baseName}-${width}x${height}.${extension}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  const targetText = targetMbInput.value ? ` • target ${targetMb.toFixed(2)} MB` : '';
  outputInfo.textContent = `Output: ${width} × ${height}px • ${extension.toUpperCase()} • ${formatBytes(blob.size)}`;
  setStatus(`Done! ${formatBytes(blob.size)}${targetText}`);
  resizeBtn.disabled = false;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise(resolve => canvas.toBlob(resolve, type, type === 'image/png' ? undefined : quality));
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function resetTool() {
  if (previewImage.src.startsWith('blob:')) URL.revokeObjectURL(previewImage.src);
  currentFile = null;
  sourceImage = null;
  fileInput.value = '';
  targetMbInput.value = '';
  formatSelect.value = 'image/jpeg';
  qualityInput.disabled = false;
  targetMbInput.disabled = false;
  editor.classList.add('hidden');
  dropZone.classList.remove('hidden');
  outputInfo.textContent = '';
  setStatus('');
}

function setStatus(message) {
  statusEl.textContent = message;
}
