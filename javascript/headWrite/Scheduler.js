class Scheduler {
  constructor(limit) {
    this.limit = limit;
    this.running = 0;
    this.queue = [];
  }

  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push(() => {
        return Promise.resolve()
          .then(task)
          .then(resolve)
          .catch(reject);
      });

      this.run();
    });
  }

  run() {
    if (this.running >= this.limit) return;
    if (!this.queue.length) return;

    const task = this.queue.shift();

    this.running++;

    task().finally(() => {
      this.running--;
      this.run();
    });
  }
}


// demo
const scheduler = new Scheduler(2);

const addTask = (time, name) => {

  scheduler.add(() => {

    return new Promise((resolve) => {

      setTimeout(() => {

        console.log(name);

        resolve(name);

      }, time);

    });

  });

};

addTask(1000, "1");

addTask(500, "2");

addTask(300, "3");

addTask(400, "4");