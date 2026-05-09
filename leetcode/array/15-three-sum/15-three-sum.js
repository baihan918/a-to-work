/**
 * LeetCode 15. 三数之和
 *
 * 思路：
 * 先排序，再枚举第一个数，剩下两个数用双指针查找。
 *
 * @param {number[]} nums
 * @return {number[][]}
 */
function threeSum(nums) {
  const result = [];

  nums.sort((a, b) => a - b);

  for (let i = 0; i < nums.length - 2; i += 1) {
    if (nums[i] > 0) {
      break;
    }

    if (i > 0 && nums[i] === nums[i - 1]) {
      continue;
    }

    let left = i + 1;
    let right = nums.length - 1;

    while (left < right) {
      const sum = nums[i] + nums[left] + nums[right];

      if (sum === 0) {
        result.push([nums[i], nums[left], nums[right]]);

        while (left < right && nums[left] === nums[left + 1]) {
          left += 1;
        }

        while (left < right && nums[right] === nums[right - 1]) {
          right -= 1;
        }

        left += 1;
        right -= 1;
      } else if (sum < 0) {
        left += 1;
      } else {
        right -= 1;
      }
    }
  }

  return result;
}

console.log(threeSum([-1, 0, 1, 2, -1, -4])); // [[-1, -1, 2], [-1, 0, 1]]

module.exports = threeSum;
