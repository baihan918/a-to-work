# 01 React 深度

## 高频面试题

### 1. 为什么 React 需要 Fiber？

**答题口径**

React 早期更新是递归同步执行的，大组件树会长时间占用主线程，导致输入、动画、滚动卡顿。Fiber 把渲染任务拆成可恢复的工作单元，每个 Fiber 节点通过 `child`、`sibling`、`return` 形成链表结构，让 React 可以暂停、恢复、丢弃和重做渲染。

Fiber 的意义不是单纯换了数据结构，而是给调度、优先级、Concurrent Rendering 打基础。

**注意点**

- 不要只说 Fiber 是虚拟 DOM。
- 要强调 render 阶段可中断，commit 阶段不可中断。
- 要能说出链表结构为什么利于遍历和恢复工作。

**项目追问**

如果页面输入卡顿，你可以说：React 的低优先级渲染可能阻塞高优先级输入，需要减少渲染范围，或把非紧急列表更新放进 `startTransition`。

### 2. React diff 为什么不做完美 diff？

**答题口径**

通用树 diff 成本太高，React 使用启发式策略，把复杂度控制在可接受范围：

- 不同类型节点直接销毁重建。
- 相同类型节点复用并更新 props。
- 同层比较，不跨层级寻找。
- 列表通过 `key` 判断稳定身份。

**注意点**

- `key` 不是为了消除 warning，而是为了稳定身份。
- `index` 只适合静态、不排序、不插入删除的列表。

**项目追问**

表格、表单数组、拖拽排序中不要用 index 做 key，否则可能出现输入值错位、选中态错乱、动画复用错误。

### 3. Render 和 Commit 阶段分别做什么？

**答题口径**

Render 阶段执行组件函数、计算新的 Fiber 树、做 diff、收集副作用。它可以被中断、重启、丢弃，所以不能做真实副作用。

Commit 阶段把变化提交到 DOM，执行 ref 更新、DOM mutation、layout effect。Commit 阶段不可中断，否则用户会看到半更新状态。

**注意点**

- `useLayoutEffect` 在 DOM 更新后、浏览器绘制前执行。
- `useEffect` 通常在绘制后执行。
- 不要在 render 中发请求、改 DOM、写全局变量。

### 4. Hooks 为什么不能写在条件里？

**答题口径**

Hooks 依赖调用顺序。React 在当前 Fiber 上维护 Hooks 链表，每次 render 按顺序读取对应 Hook 的状态。如果 Hook 写在条件、循环或嵌套函数里，调用顺序可能变化，状态就会错位。

**注意点**

- 不是语法限制，是运行时状态匹配机制决定的。
- 自定义 Hook 也必须遵守同样规则。

### 5. useEffect 依赖数组怎么理解？

**答题口径**

`useEffect` 表示组件渲染结果提交后执行副作用。依赖数组决定副作用和清理函数何时重新执行：

- 不传依赖：每次渲染后执行。
- 空数组：挂载后执行一次，卸载时清理。
- 有依赖：依赖变化后执行，执行新 effect 前先执行上一次 cleanup。

**注意点**

- 依赖不是“想什么时候执行”的开关，而是 effect 使用了哪些响应式值的声明。
- 为了少执行而故意漏依赖，容易制造 stale closure。

### 6. stale closure 是什么？怎么解决？

**答题口径**

函数组件每次 render 都有自己的变量快照。异步回调、定时器、订阅函数如果引用了旧 render 的变量，就会读到旧 state，这就是 stale closure。

解决方式：

- 补全依赖。
- 使用函数式更新：`setCount(c => c + 1)`。
- 用 `useRef` 保存最新值。
- 用 `useReducer` 收敛复杂状态。
- 把逻辑移到事件处理或数据层。

**项目追问**

搜索、轮询、WebSocket、异步校验都容易出现 stale closure，要能举出你如何处理旧请求覆盖新请求。

### 7. setState / setXxx 是同步还是异步？

**答题口径**

setter 调用本身是同步入队，但 state 在当前 render 中是快照，不会立刻变成新值。React 会根据调度和批处理机制安排后续 render 和 commit。

React 18 之后自动批处理范围扩大到 Promise、setTimeout、原生事件等更多场景。

**注意点**

- 不要简单说“异步”。
- 依赖上一次状态时用函数式更新。
- 少数需要立即读 DOM 的场景才考虑 `flushSync`。

### 8. Concurrent Rendering 解决什么问题？

**答题口径**

Concurrent Rendering 让 React 能够中断低优先级渲染，优先响应高优先级交互。它不是多线程，而是可中断调度模型。

`startTransition` 用来标记非紧急更新，例如搜索结果、复杂列表、图表刷新。输入框 value 本身是紧急更新，结果列表可以是 transition。

**注意点**

- `startTransition` 不是让计算变快，而是改善交互优先级。
- 不适合包裹受控输入的直接 value 更新。

### 9. Suspense 和普通 loading 有什么区别？

**答题口径**

普通 loading 是业务组件手动维护加载状态。Suspense 是组件在渲染时声明“我还没准备好”，由上层边界统一 fallback。

它适合 lazy component、框架级数据读取、Server Components、流式渲染等场景。

**注意点**

- Suspense 不是全局请求库。
- 数据请求能否直接 Suspense 化取决于框架或数据层支持。

### 10. React.memo / useMemo / useCallback 什么时候有用？

**答题口径**

`React.memo` 跳过 props 浅比较相同的子组件渲染。`useMemo` 缓存计算结果。`useCallback` 缓存函数引用。

适用场景：

- 子组件很重。
- 列表项很多。
- props 稳定后能让 memo 生效。
- 计算成本明显高。

**注意点**

- 轻组件大量使用是负优化。
- 对象、数组、函数每次新建会让 memo 失效。
- 先用 Profiler 定位，再做优化。

## 9 年前端加分题

### 复杂表单怎么设计？

把状态分成字段值、校验状态、异步状态、联动状态、提交状态。简单表单可受控，复杂表单可以使用表单库或 schema 驱动。跨字段联动不要散落在多个组件里，建议集中到 reducer、状态机或规则层。

### 大列表卡顿怎么优化？

先用 React Profiler 和 Performance 定位。常见手段包括虚拟滚动、分页、稳定 key、memo 行组件、稳定 columns 和 handlers、拆分 Context、懒加载重内容。

### React 项目性能分析怎么做？

先用 React Profiler 看重复渲染和 commit 耗时，再用 Chrome Performance 看主线程长任务、Layout、Paint，最后用 bundle analyzer 看包体积和第三方依赖。

