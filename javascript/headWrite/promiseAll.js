function myPromiseAllSettled(iterable) {
  return new Promise(resolve => {
    const list = Array.from(iterable);
    const result = [];
    let finishedCount = 0;

    if (list.length === 0) {
      resolve([]);
      return;
    }

    list.forEach((item, index) => {
      Promise.resolve(item).then(
        value => {
          result[index] = {
            status: 'fulfilled',
            value: value
          };
        },
        reason => {
          result[index] = {
            status: 'rejected',
            reason: reason
          };
        }
      ).finally(() => {
        finishedCount++;

        if (finishedCount === list.length) {
          resolve(result);
        }
      });
    });
  });
}


// myPromiseAllSettled([
//   Promise.resolve(1),
//   Promise.reject('error'),
//   3
// ]);

// [
//   { status: 'fulfilled', value: 1 },
//   { status: 'rejected', reason: 'error' },
//   { status: 'fulfilled', value: 3 }
// ]