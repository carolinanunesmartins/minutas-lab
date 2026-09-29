const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export function saveDocx(bytes: ArrayBuffer, filename: string): void {
  const blob = new Blob([bytes], { type: DOCX_MIME });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
