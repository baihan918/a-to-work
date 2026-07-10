# React 更新流程与调度机制

## 1. 一次 React 更新经历哪些阶段

一次完整更新可以概括为：

```text
触发更新
  -> 更新入队与优先级调度
  -> Render 阶段
  -> Commit 阶段
  -> 浏览器绘制
  -> Passive Effects
```

React 官方通常将页面更新概括为三个核心步骤：

1. Trigger：触发渲染。
2. Render：计算新的 UI。
3. Commit：将变化提交到 DOM。

### 1.1 触发更新

常见来源包括：

- `setState` 或 `useState`
- `useReducer` 的 `dispatch`
- 父组件重新渲染
- `Context` 值变化
- 外部 Store 更新

更新会进入 React 的更新队列。同一批更新可能被自动批处理，从而合并为一次 Render 和 Commit。

### 1.2 Render 阶段

Render 阶段负责计算新的 UI：

- 调用函数组件
- 执行 Hooks
- 生成新的 React Element
- 构建或复用 Fiber
- 对新旧结构进行 Reconciliation
- 标记需要新增、修改或删除的节点

Render 阶段不会直接修改真实 DOM。

在并发渲染中，Render 可以：

- 暂停
- 恢复
- 被更高优先级的更新打断
- 被放弃后重新计算

### 1.3 Commit 阶段

Render 完成后，React 将结果提交到真实环境：

- 插入、修改或删除 DOM
- 更新 `ref`
- 处理 Layout Effects
- 执行相关生命周期

Commit 一旦开始，就是同步且不可中断的。否则浏览器可能绘制出只更新了一部分的不一致界面。

### 1.4 浏览器绘制

Commit 完成后，浏览器才有机会完成样式计算、布局、绘制和合成：

```text
Style -> Layout -> Paint -> Composite
```

`useLayoutEffect` 在浏览器绘制前同步执行，因此会阻塞绘制。

### 1.5 Passive Effects

`useEffect` 属于 Passive Effects，通常不会阻塞浏览器绘制。

React 会处理：

1. 上一次 Effect 的 cleanup。
2. 本次 Effect 的 setup。

实际执行与绘制的先后细节可能受到更新来源和 React 调度策略影响，因此更准确的表述是：`useEffect` 通常允许浏览器先绘制，而不是绝对保证每次都在绘制后执行。

## 2. 为什么组件渲染逻辑必须是纯函数

理想的组件渲染关系是：

```text
UI = render(props, state)
```

给定相同的 `props` 和 `state`，组件应该得到相同的 JSX，并且不能在计算过程中修改外部环境。

根本原因是 Render 并不保证只执行一次，也不保证执行后一定 Commit。

### 2.1 Render 可能执行多次

组件可能因为父组件更新、并发调度或开发环境的 Strict Mode 被重复调用。

如果在组件函数里发送请求：

```tsx
function User() {
  request('/track');
  return <div>User</div>;
}
```

一次逻辑更新可能产生多次请求。

### 2.2 Render 可能被放弃

```text
开始低优先级 Render
  -> 执行了组件中的请求
  -> 高优先级更新到来
  -> 当前 Render 被放弃
```

虽然这次 UI 没有 Commit，请求却已经发送，外部状态与最终 UI 不一致。

### 2.3 Render 需要能够安全重算

只有 Render 保持纯净，React 才能安全地：

- 暂停和恢复
- 重复执行
- 放弃中间结果
- 根据优先级切换任务

副作用应根据用途放到合适的位置：

| 操作 | 推荐位置 |
| --- | --- |
| 根据 `props/state` 计算 JSX | 组件函数 |
| 用户点击后提交请求 | 事件处理函数 |
| 与网络、订阅等外部系统同步 | `useEffect` |
| 绘制前测量或修改布局 | `useLayoutEffect` |
| 缓存昂贵的纯计算 | `useMemo` |

核心原则：

> Render 只描述 UI 应该是什么；确定提交后，再同步外部世界。

## 3. 优先级调度影响什么

优先级主要影响更新何时执行，以及 Render 是否可以被中断。

低优先级 Render 进行时，如果出现高优先级更新，过程可能是：

```text
低优先级 Render
  -> 高优先级更新到来
  -> 暂停或放弃低优先级 Render
  -> 处理高优先级 Render
  -> 同步 Commit
  -> 之后继续或重新执行低优先级 Render
```

需要注意，JavaScript 不能从组件函数的任意一行被强制抢占。React 通常在完成一个 Fiber 工作单元后检查是否应该让出主线程或切换任务。

## 4. Sync 更新是否立即执行

Sync 优先级更新会同步完成必要的 Render 和 Commit，Render 不会按并发时间片暂停：

```text
Sync 更新
  -> 同步 Render
  -> 同步 Commit
  -> 浏览器获得绘制机会
```

但“同步优先级”不等于每次调用 `setState` 都在这一行立刻更新 DOM。React 仍然可能批处理同一事件中的多个更新：

```tsx
function handleClick() {
  setCount(count => count + 1);
  setName('Tom');

  // 此处 DOM 通常还是旧值
}
```

通常会在事件处理结束后，将它们合并成一次 Render 和 Commit。

如果第三方集成确实要求回调返回前 DOM 已经更新，可以使用 `flushSync`：

```tsx
import { flushSync } from 'react-dom';

flushSync(() => {
  setCount(count => count + 1);
});

// 此时相关 DOM 已完成更新
```

`flushSync` 会损害性能，应该只用于少数需要同步读取更新后 DOM 的集成场景。

## 5. React 是否等待浏览器空闲再工作

现代 React 的正常并发调度并不是简单地等待浏览器进入空闲状态。

更准确的理解是：

> React 将可中断的 Render 分成多个时间片，在时间片结束后主动交还主线程，再尽快安排下一轮工作。

```text
执行一段 Render
  -> 达到时间片阈值
  -> React 主动 yield
  -> 浏览器有机会处理输入和绘制
  -> 下一轮任务继续 Render
```

这是一种合作式调度。React 自己定期检查是否应该让出主线程，而不是浏览器从正在运行的 JavaScript 中强行夺走执行权。

## 6. requestIdleCallback 的早期调度思路

Fiber 早期设计、实验实现和教学模型经常使用 `requestIdleCallback` 来解释可中断工作：

```text
浏览器完成当前帧的重要工作
  -> 浏览器存在空闲时间
  -> 调用 React 工作回调
  -> React 根据剩余时间执行任务
```

其核心特点是：

- 由浏览器判断什么时候有空闲时间。
- 可以通过 deadline 获取大致的剩余空闲时间。
- 页面持续繁忙时，低优先级工作可能很久得不到执行机会。
- 浏览器兼容性和执行时机不够稳定。
- React 难以精确控制不同优先级任务的响应延迟。

因此，不能笼统地说所有早期正式版 React 都完全依赖原生 `requestIdleCallback`。它更适合被理解为 Fiber 早期的重要设计思路和常见教学模型。

## 7. MessageChannel 的工作逻辑

`MessageChannel` 可以创建两个互相通信的端口。一个端口发送消息，另一个端口收到消息后执行回调：

```ts
const channel = new MessageChannel();

channel.port1.onmessage = () => {
  const hasMoreWork = performWorkUntilDeadline();

  if (hasMoreWork) {
    channel.port2.postMessage(null);
  }
};

function scheduleWork() {
  channel.port2.postMessage(null);
}
```

这是对 React Scheduler 思路的简化示意，不是完整源码。

`postMessage` 会安排后续任务。React 可以在该任务中执行一段工作：

```text
MessageChannel 回调开始
  -> 取出当前最高优先级任务
  -> 执行若干 Fiber 工作单元
  -> 检查是否应该让出主线程
  -> 时间片耗尽时暂停
  -> 安排下一轮 MessageChannel 任务
```

时间判断可以简化理解为：

```ts
function shouldYieldToHost() {
  return performance.now() - startTime >= frameYieldMs;
}
```

真正的 React Scheduler 还需要考虑任务优先级、过期时间、是否存在待处理输入等因素。

## 8. MessageChannel 不是“下一帧执行”

`MessageChannel.postMessage()` 安排的是后续事件循环任务，不是 `requestAnimationFrame`。

因此不能表述为：

> React 交出主线程，然后在下一帧继续执行。

应该表述为：

> React 交出主线程，并尽快安排下一轮任务。浏览器可以在任务间隙处理输入和绘制，但不保证每次 yield 后都会产生新的一帧。

简化事件循环：

```text
当前任务执行 React Render
  -> 清空微任务
  -> 浏览器可能进行渲染
  -> 下一个 MessageChannel 任务继续 Render
```

“可能渲染”很重要。浏览器是否在两个任务之间执行一帧绘制，由浏览器的渲染时机决定。

## 9. requestIdleCallback 与 MessageChannel 对比

| 维度 | `requestIdleCallback` | `MessageChannel` 调度 |
| --- | --- | --- |
| 触发方式 | 等浏览器报告空闲 | 主动投递后续任务 |
| 控制权 | 浏览器决定何时回调 | React 更容易控制工作节奏 |
| 工作依据 | 剩余空闲时间 | React 自己的时间片和优先级 |
| 页面繁忙时 | 可能长期得不到执行 | 可继续安排后续任务 |
| 与帧的关系 | 倾向使用帧内空闲时间 | 不等于下一帧回调 |
| 常见定位 | Fiber 早期思路和低优先级空闲任务 | Scheduler 主动时间切片 |

## 10. Render 与 Commit 的关键区别

| 维度 | Render | Commit |
| --- | --- | --- |
| 主要职责 | 计算 UI 和变更 | 应用真实变更 |
| 是否修改 DOM | 否 | 是 |
| 是否可中断 | 并发 Render 可以 | 不可以 |
| 是否可重做 | 可以 | 不可以随意重做 |
| 是否可能被放弃 | 可以 | 开始后必须完成 |
| 是否适合副作用 | 不适合 | Effect 在相应提交时机处理 |

并发调度的价值主要来自 Render 可中断。Commit 无论对应哪种优先级，一旦开始都必须同步完成。

## 11. 完整时序示例

假设一个低优先级列表更新正在执行，此时用户点击按钮：

```text
低优先级更新进入队列
  -> MessageChannel 安排任务
  -> 执行一段低优先级 Render
  -> 时间片耗尽，主动 yield
  -> 用户点击产生高优先级更新
  -> 下一次调度优先处理点击更新
  -> 高优先级 Render 完成
  -> 同步 Commit
  -> 浏览器有机会绘制
  -> 之后继续或重做低优先级 Render
  -> 低优先级 Render 完成
  -> 同步 Commit
```

如果是 Sync 更新：

```text
Sync 更新进入队列
  -> 同步 Render
  -> 同步 Commit
  -> 返回浏览器
```

如果 Sync 更新发生在 React 批处理上下文中，它可能等到当前批次边界再统一执行，并不意味着每次 `setState` 都立即刷新 DOM。

## 12. 面试回答

### React 一次更新经历哪些阶段

> React 更新可以概括为 Trigger、Render 和 Commit。更新触发后会进入队列并分配优先级；Render 阶段计算 Fiber 树和 DOM 变更，在并发模式下可以暂停、恢复或放弃；Render 完成后进入同步且不可中断的 Commit，修改 DOM、ref 并执行 Layout Effects；之后浏览器获得绘制机会，Passive Effects 通常不会阻塞绘制。

### 为什么 Render 必须是纯函数

> 因为并发 Render 可能重复执行、暂停、恢复或直接放弃。如果组件函数在 Render 中发送请求或修改外部状态，就可能出现 UI 没有提交但副作用已经发生，或者副作用重复执行。保持 Render 纯净，React 才能安全地进行可中断调度。

### React 是否在浏览器空闲时执行

> 现代 React 并发调度不是简单等待浏览器空闲，而是通过 Scheduler 主动执行一段 Render，在时间片耗尽时让出主线程，再安排下一轮任务。浏览器可以在任务间隙处理输入和绘制。

### MessageChannel 是什么作用

> `MessageChannel` 用来安排下一轮事件循环任务。React 借此将较长的并发 Render 分散到多个任务中，并在任务之间主动让出主线程。它不是 `requestAnimationFrame`，所以不能说一定在下一帧继续。

### 高优先级更新如何抢占

> 高优先级主要抢占的是可中断的 Render。JavaScript 不能从任意代码行被抢占，React 会在 Fiber 工作单元之间检查是否需要 yield 或切换任务。高优先级 Render 完成后，对应 Commit 仍然同步且不可中断。

## 13. 最终记忆模型

```text
优先级决定先做什么
时间切片决定一次做多久
MessageChannel 决定如何安排下一轮任务
Fiber 提供可暂停的工作单元
Render 可以中断和重做
Commit 必须同步完成
```

最准确的一句话总结：

> React Scheduler 不是等待浏览器空闲，而是在可中断的 Render 中按优先级执行工作，并按时间片主动归还主线程；`MessageChannel` 用于尽快安排下一轮任务，Render 完成后再同步 Commit。

## 参考资料

- React 官方文档：Render and Commit  
  https://react.dev/learn/render-and-commit
- React 官方文档：React v18.0，Concurrent React  
  https://react.dev/blog/2022/03/29/react-v18
- React 官方文档：`useLayoutEffect`  
  https://react.dev/reference/react/useLayoutEffect
- React 官方文档：`useEffect`  
  https://react.dev/reference/react/useEffect
- React 官方文档：`flushSync`  
  https://react.dev/reference/react-dom/flushSync
- React Scheduler 源码  
  https://github.com/facebook/react/tree/main/packages/scheduler
