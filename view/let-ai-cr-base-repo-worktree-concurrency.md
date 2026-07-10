# let-ai-cr：base repo 与 worktree 并发优化点

## 背景

`let-ai-cr` 当前默认任务级并发为 `1`。在这种串行执行模式下，每个任务开始前重新准备仓库环境，整体实现简单直接：

- 如果本地 `baseRepoPath` 已存在，先清理 worktree。
- 删除已有 base repo。
- 重新 clone 仓库。
- 基于 source branch 创建 worktree。
- 在 worktree 中执行依赖分析、影响面分析和 AI Code Review。

这个方案在串行场景下可用，但如果后续要提高吞吐，支持同项目多分支或同项目多任务并发，就会暴露可靠性和性能问题。

## 当前不足

### 1. 重复 clone 成本高

每个任务都删除并重新 clone base repo，会带来明显的网络和磁盘开销。仓库越大，任务启动耗时越长。

### 2. 同项目并发存在互相删除风险

如果把任务并发数调大，同一个项目的两个任务可能同时执行：

```text
任务 A：创建 base repo 和 worktree-A，开始跑 CR
任务 B：发现 base repo 已存在，清理 worktree，删除 base repo，重新 clone
```

此时任务 B 可能删除任务 A 正在使用的 base repo 或 worktree，导致任务 A 执行失败。

### 3. worktree 不是按任务唯一隔离

如果 worktree 路径只基于 `projectName + sourceBranch`，同项目同分支的多个任务会使用同一个目录，存在冲突风险。

## 优化方案

核心思路：把 base repo 从“一次性工作目录”改成“项目级 Git 缓存”，每个任务只创建自己的独立 worktree。

### 1. base repo 不再删除重克隆

将 `cloneRepository()` 改造为 `ensureRepository()`：

```text
如果 base repo 不存在：
  git clone

如果 base repo 已存在：
  git fetch --prune origin
```

这样 base repo 长期保留，作为项目级缓存复用。

### 2. worktree 按任务维度隔离

worktree 路径建议带上 `taskCenterTaskId`：

```text
workspace/worktrees/{projectId}/{taskCenterTaskId}
```

或者至少包含：

```text
{projectId}-{sourceBranch}-{taskCenterTaskId}
```

这样即使同项目、同分支、不同任务并发，也不会共用同一个工作目录。

### 3. 从固定 commit 或远端 ref 创建 worktree

更稳的方式是创建 detached worktree：

```bash
git worktree add --detach <workTreePath> <sourceCommit>
```

这样任务绑定到创建时的 commit，不受分支后续更新影响。

如果没有 commit，也可以基于远端分支：

```bash
git worktree add --detach <workTreePath> origin/<sourceBranch>
git reset --hard origin/<sourceBranch>
```

### 4. base repo 操作加项目级短锁

worktree 解决的是工作目录隔离，但 base repo 的 `.git` 元数据仍然共享。多个任务同时执行 `git fetch`、`git worktree add` 可能出现 Git lock 冲突或 ref 互相影响。

因此需要项目级锁：

```text
lock:let-ai-cr:repo:{projectId}
```

锁住范围只包括：

```text
ensureRepository
git fetch
git worktree add
```

创建好 worktree 后立即释放锁。后续 AI Review、影响面分析和评论上传都在各自 worktree 中并发执行。

## 优化后的流程

```text
任务 A 获取 project repo 锁
  更新 base repo
  创建 worktree-A
释放 project repo 锁
任务 A 在 worktree-A 中执行 CR

任务 B 获取 project repo 锁
  更新 base repo
  创建 worktree-B
释放 project repo 锁
任务 B 在 worktree-B 中执行 CR
```

这样可以做到：

- base repo 复用，减少重复 clone。
- worktree 按任务隔离，避免目录冲突。
- Git 元数据操作短暂串行，避免 `.git` lock 冲突。
- AI Review 主流程仍可并发，不被项目级锁长期阻塞。

## 面试表达

可以这样讲：

> 当前系统默认任务级并发是 1，所以仓库准备流程采用了比较简单稳妥的方式：任务开始前删除并重新 clone base repo，再基于分支创建 worktree。这个方案在串行场景下可用，但如果后续要提升吞吐，支持同项目多分支甚至同项目多任务并发，就会有重复 clone 成本高、base repo 被并发任务互相删除、worktree 路径冲突等风险。

> 我的优化思路是把 base repo 改造成项目级 Git 缓存，不再每次删除重克隆，而是通过 `git fetch --prune` 更新；每个任务创建独立 worktree，路径带 `taskCenterTaskId` 或 commit，保证任务目录隔离。同时给 base repo 的 fetch 和 worktree 创建阶段加项目级短锁，锁只覆盖 Git 元数据操作，创建完 worktree 就释放，后续 AI Review 在各自 worktree 中并发执行。

> 这样既降低了任务启动成本，也为后续把 `taskParallelCount` 从 1 调大提供了基础。它不是简单地“开并发”，而是先把共享资源和任务隔离边界设计清楚，避免并发后出现互删目录、污染分支引用或重复 clone 的问题。

## 可能追问

### 为什么有 worktree 了还需要锁？

worktree 解决的是工作目录隔离，但 base repo 的 `.git` 元数据仍然是共享的。多个任务同时 fetch、创建 worktree、更新 ref，仍可能发生 Git lock 冲突或引用被覆盖。所以需要项目级短锁保护 base repo 维护阶段。

### 锁会不会让并发又退化成串行？

不会。锁只包住 `fetch` 和 `worktree add` 这类很短的准备阶段，不包住整个 CR 执行。真正耗时的 AI Review、影响面分析、LLM 调用和评论上传仍然在各自 worktree 中并发执行。

### 为什么不用每个任务都完整 clone？

完整 clone 隔离性最好，但成本高，尤其大仓库会明显增加网络、磁盘和任务启动耗时。项目级 base repo 缓存 + task 级 worktree 能在隔离性和性能之间取得更好的平衡。
