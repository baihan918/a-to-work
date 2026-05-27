# 团队 Plugin 与 MCP 复用

公共 skill、MCP server、脚本、资产和团队协作规范，都可以做成 plugin 去团队推广。

plugin 的价值不是把所有内容塞到一起，而是把一组高内聚、可安装、可维护的 Agent 能力打包，让团队成员能按需复用。

## 什么适合做成 plugin

适合放进 plugin 的内容：

- 公共 skill：前端规范、后端规范、业务域规则、代码 review 规则；
- MCP server 配置：Figma、GitLab、Jira、接口平台、知识库；
- 脚本：验证脚本、项目扫描脚本、生成脚本；
- 资产：模板、示例、固定 prompt；
- App 或工具入口：团队内部系统连接方式。

不适合放进 plugin 的内容：

- 个人 token；
- 个人账号配置；
- 只在某台机器存在的绝对路径；
- 临时任务说明；
- 还没有验证过的规则；
- 所有业务混在一起的大杂烩。

## 一个 plugin 还是多个 plugin

判断标准：

```text
高内聚、同生命周期、同权限边界
  -> 放一个 plugin

不同业务域、不同权限、不同更新节奏
  -> 拆成多个 plugin
```

不要把所有能力都塞进一个巨大的 plugin。那会变成另一种“超长 CLAUDE.md”：安装重、触发杂、权限边界不清、后续维护困难。

推荐结构：

```text
company-codex-base
  -> 通用协作规范、验证习惯、错误沉淀规则

company-frontend
  -> 前端工程 skill、组件规范、设计系统约定、截图验证脚本

company-backend
  -> 后端分层规范、API/DB 约定、服务调试 MCP

company-service-order
  -> 服务单业务域 skill、路由/API/类型说明、常见错误规则

company-design-tools
  -> Figma MCP、设计还原 skill、设计 review 规则

company-internal-tools
  -> Jira、GitLab、接口平台、知识库等内部 MCP 集成
```

更稳的团队方案是：一个基础 plugin，加多个专题 plugin。

## plugin 的基本结构

一个 Codex plugin 通常类似：

```text
my-plugin/
  .codex-plugin/
    plugin.json
  skills/
    frontend/SKILL.md
    backend/SKILL.md
    service-order/SKILL.md
  scripts/
  assets/
  .mcp.json
  .app.json
```

关键点：

- `.codex-plugin/plugin.json`：定义 plugin 元信息；
- `skills/*/SKILL.md`：定义可触发的工作流和规则；
- `.mcp.json`：定义 MCP server 连接方式；
- `scripts/`：放可复用脚本；
- `assets/`：放模板、示例和静态资源。

## MCP server 可以是外部 MCP

plugin 里的 `.mcp.json` 可以配置外部 MCP server，比如 Figma MCP、GitLab MCP、Jira MCP、内部知识库 MCP。

要区分两层：

```text
plugin
  -> 分发配置、skill 和使用入口

MCP server
  -> 真实运行的外部服务或本地命令
```

plugin 可以把 Figma MCP 的连接方式带给团队，但每个人本地能不能用，还取决于：

- 是否安装了对应 MCP server 包；
- 是否有 Node/Python 等运行环境；
- 是否配置了 token；
- 是否完成 OAuth 或登录；
- 是否有对应系统权限。

示例：

```json
{
  "mcpServers": {
    "figma": {
      "command": "npx",
      "args": ["-y", "some-figma-mcp-server"],
      "env": {
        "FIGMA_ACCESS_TOKEN": "${FIGMA_ACCESS_TOKEN}"
      }
    }
  }
}
```

团队 plugin 里适合放 MCP 名称、启动命令、默认参数、需要的环境变量和使用说明，不应该放个人密钥。

## 是否要区分 Cursor、Codex、Claude Code

需要区分。

底层知识和 MCP server 可以复用，但不同平台识别 plugin、规则和配置的方式不一样。

可以按三层理解：

```text
通用知识层
  -> 团队规范、业务规则、Prompt、错误沉淀、README

工具协议层
  -> MCP server、脚本、命令、schema、API client

平台适配层
  -> Codex plugin / Cursor rules / Claude CLAUDE.md
```

可以共用的内容：

- 业务域文档；
- 前端/后端工程规范；
- 错误复盘规则；
- MCP server 本身；
- 脚本和工具命令；
- 测试、构建说明。

需要适配的内容：

```text
Codex
  -> .codex-plugin/plugin.json
  -> skills/*/SKILL.md
  -> .mcp.json
  -> marketplace.json

Cursor
  -> .cursor/rules/*.mdc
  -> Cursor 的 MCP 配置方式
  -> rule 的 alwaysApply / globs / description

Claude Code
  -> CLAUDE.md
  -> slash commands
  -> Claude 的 MCP 配置方式
```

## 推荐仓库结构

如果团队同时使用 Codex、Cursor、Claude Code，可以把“通用知识”和“平台适配”拆开：

```text
agent-tooling/
  shared/
    frontend.md
    backend.md
    service-order.md
    agent-context.md

  mcp/
    figma/
    jira/
    gitlab/

  codex/
    plugins/
      company-frontend/
      company-service-order/

  cursor/
    rules/
      frontend.mdc
      service-order.mdc

  claude/
    CLAUDE.md
    commands/
```

这样 `shared/` 可以作为单一事实来源，Codex plugin、Cursor rules 和 Claude 配置只是不同平台的适配层。

## 推广策略

可以先从 Codex 侧落地：

```text
company-codex-base
  -> 全员安装

company-frontend / company-backend
  -> 按技术方向安装

company-service-order / company-design-tools
  -> 按业务域或场景安装
```

如果团队混用多个 Agent 工具，再逐步补齐 Cursor 和 Claude Code 的适配。

不要一开始就追求平台全覆盖。先把高频、稳定、能减少错误的规则沉淀好，再做跨平台分发。

## 一句话总结

公共 skill 和 MCP 很适合做成 plugin 去团队推广，但不要做成一个巨型万能 plugin。

更好的方式是：

```text
通用知识可复用
MCP 服务可复用
平台入口要适配
plugin 按职责拆分
```

基础能力统一安装，专业能力按需安装，长期维护才不会打结。
