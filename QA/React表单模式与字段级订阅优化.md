# React 表单模式与字段级订阅优化

## 一、受控组件与非受控组件

### 1. 受控组件

受控组件的值由 React 状态管理，输入组件通过 `value` 接收值，通过 `onChange` 更新状态。

```tsx
const [name, setName] = useState("");

<Input
  value={name}
  onChange={(event) => setName(event.target.value)}
/>;
```

适合以下场景：

- 输入值需要实时参与业务逻辑
- 字段之间存在实时联动
- 需要实时校验、格式化或限制输入
- 输入状态需要同步到其他组件或全局 Store
- 需要由外部状态主动修改字段值

受控组件的主要问题是：状态变化会触发订阅该状态的 React 组件重新渲染。如果把整张大表单放在父组件的一个 `useState` 中，任意字段变化都可能导致父组件和大量子组件重新执行。

### 2. 非受控组件

非受控组件的实时值由 DOM 自己保存，React 通常在提交时通过 `ref` 读取。

```tsx
const inputRef = useRef<HTMLInputElement>(null);

<Input ref={inputRef} defaultValue="" />;

const submit = () => {
  const name = inputRef.current?.value;
};
```

适合以下场景：

- React 只关心最终提交结果
- 字段几乎没有实时联动
- 大量字段需要减少输入过程中的 React 渲染
- 文件输入
- 接入由 DOM 或第三方库管理状态的组件

### 3. 选择原则

可以用一句话判断：

> React 需要实时决定字段值时使用受控模式；React 只关心最终结果时可以使用非受控模式。

大型表单不必在“全部受控”和“全部非受控”之间二选一。更常见的方案是使用表单 Store 和字段级订阅，将受控更新限制在单个字段范围内。

---

## 二、Redux 用于大表单时是否天然具备订阅能力

Redux 本身是发布订阅模式，但使用 Redux 不代表自动获得字段级渲染优化。真正的更新粒度取决于组件如何使用 `useSelector`。

### 1. 粗粒度订阅

```tsx
const form = useSelector((state: RootState) => state.form);
```

组件订阅了整个 `form` 对象。任意字段变化导致对象引用变化后，该组件都会重新渲染。

### 2. 字段级订阅

```tsx
function NameField() {
  const value = useSelector(
    (state: RootState) => state.form.name,
  );
  const dispatch = useDispatch();

  return (
    <Input
      value={value}
      onChange={(event) => {
        dispatch(
          updateField({
            name: "name",
            value: event.target.value,
          }),
        );
      }}
    />
  );
}
```

每个字段组件只订阅自己的值，修改 `name` 时，通常只有依赖 `name` 的组件更新。

因此：

- Redux 提供 Store 和订阅机制
- `useSelector` 决定状态订阅粒度
- 组件拆分决定 React 渲染边界
- Immer 只简化不可变更新，不负责字段订阅

对于百字段表单，每次输入都 dispatch 到 Redux 仍会经过完整的 Redux 更新与订阅通知流程。除非字段值确实需要跨页面或跨模块实时共享，否则不建议把每次键入都同步到 Redux。

---

## 三、Ant Design Form 属于什么模式

Ant Design Form 可以概括为：

> 集中式 FormStore + 字段实体注册 + 字段级订阅 + 受控输入组件。

```tsx
<Form.Item name="username">
  <Input />
</Form.Item>
```

其内部过程可以近似理解为：

1. `Form.Item` 使用 `name` 向 FormStore 注册字段实体。
2. `Form.Item` 订阅 `username` 对应的值和字段状态。
3. `Form.Item` 向 `Input` 注入 `value` 和 `onChange`。
4. 用户输入时，`onChange` 将新值写入 FormStore。
5. FormStore 通知与 `username` 相关的字段实体。
6. 对应的 `Form.Item` 重新渲染，并向 `Input` 传入新值。

从 `Input` 的角度看，它是受控组件；但字段值并不保存在页面父组件的 `useState` 中，而是保存在 FormStore 中。

### Ant Design Form 与 Redux 的类比

| Ant Design Form | Redux |
| --- | --- |
| FormStore | Redux Store |
| `setFieldValue` | `dispatch` |
| `getFieldValue` | `getState` |
| `Form.Item name` | 字段级 `useSelector` |
| `Form.useWatch` | `useSelector` |
| `dependencies` | 多状态依赖 |
| `initialValues` | `preloadedState` |
| `onFinish` | 读取状态并提交 |

这个类比在状态存储和订阅模型上成立，但 Ant Design Form 还负责：

- 字段注册和卸载
- `touched`、`validating`、`errors`、`warnings`
- 同步与异步校验
- 字段依赖和联动
- 嵌套路径
- 动态数组字段
- 初始值、重置和批量赋值
- 字段值是否在卸载后保留

所以更准确的结论是：

> Ant Design Form 是一个表单领域专用的 Store 和订阅系统，不只是普通的全局状态管理。

---

## 四、百字段 Ant Design Form 如何优化

### 1. 不要重复维护整份表单 state

不推荐：

```tsx
const [formData, setFormData] = useState({});

<Form
  onValuesChange={(_, values) => {
    setFormData(values);
  }}
/>;
```

这样每次输入既更新 FormStore，又更新页面 state，容易导致整个页面重新渲染。

推荐让 FormStore 成为字段实时状态的唯一来源：

```tsx
const [form] = Form.useForm();

<Form
  form={form}
  initialValues={initialData}
  onFinish={handleSubmit}
>
  {/* fields */}
</Form>;
```

### 2. 精确声明字段依赖

字段校验或联动优先使用 `dependencies`：

```tsx
<Form.Item name="country" label="国家">
  <Select options={countryOptions} />
</Form.Item>

<Form.Item
  name="province"
  label="省份"
  dependencies={["country"]}
  rules={[
    ({ getFieldValue }) => ({
      validator(_, value) {
        return validateProvince(
          getFieldValue("country"),
          value,
        );
      },
    }),
  ]}
>
  <Select />
</Form.Item>
```

### 3. 避免无边界的 `shouldUpdate`

不推荐：

```tsx
<Form.Item shouldUpdate>
  {() => (
    <HeavyComponent values={form.getFieldsValue()} />
  )}
</Form.Item>
```

`shouldUpdate={true}` 会响应表单的任意变化。应尽量使用精确比较：

```tsx
<Form.Item
  noStyle
  shouldUpdate={(previous, current) =>
    previous.accountType !== current.accountType
  }
>
  {({ getFieldValue }) =>
    getFieldValue("accountType") === "company" && (
      <CompanyFields />
    )
  }
</Form.Item>
```

一般不要在同一个 `Form.Item` 上同时使用 `dependencies` 和 `shouldUpdate`，避免形成冲突的更新逻辑。

### 4. `useWatch` 只监听必要字段

```tsx
function CompanySection({ form }: Props) {
  const accountType = Form.useWatch("accountType", form);

  if (accountType !== "company") {
    return null;
  }

  return <CompanyFields />;
}
```

不要在大组件中监听整份表单。字段监听应该下沉到真正消费该值的组件中。

### 5. 按业务区块拆分组件

```tsx
<Form form={form}>
  <BasicInfoSection />
  <ContactSection />
  <ProductSection />
  <DeliverySection />
</Form>
```

组件拆分可以隔离页面自身状态变化带来的渲染。`React.memo` 可以用于阻止 props 没有变化的区块重新渲染，但 FormStore 的字段订阅仍由内部 `Form.Item` 处理。

### 6. 控制校验频率

复杂校验和接口校验可以改到失焦时执行：

```tsx
<Form.Item
  name="username"
  validateTrigger="onBlur"
  rules={[{ validator: validateUsername }]}
>
  <Input />
</Form.Item>
```

也可以使用防抖校验：

```tsx
<Form.Item
  name="username"
  validateDebounce={400}
  rules={[{ validator: validateUsername }]}
>
  <Input />
</Form.Item>
```

异步校验还应避免旧请求晚于新请求返回后覆盖最新结果。

### 7. 不要逐键同步整份数据到 Redux

不推荐：

```tsx
<Form
  onValuesChange={(_, values) => {
    dispatch(updateForm(values));
  }}
/>;
```

推荐职责划分：

- Ant Design Form 管理实时字段、校验和联动
- Redux 管理接口原始数据、跨页面状态和草稿快照
- 初始化时将数据写入 Form
- 暂存或提交时同步 Redux 或后端
- 只有确实影响全局业务的少数字段实时同步

### 8. 分步挂载大量重组件

如果字段包含富文本、上传、树选择器、复杂表格等重组件，可以按步骤或页签分批挂载：

```tsx
{currentStep === 0 && <BasicFields />}
{currentStep === 1 && <ProductFields />}
```

需要注意 `preserve`：

- 保持默认配置时，字段卸载后通常仍保留值
- `preserve={false}` 时，字段卸载会移除对应值

---

## 五、自研字段级 FormItem 是否和 Ant Design Form 类似

如果自己实现以下结构，其核心状态和渲染模型与 Ant Design Form 非常接近：

- 独立于 React 组件树的 FormStore
- `FormItem` 按字段路径注册
- 每个 `FormItem` 只订阅自己的字段
- Store 更新后只通知相关字段
- `FormItem` 向输入组件注入 `value` 和 `onChange`

```tsx
function FormItem({ name, children }: FormItemProps) {
  const store = useFormStore();

  const value = useSyncExternalStore(
    (notify) => store.subscribe(name, notify),
    () => store.getValue(name),
    () => store.getValue(name),
  );

  return React.cloneElement(children, {
    value,
    onChange: (event: React.ChangeEvent<HTMLInputElement>) => {
      store.setValue(name, event.target.value);
    },
  });
}
```

更新过程如下：

```text
username 输入变化
→ 更新 FormStore 中的 username
→ 只通知 username 订阅者
→ 对应 FormItem 重新渲染
→ 其他 FormItem 不更新
```

### 推荐的 Store 接口

```ts
type NamePath = string | Array<string | number>;

interface FieldMeta {
  touched: boolean;
  validating: boolean;
  errors: string[];
  warnings: string[];
}

interface FormStore {
  getFieldValue(name: NamePath): unknown;
  setFieldValue(name: NamePath, value: unknown): void;
  subscribe(
    name: NamePath,
    listener: () => void,
  ): () => void;
  getFieldMeta(name: NamePath): FieldMeta;
  validateFields(
    names?: NamePath[],
  ): Promise<Record<string, unknown>>;
}
```

### 订阅表不能只有一个全局监听集合

下面的实现虽然字段组件只读取一个值，但 Store 的任意更新仍会通知所有字段：

```tsx
useSyncExternalStore(
  store.subscribe,
  () => store.getValues()[name],
);
```

更合适的是按规范化后的字段路径维护监听器：

```ts
Map<string, Set<() => void>>
```

更新字段时只通知：

1. 当前字段订阅者
2. 依赖当前字段的订阅者
3. 必要的表单级订阅者

多个字段的批量修改还应合并通知，避免同一个订阅者在一次事务中重复更新。

---

## 六、自研方案与成熟表单库的差距

只实现字段 Store、注册和单字段订阅，可以获得最核心的性能模型。但要成为通用表单库，还需要处理：

- 字段嵌套路径的读取、更新与比较
- 字段数组增删后路径和元数据迁移
- 字段注册、注销和重复注册
- 初始值优先级与重置语义
- 字段卸载后是否保留值
- 同步校验、异步校验和竞态
- 字段依赖图和循环依赖
- 批量更新与通知合并
- `valuePropName`，例如 Checkbox 的 `checked`
- 自定义事件取值，例如 `getValueFromEvent`
- 值转换、格式化与标准化
- 表单提交、错误聚合和滚动到错误字段
- React 并发渲染下的状态一致性
- SSR 下 `useSyncExternalStore` 的快照

所以：

- 固定业务场景、字段类型受控时，自研轻量方案可行
- 需要动态数组、复杂校验和通用组件接入时，成熟表单库更稳妥
- 自研的主要价值通常是满足特定业务模型，而不是重复实现完整表单生态

---

## 七、最终结论

1. 受控与非受控的区别，在于字段实时状态由 React 还是 DOM 管理。
2. Redux 本身支持订阅，但字段级性能依赖细粒度 `useSelector` 和组件拆分。
3. Ant Design Form 本质上是表单领域的集中式 Store 与字段级订阅系统。
4. Ant Design 的输入组件仍是受控的，只是字段状态保存在 FormStore，而非页面父组件 state。
5. 百字段表单的重点是避免重复状态、全量监听、无边界联动、逐键同步 Redux 和一次性挂载大量重组件。
6. 自研 FormItem 按单字段订阅，可以获得与 Ant Design Form 相近的核心渲染模型。
7. Ant Design Form 真正复杂的部分，是订阅模型之外的校验、字段依赖、动态数组、生命周期和并发一致性。

一句话总结：

> 大表单优化的核心不是简单选择受控或非受控，而是把状态更新限制在正确的字段范围内，并建立清晰、可控的订阅边界。
