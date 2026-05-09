/**
 * LeetCode 567. 字符串的排列
 *
 * 思路：
 * 用固定长度滑动窗口统计字符频次。
 * 如果某个窗口的字符频次和 s1 完全一致，说明 s2 包含 s1 的排列。
 *
 * @param {string} s1
 * @param {string} s2
 * @return {boolean}
 */
function checkInclusion(s1, s2) {
  if (s1.length > s2.length) {
    return false;
  }

  const need = new Array(26).fill(0);
  const window = new Array(26).fill(0);
  const base = 'a'.charCodeAt(0);

  for (let i = 0; i < s1.length; i += 1) {
    need[s1.charCodeAt(i) - base] += 1;
    window[s2.charCodeAt(i) - base] += 1;
  }

  if (isSameCount(need, window)) {
    return true;
  }

  for (let right = s1.length; right < s2.length; right += 1) {
    const left = right - s1.length;

    window[s2.charCodeAt(right) - base] += 1;
    window[s2.charCodeAt(left) - base] -= 1;

    if (isSameCount(need, window)) {
      return true;
    }
  }

  return false;
}

function isSameCount(a, b) {
  for (let i = 0; i < 26; i += 1) {
    if (a[i] !== b[i]) {
      return false;
    }
  }

  return true;
}

console.log(checkInclusion('ab', 'eidbaooo')); // true
console.log(checkInclusion('ab', 'eidboaoo')); // false

module.exports = checkInclusion;
