# AI 审查是否需要 RAG

## 结论

AI 审查最核心的是精准上下文，不是一定要上 RAG。代码类上下文优先来自当前 MR 的一手事实，比如 diff、变更文件完整内容、依赖图、调用链和影响面分析。

RAG 更适合作为上下文增强层，用来补充模型不知道的团队知识和业务约束，例如项目通用规范、业务 Skill、组件使用规范、接口文档、历史事故和高质量 CR 样例。

## 面试回答

AI Code Review 不一定一开始就需要完整 RAG。对于代码变更审查，最可靠的一手上下文是 diff、变更文件、依赖图、调用影响面和项目规则。

我们当前项目已经通过 diff 解析、token 估算、依赖分析、依赖分组或 AI 分组来控制上下文质量。RAG 可以作为后续增强，用来召回项目通用规范和业务 Skill，补足模型不知道的团队知识、业务规则和历史经验，但它不应该替代 diff 和依赖分析这条主链路。

更准确地说，RAG 不是 AI 审查的主干，而是上下文增强层。主干应该是：

```text
diff + 变更文件内容 + 依赖分析 + 规则化 prompt
```

RAG 负责补充：

```text
项目通用规范 + 业务 Skill + 组件约束 + 历史事故 + 高质量 CR 样例
```

## 当前项目里的上下文机制

当前 let-ai-cr 更像是“确定性上下文构造 + LLM 审查”，不是完整 RAG 架构。

平台侧会先创建执行环境，然后调用核心包的 `analyzeDependency({ config, diffContext, logger })` 得到 `depCtxs`。后续影响面分析和代码审查都会使用这份依赖上下文。

相关代码：

- `app/service/run.ts`: 先调用 `analyzeDependency()`，再并行执行影响面分析和代码审查。
- `app/service/run.ts`: `groupDiffFiles()` 会基于 token 判断是否需要分组，并以依赖分组作为基础和兜底。
- `app/service/run.ts`: `groupDiffFilesByAI()` 会把 diff 文件和依赖关系放进 prompt，让模型做语义分组。

## LocalRuleManager 和 RAG 的关系

项目特有规范由 `LocalRuleManager` 根据 `config.rules.pattern` 从本地规则文件加载。

规则加载后，在代码审查和影响面分析构造 System Message 时，会和基础 prompt 一起通过 `concatRules()` 注入模型。

所以当前机制可以理解为轻量规则注入，而不是完整 RAG：

```text
规则文件 -> LocalRuleManager -> rules -> concatRules() -> System Message
```

如果后续规则规模变大，可以按文件路径、模块、语言和变更类型动态选择相关规则，必要时升级成规则库或 RAG。但核心原则不变：只给模型具体、可验证、和本次 diff 相关的规范，避免无关上下文污染判断。

## 为什么不能直接全量 RAG

AI 审查里的上下文质量比上下文数量更重要。如果把整个代码库、所有历史评论、所有业务文档都召回给模型，可能会带来几个问题：

- 无关规则干扰判断，导致误报。
- 历史评论不一定适用于当前代码。
- 业务文档可能过期，模型难以判断新旧。
- token 成本变高，但有效信息密度下降。
- 模型可能基于相似案例过度推断，而不是基于当前 diff 下结论。

因此 RAG 不能作为“全量塞资料”的入口，而应该作为精准召回层。

## 检索策略

更稳的策略是检索前过滤和检索后过滤/重排都做。

检索前先用元数据缩小候选范围：

```text
project
module
file_path
language
change_type
rule_type
```

召回后再做精选：

```text
similarity threshold
path relevance
module relevance
rule priority
deduplication
token budget trimming
```

也就是说，检索前先缩圈，检索后再精选。前者控制召回范围，后者控制最终上下文质量。

## 适合放进 RAG 的内容

优先放高价值、低噪声、相对稳定的知识：

- 团队代码规范。
- 项目通用规范。
- 业务 Skill。
- 组件库使用约束。
- API 契约和接口文档。
- 历史线上事故复盘。
- 历史高质量 CR 评论。
- 常见缺陷模式和规避规则。

不建议一开始就把整个代码库都向量化。代码库变化快、噪声大，而且当前 MR 的 diff 和依赖图通常比向量召回更精确。

## 一句话总结

AI 审查需要的是精准上下文，RAG 只是其中一种补充手段。当前项目的主干是 diff、依赖分析、规则化 prompt 和代码审查流程；RAG 适合作为后续增强，用来召回项目通用规范和业务 Skill，但必须围绕本次 diff 做精准过滤、重排和裁剪。
