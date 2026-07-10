# React 状态更新与副作用

## 1. setState 到底算不算副作用

这个问题需要区分函数式编程语境和 React 开发语境。

从广义的函数式编程角度看，`setState` 会向 React 提交状态变更，并触发后续更新，因此它不是一个普通的纯计算。

但在 React 语境中，更准确的说法是：

> `setState` 是发起状态更新的操作。它负责通知 React 状态发生了变化，并请求一次新的 Render。

它和接口请求、订阅、日志、存储、DOM 操作等外部副作用并不等价。

## 2. setState 与外部副作用的区别

### 2.1 setState 的职责

```tsx
setCount(count => count + 1);
```

它的主要作用是：

```text
向 React 提交状态更新
  -> 更新进入 React 队列
  -> React 进行调度和批处理
  -> 触发 Render
  -> 完成 Commit
```

`setState` 不会直接修改当前 Render 中拿到的 state 值。

```tsx
function handleClick() {
  console.log(count); // 0

  setCount(1);

  console.log(count); // 仍然是 0
}
```

当前事件处理函数中的 `count` 是本次 Render 的状态快照。`setCount` 请求下一次 Render 使用新状态，但不会修改当前闭包中的值。

### 2.2 外部副作用的职责

副作用通常是 React 渲染之外的可观察操作，例如：

- 发送接口请求
- 建立或关闭 WebSocket
- 订阅或取消订阅
- 修改 `document.title`
- 操作 `localStorage`
- 记录埋点
- 调用第三方命令式 API
- 手动修改 DOM

```tsx
useEffect(() => {
  document.title = title;
}, [title]);
```

这里修改浏览器环境是副作用，但没有调用 `setState`。

## 3. 接口请求和 setState 为什么经常一起出现

典型的数据请求代码：

```tsx
useEffect(() => {
  let ignore = false;

  async function loadUser() {
    const user = await fetchUser();

    if (!ignore) {
      setUser(user);
    }
  }

  loadUser();

  return () => {
    ignore = true;
  };
}, []);
```

执行流程是：

```text
Effect 执行
  -> 发起接口请求
  -> 请求属于外部副作用
  -> 请求返回
  -> 调用 setUser
  -> 通知 React 更新状态
  -> Render
  -> Commit
```

因此不能说：

> `setState` 导致了接口请求。

更准确的说法是：

> 接口请求负责获取外部数据，`setState` 负责把请求结果提交到 React 状态中。

二者经常连续出现，但职责不同。

## 4. setState 不一定伴随外部副作用

例如用户点击后打开弹窗：

```tsx
function handleOpen() {
  setOpen(true);
}
```

这里只更新 React 状态，没有发送请求、修改存储或订阅外部系统。

执行过程是：

```text
用户点击
  -> setOpen(true)
  -> React 调度更新
  -> Render
  -> Commit
```

因此：

```text
调用 setState
不等于
一定发生了接口请求等外部副作用
```

## 5. 外部副作用也不一定调用 setState

### 修改页面标题

```tsx
useEffect(() => {
  document.title = title;
}, [title]);
```

### 建立连接

```tsx
useEffect(() => {
  const connection = createConnection();

  connection.connect();

  return () => {
    connection.disconnect();
  };
}, []);
```

### 记录埋点

```tsx
function handleBuy() {
  track('buy');
  submitOrder();
}
```

这些操作都会影响 React 外部环境，但不一定需要更新组件状态。

## 6. setState 应该放在哪里

### 6.1 事件处理函数中

这是最自然的使用位置：

```tsx
function handleClick() {
  setCount(count => count + 1);
}
```

事件处理函数允许执行操作，包括：

- 更新状态
- 发送请求
- 页面跳转
- 修改存储
- 记录日志和埋点

### 6.2 异步回调中

```tsx
async function handleSubmit() {
  setSubmitting(true);

  try {
    await submitForm(formData);
    setSuccess(true);
  } finally {
    setSubmitting(false);
  }
}
```

这也是正常用法。需要注意组件卸载、请求竞态和旧请求覆盖新状态的问题。

### 6.3 Effect 中

Effect 中允许调用 `setState`：

```tsx
useEffect(() => {
  fetchUser(userId).then(setUser);
}, [userId]);
```

但需要区分两种情况。

#### 外部系统同步结果

```tsx
useEffect(() => {
  const unsubscribe = store.subscribe(() => {
    setValue(store.getValue());
  });

  return unsubscribe;
}, []);
```

这种更新来源于外部系统同步，具有合理性。

不过对于外部 Store，通常优先考虑 `useSyncExternalStore`。

#### 根据已有 props/state 派生状态

```tsx
useEffect(() => {
  setFullName(`${firstName} ${lastName}`);
}, [firstName, lastName]);
```

这种写法通常没有必要，因为它会产生额外更新：

```text
firstName 或 lastName 变化
  -> Render
  -> Commit
  -> Effect
  -> setFullName
  -> 再次 Render
  -> 再次 Commit
```

应该直接在 Render 中计算：

```tsx
const fullName = `${firstName} ${lastName}`;
```

计算昂贵时，可以使用：

```tsx
const result = useMemo(
  () => expensiveTransform(data),
  [data],
);
```

## 7. 为什么通常不能在 Render 中调用 setState

错误示例：

```tsx
function Counter() {
  const [count, setCount] = useState(0);

  setCount(count + 1);

  return <div>{count}</div>;
}
```

执行过程：

```text
Render
  -> setCount
  -> 请求再次 Render
  -> Render
  -> setCount
  -> 再次 Render
  -> 无限循环
```

Render 应该只负责：

```text
根据 props、state 和 context
计算应该返回什么 JSX
```

它不能在无条件执行路径中发起新的状态更新。

### 少数条件更新模式

React 允许在少数情况下，在 Render 中带条件地更新当前组件：

```tsx
function List({ items }) {
  const [previousItems, setPreviousItems] = useState(items);
  const [selection, setSelection] = useState(null);

  if (items !== previousItems) {
    setPreviousItems(items);
    setSelection(null);
  }

  return null;
}
```

这里必须有能够终止更新的条件，否则会形成循环。

这种模式较难理解，通常应优先考虑：

- 直接派生值
- 调整 state 结构
- 使用 `key` 重置组件
- 将状态更新放到事件中

## 8. state updater 必须保持纯净

函数式更新：

```tsx
setTodos(previousTodos => {
  return [...previousTodos, newTodo];
});
```

updater 函数可能被 React 重复调用来验证纯净性，因此不能修改旧状态。

错误示例：

```tsx
setTodos(previousTodos => {
  previousTodos.push(newTodo);
  return previousTodos;
});
```

这里直接修改了旧数组。

正确示例：

```tsx
setTodos(previousTodos => [
  ...previousTodos,
  newTodo,
]);
```

对象状态同样应该创建新对象：

```tsx
setUser(previousUser => ({
  ...previousUser,
  name: 'Tom',
}));
```

## 9. Effect 中 setState 的常见问题

### 9.1 形成无限循环

```tsx
useEffect(() => {
  setCount(count + 1);
}, [count]);
```

执行过程：

```text
count 变化
  -> Effect 执行
  -> setCount
  -> count 再变化
  -> Effect 再执行
  -> 无限循环
```

### 9.2 请求结果触发重复请求

```tsx
useEffect(() => {
  fetchData().then(data => {
    setData(data);
  });
}, [data]);
```

`data` 是请求结果，却又被声明为请求 Effect 的依赖：

```text
请求
  -> setData
  -> data 变化
  -> 再次请求
```

请求的依赖一般应该是查询条件：

```tsx
useEffect(() => {
  const controller = new AbortController();

  async function load() {
    const response = await fetch(
      `/api/users/${userId}`,
      { signal: controller.signal },
    );

    const user = await response.json();
    setUser(user);
  }

  load();

  return () => {
    controller.abort();
  };
}, [userId]);
```

### 9.3 同步派生状态造成额外 Render

```tsx
useEffect(() => {
  setFilteredItems(
    items.filter(item => item.active),
  );
}, [items]);
```

应该直接计算：

```tsx
const filteredItems = items.filter(
  item => item.active,
);
```

### 9.4 旧异步任务覆盖新状态

```text
请求 A 发出
  -> 请求 B 发出
  -> B 先返回并 setState
  -> A 后返回并覆盖 B
```

可以在 cleanup 中取消请求并忽略旧结果：

```tsx
useEffect(() => {
  const controller = new AbortController();
  let active = true;

  async function load() {
    try {
      const response = await fetch(
        `/api/users/${userId}`,
        { signal: controller.signal },
      );

      const user = await response.json();

      if (active) {
        setUser(user);
      }
    } catch (error) {
      if (
        active &&
        !(error instanceof DOMException &&
          error.name === 'AbortError')
      ) {
        setError(error);
      }
    }
  }

  load();

  return () => {
    active = false;
    controller.abort();
  };
}, [userId]);
```

## 10. Strict Mode 为什么会执行两次

Strict Mode 的主要目的不是性能优化，而是在开发环境主动暴露：

- 不纯的组件 Render
- 不纯的 state updater
- Effect 缺少 cleanup
- ref callback 缺少清理
- 依赖重复挂载会出错的代码

Strict Mode 的额外检查只发生在开发环境，不影响生产环境。

## 11. 组件函数为什么会执行两次

React 假设组件函数是纯函数：

```text
相同的 props、state、context
  -> 应该返回相同的 JSX
  -> 不应该修改外部数据
```

Strict Mode 会重复调用应当保持纯净的函数。

错误示例：

```tsx
function UserList({ users }) {
  users.push({ id: 'new' });

  return <div>{users.length}</div>;
}
```

第一次 Render 修改一次，第二次 Render 又修改一次，问题会快速暴露。

正确示例：

```tsx
function UserList({ users }) {
  const nextUsers = [
    ...users,
    { id: 'new' },
  ];

  return <div>{nextUsers.length}</div>;
}
```

无论调用一次还是多次，都不会修改外部数据。

## 12. Effect 为什么看起来执行两次

Strict Mode 开发环境首次挂载时，会额外执行一次：

```text
Effect setup
  -> Effect cleanup
  -> Effect setup
```

例如：

```tsx
useEffect(() => {
  const connection = createConnection();

  connection.connect();

  return () => {
    connection.disconnect();
  };
}, []);
```

这个 Effect 可以安全经历：

```text
连接
  -> 断开
  -> 重新连接
```

如果遗漏 cleanup：

```tsx
useEffect(() => {
  const connection = createConnection();
  connection.connect();
}, []);
```

开发环境中就可能出现重复连接，从而暴露资源泄漏。

Strict Mode 不是简单地“无意义执行两次”，而是在验证：

> setup 做的事情，cleanup 是否能够完整停止或撤销。

## 13. state initializer 和 updater 为什么可能重复执行

### state initializer

```tsx
const [data] = useState(() => {
  return createInitialData();
});
```

初始化函数应该保持纯净：

```tsx
const [data] = useState(() => {
  localStorage.setItem('initialized', 'true');
  return createInitialData();
});
```

上面的初始化函数修改了外部存储，不适合作为纯初始化计算。

### state updater

```tsx
setCount(previousCount => {
  return previousCount + 1;
});
```

updater 也应该是纯函数。React 可以在开发环境重复调用它，以发现状态突变等问题。

## 14. “执行两次”不代表真实 DOM 一定提交两次

需要区分：

- 组件函数可能重复调用。
- 第一次 Render 结果可能被丢弃。
- 不代表真实 DOM 一定重复插入两次。
- Effect 会额外经历一次 setup 和 cleanup。
- 生产环境不会执行这些额外的 Strict Mode 检查。

可以理解为：

```text
开发环境：
React 故意增加压力测试

生产环境：
没有这些额外检查
```

## 15. 常见判断表

| 场景 | setState 是否合理 | 说明 |
| --- | --- | --- |
| 用户点击更新 UI | 合理 | 最常见使用方式 |
| 表单提交前设置 loading | 合理 | 事件引发的状态更新 |
| 接口返回后保存数据 | 合理 | 注意竞态与卸载 |
| 外部订阅通知后更新状态 | 合理 | 需要 cleanup |
| 根据 props 计算展示值 | 通常不需要 | 直接在 Render 中计算 |
| Effect 中同步复制 props 到 state | 通常不合理 | 造成额外 Render |
| Render 中无条件调用 | 错误 | 造成无限循环 |
| updater 中修改旧 state | 错误 | 破坏纯净性 |

## 16. 面试回答

### setState 算不算副作用

> 从广义函数式编程角度，`setState` 不是纯计算，因为它会向 React 提交更新。但在 React 语境中，更准确地说它是状态更新入口。接口请求、订阅和 DOM 操作属于外部副作用，`setState` 负责把这些交互产生的结果放入 React 状态。二者经常一起出现，但并不等价。

### 为什么不能在 Render 中调用 setState

> Render 应该是根据 props、state 和 context 计算 JSX 的纯过程。无条件在 Render 中调用 `setState` 会在当前渲染尚未稳定时继续发起更新，通常形成无限循环，也会破坏 React 重复、暂停或放弃 Render 的能力。

### Effect 中能不能调用 setState

> 可以，尤其是在接口、订阅等外部系统返回结果后更新状态。但如果只是根据已有 props 或 state 计算另一个值，通常不需要 Effect 和 `setState`，应该直接派生计算，避免多一次 Render 和 Commit。

### Strict Mode 为什么执行两次

> Strict Mode 在开发环境重复调用组件、state initializer 和 updater，以发现不纯逻辑；它还会让 Effect 额外经历一次 setup、cleanup、setup，验证 cleanup 是否完整。第一次 Render 的结果可能被丢弃，因此不等于 DOM 一定提交两次。这些额外检查不会发生在生产环境。

## 17. 最终结论

需要记住三个边界：

```text
接口请求、订阅、DOM 操作：
属于与外部系统交互的副作用

setState：
向 React 提交状态更新并请求重新渲染

Render：
只根据输入计算 JSX，必须保持纯净
```

一句话总结：

> 副作用负责与 React 外部系统交互；setState 负责把交互结果提交给 React，从而触发新的 Render。两者经常连续出现，但互不等价，也不一定同时存在。Strict Mode 通过开发环境的重复执行来验证这些边界是否可靠。

## 参考资料

- React：Keeping Components Pure  
  https://react.dev/learn/keeping-components-pure
- React：Components and Hooks must be pure  
  https://react.dev/reference/rules/components-and-hooks-must-be-pure
- React：State as a Snapshot  
  https://react.dev/learn/state-as-a-snapshot
- React：Queueing a Series of State Updates  
  https://react.dev/learn/queueing-a-series-of-state-updates
- React：You Might Not Need an Effect  
  https://react.dev/learn/you-might-not-need-an-effect
- React：StrictMode  
  https://react.dev/reference/react/StrictMode
- React：useEffect  
  https://react.dev/reference/react/useEffect
- React ESLint：set-state-in-render  
  https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-render
- React ESLint：set-state-in-effect  
  https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect
