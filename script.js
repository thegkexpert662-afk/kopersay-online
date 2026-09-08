const fileInput = document.getElementById('fileInput');
const chooseBtn = document.getElementById('chooseBtn');
const dropZone = document.getElementById('dropZone');
const editor = document.getElementById('editor');
const previewImage = document.getElementById('previewImage');
const originalInfo = document.getElementById('originalInfo');
const widthInput = document.getElementById('widthInput');
const heightInput = document.getElementById('heightInput');
const lockRatio = document.getElementById('lockRatio');
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
    originalInfo.textContent = `Original: ${image.width} × ${image.height}px • ${(file.size / 1024 / 1024).toFixed(2)} MB`;
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

function resizeAndDownload() {
  if (!sourceImage || !currentFile) return;

  const width = Number(widthInput.value);
  const height = Number(heightInput.value);
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > 10000 || height > 10000) {
    setStatus('Enter width and height between 1 and 10,000 pixels.');
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    setStatus('Your browser could not prepare the image.');
    return;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(sourceImage, 0, 0, width, height);

  const outputType = currentFile.type === 'image/png'
    ? 'image/png'
    : currentFile.type === 'image/webp'
      ? 'image/webp'
      : 'image/jpeg';

  canvas.toBlob(blob => {
    if (!blob) {
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
    setStatus(`Done! Downloaded ${width} × ${height}px image.`);
  }, outputType, outputType === 'image/jpeg' ? 0.92 : undefined);
}

function resetTool() {
  if (previewImage.src.startsWith('blob:')) URL.revokeObjectURL(previewImage.src);
  currentFile = null;
  sourceImage = null;
  fileInput.value = '';
  editor.classList.add('hidden');
  dropZone.classList.remove('hidden');
  setStatus('');
}

function setStatus(message) {
  statusEl.textContent = message;
}
