let heading = document.querySelector('h1');
heading.textContent = 'Click anywhere to start'
document.body.onclick = init;

function init() {

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
  var source;
  var stream;

  var analyser = audioCtx.createAnalyser();
  analyser.minDecibels = -100;
  analyser.maxDecibels = 100;
  analyser.smoothingTimeConstant = 0;

  var gainNode = audioCtx.createGain();

  var soundSource;

  ajaxRequest = new XMLHttpRequest();

  ajaxRequest.open('GET', 'https://mdn.github.io/voice-change-o-matic/audio/concert-crowd.ogg', true);

  ajaxRequest.responseType = 'arraybuffer';

  ajaxRequest.onload = function () {
    var audioData = ajaxRequest.response;

    audioCtx.decodeAudioData(audioData, function (buffer) {
      soundSource = audioCtx.createBufferSource();
    }, function (e) { console.log("Error with decoding audio data" + e.err); });
  };

  ajaxRequest.send();

  // set up canvas context for visualizer

  var canvas = document.querySelector('.visualizer');
  var canvasCtx = canvas.getContext("2d");

  var intendedWidth = document.querySelector('.wrapper').clientWidth;

  canvas.setAttribute('width', intendedWidth);
  canvas.setAttribute('style', "");

  // main block for doing the audio recording

  if (navigator.mediaDevices.getUserMedia) {
    console.log('getUserMedia supported.');
    var constraints = { audio: true }
    navigator.mediaDevices.getUserMedia(constraints)
      .then(
        function (stream) {
          source = audioCtx.createMediaStreamSource(stream);
          source.connect(gainNode);
          gainNode.connect(analyser);
          visualize();
        })
      .catch(function (err) { console.log('The following gUM error occured: ' + err); })
  } else {
    console.log('getUserMedia not supported on your browser!');
  }

  function visualize() {

    WIDTH = canvas.width;
    HEIGHT = canvas.height;

    analyser.fftSize = 2048 * 16;
    var bufferLength = analyser.fftSize;
    console.log(bufferLength);
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

      var sliceWidth = WIDTH * 1.0 / bufferLength;
      var x = 0;

      for (var i = 0; i < bufferLength; i++) {

        var amp = 10;
        var v = dataArray[i];
        var y = HEIGHT / 2 * (1 + v * amp);

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
}
