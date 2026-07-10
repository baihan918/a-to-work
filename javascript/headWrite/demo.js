function myPromiseAllSettled(proArr) {
  return new Promise(resolve => {
    const list = Array.from(proArr);
    const res = [];
    let finishedCount = 0;

    list.forEach((it, index) => {
      Promise
        .resolve(it)
        .then(
          value => {
            res[index] = {
              status: 'fulfilled',
              value,
            }
          },
          reson => {
            res[index] = {
              status: 'reject',
              reson
            }
          }
        )
        .finally(() => {
          finishedCount++;

          if (finishedCount === list.length) {
            resolve(res);
          }
        });
    });
  });
}