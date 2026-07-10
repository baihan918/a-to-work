# React Compiler 与手动 Memoization

## 1. React Compiler 是什么

React Compiler 是一个构建阶段的 React 优化编译器。

它会静态分析组件和 Hook 中的：

- 数据流
- 变量依赖
- 引用关系
- 可变性
- JSX 与数据之间的关系

然后自动添加细粒度的 memoization，减少不必要的重复计算和级联渲染。

React Compiler 1.0 已于 2025 年 10 月 7 日发布稳定版，支持 React 和 React Native。

它的核心目标可以概括为：

```text
开发者编写纯净、声明式的 React 代码
  -> Compiler 在构建阶段分析依赖
  -> 自动生成缓存逻辑
  -> React 执行优化后的代码
```

## 2. React Compiler 主要解决什么问题

没有 Compiler 时，开发者经常需要手动维护缓存：

```tsx
import { memo, useCallback, useMemo } from 'react';

const UserList = memo(function UserList({ users, onSelect }) {
  const visibleUsers = useMemo(
    () => filterUsers(users),
    [users],
  );

  const handleSelect = useCallback(
    id => onSelect(id),
    [onSelect],
  );

  return (
    <List
      users={visibleUsers}
      onSelect={handleSelect}
    />
  );
});
```

这些手动优化存在几个问题：

- 需要开发者判断哪里值得缓存。
- 需要手动维护依赖数组。
- 容易因为不稳定的对象或函数引用导致缓存失效。
- 容易出现闭包和依赖遗漏问题。
- 大量缓存代码会降低可读性。

启用 Compiler 后，可以优先编写自然代码：

```tsx
function UserList({ users, onSelect }) {
  const visibleUsers = filterUsers(users);

  const handleSelect = id => {
    onSelect(id);
  };

  return (
    <List
      users={visibleUsers}
      onSelect={handleSelect}
    />
  );
}
```

Compiler 会分析：

- `visibleUsers` 依赖 `users`。
- `handleSelect` 依赖 `onSelect`。
- JSX 中不同部分分别依赖哪些值。
- 哪些结果、函数和 JSX 可以复用。

它会自动生成类似 `React.memo`、`useMemo` 和 `useCallback` 的优化逻辑。

## 3. React Compiler 会改变什么

### 3.1 减少手动缓存代码

过去可能习惯于提前添加：

```tsx
memo(Component);
useMemo(() => value, [deps]);
useCallback(() => {}, [deps]);
```

使用 Compiler 后，新代码通常应该先保持简单，让 Compiler 完成常规 memoization。

开发者不需要仅仅为了稳定普通对象和函数引用，就到处添加缓存 API。

### 3.2 优化粒度更细

手动 `React.memo` 通常以整个组件作为缓存边界。

Compiler 可以进一步缓存组件内部的：

- 计算结果
- 函数
- 对象
- JSX 节点
- 条件分支之后的内容

例如：

```tsx
function Page({ user, theme }) {
  const header = <Header user={user} />;
  const content = <Content theme={theme} />;

  return (
    <>
      {header}
      {content}
    </>
  );
}
```

当只有 `theme` 变化时，Compiler 可以复用与 `user` 相关的 JSX，只重新处理依赖 `theme` 的部分。

这种效果类似细粒度响应式：

```text
状态变化
  -> 找到真正依赖该状态的计算和 JSX
  -> 复用其他未变化部分
```

### 3.3 减少引用不稳定问题

下面的代码每次 Render 都会创建新对象和新函数：

```tsx
<MemoChild
  config={{ pageSize: 20 }}
  onClick={() => selectItem(item)}
/>
```

在纯手动优化中，这些新引用可能导致 `React.memo` 失效。

Compiler 可以根据真实依赖判断这些对象和函数能否安全复用，而不要求开发者手动包裹 `useMemo` 或 `useCallback`。

### 3.4 React 规则变得更重要

Compiler 的分析建立在 Rules of React 之上：

- Render 必须保持纯净。
- 不能修改 props 和 state。
- Hook 调用顺序必须稳定。
- 不能在 Render 中执行副作用。
- 不能在 Render 中进行不安全的 ref 读写。

例如：

```tsx
function User({ user }) {
  user.name = 'Tom';
  return <div>{user.name}</div>;
}
```

这段代码修改了 props，不符合 React 的纯渲染规则，也会妨碍 Compiler 正确分析。

Compiler 相关检查会通过 `eslint-plugin-react-hooks` 暴露部分潜在问题。

## 4. React Compiler 不会改变什么

### 4.1 不会改变 React 更新模型

React 更新仍然是：

```text
触发更新
  -> Render
  -> Commit
```

Compiler 优化的是 Render 中：

- 哪些计算需要重新执行。
- 哪些对象和函数需要重新创建。
- 哪些 JSX 可以复用。
- 哪些子组件不必继续渲染。

它不会改变 state 的基本语义，也不会把 Commit 变成可中断或异步过程。

### 4.2 不保证组件函数完全不执行

父组件更新时，组件函数仍可能进入 Render。

Compiler 可以在组件内部检查依赖并复用已有结果：

```text
组件开始 Render
  -> 检查相关依赖
  -> 复用未变化部分
  -> 重新计算变化部分
```

因此，它不只是判断“整个组件是否执行”，还会判断组件内部哪些表达式需要重新计算。

### 4.3 不会缓存所有普通函数

Compiler 主要优化 React 组件和 Hook 内部的计算。

```tsx
function expensiveCalculate(data) {
  // 不会因此自动获得跨组件共享的全局缓存
}
```

如果多个组件调用同一个昂贵函数，Compiler 的局部缓存不会自动在多个组件之间共享。

跨组件共享结果仍然可能需要：

- 数据层缓存
- Selector
- Query 缓存
- 模块级缓存
- 专门的 memoization 工具

## 5. 还需要 React.memo、useMemo 和 useCallback 吗

需要。

但它们的定位会从“默认性能优化手段”转变为“显式控制工具”。

可以这样理解：

```text
Compiler：
负责常规、普遍、细粒度的自动优化

开发者：
在具有业务知识或明确性能证据时设置缓存边界
```

## 6. Profiler 定位问题后能否手动优化

完全可以，而且这是合理的流程：

```text
Profiler 定位瓶颈
  -> 判断问题来源
  -> 手动添加 memoization
  -> 再次 Profile
  -> 验证渲染次数和耗时是否下降
```

React Compiler 不禁止手动缓存。

如果开发者明确知道某个组件、计算或引用需要稳定，可以继续使用：

- `React.memo`
- `useMemo`
- `useCallback`

Compiler 会保留已有的手动 memoization。

## 7. 手动缓存不是为了减少 Compiler 分析

即使手动写了：

```tsx
const result = useMemo(
  () => calculate(data),
  [data],
);
```

Compiler 仍然需要分析组件代码：

- 验证 React 规则。
- 分析数据流与可变性。
- 识别其他可优化内容。
- 保留手动缓存边界。

所以手动优化的价值是：

> 明确表达这里需要缓存结果、稳定引用或设置组件边界。

它不是为了节省 Compiler 的静态分析成本。

Compiler 的分析发生在构建阶段，而手动缓存主要影响应用运行时行为。

## 8. Compiler 会不会遗漏缓存场景

会存在没有缓存的情况。

Compiler 根据静态分析和启发式策略决定是否进行 memoization，不会无条件缓存所有表达式。

可能不进行优化的原因包括：

- 数据流过于动态。
- 可变性难以静态判断。
- 代码违反 Rules of React。
- 某种代码模式暂时不受支持。
- Compiler 判断缓存收益有限。
- 缓存需求超出组件或 Hook 的局部范围。
- Compiler 无法理解业务语义。

缓存本身也有成本：

```text
保存缓存值
+ 记录依赖
+ 比较依赖
+ 增加内存占用
```

例如：

```tsx
const fullName = firstName + lastName;
```

这种简单计算重新执行通常比维护缓存更便宜。

因此，Compiler 没有缓存某段代码，不一定是遗漏，也可能是主动的成本判断。

## 9. 哪些情况适合手动 useMemo

### 9.1 Profiler 证明计算昂贵

```tsx
const sortedRows = useMemo(
  () => expensiveSort(rows),
  [rows],
);
```

适用前提：

- `rows` 较大。
- 排序或转换确实耗时。
- 组件经常因为其他状态变化而重新渲染。
- Profiler 或 Performance 工具证明该计算是瓶颈。

### 9.2 Effect 依赖需要明确稳定

```tsx
const options = useMemo(
  () => ({ roomId, token }),
  [roomId, token],
);

useEffect(() => {
  return connect(options);
}, [options]);
```

这里的 `useMemo` 不只是性能优化，还明确表达：

```text
只有 roomId 或 token 变化
  -> options 引用才变化
  -> Effect 才重新同步
```

当引用稳定性参与 Effect 语义时，手动控制通常更明确。

### 9.3 需要稳定第三方库参数

某些表格、图表、编辑器或状态库可能将引用变化视为配置变化。

```tsx
const columns = useMemo(
  () => createColumns(permission),
  [permission],
);

return <DataGrid columns={columns} />;
```

这时手动缓存可以明确第三方库的输入稳定边界。

## 10. 哪些情况适合手动 useCallback

### 10.1 向明确 memoized 的子组件传递函数

```tsx
const handleDelete = useCallback((id: string) => {
  setUsers(users =>
    users.filter(user => user.id !== id),
  );
}, []);

return (
  <MemoizedUserList
    users={users}
    onDelete={handleDelete}
  />
);
```

如果 Profiler 证明函数引用变化导致昂贵子组件重新渲染，可以显式稳定函数引用。

### 10.2 函数本身是其他 Hook 的依赖

```tsx
const loadData = useCallback(async () => {
  return api.getData(projectId);
}, [projectId]);

useEffect(() => {
  loadData();
}, [loadData]);
```

需要注意：很多时候可以直接把函数放进 Effect，避免额外的 `useCallback`。

## 11. 哪些情况适合手动 React.memo

### 11.1 昂贵组件 props 经常不变

```tsx
const LargeChart = memo(function LargeChart({ data }) {
  return <Chart data={data} />;
});
```

常见场景包括：

- 大型图表
- 富文本编辑器
- 大型列表
- 复杂画布
- 计算和节点数量都较多的展示组件

### 11.2 需要明确的组件级性能边界

某些业务模块具有清晰边界，开发者希望明确保证：

```text
父组件更新
  -> 只要模块 props 未变
  -> 模块不重新 Render
```

这时 `React.memo` 可以作为显式的架构和性能边界。

### 11.3 需要业务语义比较

```tsx
const Chart = memo(
  ChartView,
  (previous, next) =>
    previous.dataVersion === next.dataVersion,
);
```

Compiler 未必知道 `dataVersion` 可以代表图表数据是否变化，而开发者掌握该业务语义。

自定义比较必须谨慎：

- 比较成本要低于重新渲染。
- 必须覆盖所有影响渲染的 props。
- 函数 props 也可能包含不同闭包。
- 深比较大型对象可能比重新渲染更慢。

## 12. 不建议手动缓存的场景

不要为了“可能更快”而给所有值增加缓存：

```tsx
const name = useMemo(
  () => user.name,
  [user.name],
);

const handleOpen = useCallback(() => {
  setOpen(true);
}, []);
```

如果只是读取字段或执行简单状态更新，缓存通常没有明显收益，反而会增加：

- 依赖维护成本
- 代码复杂度
- 闭包错误风险
- 内存和比较成本

手动 memoization 应该建立在以下条件之一上：

1. 有明确的性能测量结果。
2. 需要明确的引用稳定语义。
3. 需要组件级缓存边界。
4. Compiler 无法理解的业务语义。
5. 需要跨组件或跨调用共享缓存。

## 13. Compiler 与手动缓存如何配合

推荐采用两层优化模型。

### 第一层：Compiler 自动优化

开发者优先保证：

- 组件纯净。
- state 结构合理。
- props 尽量精简。
- 不滥用 Context。
- Effect 只用于同步外部系统。
- 避免无意义的派生 state。

Compiler 负责常规缓存和细粒度依赖分析。

### 第二层：Profiler 驱动的手动优化

对于 Compiler 没有解决或无法解决的问题：

```text
Profiler 找到真实瓶颈
  -> 分析是计算、引用还是组件渲染问题
  -> 使用对应缓存手段
  -> 再次测量
```

对应关系：

| 性能问题 | 可能的处理方式 |
| --- | --- |
| 昂贵计算重复执行 | `useMemo`、Selector 或外部缓存 |
| 函数引用导致子组件更新 | `useCallback` |
| 昂贵子组件随父组件更新 | `React.memo` |
| Context 导致大范围更新 | 拆分 Context 或使用 Selector |
| 大量列表节点 | 虚拟列表 |
| 高频状态更新 | 状态下沉、订阅切分或节流 |
| 多组件重复请求 | Query/Data Cache |

`memo` 不是所有性能问题的答案。

## 14. 是否应该删除已有的手动缓存

不建议因为启用 Compiler 就批量删除：

```tsx
useMemo
useCallback
React.memo
```

原因包括：

- 手动缓存可能表达了业务语义。
- 某些稳定引用用于 Effect 依赖。
- 删除缓存可能改变编译输出。
- 旧代码可能依赖引用稳定性。
- 缺少测试时难以判断行为是否改变。

更稳妥的方式是：

```text
保留已有缓存
  -> 启用 Compiler
  -> 通过测试和 Profiler 验证
  -> 逐个删除确认无价值的缓存
```

新代码则可以减少防御性 memoization，优先依赖 Compiler。

## 15. 推荐优化流程

```text
1. 编写正确、纯净、简单的 React 代码
2. 启用 React Compiler 完成常规优化
3. 在生产模式或接近生产的环境中测试
4. 使用 React DevTools Profiler 找到瓶颈
5. 判断瓶颈属于计算、引用、组件还是状态架构
6. 必要时手动增加 memoization
7. 对比优化前后的渲染次数和耗时
8. 没有收益就撤销手动缓存
```

需要关注的测量指标：

- Commit duration
- 组件 Render 次数
- 单次 Render 耗时
- 交互延迟
- 更新影响的组件范围
- 缓存比较函数耗时
- 内存变化

## 16. 面试回答

### React Compiler 是什么

> React Compiler 是一个构建阶段的优化编译器。它理解 React 的纯渲染规则，并分析组件和 Hook 中的数据流、依赖与可变性，自动添加细粒度 memoization，减少重复计算和无意义的级联渲染。

### 它会替代 useMemo、useCallback 和 React.memo 吗

> 它会减少常规手动 memoization 的需要，但不会完全替代。新代码可以优先依赖 Compiler；当 Profiler 定位到真实瓶颈，或者需要稳定 Effect 依赖、设置组件边界、使用业务语义比较时，仍然可以手动使用这些 API。

### Compiler 是否可能遗漏

> 可能存在没有缓存的场景。Compiler 基于静态分析和成本策略工作，动态数据流、复杂可变性、规则违规、跨组件共享缓存以及业务语义都可能超出它的自动优化范围。另外，不缓存简单计算也可能是合理的，因为缓存本身有比较和内存成本。

### Profiler 定位后还能手动优化吗

> 可以。合理流程是先让 Compiler 处理常规优化，再通过 Profiler 找到瓶颈。如果明确是昂贵计算、函数引用或子组件渲染问题，可以分别使用 `useMemo`、`useCallback` 或 `React.memo`，然后再次 Profile 验证收益。

### 手动缓存能让 Compiler 少分析吗

> 不能这样理解。即使存在手动缓存，Compiler 仍然需要分析组件的数据流和 React 规则。手动缓存的价值是表达显式的运行时缓存边界和引用稳定语义，而不是减少构建阶段的分析工作。

## 17. 最终结论

React Compiler 没有改变 React 的更新原理，而是改变了性能优化的默认分工：

```text
过去：
开发者大量手动判断并维护 memoization

现在：
Compiler 负责常规、细粒度优化
开发者负责架构、业务语义和 Profiler 发现的明确瓶颈
```

最实用的原则是：

> 默认写纯净、简单的 React 代码，让 Compiler 处理常规缓存；通过 Profiler 发现明确问题后，再有针对性地使用 `React.memo`、`useMemo` 和 `useCallback`，并用数据验证优化是否有效。

## 参考资料

- React Compiler Introduction  
  https://react.dev/learn/react-compiler/introduction
- React Compiler 1.0  
  https://react.dev/blog/2025/10/07/react-compiler-1
- React Compiler Installation  
  https://react.dev/learn/react-compiler/installation
- React Compiler Incremental Adoption  
  https://react.dev/learn/react-compiler/incremental-adoption
- React Compiler Configuration  
  https://react.dev/reference/react-compiler/configuration
- React `memo`  
  https://react.dev/reference/react/memo
- React `useMemo`  
  https://react.dev/reference/react/useMemo
- React `useCallback`  
  https://react.dev/reference/react/useCallback
