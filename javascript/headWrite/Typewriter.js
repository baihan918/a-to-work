function createTypewriter(text, onUpdate, speed = 100) {
  const characters = Array.from(text)

  let index = 0
  let timer = null
  let status = 'idle' // idle | running | paused | finished

  function printNext() {
    if (status !== 'running') return

    if (index >= characters.length) {
      status = 'finished'
      timer = null
      return
    }

    index++
    onUpdate(characters.slice(0, index).join(''))

    timer = setTimeout(printNext, speed)
  }

  function start() {
    if (status === 'running' || status === 'finished') return

    status = 'running'
    printNext()
  }

  function pause() {
    if (status !== 'running') return

    status = 'paused'
    clearTimeout(timer)
    timer = null
  }

  function resume() {
    if (status !== 'paused') return

    status = 'running'
    printNext()
  }

  function reset() {
    clearTimeout(timer)

    index = 0
    timer = null
    status = 'idle'

    onUpdate('')
  }

  return {
    start,
    pause,
    resume,
    reset,
    getStatus: () => status,
  }
}




// demo

// <div id="app"></div>

// <button id="start">开始</button>
// <button id="pause">暂停</button>
// <button id="resume">恢复</button>
// <button id="reset">重置</button>

// <script>
//   const app = document.querySelector('#app')

//   const typewriter = createTypewriter(
//     '这是一段支持暂停和恢复的打字机文字。',
//     text => {
//       app.textContent = text
//     },
//     100
//   )

//   document.querySelector('#start').onclick = typewriter.start
//   document.querySelector('#pause').onclick = typewriter.pause
//   document.querySelector('#resume').onclick = typewriter.resume
//   document.querySelector('#reset').onclick = typewriter.reset
// </script>
