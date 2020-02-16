let heading = document.querySelector('h1');
heading.textContent = 'Click anywhere to start'
document.body.onclick = init;

function init() {

  document.body.onclick = null;

  heading.textContent = 'Online Timegrapher';

  // Older browsers might not implement mediaDevices at all, so we set an empty object first
  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  // Some browsers partially implement mediaDevices. We can't just assign an object
  // with getUserMedia as it would overwrite existing properties.
  // Here, we will just add the getUserMedia property if it's missing.
  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {

      // First get ahold of the legacy getUserMedia, if present
      var getUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

      // Some browsers just don't implement it - return a rejected promise with an error
      // to keep a consistent interface
      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
      }

      // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    }
  }

  // set up forked web audio context, for multiple browsers
  // window. is needed otherwise Safari explodes

  var audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  var analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -90;
  analyser.maxDecibels = -10;
  analyser.smoothingTimeConstant = 0;

  var gainNode = audioCtx.createGain();

  // set up canvas context for visualizer

  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");

  var intendedWidth = document.querySelector('.wrapper').clientWidth;

  canvas.setAttribute('width', intendedWidth);

  var main = document.getElementById("main")
  main.setAttribute('style', "");

  // main block for doing the audio recording

  if (navigator.mediaDevices.getUserMedia) {
    console.log('getUserMedia is supported');
    var constraints = { audio: true }
    navigator.mediaDevices.getUserMedia(constraints)
      .then(
        function (stream) {
          var source = audioCtx.createMediaStreamSource(stream);
          source.connect(gainNode);
          gainNode.connect(analyser);
          visualize();
        })
      .catch(function (err) { console.log('The following gUM error occured: ' + err); })
  } else {
    console.log('getUserMedia not supported on your browser!');
  }

  function process(buffer) {

    const windowSize = 1024;

    var result = new Float32Array(buffer.length - windowSize + 1);

    var sum = 0;
    for (var i = 0; i < buffer.length; i++) {
      var rem;
      var add = buffer[i];
      if (i < windowSize) {
        rem = 0;
      } else {
        result[i - windowSize] = sum / windowSize;
        rem = buffer[i - windowSize];
      }
      sum += add * add - rem * rem;
    }

    result[result.length - 1] = sum / windowSize;

    return result;
  }

  function visualize() {

    WIDTH = canvas.width;
    HEIGHT = canvas.height;

    analyser.fftSize = 32 * 1024;
    var bufferLength = analyser.fftSize;
    var dataArray = new Float32Array(bufferLength);

    canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);

    var draw = function () {

      drawVisual = requestAnimationFrame(draw);

      analyser.getFloatTimeDomainData(dataArray);

      canvasCtx.fillStyle = 'rgb(255, 255, 255)';
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      canvasCtx.lineWidth = 1;
      canvasCtx.strokeStyle = 'rgb(0, 0, 0)';

      canvasCtx.beginPath();

      processedDataArray = process(dataArray);
      var sliceWidth = WIDTH * 1.0 / processedDataArray.length;

      var x = 0;

      for (var i = 0; i < processedDataArray.length; i++) {

        var v = processedDataArray[i];
        var y = HEIGHT * (1 - v);

        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }

        x += sliceWidth;
      }

      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
    };

    draw();
  }

  var gainChange = function (event) {

    var parsed = parseInt(gainInput.value, 10);

    if (isNaN(parsed) || parsed < 0 || parsed > 10000) {
      alert("Gain must be an integer between 0 and 10000");
      gainInput.value = gainNode.gain.value;
      return;
    }

    gainNode.gain.value = parsed;
  }

  var gainInput = document.getElementById("gainInput");
  gainInput.onchange = gainChange;

  gainChange();
}
