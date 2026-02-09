import React, { useState, useEffect } from 'react';
import { Document, Page } from 'react-pdf';
import { 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  BookOpen, 
  Languages, 
  Loader2,
  PanelLeftClose, 
  PanelLeftOpen, 
  BookmarkPlus, 
  Bookmark, 
  Trash2,
  Upload, // 新增：上传图标
  ArrowLeft // 新增：返回图标
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// 引入 Worker (请确保路径正确)
import '../utils/pdf-worker'; 

// --- 类型定义 ---
interface BookmarkItem {
  page: number;
  label: string;
  timestamp: number;
}

// --- 工具函数 ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ---------------------------
// 组件：翻译气泡 (保持不变)
// ---------------------------
interface TranslatePopoverProps {
  text: string;
  position: { x: number; y: number } | null;
  onClose: () => void;
}

const TranslatePopover: React.FC<TranslatePopoverProps> = ({ text, position, onClose }) => {
  const [translation, setTranslation] = useState<string>('Translating...');

  useEffect(() => {
    if (!text) return;
    setTranslation('正在翻译...');
    const timer = setTimeout(() => {
      setTranslation(`[译] ${text.slice(0, 20)}... (此处接入真实API)`);
    }, 800);
    return () => clearTimeout(timer);
  }, [text]);

  if (!position) return null;

  return (
    <div 
      className="fixed z-50 w-64 p-3 bg-white rounded-lg shadow-xl border border-slate-200 animate-in fade-in zoom-in duration-200"
      style={{ top: position.y + 10, left: position.x }}
    >
      <div className="flex justify-between items-center mb-2">
        <span className="text-xs font-bold text-blue-600 flex items-center gap-1">
          <Languages size={14} /> 智能翻译
        </span>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xs">关闭</button>
      </div>
      <p className="text-sm text-slate-600 leading-relaxed border-b border-slate-100 pb-2 mb-2">"{text}"</p>
      <p className="text-sm font-medium text-slate-800">{translation}</p>
    </div>
  );
};

// ---------------------------
// 组件：首页 (文件选择器)
// ---------------------------
interface HomePageProps {
  onFileSelect: (file: File) => void;
}

const HomePage: React.FC<HomePageProps> = ({ onFileSelect }) => {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const selectedFile = files[0];
      if (selectedFile.type === 'application/pdf') {
        onFileSelect(selectedFile);
      } else {
        alert('请选择 PDF 文件');
      }
    }
  };

  return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center border border-slate-200">
        <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <BookOpen size={40} />
        </div>
        
        <h1 className="text-2xl font-bold text-slate-800 mb-2">PDF 阅读器</h1>
        <p className="text-slate-500 mb-8">请上传一个 PDF 文件开始阅读</p>
        
        <label className="group cursor-pointer flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 border-dashed rounded-lg hover:bg-slate-50 hover:border-blue-400 transition-all">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <Upload className="w-8 h-8 mb-3 text-slate-400 group-hover:text-blue-500 transition-colors" />
            <p className="mb-2 text-sm text-slate-500 group-hover:text-slate-700">
              <span className="font-semibold">点击上传</span> 或拖拽文件到此处
            </p>
            <p className="text-xs text-slate-400">仅支持 PDF 格式</p>
          </div>
          <input 
            type="file" 
            className="hidden" 
            accept="application/pdf"
            onChange={handleFileChange}
          />
        </label>
      </div>
    </div>
  );
};

// ---------------------------
// 组件：PDF 阅读器 (原 App 内容)
// ---------------------------
interface PdfReaderProps {
  file: File | string; // 接收 File 对象或 URL 字符串
  onBack: () => void;  // 返回首页的回调
}

const PdfReader: React.FC<PdfReaderProps> = ({ file, onBack }) => {
  // --- 状态管理 ---
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [scale, setScale] = useState<number>(0.6); 
  const [showSidebar, setShowSidebar] = useState<boolean>(true);
  const [selection, setSelection] = useState<{ text: string; x: number; y: number } | null>(null);
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'pages' | 'bookmarks'>('pages'); 
  const [isNavigating, setIsNavigating] = useState(false);

  // --- 初始化加载书签 ---
  useEffect(() => {
    // 这里的 key 可以根据文件名生成，实现不同文件不同书签 (可选优化)
    const saved = localStorage.getItem('pdf-bookmarks'); 
    if (saved) {
      try {
        setBookmarks(JSON.parse(saved));
      } catch (e) {
        console.error("读取书签失败", e);
      }
    }
  }, []);

  // --- 文档加载成功 ---
  function onDocumentLoadSuccess({ numPages }: { numPages: number }) {
    setNumPages(numPages);
    setPageNumber(1);
  }

  // --- 翻页 ---
  const changePage = (offset: number) => {
    setPageNumber(prev => Math.min(Math.max(1, prev + offset), numPages));
  };

  // 处理滚轮事件
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isNavigating || e.ctrlKey) return;

    const container = e.currentTarget;
    const { scrollTop, scrollHeight, clientHeight } = container;
    const isAtBottom = Math.abs(scrollHeight - clientHeight - scrollTop) < 2;
    const isAtTop = scrollTop < 2;

    if (e.deltaY > 0 && isAtBottom) {
      if (pageNumber < numPages) {
        setIsNavigating(true);
        changePage(1);
        setTimeout(() => setIsNavigating(false), 500); 
      }
    } else if (e.deltaY < 0 && isAtTop) {
      if (pageNumber > 1) {
        setIsNavigating(true);
        changePage(-1);
        setTimeout(() => setIsNavigating(false), 500);
      }
    }
  };

  // --- 书签功能 ---
  const handleAddBookmark = () => {
    if (bookmarks.some(b => b.page === pageNumber)) {
      alert("当前页已添加书签");
      return;
    }
    const newBookmark: BookmarkItem = {
      page: pageNumber,
      label: `第 ${pageNumber} 页`, 
      timestamp: Date.now()
    };
    const newList = [...bookmarks, newBookmark].sort((a, b) => a.page - b.page);
    setBookmarks(newList);
    localStorage.setItem('pdf-bookmarks', JSON.stringify(newList));
    setSidebarTab('bookmarks'); 
  };

  const handleRemoveBookmark = (page: number, e: React.MouseEvent) => {
    e.stopPropagation(); 
    const newList = bookmarks.filter(b => b.page !== page);
    setBookmarks(newList);
    localStorage.setItem('pdf-bookmarks', JSON.stringify(newList));
  };

  // --- 文本选中 ---
  const handleMouseUp = () => {
    const windowSelection = window.getSelection();
    if (windowSelection && windowSelection.toString().trim().length > 0) {
      const range = windowSelection.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelection({
        text: windowSelection.toString(),
        x: rect.left + (rect.width / 2),
        y: rect.bottom
      });
    } else {
      setSelection(null);
    }
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden font-sans">
      
      {/* --- 顶部工具栏 --- */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 shadow-sm z-20 shrink-0">
        
        {/* 左侧：Logo & 返回 & 侧边栏 */}
        <div className="flex items-center gap-2">
          {/* 新增：返回按钮 */}
          <button 
            onClick={onBack}
            className="text-slate-500 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-100 mr-2"
            title="返回首页"
          >
            <ArrowLeft size={20} />
          </button>

          <button 
            onClick={() => setShowSidebar(!showSidebar)}
            className="text-slate-500 hover:text-slate-800 transition-colors p-1 rounded-md hover:bg-slate-100"
            title={showSidebar ? "收起侧边栏" : "展开侧边栏"}
          >
            {showSidebar ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
          </button>
          
          <div className="font-bold text-slate-700 flex items-center gap-2 select-none">
            <BookOpen className="text-blue-600" size={20} />
            <span className="hidden sm:inline">PDF Reader</span>
          </div>
        </div>

        {/* 中间：翻页器 */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 shadow-inner">
          <button 
            onClick={() => changePage(-1)} disabled={pageNumber <= 1}
            className="p-1.5 hover:bg-white rounded-md disabled:opacity-30 transition-all text-slate-700 shadow-sm disabled:shadow-none"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-semibold w-20 text-center text-slate-700 select-none">
            {pageNumber} / {numPages || '--'}
          </span>
          <button 
            onClick={() => changePage(1)} disabled={pageNumber >= numPages}
            className="p-1.5 hover:bg-white rounded-md disabled:opacity-30 transition-all text-slate-700 shadow-sm disabled:shadow-none"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* 右侧：缩放 & 书签添加 */}
        <div className="flex items-center gap-3">
           <button 
            onClick={handleAddBookmark}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-600 px-2 py-1 rounded hover:bg-blue-50 transition-colors"
            title="添加当前页为书签"
          >
            <BookmarkPlus size={18} />
            <span className="hidden sm:inline">书签</span>
          </button>

          <div className="w-px h-5 bg-slate-300 mx-1" />

          <button onClick={() => setScale(s => Math.max(0.3, s - 0.1))} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ZoomOut size={18} />
          </button>
          <span className="text-xs font-medium text-slate-600 w-10 text-center select-none">{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(2.5, s + 0.1))} className="p-2 hover:bg-slate-100 rounded-full text-slate-600">
            <ZoomIn size={18} />
          </button>
        </div>
      </header>

      {/* --- 主体区域 --- */}
      <div className="flex flex-1 overflow-hidden relative">
        
        {/* 左侧侧边栏 */}
        <aside 
          className={cn(
            "bg-white border-r border-slate-200 flex flex-col transition-all duration-300 ease-in-out overflow-hidden relative z-10",
            showSidebar ? "w-64 opacity-100" : "w-0 opacity-0 border-r-0"
          )}
        >
          <div className="flex border-b border-slate-100">
            <button 
              onClick={() => setSidebarTab('pages')}
              className={cn("flex-1 py-3 text-xs font-bold text-center transition-colors", sidebarTab === 'pages' ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700")}
            >
              目录 / 缩略图
            </button>
            <button 
              onClick={() => setSidebarTab('bookmarks')}
              className={cn("flex-1 py-3 text-xs font-bold text-center transition-colors", sidebarTab === 'bookmarks' ? "text-blue-600 border-b-2 border-blue-600" : "text-slate-500 hover:text-slate-700")}
            >
              我的书签
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin scrollbar-thumb-slate-200">
            {sidebarTab === 'pages' ? (
              numPages > 0 ? (
                Array.from(new Array(numPages), (_, index) => {
                  const pNum = index + 1;
                  return (
                    <button
                      key={`page_${pNum}`}
                      onClick={() => setPageNumber(pNum)}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm rounded-md transition-colors flex justify-between group",
                        pageNumber === pNum ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-slate-50 text-slate-600"
                      )}
                    >
                      <span>第 {pNum} 页</span>
                      {pageNumber === pNum && <div className="w-2 h-2 rounded-full bg-blue-500 my-auto" />}
                    </button>
                  );
                })
              ) : <div className="p-4 text-center text-slate-400 text-sm">加载中...</div>
            ) : (
              bookmarks.length > 0 ? (
                bookmarks.map((b) => (
                  <div
                    key={`bm_${b.page}`}
                    onClick={() => setPageNumber(b.page)}
                    className={cn(
                      "group w-full text-left px-3 py-3 text-sm rounded-md transition-colors border border-transparent hover:border-slate-200 hover:bg-slate-50 cursor-pointer flex justify-between items-center",
                      pageNumber === b.page ? "bg-blue-50 border-blue-100" : ""
                    )}
                  >
                    <div className="flex items-center gap-2 overflow-hidden">
                      <Bookmark size={14} className={pageNumber === b.page ? "text-blue-500 fill-blue-500" : "text-slate-400"} />
                      <span className={cn("truncate", pageNumber === b.page ? "text-blue-700 font-medium" : "text-slate-600")}>
                        {b.label}
                      </span>
                    </div>
                    
                    <button 
                      onClick={(e) => handleRemoveBookmark(b.page, e)}
                      className="text-slate-300 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      title="删除书签"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
                  <Bookmark size={32} className="opacity-20" />
                  <span className="text-xs">暂无书签</span>
                  <button onClick={handleAddBookmark} className="text-xs text-blue-500 hover:underline">添加当前页</button>
                </div>
              )
            )}
          </div>
        </aside>

        {/* PDF 渲染区域 */}
        <main 
          className="flex-1 bg-slate-100 overflow-auto relative flex justify-center p-4 sm:p-8 no-scrollbar"
          onMouseUp={handleMouseUp}
          onWheel={handleWheel}
        >
          <div className="relative shadow-xl transition-transform duration-200 ease-out origin-top">
            <Document
              file={file} // 使用传入的 file 属性
              onLoadSuccess={onDocumentLoadSuccess}
              loading={
                <div className="flex items-center gap-2 text-slate-500 bg-white p-4 rounded shadow">
                  <Loader2 className="animate-spin" /> 加载文档中...
                </div>
              }
              error={<div className="text-red-500 bg-white p-4 rounded shadow">加载 PDF 失败</div>}
            >
              <Page 
                pageNumber={pageNumber} 
                scale={scale} 
                renderTextLayer={true} 
                renderAnnotationLayer={true}
                className="bg-white"
                loading={<div style={{ width: 600 * scale, height: 800 * scale }} className="bg-white animate-pulse" />}
              />
            </Document>
          </div>

          {/* 底部悬浮翻页栏 */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 px-6 py-3 bg-white/90 backdrop-blur-sm shadow-2xl rounded-full border border-slate-200 transition-all hover:scale-105 hover:bg-white">
            <button 
              onClick={() => changePage(-1)} 
              disabled={pageNumber <= 1}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="上一页"
            >
              <ChevronLeft size={24} />
            </button>
            
            <div className="flex flex-col items-center leading-none px-2 select-none">
              <span className="text-lg font-bold text-slate-800">{pageNumber}</span>
              <span className="text-[10px] text-slate-400 uppercase font-medium">of {numPages}</span>
            </div>

            <button 
              onClick={() => changePage(1)} 
              disabled={pageNumber >= numPages}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="下一页"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </main>
        
        {/* 翻译弹窗 */}
        {selection && (
          <TranslatePopover text={selection.text} position={selection} onClose={() => setSelection(null)} />
        )}
      </div>
    </div>
  );
};

// ---------------------------
// 主程序入口
// ---------------------------
const PdfReaderApp = () => {
  // 状态：当前打开的 PDF 文件
  // file 为 null 时显示 HomePage，不为 null 时显示 PdfReader
  const [selectedFile, setSelectedFile] = useState<File | string | null>(null);

  // 如果你想保留一个默认的演示文件，可以取消下面的注释：
  // import tcpdf from './assets/tcp.pdf';
  // useEffect(() => setSelectedFile(tcpdf), []);

  return (
    <>
      {selectedFile ? (
        <PdfReader 
          file={selectedFile} 
          onBack={() => setSelectedFile(null)} 
        />
      ) : (
        <HomePage 
          onFileSelect={(file) => setSelectedFile(file)} 
        />
      )}
    </>
  );
};

export default PdfReaderApp;