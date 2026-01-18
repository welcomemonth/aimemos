# Memos

<img align="right" height="96px" src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/logo-rounded.png" alt="Memos" />

一款开源的自托管笔记服务。你的想法、你的数据、由你掌控——无追踪、无广告、无订阅费用。

[![官网](https://img.shields.io/badge/🏠-usememos.com-blue?style=flat-square)](https://usememos.com)
[![在线演示](https://img.shields.io/badge/✨-体验演示-orange?style=flat-square)](https://demo.usememos.com/)
[![文档](https://img.shields.io/badge/📚-官方文档-green?style=flat-square)](https://usememos.com/docs)
[![Discord 社区](https://img.shields.io/badge/💬-Discord-5865f2?style=flat-square&logo=discord&logoColor=white)](https://discord.gg/tfPJa4UmAv)
[![Docker 下载量](https://img.shields.io/docker/pulls/neosmemo/memos?style=flat-square&logo=docker)](https://hub.docker.com/r/neosmemo/memos)

<img src="https://raw.githubusercontent.com/usememos/.github/refs/heads/main/assets/demo.png" alt="Memos 演示截图" height="512" />

### 💎 特邀赞助商

[**Warp** — 一款基于人工智能的终端，为速度与协作而生](https://go.warp.dev/memos)

<a href="https://go.warp.dev/memos" target="_blank" rel="noopener">
  <img src="https://raw.githubusercontent.com/warpdotdev/brand-assets/main/Github/Sponsor/Warp-Github-LG-02.png" alt="Warp - 一款基于人工智能的终端，为速度与协作而生" width="512" />
</a>

---

[**LambdaTest** - 跨浏览器测试云平台](https://www.lambdatest.com/?utm_source=memos&utm_medium=sponsor)
  
<a href="https://www.lambdatest.com/?utm_source=memos&utm_medium=sponsor" target="_blank" rel="noopener">
  <img src="https://www.lambdatest.com/blue-logo.png" alt="LambdaTest - 跨浏览器测试云平台" height="50" />
</a>

## 项目概览
Memos 是一款隐私优先的自托管知识库，可无缝用于个人笔记记录、团队维基搭建与知识管理。基于 Go 与 React 构建，在保证功能完整性与易用性的同时，实现了闪电般的响应速度。

**为什么选择 Memos 而非云服务？**

| 功能特性           | Memos                          | 云服务平台                    |
| ----------------- | ------------------------------ | ----------------------------- |
| **隐私安全**       | ✅ 自托管部署，无任何数据埋点 | ❌ 数据存储在第三方服务器      |
| **使用成本**       | ✅ 永久免费，遵循 MIT 开源协议 | ❌ 需支付订阅费用              |
| **响应性能**       | ✅ 秒级加载，无延迟困扰        | ⚠️ 依赖网络状况                |
| **数据所有权**     | ✅ 完全掌控，支持数据导出      | ❌ 存在供应商锁定风险          |
| **API 访问权限**   | ✅ 完整支持 REST 与 gRPC 接口  | ⚠️ 接口受限或需付费解锁        |
| **自定义自由度**   | ✅ 开源项目，可自由复刻修改    | ❌ 生态封闭，无法深度定制      |

## 核心功能
- **🔒 隐私优先的架构**
  - 部署在你的自有服务器上，无任何数据埋点
  - 完全拥有数据所有权，支持一键导出
  - 无追踪、无广告、无供应商锁定风险

- **📝 原生支持 Markdown**
  - 全面兼容 Markdown 语法
  - 采用纯文本格式存储数据，可轻松迁移至任意平台

- **⚡ 极速响应**
  - 基于 Go 后端与 React 前端开发
  - 针对不同规模的使用场景，均做了性能优化

- **🐳 部署简单**
  - 一行 Docker 命令即可完成安装
  - 支持 SQLite、MySQL、PostgreSQL 三种数据库

- **🔗 开发者友好**
  - 提供完整的 REST 与 gRPC 接口
  - 可轻松集成至现有工作流中

- **🎨 简洁美观的界面**
  - 设计简洁大方，支持深色模式
  - 自适应移动端布局，随时随地使用

## 快速开始
### Docker 部署（推荐）
```bash
docker run -d \
  --name memos \
  -p 5230:5230 \
  -v ~/.memos:/var/opt/memos \
  neosmemo/memos:stable
```
打开 `http://localhost:5230`，即可开始记录笔记！

### 体验在线演示
暂时不想部署？先试试我们的 [在线演示](https://demo.usememos.com/)！

### 其他安装方式
- **Docker Compose** - 推荐用于生产环境部署
- **预编译二进制包** - 提供 Linux、macOS、Windows 版本
- **Kubernetes** - 提供 Helm Chart 与部署清单
- **从源码构建** - 适用于开发与自定义场景

查看 [官方安装指南](https://usememos.com/docs/installation) 了解详细步骤。

## 贡献指南
我们欢迎任何形式的贡献！无论是修复 Bug、新增功能、完善文档，还是参与翻译工作——每一份贡献都至关重要。

**贡献方式：**
- 🐛 [提交 Bug 反馈](https://github.com/usememos/memos/issues/new?template=bug_report.md)
- 💡 [提出功能建议](https://github.com/usememos/memos/issues/new?template=feature_request.md)
- 🔧 [提交代码 Pull Request](https://github.com/usememos/memos/pulls)
- 📖 [完善项目文档](https://github.com/usememos/memos/tree/main/docs)
- 🌍 [参与多语言翻译](https://github.com/usememos/memos/tree/main/web/src/locales)

## 赞助我们
喜欢 Memos 这款工具？[在 GitHub 上赞助我们](https://github.com/sponsors/usememos)，助力项目持续发展！

## 星标历史
[![Star History Chart](https://api.star-history.com/svg?repos=usememos/memos&type=Date)](https://star-history.com/#usememos/memos&Date)

## 开源协议
Memos 是一款开源软件，遵循 [MIT 开源协议](LICENSE)。

## 隐私政策
隐私是 Memos 的核心设计原则。作为一款自托管应用，所有数据均存储在你的自有服务器上。我们不会进行任何数据埋点、追踪或收集行为。详情请查看 [隐私政策](https://usememos.com/privacy)。

---

**[官网](https://usememos.com)** • **[官方文档](https://usememos.com/docs)** • **[在线演示](https://demo.usememos.com/)** • **[Discord 社区](https://discord.gg/tfPJa4UmAv)** • **[X/Twitter](https://x.com/usememos)**

<a href="https://vercel.com/oss">
  <img alt="Vercel 开源项目计划" src="https://vercel.com/oss/program-badge.svg" />
</a>

---