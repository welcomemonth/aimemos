import { pdfjs } from 'react-pdf';

// 设置 worker，必须匹配版本
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;