// Browser-side PDF text extraction for bank e-Statements. Loaded only when a PDF is picked.
import type { PdfText } from "./engine/read.ts";

export async function pdfText(data: ArrayBuffer): Promise<PdfText[][]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const doc = await pdfjs.getDocument({ data }).promise;
  const pages: PdfText[][] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const { items } = await (await doc.getPage(p)).getTextContent();
    pages.push(items.flatMap((i) => ("str" in i ? [{ str: i.str, x: i.transform[4], y: i.transform[5] }] : [])));
  }
  return pages;
}
