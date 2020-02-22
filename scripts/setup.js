
function setUp() {

    document.body.onclick = null

    // Older browsers might not implement mediaDevices at all, so we set an empty object first
    if (navigator.mediaDevices === undefined) {
        navigator.mediaDevices = {}
    }

    // Some browsers partially implement mediaDevices. We can't just assign an object
    // with getUserMedia as it would overwrite existing properties.
    // Here, we will just add the getUserMedia property if it's missing.
    if (navigator.mediaDevices.getUserMedia === undefined) {
        navigator.mediaDevices.getUserMedia = function (constraints) {

            // First get ahold of the legacy getUserMedia, if present
            var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia

            // Some browsers just don't implement it - return a rejected promise with an error
            // to keep a consistent interface
            if (!getUserMedia) {
                return Promise.reject(new Error('getUserMedia is not implemented in this browser'))
            }

            // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
            return new Promise(function (resolve, reject) {
                getUserMedia.call(navigator, constraints, resolve, reject)
            })
        }
    }

    let subtitle = document.querySelector('h2')

    if (!navigator.mediaDevices.getUserMedia) {
        subtitle.textContent = 'Unfortunately, your browser does not seem to support recording audio.'
        return;
    }

    subtitle.textContent = 'recording audio...'

    console.log('getUserMedia is supported')

    var intendedWidth = document.querySelector('.wrapper').clientWidth

    var canvas = document.querySelector('.visualizer')
    canvas.setAttribute('width', intendedWidth)

    var main = document.getElementById("main")
    main.setAttribute('style', "")

    return new (window.AudioContext || window.webkitAudioContext)()
}