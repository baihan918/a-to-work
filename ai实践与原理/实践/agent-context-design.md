# Agent 上下文设计：CLAUDE.md、Codex Skill 与活文档

这篇记录围绕一个核心问题：怎么给代码 Agent 提供足够上下文，同时不把它喂笨。

相关对象包括：

- Claude Code 的 `CLAUDE.md`
- Codex 的全局规则、项目说明和 skill
- 前端、后端、业务域等专题文档
- Agent 做错后持续修正的活文档

## CLAUDE.md 写多长合适

`CLAUDE.md` 不适合写成项目百科全书。

它更像一份操作手册：告诉 Claude 这个项目怎么启动、怎么验证、什么不能碰、遇到常见任务应该从哪里入手。

经验长度：

```text
50 行以内：可能太少，容易缺关键命令和边界
100-300 行：比较舒服
300-500 行：还能接受，但要保持克制
500-1000 行：开始明显稀释注意力
1000 行以上：大概率变成噪音源
```

写到 1000 行以后，Claude 不是真的“变笨”，而是每次任务都背着太多低相关信息。模型的注意力会被稀释，重要规则反而更容易被淹没。

## CLAUDE.md 应该放什么

适合放高频、稳定、全局有效的信息。

推荐内容：

```md
# Project Guide

## Commands
- Install: pnpm install
- Dev: pnpm dev
- Test: pnpm test
- Typecheck: pnpm typecheck

## Architecture
- src/pages: route-level pages
- src/components: shared UI components
- src/api: request wrappers
- src/types: shared TypeScript types

## Rules
- Reuse existing components before creating new ones.
- Do not change generated files manually.
- Keep API types in sync with src/types/api.ts.
- Prefer existing hooks in src/hooks.

## Verification
- For UI changes, run pnpm typecheck.
- For shared logic changes, run pnpm test.
```

不适合放：

- 完整业务文档；
- 几十个接口字段说明；
- 大段历史背景；
- 每个目录的详细文件列表；
- 已废弃规则；
- 一次性任务说明；
- 太多风格偏好；
- “可能有用但不常用”的碎片知识。

## 更好的方式：分层

不要把所有东西塞进一个 `CLAUDE.md`。

更好的结构是：

```text
CLAUDE.md                         # 全局规则，短
docs/ai/frontend.md               # 前端约定
docs/ai/backend.md                # 后端约定
docs/ai/testing.md                # 测试约定
docs/ai/business-service-order.md # 某个业务域说明
```

`CLAUDE.md` 里只放索引：

```md
## Extra Context
- Frontend conventions: docs/ai/frontend.md
- Testing conventions: docs/ai/testing.md
- Service order domain: docs/ai/business-service-order.md
```

这样 Agent 需要时再读，不需要时不会被无关内容干扰。

## Codex Skill 也是类似逻辑

Codex 的全局说明、项目 skill、前端 skill、后端 skill，本质上也会进入模型可用上下文。

所以它们也不能写成大杂烩。写得太长、太杂、太像百科全书，同样会稀释注意力。

但 Codex skill 有一个优势：可以按任务触发。

推荐分层：

```text
全局记忆或全局指令
  -> 只放稳定偏好和绝对禁忌

项目级 README / AGENTS.md / CLAUDE.md 类文件
  -> 放项目启动、目录结构、验证命令、核心边界

skills/frontend-xxx
  -> 只放前端任务会用到的组件约定、样式规范、测试方式

skills/backend-xxx
  -> 只放后端任务会用到的接口、数据库、服务分层、验证方式

业务域 skill
  -> 只放高频业务模块，比如服务单、订单、会员
```

经验尺度：

```text
全局指令：50-150 行
项目级说明：100-300 行
单个 skill：100-400 行
复杂业务域 skill：可以更长，但要结构化，并且只在相关任务触发
```

关键原则是：

```text
全局越短越好
专题越具体越好
触发越精准越好
```

## 不要追求常驻知识库

给 Agent 写上下文，不是追求“所有知识都常驻”。

更好的目标是：

```text
当前任务需要的知识，刚好被加载。
```

如果所有业务、所有接口、所有规则都常驻，Agent 会更容易：

- 抓错入口；
- 被历史规则干扰；
- 忽略真正关键的当前任务；
- 把相似但不相关的模块混在一起；
- 违反更高优先级的局部约定。

## 直接给入口可以降噪

如果已经确定是哪个模块，直接告诉 Agent 对应入口，或者把当前工作目录、打开文件切到相关模块附近，是很有效的降噪方式。

不要只说：

```text
帮我改一下导出逻辑
```

更好是：

```text
改服务单列表页的导出逻辑，入口在 src/pages/service-order/list/index.tsx。
相关接口在 src/api/service-order.ts。
不要动 legacy/service-order。
改完跑 pnpm test service-order。
```

这会减少 Agent 猜入口的成本，也降低它误改旧页面、相似模块、测试 fixture 或历史代码的概率。

可以优先给这些信息：

- 任务目标：要改什么行为；
- 入口文件：从哪个页面、组件、API 开始看；
- 相关文件：类型、接口、hooks、测试在哪里；
- 排除范围：哪些目录不要动；
- 验证方式：改完跑什么命令。

不同清晰度可以对应不同协作方式：

```text
不知道入口：
  让 Agent 先搜索定位，但要求它说明判断依据

知道入口：
  直接告诉入口文件、相关模块、不要动哪里

非常确定改法：
  直接告诉它在某文件某函数附近改什么，并要求保持现有风格
```

只切到对应目录也有帮助，但最稳的是：明确说出入口，同时让当前目录或打开文件也靠近相关模块。

入口越准确，Agent 越像结对工程师；信息越泛，它越像侦探。侦探模式能用，但噪音和成本都会更高。

## 用 ignore 和代码库地图降噪

除了直接告诉入口，还可以通过两类项目级配置降低噪音。

第一类是 ignore 规则。

把生成文件、构建产物、第三方代码、缓存目录、大型快照文件等排除掉，可以减少 Agent 搜索和阅读时碰到的无效内容。

常见应该排除的内容包括：

- `node_modules/`；
- `dist/`、`build/`、`.next/`、`.nuxt/`；
- coverage、缓存、日志；
- 自动生成的 API client 或 schema；
- lockfile 以外的大型机器生成文件；
- vendored 第三方源码；
- 测试快照和大型 fixture。

如果是 Claude Code，可以把团队共享的 deny 或 ignore 规则提交到 `.claude/settings.json`。这样团队成员不用每个人手动配置，Agent 也更不容易把生成代码、构建产物或第三方代码当成业务入口。

第二类是代码库地图。

当目录结构不直观时，可以在根目录放一份简短的 markdown 文件，用一两句话说明每个顶层目录或关键业务目录的职责。

示例：

```md
# Codebase Map

- `src/pages/service-order/`：服务单页面入口，列表和详情都在这里。
- `src/api/service-order.ts`：服务单接口封装。
- `src/components/`：跨业务复用组件，新增组件前先搜索这里。
- `src/legacy/`：历史实现，除非明确要求，不要修改。
- `generated/`：自动生成代码，不要手动编辑。
```

代码库地图不需要写成完整文档。它的价值是让 Agent 在搜索前先获得方向感，比盲目全仓探索更快。

这两类配置的作用不同：

```text
ignore 规则
  -> 告诉 Agent 哪些东西不要看、不要改

代码库地图
  -> 告诉 Agent 应该优先从哪里看
```

它们和入口提示可以配合使用：

```text
ignore 规则减少无效内容
代码库地图提供全局导航
用户明确入口缩小任务范围
```

三者叠加后，Agent 的探索空间会小很多，误入旧代码、生成代码、第三方代码的概率也会降低。

## 把代码仓库当作记录系统

对于大型代码库，不要指望一个巨大的 `AGENTS.md`、`CLAUDE.md` 或总说明文件承载所有知识。

更好的方式是把代码仓库本身设计成记录系统：

```text
AGENTS.md / CLAUDE.md
  -> 地图和索引

docs/
  -> 结构化知识库

业务目录 README
  -> 局部规则和入口说明

skill / plugin
  -> 可触发的工作流和操作规范
```

也就是说，要给 Agent 的不是一本 1000 页说明书，而是一张地图。

大型单文件说明的问题在于：

- 上下文是一种稀缺资源，巨大指令文件会挤掉任务、代码和相关文档；
- 当所有内容都“重要”时，模型反而不知道什么最重要；
- 文档很快腐烂，旧规则、新规则、废弃规则混在一起会制造噪音；
- 单个大文件很难机械检查覆盖率、新鲜度、所有权和交叉链接；
- 人类也不愿意长期维护一个臃肿的总说明。

因此，更推荐：

```text
短 AGENTS.md / CLAUDE.md
  -> 说明项目怎么启动、怎么验证、哪里是地图

结构化 docs/
  -> 存放真实业务知识、架构说明、模块边界、决策记录

局部 README
  -> 说明当前目录负责什么、入口在哪里、不要碰什么

专题 skill
  -> 在相关任务触发时加载对应规则
```

一个好的根部 `AGENTS.md` 或 `CLAUDE.md` 可以控制在 100 行左右，主要做三件事：

- 给出全局命令和验证方式；
- 指向代码库地图和关键 docs；
- 写清少量绝对禁忌，比如不要改生成代码、不要覆盖用户改动。

真实知识应该留在更合适的位置。这样 Agent 可以先读地图，再按任务进入对应文档或目录，而不是每次都背着一整本百科全书。

## 文档不是一次性产物

这些上下文文件不是写一次就完事。

它们是一组持续打磨的活文档。Agent 每做错一次，如果错误有复用价值，就应该把原因和修正方式沉淀到对应位置。

比如：

```text
Agent 改错了旧页面
  -> 在对应业务域 skill 里补充当前入口和旧入口的边界

Agent 没有复用组件
  -> 在前端 skill 里补充组件复用规则和搜索方式

Agent 跑错测试命令
  -> 在项目级说明或 testing 文档里补充验证命令

Agent 改了生成文件
  -> 在项目级说明里补充禁止手改的目录
```

## 错误应该沉淀到哪里

按影响范围放，不要一股脑塞进全局。

```text
全局协作偏好
  -> 全局规则或通用 skill

项目启动、目录、验证命令
  -> 项目级 README、AGENTS.md、CLAUDE.md 或 Codex 项目说明

前端组件、样式、交互、测试约定
  -> frontend skill 或前端约定文档

后端接口、数据库、错误处理、服务分层
  -> backend skill 或后端约定文档

具体业务域规则
  -> 业务域 skill 或业务 md
```

一句话：谁会再次用到这条规则，就放到谁会被触发读取的地方。

## 怎么写沉淀规则

沉淀内容要短、准、可执行。

不推荐：

```text
以后要注意服务单逻辑。
```

推荐：

```text
修改服务单详情页按钮时，先确认当前入口是 `src/pages/service-order/detail`，不要改历史页面 `src/legacy/service-order`。
```

好的规则通常包含：

- 触发场景：什么时候需要看这条；
- 正确做法：应该怎么做；
- 错误边界：不要做什么；
- 验证方式：改完跑什么命令或检查什么页面。

## 什么时候值得沉淀

不是每个错误都值得写进长期上下文。

值得沉淀的情况：

- 以后很可能再遇到；
- 错误代价比较高；
- 规则足够稳定；
- 它能帮助 Agent 更快定位入口；
- 它能减少重复解释。

不适合沉淀的情况：

- 一次性需求；
- 临时方案；
- 还没有验证的猜测；
- 只对某次对话有效的背景；
- 已经废弃或即将变化的规则。

## 一句话总结

`CLAUDE.md`、Codex skill 和项目 AI 文档，都不是越长越好。

它们的目标不是把所有知识塞给 Agent，而是让 Agent 在正确时机拿到正确规则。

最好的维护方式是：

```text
短的全局规则
  + 精准触发的专题 skill
  + 按错误持续修正的活文档
```

每次 Agent 做错，都问一句：

```text
这是一次性失误，还是缺少一条以后也会用到的规则？
```

如果是后者，就把它沉淀到对应的 skill 或 md 里。
