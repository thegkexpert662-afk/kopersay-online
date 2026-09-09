const { jsPDF } = window.jspdf;
const { PDFDocument } = window.PDFLib;
const $ = id => document.getElementById(id);

function setStatus(message, error = false){
  const el = $('pdfStatus');
  el.textContent = message || '';
  el.style.color = error ? '#c34b63' : '#6545ed';
}

function newPdf(size='a4', orientation='portrait'){
  return new jsPDF({orientation, unit:'pt', format:size});
}

function addWrappedText(doc, text, x, y, maxWidth, fontSize, lineHeight=1.35){
  doc.setFont('helvetica','normal');
  doc.setFontSize(Number(fontSize));
  const lines = doc.splitTextToSize(String(text || ''), maxWidth);
  const step = Number(fontSize) * lineHeight;
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginBottom = 50;
  for(const line of lines){
    if(y + step > pageHeight - marginBottom){ doc.addPage(); y = 55; }
    doc.text(line, x, y);
    y += step;
  }
  return y;
}

function download(doc, name){
  doc.save(name.replace(/[^a-z0-9._-]+/gi,'-').replace(/-+/g,'-'));
}

function downloadBytes(bytes, name){
  const blob = new Blob([bytes], {type:'application/pdf'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

document.querySelectorAll('.pdf-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.pdf-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.pdf-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    $(tab.dataset.tab).classList.add('active');
    setStatus('');
  });
});

$('createBtn').addEventListener('click', () => {
  const text = $('createText').value.trim();
  const title = $('createTitle').value.trim() || 'Kopersay PDF';
  if(!text){ setStatus('Please enter some content first.', true); return; }
  const doc = newPdf($('createSize').value);
  const margin = Number($('createMargin').value);
  const font = Number($('createFont').value);
  doc.setFont('helvetica','bold'); doc.setFontSize(font + 4); doc.text(title, margin, margin);
  addWrappedText(doc, text, margin, margin + font + 22, doc.internal.pageSize.getWidth() - margin * 2, font, 1.45);
  download(doc, title + '.pdf');
  setStatus('PDF created successfully.');
});

$('clearCreate').addEventListener('click', () => { $('createTitle').value=''; $('createText').value=''; setStatus(''); });

let selectedImages = [];
$('imageFiles').addEventListener('change', e => {
  selectedImages = Array.from(e.target.files || []);
  $('imageList').textContent = selectedImages.length ? selectedImages.map((f,i)=>`${i+1}. ${f.name}`).join(' • ') : 'No images selected.';
  setStatus('');
});
$('clearImages').addEventListener('click', () => { selectedImages=[]; $('imageFiles').value=''; $('imageList').textContent='No images selected.'; setStatus(''); });

function readDataUrl(file){ return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }
function loadImage(src){ return new Promise((resolve,reject)=>{ const img=new Image(); img.onload=()=>resolve(img); img.onerror=reject; img.src=src; }); }

$('imageBtn').addEventListener('click', async () => {
  if(!selectedImages.length){ setStatus('Please select at least one image.', true); return; }
  const size = $('imageSize').value;
  const orientation = $('imageOrientation').value;
  const fit = $('imageFit').value;
  const doc = newPdf(size, orientation);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 24;
  try {
    for(let i=0;i<selectedImages.length;i++){
      if(i) doc.addPage(size, orientation);
      const img = await loadImage(await readDataUrl(selectedImages[i]));
      const ratio = img.width / img.height;
      let w, h, x, y;
      if(fit === 'full'){
        w = pageW; h = pageW / ratio;
        if(h < pageH){ h=pageH; w=pageH*ratio; }
        x=(pageW-w)/2; y=(pageH-h)/2;
      }else{
        const maxW=pageW-margin*2, maxH=pageH-margin*2;
        w=maxW; h=w/ratio;
        if(h>maxH){h=maxH; w=h*ratio;}
        x=(pageW-w)/2; y=(pageH-h)/2;
      }
      let type='JPEG';
      if(selectedImages[i].type==='image/png') type='PNG';
      doc.addImage(img, type, x, y, w, h, undefined, 'FAST');
    }
    download(doc, 'kopersay-images-to-pdf.pdf');
    setStatus(`${selectedImages.length} image${selectedImages.length>1?'s':''} converted to PDF successfully.`);
  } catch(err){ setStatus('Could not process one of the selected images.', true); }
});

$('textBtn').addEventListener('click', () => {
  const text = $('textContent').value.trim();
  if(!text){ setStatus('Please enter some text first.', true); return; }
  const doc = newPdf($('textSize').value);
  const margin = 55;
  const font = Number($('textFont').value);
  doc.setFont('helvetica','normal');
  doc.setFontSize(font);
  addWrappedText(doc, text, margin, margin, doc.internal.pageSize.getWidth()-margin*2, font, Number($('textSpacing').value));
  download(doc, 'kopersay-text-to-pdf.pdf');
  setStatus('Text converted to PDF successfully.');
});

$('clearText').addEventListener('click', () => { $('textContent').value=''; setStatus(''); });

async function readPdfFile(inputId){
  const file = $(inputId).files?.[0];
  if(!file) throw new Error('Please select a PDF file.');
  return new Uint8Array(await file.arrayBuffer());
}

$('lockBtn').addEventListener('click', async () => {
  const password = $('lockPassword').value;
  if(!password){ setStatus('Please enter a password.', true); return; }
  try{
    setStatus('Locking PDF...');
    const bytes = await readPdfFile('lockFile');
    const pdf = await PDFDocument.load(bytes, {ignoreEncryption:true});
    if(typeof pdf.encrypt !== 'function') throw new Error('Password protection is not available in this browser library version.');
    pdf.encrypt({
      userPassword: password,
      ownerPassword: password,
      permissions: { printing:'highResolution', modifying:false, copying:false, annotating:false, fillingForms:false, contentAccessibility:false, documentAssembly:false }
    });
    const out = await pdf.save();
    downloadBytes(out, 'kopersay-locked.pdf');
    setStatus('PDF locked successfully. Use the same password to open it.');
  }catch(err){
    setStatus('Could not lock this PDF. Please use a valid, uncorrupted PDF and try again.', true);
  }
});

$('unlockBtn').addEventListener('click', async () => {
  const password = $('unlockPassword').value;
  if(!password){ setStatus('Please enter the PDF password.', true); return; }
  try{
    setStatus('Checking password and unlocking PDF...');
    const bytes = await readPdfFile('unlockFile');
    const pdf = await PDFDocument.load(bytes, {password});
    const out = await pdf.save();
    downloadBytes(out, 'kopersay-unlocked.pdf');
    setStatus('PDF unlocked successfully.');
  }catch(err){
    setStatus('Incorrect password or unsupported encrypted PDF.', true);
  }
});
