document.body.onclick = init

async function init() {

    var audioCtx = setUp()

    var stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    var source = audioCtx.createMediaStreamSource(stream)

    var gainNode = audioCtx.createGain()
    gainNode.gain.value = 100
    source.connect(gainNode)

    var analyser = audioCtx.createAnalyser()
    analyser.fftSize = 32 * 1024
    analyser.minDecibels = -90
    analyser.maxDecibels = -10
    analyser.smoothingTimeConstant = 0
    gainNode.connect(analyser)

    var destination = audioCtx.createMediaStreamDestination()
    analyser.connect(destination)

    visualize()

    startRecording(destination.stream, 5000).then(processRecordedBlob)

    var recordedDataArray = null;

    function visualize() {

        var canvas = document.querySelector('.visualizer')
        var canvasCtx = canvas.getContext("2d")

        var width = canvas.width
        var height = canvas.height

        var bufferLength = analyser.fftSize
        var dataArray = new Float32Array(bufferLength)

        canvasCtx.clearRect(0, 0, width, height)

        var draw = function () {

            if (recordedDataArray == null) {
                drawVisual = requestAnimationFrame(draw)
                analyser.getFloatTimeDomainData(dataArray)
            } else {
                dataArray = recordedDataArray
            }

            canvasCtx.fillStyle = 'rgb(255, 255, 255)'
            canvasCtx.fillRect(0, 0, width, height)

            canvasCtx.lineWidth = 1
            canvasCtx.strokeStyle = 'rgb(0, 0, 0)'

            canvasCtx.beginPath()

            processedDataArray = process(dataArray)
            var sliceWidth = width * 1.0 / processedDataArray.length

            var x = 0

            for (var i = 0; i < processedDataArray.length; i++) {

                var v = processedDataArray[i]
                var y = height * (1 - v)

                if (i === 0) {
                    canvasCtx.moveTo(x, y)
                } else {
                    canvasCtx.lineTo(x, y)
                }

                x += sliceWidth
            }

            canvasCtx.lineTo(canvas.width, canvas.height / 2)
            canvasCtx.stroke()
        }

        draw()
    }

    function process(buffer) {

        const windowSize = 1024

        var result = new Float32Array(buffer.length - windowSize + 1)

        var sum = 0
        for (var i = 0; i < buffer.length; i++) {
            var rem
            var add = buffer[i]
            if (i < windowSize) {
                rem = 0
            } else {
                result[i - windowSize] = sum / windowSize
                rem = buffer[i - windowSize]
            }
            sum += add * add - rem * rem
        }

        result[result.length - 1] = sum / windowSize

        return result
    }

    function startRecording(stream, lengthInMs) {

        let data = []

        let recorder = new MediaRecorder(stream)
        recorder.ondataavailable = async event => {
            data.push(event.data)
        }

        recorder.start(500)
        console.log(recorder.state + " for " + (lengthInMs / 1000) + " seconds...")

        let stopped = new Promise((resolve, reject) => {
            recorder.onstop = resolve
            recorder.onerror = event => reject(event.name)
        })

        let recorded = wait(lengthInMs).then(
            () => recorder.state == "recording" && recorder.stop()
        )

        return Promise.all([stopped, recorded])
            .then(() => {
                return new Blob(data, { 'type': 'audio/ogg codecs=opus' })
            })
    }

    async function processRecordedBlob(blob) {

        var arrayBuffer = await blob.arrayBuffer()
        var audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

        console.log(audioBuffer)

        recordedDataArray = audioBuffer.getChannelData(0)
    }

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
