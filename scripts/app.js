document.body.onclick = init

async function init() {

    var audioCtx = setUp()

    var stream = await navigator.mediaDevices.getUserMedia({ audio: true })

    var source = audioCtx.createMediaStreamSource(stream)

    var gainNode = audioCtx.createGain()
    gainNode.gain.value = 1000
    source.connect(gainNode)

    var analyser = audioCtx.createAnalyser()
    analyser.fftSize = 32 * 1024
    analyser.minDecibels = -90
    analyser.maxDecibels = -10
    analyser.smoothingTimeConstant = 0
    gainNode.connect(analyser)

    var destination = audioCtx.createMediaStreamDestination()
    analyser.connect(destination)

    var bph = 'not known yet'

    for (var n = 0; n < 15; n++) {

        var controls = document.querySelector('.controls')
        controls.textContent = 'Gain: ' + gainNode.gain.value + ' | BPH: ' + bph

        var blob = await startRecording(destination.stream, 2000)

        var arrayBuffer = await blob.arrayBuffer()
        var audioBuffer = await audioCtx.decodeAudioData(arrayBuffer)

        console.log(audioBuffer)

        var data = audioBuffer.getChannelData(0)
        squareValues(data)

        var movingAverageNormalizedData = getMovingAverageNormalized(data)

        var count = audioBuffer.sampleRate * 0.25 // 250 ms should be enough for a maximum to show up
        var autocorrelation = getAutocorrelation(movingAverageNormalizedData, count)

        var lookingForMin = true
        var prev = 2
        for (var i = 0; i < autocorrelation.length; i++) {
            if (lookingForMin) {
                if (autocorrelation[i] > prev)
                    lookingForMin = false
            } else {
                if (autocorrelation[i] < prev)
                    break
            }
            prev = autocorrelation[i]
        }

        var bph = Math.round(3600 / ((i - 1) / audioBuffer.sampleRate))
        console.log('bph', bph)

        visualize('wavesquared', movingAverageNormalizedData, 0, 1)
        visualize('autocorrelation', autocorrelation, -1, 1)

        var maxValue = getMaxValue(data)
        if (maxValue > 0.9)
            gainNode.gain.value = Math.round(gainNode.gain.value / 2)
        if (maxValue < 0.6)
            gainNode.gain.value = Math.round(gainNode.gain.value * 1.5)
    }

    let subtitle = document.querySelector('h2')
    subtitle.textContent = 'Stopped, reload the page to start again'

    function squareValues(dataArray) {
        for (var i = 0; i < dataArray.length; i++) {
            dataArray[i] = dataArray[i] * dataArray[i]
        }
    }

    function getMaxValue(dataArray) {
        var max = 0
        for (var i = 0; i < dataArray.length; i++) {
            if (dataArray[i] > max)
                max = dataArray[i]
        }
        return max
    }

    function visualize(canvasId, data, min, max) {

        var canvas = document.getElementById(canvasId)
        var canvasCtx = canvas.getContext("2d")

        var width = canvas.width
        var height = canvas.height

        canvasCtx.clearRect(0, 0, width, height)
        canvasCtx.fillStyle = 'rgb(255, 255, 255)'
        canvasCtx.fillRect(0, 0, width, height)
        canvasCtx.lineWidth = 1
        canvasCtx.strokeStyle = 'rgb(0, 0, 0)'

        canvasCtx.beginPath()

        var sliceWidth = width * 1.0 / data.length

        var x = 0

        for (var i = 0; i < data.length; i++) {

            var v = data[i]
            var y = height * (max - v) / (max - min)

            if (i === 0) {
                canvasCtx.moveTo(x, y)
            } else {
                canvasCtx.lineTo(x, y)
            }

            x += sliceWidth
        }

        canvasCtx.stroke()
    }

    function getMovingAverageNormalized(data) {

        const windowSize = 1024

        var result = new Float32Array(data.length - windowSize + 1)

        var sum = 0
        for (var i = 0; i < data.length; i++) {
            var rem
            var add = data[i]
            if (i < windowSize) {
                rem = 0
            } else {
                result[i - windowSize] = sum / windowSize
                rem = data[i - windowSize]
            }
            sum += add * add - rem * rem
        }

        result[result.length - 1] = sum / windowSize

        var maxValue = getMaxValue(result)
        var q = 0.9 / maxValue

        for (var i = 0; i < result.length; i++) {
            result[i] = result[i] * q
        }

        return result
    }

    function getAutocorrelation(data, count) {

        var begin = performance.now()

        var mean = getMean(data)

        var dataWoMean = new Float32Array(data.length)
        for (var i = 0; i < data.length; i++)
            dataWoMean[i] = data[i] - mean

        var result = new Float32Array(count)

        for (var lag = 0; lag < result.length; lag++) {
            var sum = 0
            for (var i = 0; i < dataWoMean.length - lag; i++) {
                sum += dataWoMean[i] * dataWoMean[i + lag]
            }
            result[lag] = sum
        }

        var sum0 = result[0]
        for (var lag = 0; lag < result.length; lag++) {
            result[lag] /= sum0
        }

        console.log('autocorrelation took ' + Math.round(performance.now() - begin) + ' ms')

        return result;
    }

    function getMean(data) {
        var sum = 0
        for (var i = 0; i < data.length; i++) {
            sum += data[i]
        }
        return sum / data.length
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

    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms))
    }
}
