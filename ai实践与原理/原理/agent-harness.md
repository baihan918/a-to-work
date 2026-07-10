# Agent Harness 是什么

我们前面聊到的 function call、MCP、skills、memory、context compression、ignore 规则、代码库地图、subagent、heartbeat，本质上很多都可以归到一个词下面：Agent harness。

Harness 可以理解成：

```text
把大模型包起来，让它能可靠干活的一整套运行框架。
```

模型本体只负责推理和生成 token。真正让模型进入代码仓库、调用工具、读写文件、跑测试、长期记忆、压缩上下文、接入外部系统的，是 harness。

## 三层关系

可以先分成三层：

```text
LLM
  -> 负责理解、推理、生成 token

Agent
  -> LLM + 目标 + 工具调用 + 思考/行动循环

Harness
  -> 让 Agent 能运行起来的外壳、工具箱、上下文系统和安全边界
```

一个更直观的类比：

```text
LLM：脑子
Agent loop：思考、行动、观察、再行动的循环
Harness：身体、工具箱、工作台、记忆本、规章制度
```

所以，只有模型还不够。模型会说话，但 harness 让它能做事。

## Harness 包含什么

一个 coding agent 或通用 agent 的 harness 可能包含：

```text
上下文管理
工具调用
文件系统访问
shell 执行
git 操作
浏览器控制
MCP 连接
skills 加载
memory 检索和写入
权限控制
重试和反思
日志裁剪
测试、lint、typecheck
subagent 调度
heartbeat 常驻机制
```

这些能力共同决定了 Agent 能不能从“生成建议”走到“完成任务”。

## 前面聊过的内容如何归类

很多具体机制都可以看成 harness 的一部分。

```text
Function call
  -> harness 提供工具调用通道

MCP
  -> harness 接入外部工具和数据源的协议层

Skills
  -> harness 加载的工作流说明和行为规则

CLAUDE.md / AGENTS.md
  -> harness 注入给模型的项目上下文

ignore / deny 规则
  -> harness 控制模型看什么、不要碰什么

代码库地图
  -> harness 给模型的导航信息

context compression
  -> harness 管理长上下文的方法

memory
  -> harness 的长期状态层

subagent
  -> harness 的多 Agent 调度能力

heartbeat
  -> harness 的常驻运行机制

tool schema
  -> harness 告诉模型有哪些工具可用、怎么调用

tests / lint / typecheck
  -> harness 给模型的执行反馈
```

## 为什么 harness 很重要

在真实工程里，模型能力只是基础。Agent 产品的差异，很大一部分来自 harness。

例如：

- 怎么组织上下文；
- 怎么暴露工具；
- 怎么限制权限；
- 怎么压缩历史；
- 怎么接 MCP；
- 怎么存 memory；
- 怎么跑命令；
- 怎么处理失败；
- 怎么验证结果；
- 怎么接入 IDE、CLI、聊天软件；
- 怎么避免误读生成文件和第三方代码。

这些不是模型权重本身能直接解决的问题，而是 Agent 运行时设计的问题。

## 产品差异主要在 harness

Codex、Claude Code、OpenClaw 这类产品，底层都依赖大模型，但真正拉开差异的地方，很大一部分在 harness。

同样是一个强模型，不同产品会因为 harness 设计不同，表现出完全不同的能力边界。

对比来看：

```text
Codex
  -> 更偏代码仓库里的工程任务
  -> 强调搜索、编辑、运行命令、测试验证、git 工作区协作

Claude Code
  -> 更偏 CLI 里的代码任务执行
  -> 强调项目上下文、工具调用、代码修改和本地验证

OpenClaw
  -> 更偏本地常驻 Agent 运行时
  -> 强调 heartbeat、memory、context engine、插件、消息入口和长期任务
```

这些差异不只是“模型谁更聪明”，而是：

- 上下文怎么组织；
- 工具怎么暴露；
- 权限怎么限制；
- 记忆怎么保存和召回；
- 历史怎么压缩；
- 外部系统怎么接入；
- 任务失败后怎么重试；
- 是否支持常驻和主动值守；
- 是否支持多 Agent 协作；
- 验证结果如何回流给模型。

所以更准确的判断是：

```text
大模型决定上限的一部分。
Harness 决定这个上限能不能在真实任务里被用出来。
```

也可以用车来类比：

```text
模型能力是发动机。
Harness 决定这台车有没有方向盘、刹车、导航、后备箱和维修工具。
```

没有 harness，再强的模型也容易停在“会说”。Harness 做得好，模型才真的能进入复杂项目和真实工作流里“会做”。

代码 Agent 能不能扛住百万行仓库，常驻 Agent 会不会烧 token，长期记忆是否可控，MCP 和 skills 是否好用，这些核心体验都发生在 harness 层。

## 代码 Agent 为什么依赖 harness

公司项目几百万行代码时，Agent 不可能把全仓一次性塞进上下文。

它能工作，靠的是 harness 提供的工程化能力（不同 harness 决定了怎么去读海量代码，比如 codex，Claude Code 和 cursor）：

```text
搜索定位
  -> 读局部文件
  -> 追 import / 调用链 / 类型定义
  -> 修改代码
  -> 跑测试和 typecheck
  -> 看报错
  -> 再修正
```

这说明，代码 Agent 的核心不是“记住整个仓库”，而是用 harness 把任务空间缩小、把反馈闭环跑起来。

## OpenClaw 为什么更像 harness 平台

OpenClaw 解决的很多问题，也可以从 harness 角度理解。

它不只是提供一个模型入口，而是在做一套本地 Agent 运行时：

```text
常驻心跳
+ 本地执行
+ 文件系统
+ memory
+ context engine
+ compaction
+ skills/plugins
+ MCP
+ 消息入口
+ subagent lifecycle
```

所以 OpenClaw 的价值不只是“更会聊天”，而是提供一套能长期运行、能接工具、能记忆、能压缩上下文、能进入日常工作流的 harness。

## 一句话总结

```text
大模型是核心引擎。
Agent 是带目标和工具的执行循环。
Harness 是让 Agent 能可靠运行在真实世界里的基础设施。
```

Function call、MCP、skills、memory、context compression、代码库地图、ignore 规则、验证命令，这些都是让模型从“会说”变成“能做”的 harness 组成部分。
