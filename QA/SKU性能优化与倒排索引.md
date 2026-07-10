# SKU 性能优化与倒排索引

## 1. 基本概念

| 概念 | 含义 | 示例 |
| --- | --- | --- |
| SPU | 标准商品，是一类商品的抽象 | 某款圆领 T 恤 |
| 规格组 | 用于区分 SKU 的销售属性 | 颜色、尺码、材质 |
| 规格值 | 规格组下的具体取值 | 红色、M、棉 |
| 规格组合 | 多个规格值组成的组合 | 红色 + M + 棉 |
| SKU | 绑定了 ID、价格和库存等信息的可销售单元 | 红色 + M + 棉，价格 199，库存 10 |

“红色 + M + 棉”严格来说是一个 SKU 规格组合。只有绑定了 `skuId`、价格、库存等信息后，才是一条完整 SKU。

材质是否属于 SKU 规格取决于业务：如果材质影响价格或独立库存，它是销售规格；如果只用于商品描述，它通常属于 SPU 属性。

## 2. 大量 SKU 为什么容易产生性能问题

多个规格组之间会形成笛卡尔积：

```text
颜色 10 × 尺码 10 × 材质 10 = 1000 个理论组合
```

主要性能压力包括：

1. 规格变化时全量重新生成笛卡尔积。
2. 每次选择规格都遍历全部 SKU，判断其他规格是否可选。
3. 使用 `find`、`filter`、`some` 产生大量重复遍历和临时对象。
4. 后台同时渲染大量 SKU 行、输入框和校验状态。
5. 修改一个字段导致整行、整表甚至整个表单重新渲染。
6. 深拷贝全部 SKU 数据，增加 CPU 和内存开销。

需要分别解决四类问题：

| 问题 | 优化手段 |
| --- | --- |
| 初始化与规格变化计算 | 增量生成 |
| SKU 查询与可选状态判断 | 组合索引、倒排索引或位图 |
| 大量数据更新 | 范式化状态与结构共享 |
| 大量表格渲染 | 虚拟化与字段级订阅 |

## 3. 后端与前端的职责

商品详情场景下，通常由后端返回这个 SPU 实际存在的 SKU，以及每条 SKU 的库存、价格等信息：

```ts
type SKU = {
  skuId: string;
  specValueIds: string[];
  price: number;
  stock: number;
};

const skus: SKU[] = [
  {
    skuId: "sku-1",
    specValueIds: ["color:red", "size:m", "material:cotton"],
    price: 199,
    stock: 10,
  },
  {
    skuId: "sku-2",
    specValueIds: ["color:red", "size:l", "material:cotton"],
    price: 199,
    stock: 0,
  },
];
```

前端不应该假设哪些组合存在或有库存，而应以后端数据为事实，初始化时扫描一次并建立索引。

## 4. 什么是倒排索引

普通数据描述的是：

```text
SKU -> 包含哪些规格值
```

倒排索引反过来描述：

```text
规格值 -> 出现在哪些可售 SKU 中
```

假设后端返回以下实际 SKU：

| SKU ID | 规格组合 | 库存 |
| --- | --- | ---: |
| 1 | 红色 + M + 棉 | 10 |
| 2 | 红色 + L + 棉 | 8 |
| 3 | 蓝色 + M + 涤纶 | 5 |
| 4 | 红色 + M + 涤纶 | 3 |

对应的可售倒排索引为：

```ts
{
  "color:red": Set([1, 2, 4]),
  "color:blue": Set([3]),
  "size:m": Set([1, 3, 4]),
  "size:l": Set([2]),
  "material:cotton": Set([1, 2]),
  "material:polyester": Set([3, 4])
}
```

倒排索引不会预先创建下面这些组合：

```text
红色 + M
红色 + 棉
M + 棉
红色 + M + 棉
```

这些属于组合索引或路径索引。倒排索引只保存单个规格值与 SKU 集合的关系，查询组合时临时求交集。

例如查询“红色 + M + 涤纶”：

```text
红色：{1, 2, 4}
M：   {1, 3, 4}
涤纶：{3, 4}

交集：{4}
```

因此，该组合对应 SKU 4。

## 5. 如何建立索引

通常同时建立两类索引：

| 索引 | 用途 |
| --- | --- |
| `组合键 -> SKU` | 完整选中后定位具体 SKU |
| `规格值 -> 可售 SKU ID 集合` | 选择过程中判断候选规格值是否可选 |

```ts
const skuMap = new Map<string, SKU>();
const availableIndex = new Map<string, Set<string>>();

function createSkuKey(valueIds: string[]) {
  return [...valueIds].sort().join("|");
}

for (const sku of skus) {
  skuMap.set(createSkuKey(sku.specValueIds), sku);

  if (sku.stock <= 0) continue;

  for (const valueId of sku.specValueIds) {
    let skuIds = availableIndex.get(valueId);

    if (!skuIds) {
      skuIds = new Set();
      availableIndex.set(valueId, skuIds);
    }

    skuIds.add(sku.skuId);
  }
}
```

保留全部 SKU 的 `skuMap`，用于查询价格、库存和售罄状态；倒排索引只收录当前可售 SKU，用于计算规格可选状态。

## 6. `10 × 10 × 10` 场景如何处理

三个规格组各有 10 个规格值，最多存在 1000 条 SKU。前端不能提前假设这些 SKU 都有库存，应扫描后端返回的数据：

```text
1000 条 SKU × 每条 3 个规格值 = 约 3000 次索引写入
```

这不是生成所有子组合，只是遍历实际 SKU，并把每条 SKU 的 ID 放入三个规格值集合中，复杂度为：

```text
O(SKU 数量 × 规格组数量)
```

用户已经选择“红色 + M”时，可以先计算一次当前匹配集合：

```ts
const matchedSkuIds = intersect(
  availableIndex.get("color:red"),
  availableIndex.get("size:m"),
);
```

判断某个材质能否选择时，只需检查它与当前结果是否存在交集：

```ts
function hasIntersection<T>(left: Set<T>, right: Set<T>) {
  const smaller = left.size <= right.size ? left : right;
  const larger = left.size <= right.size ? right : left;

  for (const value of smaller) {
    if (larger.has(value)) return true;
  }

  return false;
}
```

不要为每个候选规格值重新计算所有已选条件的完整交集。

## 7. 倒排索引一定更快吗

不一定，需要结合数据规模和交互频率判断。

| 规模与场景 | 建议 |
| --- | --- |
| 约 1000 条 SKU，交互简单 | 优化后的数组扫描也可能足够 |
| 数万条 SKU，频繁筛选 | 倒排索引优势明显 |
| 十万级 SKU | 可考虑 BitSet 位图索引 |
| 完整选择后定位 SKU | 使用组合键 `Map` |

假设需要判断 20 个候选规格值：

- 全量扫描可能执行约 `20 × 1000` 次检查。
- 倒排索引可以先缩小当前匹配集合，再判断候选集合是否与其相交。
- 倒排索引会占用额外内存，本例大约保存 `1000 × 3 = 3000` 个 SKU ID 关系。

因此，1000 条数据使用倒排索引不会有问题，但是否值得引入，应通过性能测量决定。它更重要的价值是让复杂度稳定，并方便处理实时库存变化。

## 8. 库存变化时增量维护索引

库存从无货变为有货时，把 SKU 加入对应规格值集合；从有货变为无货时，将其移除，不需要重建整个索引。

```ts
function updateStock(sku: SKU, nextStock: number) {
  const wasAvailable = sku.stock > 0;
  const isAvailable = nextStock > 0;

  sku.stock = nextStock;

  if (wasAvailable === isAvailable) return;

  for (const valueId of sku.specValueIds) {
    const skuIds = availableIndex.get(valueId);

    if (isAvailable) {
      if (skuIds) {
        skuIds.add(sku.skuId);
      } else {
        availableIndex.set(valueId, new Set([sku.skuId]));
      }
    } else {
      skuIds?.delete(sku.skuId);
    }
  }
}
```

如果库存更新频率很高，可以先批量合并同一 SKU 的库存事件，再统一修改索引和通知 React。

## 9. 后台编辑时如何增量生成 SKU

商家编辑规格时，规格值的增删可能改变 SKU 笛卡尔积。此时不要每次重建全部 SKU。

例如已有：

```text
颜色：[红、蓝]
尺码：[M、L]
```

新增颜色“黑”时，只生成：

```text
黑-M
黑-L
```

删除“蓝”时，只删除包含“蓝”的 SKU。

可以将 SKU 存为范式化结构：

```ts
type SkuState = {
  ids: string[];
  entities: Map<string, SKU>;
};
```

规格结构变化时增删相关 `skuId`；修改价格或库存时只更新对应 SKU 的字段。

## 10. 结构共享

不要在修改一个库存字段时深拷贝整个 SKU 列表。核心目标是：

- 未变化的 SKU 保持引用不变。
- 未变化的字段和视图不重新计算。
- 规格结构与价格、库存等字段状态分离。

可选方案包括：

- Redux Toolkit + Immer：开发体验好，适合大多数业务。
- Zustand 等外部 Store：便于细粒度订阅。
- `Map<skuId, SKU>` 加自定义订阅。
- HAMT、Immutable.js 等持久化数据结构：适合数据规模很大且结构共享要求高的场景。

需要注意：Immer 能降低不可变更新的编写成本，但不等于完全没有代理、复制和通知成本。

## 11. 虚拟化表格

后台存在几千甚至几万条 SKU 时，不能同时挂载所有行和输入框。虚拟化只渲染可视区域附近的行：

```tsx
<VirtualList
  count={skuIds.length}
  itemKey={(index) => skuIds[index]}
  itemContent={(index) => <SkuRow skuId={skuIds[index]} />}
/>
```

注意事项：

1. `itemKey` 使用稳定的 `skuId`，不要使用数组索引。
2. 固定行高性能最好，动态行高需要测量和缓存。
3. 排序和筛选优先生成新的 `skuIds`，不要复制全部 SKU 对象。
4. 虚拟化只减少 DOM，不会减少数据生成和索引计算。
5. 编辑中的输入值需要存入独立状态，避免行离开可视区域后丢失。

## 12. 字段级更新

不要让每个单元格订阅整张表或整个 SKU 对象。单元格只订阅自己的 `skuId + field`：

```tsx
function StockCell({ skuId }: { skuId: string }) {
  const stock = useSkuField(skuId, "stock");

  return (
    <input
      value={stock}
      onChange={(event) => {
        skuStore.setField(skuId, "stock", Number(event.target.value));
      }}
    />
  );
}
```

可以通过 `useSyncExternalStore` 接入字段级外部 Store：

```ts
function useSkuField(
  skuId: string,
  field: "price" | "stock",
) {
  const key = `${skuId}:${field}`;

  return useSyncExternalStore(
    (notify) => skuStore.subscribe(key, notify),
    () => skuStore.getField(skuId, field),
  );
}
```

这样修改一个库存输入框时，只通知对应单元格，而不是重新渲染整行或整张表。

## 13. 完整优化方案

前台商品选择：

1. 后端返回实际 SKU、库存和价格。
2. 初始化时线性扫描，建立组合键索引和可售倒排索引。
3. 选择过程中通过集合求交判断规格可选状态。
4. 完整选中后通过组合键直接定位 SKU。
5. 库存变化时增量维护索引。

后台 SKU 编辑：

1. 规格增删时增量生成或删除相关 SKU。
2. 使用范式化状态和结构共享，避免深拷贝全部数据。
3. 使用虚拟化表格控制 DOM 数量。
4. 使用 `skuId + field` 订阅实现单元格级更新。
5. 批量修改、校验和提交时合并状态更新。

## 14. 面试总结

> 大量 SKU 的问题来自规格笛卡尔积、重复全量扫描和大规模表单渲染。前端应以后端返回的实际 SKU 和库存为事实，通过组合键快速定位完整 SKU，通过可售 SKU 的倒排索引计算规格可选状态；库存和规格变化时增量维护数据，后台再结合结构共享、虚拟化表格与字段级订阅，分别控制计算、内存、DOM 和 React 重渲染成本。

