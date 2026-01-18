# Memos 代码库 AI 代理指南
本文档为使用 Memos 代码库的 AI 代理提供全面指导，内容涵盖架构设计、工作流程、编码规范及核心设计模式。

## 项目概述
Memos 是一款**自托管的知识管理平台**，技术栈如下：
- **后端**：Go 1.25 + gRPC + Connect RPC
- **前端**：React 18.3 + TypeScript + Vite 7
- **数据库**：SQLite（默认）、MySQL、PostgreSQL
- **协议**：Protocol Buffers（v2），通过 buf 工具实现代码生成
- **API 层**：双协议架构 —— Connect RPC（面向浏览器） + gRPC-Gateway（面向 REST 接口）

## 架构设计

### 后端架构
```
cmd/memos/              # 程序入口目录
└── main.go             # Cobra 命令行工具、配置初始化、服务启动入口

server/
├── server.go           # Echo HTTP 服务、健康检查接口、后台任务执行器
├── auth/               # 认证模块（JWT、PAT、会话管理）
├── router/
│   ├── api/v1/        # gRPC 服务实现层
│   │   ├── v1.go      # 服务注册、网关与 Connect 协议配置
│   │   ├── acl_config.go   # 公开接口白名单配置
│   │   ├── connect_services.go  # Connect RPC 处理器
│   │   ├── connect_interceptors.go # 拦截器（认证、日志、异常恢复）
│   │   └── *_service.go    # 业务服务实现（备忘录、用户等）
│   ├── frontend/       # 静态文件服务（单页应用）
│   ├── fileserver/     # 媒体文件原生 HTTP 服务
│   └── rss/           # RSS 订阅源生成器
└── runner/
    ├── memopayload/    # 备忘录内容处理器（标签、链接、任务解析）
    └── s3presign/     # S3 预签名 URL 管理模块

store/                  # 数据层（含缓存功能）
├── driver.go           # 数据库驱动接口（定义数据库操作）
├── store.go           # 带缓存的存储层封装
├── cache.go           # 内存缓存（实例配置、用户信息）
├── migrator.go        # 数据库迁移工具
├── db/
│   ├── db.go          # 驱动工厂
│   ├── sqlite/        # SQLite 驱动实现
│   ├── mysql/         # MySQL 驱动实现
│   └── postgres/      # PostgreSQL 驱动实现
└── migration/         # SQL 迁移脚本（嵌入式资源）

proto/                  # Protocol Buffer 定义目录
├── api/v1/           # API v1 版本服务定义
└── gen/               # 自动生成的 Go 与 TypeScript 代码
```

### 前端架构
```
web/
├── src/
│   ├── components/     # React 公共组件
│   ├── contexts/       # React Context（客户端状态管理）
│   │   ├── AuthContext.tsx      # 当前用户信息、认证状态
│   │   ├── ViewContext.tsx      # 布局模式、排序规则
│   │   └── MemoFilterContext.tsx # 筛选条件、快捷操作
│   ├── hooks/          # React Query 钩子（服务端状态管理）
│   │   ├── useMemoQueries.ts    # 备忘录增删改查、分页
│   │   ├── useUserQueries.ts    # 用户相关操作
│   │   ├── useAttachmentQueries.ts # 附件相关操作
│   │   └── ...
│   ├── lib/            # 工具函数库
│   │   ├── query-client.ts  # React Query v5 客户端配置
│   │   └── connect.ts       # Connect RPC 客户端配置
│   ├── pages/          # 页面组件
│   └── types/proto/    # 从 .proto 文件生成的 TypeScript 类型
├── package.json        # 项目依赖
└── vite.config.mts     # Vite 配置（含开发环境代理）

plugin/                 # 后端插件目录
├── scheduler/         # 定时任务（Cron 调度）
├── email/            # 邮件发送服务
├── filter/           # CEL 表达式筛选器
├── webhook/          # Webhook 消息分发
├── markdown/         # Markdown 解析与渲染
├── httpgetter/        # HTTP 内容抓取（元数据、图片）
└── storage/s3/       # S3 存储后端
```

## 核心架构模式

### 1. API 层：双协议架构

#### Connect RPC（浏览器客户端）
- 协议地址：`connectrpc.com/connect`
- 基础路径：`/memos.api.v1.*`
- 拦截器链：元数据处理 → 日志记录 → 异常恢复 → 身份认证
- 为 React 前端返回类型安全的响应数据
- 参考代码：`server/router/api/v1/connect_interceptors.go:177-227`

#### gRPC-Gateway（REST API）
- 协议类型：标准 HTTP/JSON
- 基础路径：`/api/v1/*`
- 复用 Connect RPC 的服务实现逻辑
- 适用于外部工具、命令行客户端
- 参考代码：`server/router/api/v1/v1.go:52-96`

#### 认证机制
- **JWT 访问令牌（V2）**：无状态，有效期 15 分钟，通过 `AuthenticateByAccessTokenV2` 方法验证
- **个人访问令牌（PAT）**：有状态，长期有效，需与数据库中存储的令牌校验
- 两种令牌均使用 `Authorization: Bearer <token>` 请求头传递
- 参考代码：`server/auth/authenticator.go:17-166`

### 2. 存储层：接口模式
所有数据库操作均通过 `Driver` 接口完成，接口定义如下：
```go
type Driver interface {
    GetDB() *sql.DB
    Close() error

    IsInitialized(ctx context.Context) (bool, error)

    CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
    ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
    UpdateMemo(ctx context.Context, update *UpdateMemo) error
    DeleteMemo(ctx context.Context, delete *DeleteMemo) error

    // ... 其他资源的同名方法
}
```

#### 三种驱动实现
- `store/db/sqlite/` - SQLite 驱动（基于 modernc.org/sqlite）
- `store/db/mysql/` - MySQL 驱动（基于 go-sql-driver/mysql）
- `store/db/postgres/` - PostgreSQL 驱动（基于 lib/pq）

#### 缓存策略
- 存储层封装维护以下内存缓存：
  - 实例配置（`instanceSettingCache`）
  - 用户信息（`userCache`）
  - 用户配置（`userSettingCache`）
- 缓存配置：默认过期时间 10 分钟，清理间隔 5 分钟，最大缓存条目 1000 条
- 参考代码：`store/store.go:10-57`

### 3. 前端状态管理

#### React Query v5（服务端状态）
- 所有 API 调用均通过 `web/src/hooks/` 目录下的自定义钩子实现
- 查询键按资源类型分类：`memoKeys`、`userKeys`、`attachmentKeys`
- 默认配置：数据过期时间 30 秒，缓存回收时间 5 分钟
- 支持窗口聚焦、网络重连时自动重新请求数据
- 参考代码：`web/src/lib/query-client.ts`

#### React Context（客户端状态）
- `AuthContext`：当前用户信息、认证初始化、登出逻辑
- `ViewContext`：布局模式（列表/瀑布流）、排序规则
- `MemoFilterContext`：激活的筛选条件、快捷操作选择、URL 参数同步

### 4. 数据库迁移系统

#### 迁移流程
1. `preMigrate`：检查数据库是否存在，不存在则执行 `LATEST.sql` 初始化
2. `checkMinimumUpgradeVersion`：拒绝低于 0.22 版本的数据库升级
3. `applyMigrations`：在单个事务中执行增量迁移脚本
4. 演示模式：自动填充演示数据

#### 架构版本控制
- 版本号存储在 `system_setting` 表中
- 版本格式：`主版本号.次版本号.补丁号`
- 迁移脚本路径：`store/migration/{驱动名}/{版本号}/NN__描述信息.sql`
- 参考代码：`store/migrator.go:21-414`

### 5. Protocol Buffer 代码生成

#### 定义文件位置
协议定义文件路径：`proto/api/v1/*.proto`

#### 代码重新生成命令
```bash
cd proto && buf generate
```

#### 生成产物
- Go 代码：`proto/gen/api/v1/`（供后端服务使用）
- TypeScript 代码：`web/src/types/proto/api/v1/`（供前端使用）

#### 代码校验
- 校验配置文件：`proto/buf.yaml`
- 校验规则：基础语法检查、文件级兼容性检查

## 开发命令

### 后端开发命令
```bash
# 启动开发环境服务
go run ./cmd/memos --mode dev --port 8081

# 运行所有测试用例
go test ./...

# 运行指定包的测试用例
go test ./store/...
go test ./server/router/api/v1/test/...

# 代码静态检查（使用 golangci-lint）
golangci-lint run

# 格式化导入语句
goimports -w .

# 使用 MySQL/PostgreSQL 启动服务
DRIVER=mysql go run ./cmd/memos
DRIVER=postgres go run ./cmd/memos
```

### 前端开发命令
```bash
# 安装依赖
cd web && pnpm install

# 启动开发服务器（API 请求代理到 localhost:8081）
pnpm dev

# 类型检查
pnpm lint

# 自动修复 lint 问题
pnpm lint:fix

# 代码格式化
pnpm format

# 生产环境构建
pnpm build

# 构建产物并复制到后端目录
pnpm release
```

### Protocol Buffer 相关命令
```bash
# 从 .proto 文件重新生成 Go 和 TypeScript 代码
cd proto && buf generate

# 校验 proto 文件语法
cd proto && buf lint

# 检查兼容性变更
cd proto && buf breaking --against .git#main
```

## 核心工作流程

### 新增 API 接口
1. **在 Protocol Buffer 中定义接口**
   - 编辑 `proto/api/v1/*_service.proto` 文件
   - 添加请求/响应消息结构
   - 在服务中声明 RPC 方法

2. **重新生成代码**
   ```bash
   cd proto && buf generate
   ```

3. **后端实现服务逻辑**
   - 在 `server/router/api/v1/*_service.go` 中添加方法
   - 遵循现有代码模式：获取用户信息 → 参数校验 → 调用存储层
   - （可选）在 `server/router/api/v1/connect_services.go` 中添加 Connect 协议封装（复用同一套实现逻辑）

4. **若为公开接口**
   - 将接口添加到 `server/router/api/v1/acl_config.go:11-34` 的白名单中

5. **创建前端钩子（如需）**
   - 在 `web/src/hooks/use*Queries.ts` 中添加查询/变更钩子
   - 使用已有的查询键工厂函数

### 数据库架构变更
1. **创建迁移脚本**
   ```
   store/migration/sqlite/0.28/1__add_new_column.sql
   store/migration/mysql/0.28/1__add_new_column.sql
   store/migration/postgres/0.28/1__add_new_column.sql
   ```

2. **更新 LATEST.sql 文件**
   - 将变更内容同步到 `store/migration/{驱动名}/LATEST.sql`

3. **更新存储层接口（新增表/模型时）**
   - 在 `store/driver.go:8-71` 中添加对应方法
   - 在 `store/db/{驱动名}/*.go` 中实现该方法

4. **测试迁移逻辑**
   - 执行 `go test ./store/test/...` 验证迁移正确性

### 新增前端页面
1. **创建页面组件**
   - 在 `web/src/pages/NewPage.tsx` 中编写组件
   - 使用已有的数据请求钩子

2. **添加路由配置**
   - 编辑 `web/src/App.tsx`（或对应的路由配置文件）

3. **使用 React Query 获取数据**
   ```typescript
   import { useMemos } from "@/hooks/useMemoQueries";
   const { data, isLoading } = useMemos({ filter: "..." });
   ```

4. **使用 Context 管理客户端状态**
   ```typescript
   import { useView } from "@/contexts/ViewContext";
   const { layout, toggleSortOrder } = useView();
   ```

## 测试

### 后端测试
#### 测试代码模式
```go
func TestMemoCreation(t *testing.T) {
    ctx := context.Background()
    store := test.NewTestingStore(ctx, t)

    // 创建测试用户
    user, _ := createTestUser(ctx, store, t)

    // 执行测试操作
    memo, err := store.CreateMemo(ctx, &store.Memo{
        CreatorID: user.ID,
        Content:  "Test memo",
        // ...
    })
    require.NoError(t, err)
    assert.NotNil(t, memo)
}
```

#### 测试工具函数
- `store/test/store.go:22-35` - `NewTestingStore()`：创建独立的测试数据库
- `store/test/store.go:37-77` - `resetTestingDB()`：清空测试表数据
- 测试数据库类型由 `DRIVER` 环境变量决定（默认：sqlite）

#### 运行测试命令
```bash
# 运行所有测试
go test ./...

# 运行指定包的测试
go test ./store/...
go test ./server/router/api/v1/test/...

# 生成测试覆盖率报告
go test -cover ./...
```

### 前端测试
#### TypeScript 类型检查
```bash
cd web && pnpm lint
```

#### 自动化测试说明
- 前端目前依赖 TypeScript 类型检查和手动功能验证
- 开发模式下可通过左下角的 React Query DevTools 调试

## 编码规范

### Go 语言规范
#### 错误处理
- 使用 `github.com/pkg/errors` 包包装错误：`errors.Wrap(err, "上下文描述")`
- 返回结构化 gRPC 错误：`status.Errorf(codes.NotFound, "错误消息")`

#### 命名规范
- 包名：小写、单单词（如 `store`、`server`）
- 接口名：名词形式（如 `Driver`、`Store`、`Service`）
- 方法名：导出方法使用大驼峰，内部方法使用小驼峰

#### 注释规范
- 所有导出函数必须编写注释（由 godot 工具强制检查）
- 单行注释使用 `//`，多行注释使用 `/* */`

#### 导入规范
- 导入分组：标准库 → 第三方库 → 本地库
- 每组内按字母顺序排序
- 使用 `goimports -w .` 自动格式化

### TypeScript/React 规范
#### 组件开发
- 使用函数式组件 + 钩子
- 性能优化使用 `useMemo`、`useCallback`
- 组件属性定义使用接口：`interface Props { ... }`

#### 状态管理
- 服务端状态：使用 React Query 钩子
- 客户端状态：使用 React Context
- 服务端数据避免直接使用 `useState` 管理

#### 样式规范
- 使用 Tailwind CSS v4（通过 `@tailwindcss/vite` 插件）
- 条件样式使用 `clsx` 和 `tailwind-merge` 工具

#### 导入规范
- 使用 `@/` 作为绝对导入别名
- 导入分组：React → 第三方库 → 本地库
- 通过 Biome 工具自动整理导入顺序

## 重要文件参考

### 后端入口文件
| 文件路径 | 用途 |
|------|---------|
| `cmd/memos/main.go` | 服务入口、命令行工具配置 |
| `server/server.go` | Echo 服务初始化、后台任务启动 |
| `store/store.go` | 带缓存的存储层封装 |
| `store/driver.go` | 数据库驱动接口定义 |

### API 层核心文件
| 文件路径 | 用途 |
|------|---------|
| `server/router/api/v1/v1.go` | 服务注册、网关配置 |
| `server/router/api/v1/acl_config.go` | 公开接口白名单 |
| `server/router/api/v1/connect_interceptors.go` | Connect 协议拦截器 |
| `server/auth/authenticator.go` | 认证核心逻辑 |

### 前端核心文件
| 文件路径 | 用途 |
|------|---------|
| `web/src/lib/query-client.ts` | React Query 客户端配置 |
| `web/src/contexts/AuthContext.tsx` | 用户认证状态管理 |
| `web/src/contexts/ViewContext.tsx` | UI 偏好设置管理 |
| `web/src/contexts/MemoFilterContext.tsx` | 筛选状态管理 |
| `web/src/hooks/useMemoQueries.ts` | 备忘录查询/变更钩子 |

### 数据层核心文件
| 文件路径 | 用途 |
|------|---------|
| `store/memo.go` | 备忘录模型定义、存储层方法 |
| `store/user.go` | 用户模型定义 |
| `store/attachment.go` | 附件模型定义 |
| `store/migrator.go` | 数据库迁移逻辑 |
| `store/db/db.go` | 驱动工厂 |
| `store/db/sqlite/sqlite.go` | SQLite 驱动实现 |

## 配置说明

### 后端环境变量
| 变量名 | 默认值 | 描述 |
|----------|----------|-------------|
| `MEMOS_MODE` | `dev` | 运行模式：`dev`（开发）、`prod`（生产）、`demo`（演示） |
| `MEMOS_PORT` | `8081` | HTTP 服务端口 |
| `MEMOS_ADDR` | 空字符串 | 绑定地址（空值表示监听所有地址） |
| `MEMOS_DATA` | `~/.memos` | 数据存储目录 |
| `MEMOS_DRIVER` | `sqlite` | 数据库驱动：`sqlite`、`mysql`、`postgres` |
| `MEMOS_DSN` | 空字符串 | 数据库连接字符串 |
| `MEMOS_INSTANCE_URL` | 空字符串 | 实例基础 URL |

### 前端环境变量
| 变量名 | 默认值 | 描述 |
|----------|----------|-------------|
| `DEV_PROXY_SERVER` | `http://localhost:8081` | 开发环境 API 代理目标地址 |

## 持续集成/持续部署（CI/CD）

### GitHub 工作流
#### 后端测试（`.github/workflows/backend-tests.yml`）
- 触发条件：`go.mod`、`go.sum`、`**.go` 文件变更
- 执行步骤：验证 `go mod tidy`、golangci-lint 检查、运行所有测试

#### 前端测试（`.github/workflows/frontend-tests.yml`）
- 触发条件：`web/**` 目录文件变更
- 执行步骤：pnpm 安装依赖、代码 lint 检查、生产环境构建

#### 协议文件校验（`.github/workflows/proto-linter.yml`）
- 触发条件：`.proto` 文件变更
- 执行步骤：buf lint 语法检查、buf breaking 兼容性检查

### 代码检查配置
#### Go 语言（`.golangci.yaml`）
- 启用的检查器：revive、govet、staticcheck、misspell、gocritic 等
- 格式化工具：goimports
- 禁用函数：`fmt.Errorf`、`ioutil.ReadDir`

#### TypeScript（`web/biome.json`）
- 检查工具：Biome（替代 ESLint）
- 格式化工具：Biome（替代 Prettier）
- 代码行宽：140 字符
- 强制使用分号

## 常见问题排查

### API 问题调试
1. 查看 Connect 拦截器日志：`server/router/api/v1/connect_interceptors.go:79-105`
2. 若为公开接口，确认已添加到 `acl_config.go` 白名单
3. 通过 `auth/authenticator.go:133-165` 调试认证逻辑
4. 使用 curl 测试接口：`curl -H "Authorization: Bearer <token>" http://localhost:8081/api/v1/...`

### 前端状态调试
1. 打开开发模式下左下角的 React Query DevTools
2. 检查查询缓存、变更记录、重新请求行为
3. 通过 React DevTools 查看 Context 状态
4. 检查 `MemoFilterContext` 中的筛选状态

### 多数据库测试
```bash
# SQLite（默认）
DRIVER=sqlite go test ./...

# MySQL（需提前启动 MySQL 服务）
DRIVER=mysql DSN="user:pass@tcp(localhost:3306)/memos" go test ./...

# PostgreSQL（需提前启动 PostgreSQL 服务）
DRIVER=postgres DSN="postgres://user:pass@localhost:5432/memos" go test ./...
```

## 插件系统
后端支持通过 `plugin/` 目录扩展功能，各插件说明如下：

| 插件 | 用途 |
|--------|----------|
| `scheduler` | 基于 Cron 的定时任务调度 |
| `email` | SMTP 邮件发送服务 |
| `filter` | CEL 表达式筛选功能 |
| `webhook` | HTTP Webhook 消息分发 |
| `markdown` | Markdown 解析（基于 goldmark） |
| `httpgetter` | HTTP 内容抓取工具 |
| `storage/s3` | 兼容 S3 协议的存储后端 |

每个插件目录下均包含 README 文件，提供使用示例。

## 性能优化建议

### 后端优化
- 数据库查询使用分页（`limit`、`offset`）减少数据传输
- 内存缓存降低高频访问数据的数据库查询次数
- SQLite 启用 WAL 日志模式，减少锁竞争
- 缩略图生成限制并发数为 3，避免资源耗尽

### 前端优化
- React Query 减少重复 API 请求
- 大数据列表使用无限滚动分页
- 代码分割：`utils-vendor`、`mermaid-vendor`、`leaflet-vendor`
- 大型组件使用懒加载

## 安全注意事项
- JWT 密钥需严格保密（`MEMOS_MODE=prod` 模式下会自动生成随机密钥）
- 个人访问令牌（PAT）在数据库中以 SHA-256 哈希形式存储
- 通过 SameSite Cookie 防御 CSRF 攻击
- 生产环境需配置 CORS 允许的源地址（默认允许所有源）
- 所有输入数据在服务层进行校验
- 通过参数化查询防止 SQL 注入攻击

---

我可以帮你整理这份文档的**核心架构流程图**，方便你快速梳理 Memos 的代码结构，需要吗？