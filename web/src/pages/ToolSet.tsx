import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Wrench,
  Code2,
  Layout,
  Settings,
  Search,
  ExternalLink,
  Github,
  BoxIcon,
  FilterIcon
} from 'lucide-react';

// 模拟 cn 工具函数 (memos 中常用 clsx + tailwind-merge)
const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

// 1. 定义数据类型
interface Tool {
  id: number;
  name: string;
  description: string;
  category: 'Development' | 'Design' | 'Utility';
  icon: React.ReactNode;
  url: string;
}

// 2. 模拟数据
const MOCK_TOOLS: Tool[] = [
  { id: 1, name: 'JSON Formatter', description: '格式化并校验 JSON 数据，支持多种视图。', category: 'Development', icon: <Code2 className="w-4 h-auto" />, url: '#' },
  { id: 2, name: 'SVG Optimizer', description: '压缩 SVG 文件大小，移除无用代码。', category: 'Design', icon: <Layout className="w-4 h-auto" />, url: '#' },
  { id: 3, name: 'Regex Tester', description: '在线测试正则表达式，实时匹配结果。', category: 'Development', icon: <Wrench className="w-4 h-auto" />, url: '#' },
  { id: 4, name: 'Unit Converter', description: '各种物理单位、长度、重量在线转换。', category: 'Utility', icon: <Settings className="w-4 h-auto" />, url: '#' },
  { id: 5, name: 'Color Palette', description: '生成并预览现代化的 UI 配色方案。', category: 'Design', icon: <Layout className="w-4 h-auto" />, url: '#' },
  { id: 6, name: 'Base64 Tool', description: '字符串与 Base64 编码的互转工具。', category: 'Development', icon: <Code2 className="w-4 h-auto" />, url: '#' },
  // 在 MOCK_TOOLS 列表中新增
  { id: 99, name: 'PDF Reader', description: '本地 PDF 上传与阅读器', category: 'Utility', icon: <BoxIcon className="w-4 h-auto" />, url: '/tools/pdf' },

];

const CATEGORIES = ['All', 'Development', 'Design', 'Utility'] as const;

const ToolsetPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<typeof CATEGORIES[number]>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();
  // 过滤逻辑
  const filteredTools = useMemo(() => {
    return MOCK_TOOLS.filter(tool => {
      const matchesTab = activeTab === 'All' || tool.category === activeTab;
      const matchesSearch = tool.name.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [activeTab, searchQuery]);

  return (
    <section className="@container w-full max-w-5xl min-h-full flex flex-col justify-start items-center mx-auto sm:pt-3 md:pt-6 pb-8">
      {/* 顶部简单的面包屑或移动端标题 (模仿 MobileHeader 占位) */}
      <div className="w-full px-4 sm:px-6 mb-4 flex justify-between items-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BoxIcon className="w-5 h-auto" />
          <span className="text-sm font-medium">Resources / Tools</span>
        </div>
        <a href="https://github.com" target="_blank" className="text-muted-foreground hover:text-foreground transition-colors">
          <Github className="w-5 h-auto" />
        </a>
      </div>

      <div className="w-full px-4 sm:px-6">
        {/* 主容器：模仿 memos 的 Inbox 卡片样式 */}
        <div className="w-full border border-border flex flex-col justify-start items-start rounded-xl bg-background text-foreground overflow-hidden">

          {/* Header 部分 */}
          <div className="w-full px-4 py-4 border-b border-border bg-card">
            <div className="flex flex-row justify-between items-center">
              <div className="flex flex-row items-center gap-2">
                <Wrench className="w-5 h-auto text-muted-foreground" />
                <h1 className="text-xl font-semibold text-foreground">工具集</h1>
                {filteredTools.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 text-xs font-medium rounded-full bg-primary/10 text-primary">
                    {filteredTools.length}
                  </span>
                )}
              </div>

              {/* 搜索框：整合进 Header */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="搜索..."
                  className="pl-9 pr-4 py-1.5 bg-muted/50 border border-border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary w-40 sm:w-64 transition-all"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Filter Tabs 部分：完全模仿 memos 的分段选择器样式 */}
          <div className="w-full px-4 py-2 border-b border-border bg-muted/30">
            <div className="flex flex-row gap-1 overflow-x-auto no-scrollbar">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium rounded-md transition-all flex items-center gap-1.5 whitespace-nowrap",
                    activeTab === cat
                      ? "bg-background text-foreground shadow-sm border border-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50 border border-transparent",
                  )}
                >
                  {cat === 'All' && <FilterIcon className="w-3.5 h-auto" />}
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* List/Grid 部分 */}
          <div className="w-full bg-card/50">
            {filteredTools.length === 0 ? (
              <div className="w-full py-20 flex flex-col justify-center items-center">
                {/* 这里的 Empty 是 memos 的组件，我们用图标代替 */}
                <BoxIcon className="w-12 h-12 text-muted-foreground/40 stroke-[1px]" />
                <p className="mt-4 text-sm text-muted-foreground">
                  没有找到相关的工具
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 divide-y divide-border">
                {filteredTools.map((tool) => (
                  <div
                    key={tool.id}
                    className="w-full p-4 flex flex-row justify-between items-start hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex flex-row items-start gap-3">
                      <div className="mt-1 p-2 rounded-lg bg-muted text-muted-foreground group-hover:bg-background group-hover:text-primary transition-all border border-transparent group-hover:border-border">
                        {tool.icon}
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{tool.name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded border border-border bg-muted text-muted-foreground uppercase tracking-wider">
                            {tool.category}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-1">
                          {tool.description}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (tool.url && tool.url.startsWith('/')) {
                          navigate(tool.url);
                        } else if (tool.url && tool.url !== '#') {
                          window.open(tool.url, '_blank');
                        } else {
                          // 占位：没有 url 的工具可以在这里处理
                          console.log('no url');
                        }
                      }}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-background rounded-lg transition-all border border-transparent hover:border-border"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ToolsetPage;