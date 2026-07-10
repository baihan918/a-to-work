
function throttle(fn, deley) {
  let timer = null;
  return function (...args) {
    if (timer) return;

    timer = setTimeout(() => {
      fn.apply(this, args);
      timer = null;
    }, deley);
  }
}

function debounce(fn, deley) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(args);
      timer = null;
    }, deley);
  }
}