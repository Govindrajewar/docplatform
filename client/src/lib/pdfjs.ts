import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
// Vite's `?url` suffix returns the built asset's served URL instead of importing its contents.
import workerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

GlobalWorkerOptions.workerSrc = workerSrc;

export { getDocument };
