# AI 智能体 Memos 代码库指南

本文档为与 Memos 代码库交互的 AI 智能体（AI Agents）提供全面指导。内容涵盖架构、工作流、代码规范及关键设计模式。

## 项目概览

Memos 是一个自托管的知识管理平台，其构建技术栈如下：
- **后端：** Go 1.25，采用 gRPC + Connect RPC
- **前端：** React 18.3 + TypeScript + Vite 7
- **数据库：** SQLite（默认）、MySQL、PostgreSQL
- **协议：** Protocol Buffers (v2)，使用 buf 进行代码生成
- **API 层：** 双协议支持 —— Connect RPC（浏览器端）+ gRPC-Gateway（REST 风格）

## 架构

### 后端架构

```
cmd/memos/              # 入口点
└── main.go             # Cobra CLI 命令行、配置文件设置、服务器初始化

server/
├── server.go           # Echo HTTP 服务器、健康检查 (healthz)、后台运行器 (runners)
├── auth/               # 认证模块 (JWT, PAT, 会话 session)
├── router/
│   ├── api/v1/        # gRPC 服务实现
│   │   ├── v1.go      # 服务注册、Gateway 网关及 Connect 设置
│   │   ├── acl_config.go   # 公共端点白名单 (ACL)
│   │   ├── connect_services.go  # Connect RPC 处理器
│   │   ├── connect_interceptors.go # 拦截器：认证、日志、恢复 (Recovery)
│   │   └── *_service.go    # 各个独立服务 (memo, user 等)
│   ├── frontend/       # 静态文件服务 (SPA 单页应用)
│   ├── fileserver/     # 用于媒体文件的原生 HTTP 文件服务
│   └── rss/           # RSS 订阅源生成
└── runner/
    ├── memopayload/    # Memo 载荷处理 (标签、链接、任务)
    └── s3presign/     # S3 预签名 URL 管理

store/                  # 带缓存的数据存储层
├── driver.go           # 驱动接口 (定义数据库操作)
├── store.go            # 包含缓存层的 Store 封装
├── cache.go            # 内存缓存 (实例设置、用户)
├── migrator.go        # 数据库迁移器
├── db/
│   ├── db.go          # 驱动工厂模式
│   ├── sqlite/        # SQLite 实现
│   ├── mysql/         # MySQL 实现
│   └── postgres/      # PostgreSQL 实现
└── migration/         # SQL 迁移文件 (嵌入式)

proto/                  # Protocol Buffer 定义文件
├── api/v1/           # API v1 服务定义
└── gen/               # 生成的 Go 和 TypeScript 代码
```

### 前端架构

```
web/
├── src/
│   ├── components/     # React 组件
│   ├── contexts/       # React Context (客户端状态)
│   │   ├── AuthContext.tsx      # 当前用户、认证状态
│   │   ├── ViewContext.tsx      # 布局配置、排序方式
│   │   └── MemoFilterContext.tsx # 过滤器、快捷键
│   ├── hooks/          # React Query hooks (服务端状态)
│   │   ├── useMemoQueries.ts    # Memo 增删改查 (CRUD)、分页
│   │   ├── useUserQueries.ts    # 用户操作
│   │   ├── useAttachmentQueries.ts # 附件操作
│   │   └── ...
│   ├── lib/            # 工具库
│   │   ├── query-client.ts  # React Query v5 客户端
│   │   └── connect.ts       # Connect RPC 客户端设置
│   ├── pages/          # 页面组件
│   └── types/proto/    # 从 .proto 生成的 TypeScript 类型
├── package.json        # 依赖配置
└── vite.config.mts     # Vite 配置 (含开发代理)

plugin/                 # 后端插件
├── scheduler/         # 定时任务 (Cron jobs)
├── email/            # 邮件投递
├── filter/           # CEL 过滤表达式
├── webhook/          # Webhook 分发
├── markdown/         # Markdown 解析与渲染
├── httpgetter/        # HTTP 获取器 (元数据、图片)
└── storage/s3/       # S3 存储后端
```

## 关键架构模式

### 1. API 层：双协议 (Dual Protocol)

**Connect RPC (浏览器客户端):**
- 协议库：`connectrpc.com/connect`
- 基础路径：`/memos.api.v1.*`
- 拦截器链：元数据 (Metadata) → 日志 (Logging) → 恢复 (Recovery) → 认证 (Auth)
- 向 React 前端返回类型安全 (Type-safe) 的响应
- 参见：`server/router/api/v1/connect_interceptors.go:177-227`

**gRPC-Gateway (REST API):**
- 协议：标准 HTTP/JSON
- 基础路径：`/api/v1/*`
- 使用与 Connect 相同的服务实现逻辑
- 适用于外部工具、CLI 客户端
- 参见：`server/router/api/v1/v1.go:52-96`

**认证机制:**
- JWT 访问令牌 (V2)：无状态，15分钟过期，通过 `AuthenticateByAccessTokenV2` 验证
- 个人访问令牌 (PAT)：有状态，长效，通过数据库验证
- 两者均使用 `Authorization: Bearer <token>` 头部
- 参见：`server/auth/authenticator.go:17-166`

### 2. 存储层：接口模式 (Interface Pattern)

所有数据库操作均通过 `Driver` 接口进行：
```go
type Driver interface {
    GetDB() *sql.DB
    Close() error

    IsInitialized(ctx context.Context) (bool, error)

    CreateMemo(ctx context.Context, create *Memo) (*Memo, error)
    ListMemos(ctx context.Context, find *FindMemo) ([]*Memo, error)
    UpdateMemo(ctx context.Context, update *UpdateMemo) error
    DeleteMemo(ctx context.Context, delete *DeleteMemo) error

    // ... 针对所有资源的类似方法
}
```

**三种实现:**
- `store/db/sqlite/` - SQLite (modernc.org/sqlite)
- `store/db/mysql/` - MySQL (go-sql-driver/mysql)
- `store/db/postgres/` - PostgreSQL (lib/pq)

**缓存策略:**
- Store 封装层维护内存缓存，用于：
  - 实例设置 (`instanceSettingCache`)
  - 用户 (`userCache`)
  - 用户设置 (`userSettingCache`)
- 配置：默认 TTL 10分钟，清理间隔 5分钟，最大 1000 项
- 参见：`store/store.go:10-57`

### 3. 前端状态管理

**React Query v5 (服务端状态):**
- 所有 API 调用均通过 `web/src/hooks/` 中的自定义 Hook 进行
- Query Keys 按资源组织：`memoKeys`, `userKeys`, `attachmentKeys`
- 默认 staleTime: 30秒, gcTime: 5分钟
- 窗口聚焦、重连时自动重新获取数据
- 参见：`web/src/lib/query-client.ts`

**React Context (客户端状态):**
- `AuthContext`: 当前用户、认证初始化、登出
- `ViewContext`: 布局模式 (LIST 列表 / MASONRY 瀑布流)、排序顺序
- `MemoFilterContext`: 激活的过滤器、快捷键选择、URL 同步

### 4. 数据库迁移系统

**迁移流程:**
1. `preMigrate`: 检查 DB 是否存在。若不存在，应用 `LATEST.sql`。
2. `checkMinimumUpgradeVersion`: 拒绝 0.22 版本之前的安装升级。
3. `applyMigrations`: 在单个事务中应用增量迁移。
4. Demo mode: 播种演示数据。

**Schema 版本控制:**
- 存储在 `system_setting` 表中
- 格式：`major.minor.patch` (主版本.次版本.补丁)
- 迁移文件位置：`store/migration/{driver}/{version}/NN__description.sql`
- 参见：`store/migrator.go:21-414`

### 5. Protocol Buffer 代码生成

**定义位置:** `proto/api/v1/*.proto`

**重新生成:**
```bash
cd proto && buf generate
```

**生成产物:**
- Go: `proto/gen/api/v1/` (后端服务使用)
- TypeScript: `web/src/types/proto/api/v1/` (前端使用)

**Linting (代码检查):** `proto/buf.yaml` - 包含 BASIC 规则及 FILE breaking changes (文件级破坏性变更检查)

## 开发命令

### 后端

```bash
# 启动开发服务器
go run ./cmd/memos --port 8081

# 运行所有测试
go test ./...

# 运行特定包的测试
go test ./store/...
go test ./server/router/api/v1/test/...

# 代码检查 (golangci-lint)
golangci-lint run

# 格式化导入
goimports -w .

# 使用 MySQL/Postgres 运行
DRIVER=mysql go run ./cmd/memos
DRIVER=postgres go run ./cmd/memos
```

### 前端

```bash
# 安装依赖
cd web && pnpm install

# 启动开发服务器 (代理 API 到 localhost:8081)
pnpm dev

# 类型检查
pnpm lint

# 自动修复 Lint 问题
pnpm lint:fix

# 格式化代码
pnpm format

# 生产环境构建
pnpm build

# 构建并复制到后端
pnpm release
```

### Protocol Buffers

```bash
# 从 .proto 文件重新生成 Go 和 TypeScript 代码
cd proto && buf generate

# Lint proto 文件
cd proto && buf lint

# 检查破坏性变更
cd proto && buf breaking --against .git#main
```

## 关键工作流

### 添加新的 API 端点

1. **在 Protocol Buffer 中定义:**
   - 编辑 `proto/api/v1/*_service.proto`
   - 添加请求/响应消息 (Message)
   - 向 Service 添加 RPC 方法

2. **重新生成代码:**
   ```bash
   cd proto && buf generate
   ```

3. **实现服务 (后端):**
   - 在 `server/router/api/v1/*_service.go` 中添加方法
   - 遵循现有模式：获取用户、验证、调用 store
   - （可选）向 `server/router/api/v1/connect_services.go` 添加 Connect 包装器（通常使用相同实现）

4. **如果是公共端点:**
   - 添加到 `server/router/api/v1/acl_config.go:11-34` 的白名单中

5. **创建前端 Hook (如需):**
   - 向 `web/src/hooks/use*Queries.ts` 添加 query/mutation
   - 使用现有的 query key 工厂

### 数据库架构变更

1. **创建迁移文件:**
   ```
   store/migration/sqlite/0.28/1__add_new_column.sql
   store/migration/mysql/0.28/1__add_new_column.sql
   store/migration/postgres/0.28/1__add_new_column.sql
   ```

2. **更新 LATEST.sql:**
   - 将变更添加到 `store/migration/{driver}/LATEST.sql`

3. **更新 Store 接口 (如果是新表/模型):**
   - 向 `store/driver.go:8-71` 添加方法
   - 在 `store/db/{driver}/*.go` 中实现该方法

4. **测试迁移:**
   - 运行 `go test ./store/test/...` 进行验证

### 添加新的前端页面

1. **创建页面组件:**
   - 添加到 `web/src/pages/NewPage.tsx`
   - 使用现有的 Hooks 获取数据

2. **添加路由:**
   - 编辑 `web/src/App.tsx` (或路由配置)

3. **使用 React Query:**
   ```typescript
   import { useMemos } from "@/hooks/useMemoQueries";
   const { data, isLoading } = useMemos({ filter: "..." });
   ```

4. **使用 Context 获取客户端状态:**
   ```typescript
   import { useView } from "@/contexts/ViewContext";
   const { layout, toggleSortOrder } = useView();
   ```

## 测试

### 后端测试

**测试模式:**
```go
func TestMemoCreation(t *testing.T) {
    ctx := context.Background()
    store := test.NewTestingStore(ctx, t)

    // 创建测试用户
    user, _ := createTestUser(ctx, store, t)

    // 执行操作
    memo, err := store.CreateMemo(ctx, &store.Memo{
        CreatorID: user.ID,
        Content:  "Test memo",
        // ...
    })
    require.NoError(t, err)
    assert.NotNil(t, memo)
}
```

**测试工具:**
- `store/test/store.go:22-35` - `NewTestingStore()` 创建隔离的数据库
- `store/test/store.go:37-77` - `resetTestingDB()` 清理表数据
- 测试数据库由 `DRIVER` 环境变量决定 (默认: sqlite)

**运行测试:**
```bash
# 所有测试
go test ./...

# 特定包
go test ./store/...
go test ./server/router/api/v1/test/...

# 带覆盖率
go test -cover ./...
```

### 前端测试

**TypeScript 检查:**
```bash
cd web && pnpm lint
```

**无自动化测试:**
- 前端主要依赖 TypeScript 检查和人工验证
- 开发模式下可使用 React Query DevTools（左下角）

## 代码规范

### Go

**错误处理:**
- 使用 `github.com/pkg/errors` 进行包装：`errors.Wrap(err, "context")`
- 返回结构化的 gRPC 错误：`status.Errorf(codes.NotFound, "message")`

**命名:**
- 包名：小写，单词单数 (如 `store`, `server`)
- 接口：`Driver`, `Store`, `Service`
- 方法：PascalCase (大驼峰) 为导出，camelCase (小驼峰) 为内部使用

**注释:**
- 公共导出的函数必须有注释 (godot 强制要求)
- 单行使用 `//`，多行使用 `/* */`

**导入:**
- 分组顺序：标准库、第三方库、本地库
- 组内按字母顺序排列
- 使用 `goimports -w .` 格式化

### TypeScript/React

**组件:**
- 使用带有 Hooks 的函数式组件
- 使用 `useMemo`, `useCallback` 进行优化
- Props 接口定义：`interface Props { ... }`

**状态管理:**
- 服务端状态：React Query Hooks
- 客户端状态：React Context
- 避免直接使用 useState 存储服务端数据

**样式:**
- 通过 `@tailwindcss/vite` 使用 Tailwind CSS v4
- 使用 `clsx` 和 `tailwind-merge` 处理条件类名

**导入:**
- 使用 `@/` 别名进行绝对路径导入
- 分组：React、第三方、本地
- 由 Biome 自动组织

## 重要文件参考

### 后端入口点

| 文件 | 用途 |
|------|---------|
| `cmd/memos/main.go` | 服务器入口，CLI 设置 |
| `server/server.go` | Echo 服务器初始化，后台运行器 |
| `store/store.go` | 带缓存的 Store 封装 |
| `store/driver.go` | 数据库驱动接口 |

### API 层

| 文件 | 用途 |
|------|---------|
| `server/router/api/v1/v1.go` | 服务注册，网关设置 |
| `server/router/api/v1/acl_config.go` | 公共端点白名单配置 |
| `server/router/api/v1/connect_interceptors.go` | Connect 拦截器 |
| `server/auth/authenticator.go` | 认证逻辑 |

### 前端核心

| 文件 | 用途 |
|------|---------|
| `web/src/lib/query-client.ts` | React Query 客户端配置 |
| `web/src/contexts/AuthContext.tsx` | 用户认证状态 |
| `web/src/contexts/ViewContext.tsx` | UI 偏好设置 |
| `web/src/contexts/MemoFilterContext.tsx` | 过滤器状态 |
| `web/src/hooks/useMemoQueries.ts` | Memo 查询/变更操作 |

### 数据层

| 文件 | 用途 |
|------|---------|
| `store/memo.go` | Memo 模型定义，store 方法 |
| `store/user.go` | 用户模型定义 |
| `store/attachment.go` | 附件模型定义 |
| `store/migrator.go` | 迁移逻辑 |
| `store/db/db.go` | 驱动工厂 |
| `store/db/sqlite/sqlite.go` | SQLite 驱动实现 |

## 配置

### 后端环境变量

| 变量 | 默认值 | 描述 |
|----------|----------|-------------|
| `MEMOS_DEMO` | `false` | 启用演示模式 |
| `MEMOS_PORT` | `8081` | HTTP 端口 |
| `MEMOS_ADDR` | `` | 绑定地址 (为空表示所有) |
| `MEMOS_DATA` | `~/.memos` | 数据目录 |
| `MEMOS_DRIVER` | `sqlite` | 数据库类型：`sqlite`, `mysql`, `postgres` |
| `MEMOS_DSN` | `` | 数据库连接字符串 |
| `MEMOS_INSTANCE_URL` | `` | 实例基础 URL |

### 前端环境变量

| 变量 | 默认值 | 描述 |
|----------|----------|-------------|
| `DEV_PROXY_SERVER` | `http://localhost:8081` | 后端代理目标地址 |

## CI/CD (持续集成/持续部署)

### GitHub Workflows

**后端测试** (`.github/workflows/backend-tests.yml`):
- 触发条件：`go.mod`, `go.sum`, `**.go` 变更
- 步骤：验证 `go mod tidy`，运行 golangci-lint，运行所有测试

**前端测试** (`.github/workflows/frontend-tests.yml`):
- 触发条件：`web/**` 变更
- 步骤：pnpm install, lint, build

**Proto Lint** (`.github/workflows/proto-linter.yml`):
- 触发条件：`.proto` 变更
- 步骤：buf lint, buf breaking check

### Linting (代码检查) 配置

**Go** (`.golangci.yaml`):
- 启用 Linters：revive, govet, staticcheck, misspell, gocritic 等
- 格式化器：goimports
- 禁止项：`fmt.Errorf`, `ioutil.ReadDir`

**TypeScript** (`web/biome.json`):
- Linting：Biome (替代 ESLint)
- 格式化：Biome (替代 Prettier)
- 行宽：140 字符
- 分号：总是使用 (always)

## 常见任务

### 调试 API 问题

1. 检查 Connect 拦截器日志：`server/router/api/v1/connect_interceptors.go:79-105`
2. 如果是公共端点，验证是否在 `acl_config.go` 中
3. 通过 `auth/authenticator.go:133-165` 检查认证逻辑
4. 使用 curl 测试：`curl -H "Authorization: Bearer <token>" http://localhost:8081/api/v1/...`

### 调试前端状态

1. 打开 React Query DevTools（开发模式下位于左下角）
2. 检查查询缓存、Mutations、重写获取 (refetch) 行为
3. 通过 React DevTools 检查 Context 状态
4. 在 MemoFilterContext 中验证过滤器状态

### 针对多数据库运行测试

```bash
# SQLite (默认)
DRIVER=sqlite go test ./...

# MySQL (需要运行 MySQL 服务器)
DRIVER=mysql DSN="user:pass@tcp(localhost:3306)/memos" go test ./...

# PostgreSQL (需要运行 PostgreSQL 服务器)
DRIVER=postgres DSN="postgres://user:pass@localhost:5432/memos" go test ./...
```

## 插件系统

后端在 `plugin/` 目录下支持可插拔组件：

| 插件 | 用途 |
|--------|----------|
| `scheduler` | 基于 Cron 的作业调度 |
| `email` | SMTP 邮件投递 |
| `filter` | CEL 表达式过滤 |
| `webhook` | HTTP Webhook 分发 |
| `markdown` | Markdown 解析 (goldmark) |
| `httpgetter` | HTTP 内容获取 |
| `storage/s3` | S3 兼容存储 |

每个插件都有自己的 README 及使用示例。

## 性能考量

### 后端

- 数据库查询使用分页 (`limit`, `offset`)
- 内存缓存减少频繁访问数据的 DB 命中率
- SQLite 使用 WAL 日志模式 (减少锁竞争)
- 缩略图生成限制为 3 个并发操作

### 前端

- React Query 减少冗余的 API 调用
- 大列表使用无限查询 (Infinite queries/分页)
- 手动分块 (Chunking)：`utils-vendor`, `mermaid-vendor`, `leaflet-vendor`
- 重型组件采用懒加载 (Lazy loading)

## 安全注意事项

- JWT 密钥必须保密 (生产模式下首次运行时生成)
- 个人访问令牌 (PAT) 在数据库中以 SHA-256 哈希存储
- 通过 SameSite cookies 防止 CSRF 攻击
- 所有来源均启用了 CORS (生产环境需配置)
- 在服务层进行输入验证
- 通过参数化查询防止 SQL 注入