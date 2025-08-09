// pdfUtils.ts
// Utility for extracting text from PDF files using pdfjs-dist

import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

export async function extractPdfText(file: File): Promise<string> {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let text = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            // Join items with a space for natural flow, double newline between pages
            text += content.items.map((item: any) => (item.str || '')).join(' ') + '\n\n';
        }
        if (!text.trim()) {
            return '[No extractable text found in this PDF.]';
        }
        return text;
    } catch (err) {
        return `[Error extracting PDF text: ${err instanceof Error ? err.message : String(err)}]`;
    }
}

export function sanitizeText(text: string): string {
    // Remove non-standard/unrenderable Unicode characters
    let cleaned = text
        .replace(/[\u2022\u2023\u25E6\u2043\u2219\u25AA\u25AB\u25A0\u25A1\u25B2\u25BC\u25C6\u25C7\u25CB\u25CF\u25D8\u25D9\u25E2\u25E3\u25E4\u25E5\u2605\u2606\u2660\u2661\u2662\u2663\u2665\u2666\u2667\u2668\u2670\u2671\u2709\u2764\u2794\u2B50\u2B55\uFFFD\u2028\u2029\u200B\u200C\u200D\uFEFF\u00A0\u202F\u205F\u3000\u2000-\u200F\u2010-\u201F\u2020-\u2027\u2030-\u203F\u2040-\u204F\u2050-\u205F\u2060-\u206F\uFFF0-\uFFFF]/g, '');
    // Remove all ASCII control characters except \n and \t
    cleaned = cleaned.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
    // Only allow printable ASCII, newline, and tab
    cleaned = cleaned.replace(/[^\x20-\x7E\n\t]/g, '');
    // Collapse multiple spaces into one
    cleaned = cleaned.replace(/ {2,}/g, ' ');
    // Collapse 3+ newlines into double newline
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
    // Remove spaces around newlines
    cleaned = cleaned.replace(/ *\n */g, '\n');
    // Trim leading/trailing whitespace
    cleaned = cleaned.trim();
    return cleaned;
}
