/**
 * LeetCode 28. 找出字符串中第一个匹配项的下标
 *
 * 思路：
 * 枚举 haystack 中每一个可能的起点，
 * 从该起点开始逐个字符比较 needle。
 *
 * @param {string} haystack
 * @param {string} needle
 * @return {number}
 */
function strStr(haystack, needle) {
  if (needle.length === 0) {
    return 0;
  }

  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let matched = true;

    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        matched = false;
        break;
      }
    }

    if (matched) {
      return i;
    }
  }

  return -1;
}

console.log(strStr('sadbutsad', 'sad')); // 0
console.log(strStr('leetcode', 'leeto')); // -1
console.log(strStr('sbsdffafdixfssw', 'fdi')); // 7

module.exports = strStr;
