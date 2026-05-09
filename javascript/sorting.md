# JavaScript 排序算法

## 快速排序

快速排序的核心思想是分治：

1. 选择一个基准值 `pivot`。
2. 把比 `pivot` 小的元素放到左边。
3. 把比 `pivot` 大或相等的元素放到右边。
4. 递归排序左右两边。

示例：

```js
function quickSort(arr) {
  if (arr.length <= 1) return arr;

  const pivot = arr[0];
  const left = [];
  const right = [];

  for (let i = 1; i < arr.length; i++) {
    if (arr[i] < pivot) {
      left.push(arr[i]);
    } else {
      right.push(arr[i]);
    }
  }

  return [...quickSort(left), pivot, ...quickSort(right)];
}
```

特点：

- 平均时间复杂度：`O(n log n)`。
- 最坏时间复杂度：`O(n^2)`，例如基准值每次都选到最大值或最小值。
- 空间复杂度：上面这种非原地写法是 `O(n)`；原地分区写法通常是 `O(log n)` 递归栈。
- 稳定性：通常不稳定。

## 归并排序

归并排序的核心思想也是分治：

1. 先把数组不断二分，直到每个子数组只有一个元素。
2. 再把两个有序数组合并成一个更大的有序数组。
3. 不断合并，直到得到完整有序数组。

示例：

```js
function mergeSort(arr) {
  if (arr.length <= 1) return arr;

  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));

  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0;
  let j = 0;

  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }

  return result.concat(left.slice(i), right.slice(j));
}
```

特点：

- 时间复杂度稳定：`O(n log n)`。
- 空间复杂度：`O(n)`。
- 稳定性：稳定。合并时相等元素优先取左侧元素，可以保留原来的相对顺序。
- 适合场景：链表排序、外部排序、大数据分块合并。

## 核心区别

| 对比 | 快速排序 | 归并排序 |
| --- | --- | --- |
| 分治方式 | 先分区，再递归排序 | 先递归拆分，再合并 |
| 关键操作 | partition 分区 | merge 合并 |
| 平均时间复杂度 | `O(n log n)` | `O(n log n)` |
| 最坏时间复杂度 | `O(n^2)` | `O(n log n)` |
| 空间复杂度 | 原地版较省空间 | 需要额外 `O(n)` |
| 稳定性 | 通常不稳定 | 稳定 |

## 记忆方式

快速排序：找一个基准值，小的放左边，大的放右边。

归并排序：先拆到最小，再把有序小数组合并成有序大数组。

