/**
 * 快速排序：左侧 pivot + 挖坑法
 *
 * @param {number[]} nums
 * @return {number[]}
 */
function quickSort(nums) {
  sort(nums, 0, nums.length - 1);
  return nums;
}

function sort(nums, left, right) {
  if (left >= right) return;

  const pivotIndex = partition(nums, left, right);

  sort(nums, left, pivotIndex - 1);
  sort(nums, pivotIndex + 1, right);
}

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

console.log(quickSort([4, 5, 2, 3, 1])); // [1, 2, 3, 4, 5]

module.exports = quickSort;
