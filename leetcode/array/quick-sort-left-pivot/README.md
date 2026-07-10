# 快速排序：左侧 pivot + 挖坑法

## 分类

- Array
- Sorting
- Divide and Conquer

## 题目目标

实现快速排序，把数组升序排列。

这里沉淀的是 `pivot` 取最左边元素的原地分区写法，也就是常说的“挖坑法”。

## 核心思路

快速排序分成两步：

1. 选一个基准值 `pivot`。
2. 通过 `partition` 把数组分成两边：
   - `pivot` 左边都 `<= pivot`
   - `pivot` 右边都 `>= pivot`
3. 递归排序 `pivot` 左右两段。

左侧 `pivot` 的版本里：

```js
const pivot = nums[left];
```

因为 `pivot` 已经被单独保存，所以 `left` 位置可以理解成一个“坑”。

## partition 代码

```js
function partition(nums, left, right) {
  const pivot = nums[left];
  let i = left;
  let j = right;

  while (i < j) {
    while (i < j && nums[j] >= pivot) {
      j--;
    }
    nums[i] = nums[j];

    while (i < j && nums[i] <= pivot) {
      i++;
    }
    nums[j] = nums[i];
  }

  nums[i] = pivot;
  return i;
}
```

## 为什么是赋值，不是交换

这版不是普通交换法，而是挖坑法。

一开始：

```js
const pivot = nums[left];
```

已经把 `nums[left]` 保存到了 `pivot`，所以 `left` 位置可以被覆盖。

这句：

```js
nums[i] = nums[j];
```

含义不是交换，而是：

```text
把右边找到的较小元素，填到左边的坑里
```

填完以后，`j` 位置就变成了新的坑。

接着这句：

```js
nums[j] = nums[i];
```

含义是：

```text
把左边找到的较大元素，填到右边的坑里
```

填完以后，`i` 位置又变成了新的坑。

最后 `i` 和 `j` 相遇，把最开始保存的 `pivot` 填回最后的坑：

```js
nums[i] = pivot;
```

所以中间赋值看起来会“覆盖元素”，但被覆盖的位置本来就是坑；真正的 `pivot` 已经提前保存，不会丢。

## 过程解析

以这个数组为例：

```js
nums = [4, 5, 2, 3, 1]
```

初始状态：

```text
pivot = 4
i = 0
j = 4

[4, 5, 2, 3, 1]
 ^
 坑，4 已经保存到 pivot
```

### 第一步：从右往左找小于 pivot 的元素

从右边开始找第一个 `< 4` 的元素，找到 `1`：

```js
nums[i] = nums[j];
```

得到：

```text
[1, 5, 2, 3, 1]
             ^
             这里变成新坑
```

注意此时数组里看起来有两个 `1`，这是正常的。右边那个位置已经是坑，后面会被覆盖。

### 第二步：从左往右找大于 pivot 的元素

从左边开始找第一个 `> 4` 的元素，找到 `5`：

```js
nums[j] = nums[i];
```

得到：

```text
[1, 5, 2, 3, 5]
    ^
    这里变成新坑
```

### 第三步：继续从右往左找小于 pivot 的元素

继续从右边找 `< 4` 的元素，找到 `3`：

```js
nums[i] = nums[j];
```

得到：

```text
[1, 3, 2, 3, 5]
          ^
          这里变成新坑
```

### 第四步：左右指针相遇

此时继续移动后，`i` 和 `j` 相遇。

把 `pivot` 填回最后的坑：

```js
nums[i] = pivot;
```

得到：

```text
[1, 3, 2, 4, 5]
```

此时 `4` 已经在最终位置：

```text
4 左边都 <= 4
4 右边都 >= 4
```

然后递归排序左右两边。

## 完整代码

见同目录下的 `quick-sort-left-pivot.js`。

## 复杂度

- 平均时间复杂度：`O(n log n)`
- 最坏时间复杂度：`O(n^2)`
- 空间复杂度：`O(log n)`，主要来自递归调用栈

## 易错点

- `nums[i] = nums[j]` 不是交换，是把右侧找到的小元素填到左边坑里。
- `nums[j] = nums[i]` 不是交换，是把左侧找到的大元素填到右边坑里。
- 必须先从右边开始找，因为初始坑在左边。
- 最后一定要执行 `nums[i] = pivot`，把基准值填回最终位置。
- 内层循环条件要带 `i < j`，避免两个指针越界交错。
