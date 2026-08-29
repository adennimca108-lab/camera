/* ==========================================
CAMERA DETECTOR
MOTION + SOUND DETECTION
========================================== */


/* ==========================================
ELEMENTS
========================================== */

const camera =
document.getElementById("camera");

const motionCanvas =
document.getElementById("motionCanvas");

const snapshotCanvas =
document.getElementById("snapshotCanvas");

const cameraOverlay =
document.getElementById("cameraOverlay");

const cameraStatus =
document.getElementById("cameraStatus");

const statusIndicator =
document.getElementById("statusIndicator");

const recordingDot =
document.getElementById("recordingDot");

const motionAlert =
document.getElementById("motionAlert");

const startButton =
document.getElementById("startButton");

const startMonitoringButton =
document.getElementById(
"startMonitoringButton"
);

const stopMonitoringButton =
document.getElementById(
"stopMonitoringButton"
);

const motionEnabled =
document.getElementById(
"motionEnabled"
);

const soundEnabled =
document.getElementById(
"soundEnabled"
);

const motionSensitivity =
document.getElementById(
"motionSensitivity"
);

const soundSensitivity =
document.getElementById(
"soundSensitivity"
);

const motionSensitivityValue =
document.getElementById(
"motionSensitivityValue"
);

const soundSensitivityValue =
document.getElementById(
"soundSensitivityValue"
);

const cooldown =
document.getElementById(
"cooldown"
);

const motionLevelBar =
document.getElementById(
"motionLevelBar"
);

const soundLevelBar =
document.getElementById(
"soundLevelBar"
);

const motionLevelText =
document.getElementById(
"motionLevelText"
);

const soundLevelText =
document.getElementById(
"soundLevelText"
);

const detectionCount =
document.getElementById(
"detectionCount"
);

const photoCount =
document.getElementById(
"photoCount"
);

const monitoringStatus =
document.getElementById(
"monitoringStatus"
);

const latestSnapshot =
document.getElementById(
"latestSnapshot"
);

const historyList =
document.getElementById(
"historyList"
);

const historyCount =
document.getElementById(
"historyCount"
);

const clearHistoryButton =
document.getElementById(
"clearHistoryButton"
);

const clearLatestButton =
document.getElementById(
"clearLatestButton"
);


/* ==========================================
STATE
========================================== */

let stream = null;

let audioContext = null;

let analyser = null;

let microphoneSource = null;

let animationFrame = null;

let monitoring = false;

let previousFrame = null;

let lastCaptureTime = 0;

let detections = [];

let latestImage = null;

let soundLevel = 0;

let motionLevel = 0;

let soundDetectionCooldown = false;


/* ==========================================
LOAD SAVED DATA
========================================== */

document.addEventListener(
"DOMContentLoaded",
function () {

loadHistory();

updateUI();

updateSensitivityLabels();

}
);


/* ==========================================
START CAMERA
========================================== */

async function startCamera() {

if (stream) {

return true;

}


try {

stream =
await navigator.mediaDevices.getUserMedia({

video: {
facingMode: "user",

width: {
ideal: 1280
},

height: {
ideal: 720
}
},

audio: true

});


camera.srcObject =
stream;


await camera.play();


cameraOverlay.classList.add(
"hidden"
);


cameraStatus.textContent =
"Camera and microphone active";


statusIndicator.className =
"status-indicator online";


statusIndicator.querySelector(
"strong"
).textContent =
"ONLINE";


return true;

} catch (error) {

console.error(
"Camera error:",
error
);


alert(
"Camera or microphone access was denied. Please allow camera and microphone access in your browser and try again."
);


return false;

}

}


/* ==========================================
START MONITORING
========================================== */

async function startMonitoring() {

const started =
await startCamera();


if (!started) {
return;
}


monitoring = true;


recordingDot.classList.add(
"active"
);


startMonitoringButton.disabled =
true;


stopMonitoringButton.disabled =
false;


monitoringStatus.textContent =
"ON";


cameraStatus.textContent =
"Monitoring movement and sound";


setupAudioAnalyzer();


previousFrame = null;


detectionLoop();

}


/* ==========================================
STOP MONITORING
========================================== */

function stopMonitoring() {

monitoring = false;


if (animationFrame) {

cancelAnimationFrame(
animationFrame
);

animationFrame = null;

}


recordingDot.classList.remove(
"active"
);


startMonitoringButton.disabled =
false;


stopMonitoringButton.disabled =
true;


monitoringStatus.textContent =
"OFF";


cameraStatus.textContent =
stream
? "Camera active"
: "Camera is not running";


motionLevel =
0;

soundLevel =
0;


updateLevels();


motionAlert.classList.remove(
"visible"
);

}


/* ==========================================
STOP CAMERA COMPLETELY
========================================== */

function stopCamera() {

stopMonitoring();


if (stream) {

stream
.getTracks()
.forEach(
function (track) {
track.stop();
}
);

}


stream = null;


camera.srcObject = null;


cameraOverlay.classList.remove(
"hidden"
);


cameraStatus.textContent =
"Camera is not running";


statusIndicator.className =
"status-indicator offline";


statusIndicator.querySelector(
"strong"
).textContent =
"OFFLINE";


closeAudio();

}


/* ==========================================
AUDIO ANALYZER
========================================== */

function setupAudioAnalyzer() {

if (!stream) {
return;
}


try {

if (audioContext) {

return;

}


const AudioContext =
window.AudioContext ||
window.webkitAudioContext;


if (!AudioContext) {

console.warn(
"Web Audio API unavailable."
);

return;

}


audioContext =
new AudioContext();


analyser =
audioContext.createAnalyser();


analyser.fftSize =
1024;


analyser.smoothingTimeConstant =
0.75;


microphoneSource =
audioContext.createMediaStreamSource(
stream
);


microphoneSource.connect(
analyser
);


} catch (error) {

console.error(
"Audio analyzer error:",
error
);

}

}


/* ==========================================
CLOSE AUDIO
========================================== */

function closeAudio() {

if (audioContext) {

audioContext.close()
.catch(
function () {}
);

}


audioContext = null;

analyser = null;

microphoneSource = null;

}


/* ==========================================
DETECTION LOOP
========================================== */

function detectionLoop() {

if (!monitoring) {
return;
}


detectMovement();


detectSound();


updateLevels();


animationFrame =
requestAnimationFrame(
detectionLoop
);

}


/* ==========================================
MOTION DETECTION
========================================== */

function detectMovement() {

if (!motionEnabled.checked) {

motionLevel = 0;

return;

}


if (
camera.readyState <
HTMLMediaElement.HAVE_CURRENT_DATA
) {

return;

}


const width = 160;

const height = 100;


motionCanvas.width =
width;

motionCanvas.height =
height;


const context =
motionCanvas.getContext(
"2d",
{
willReadFrequently: true
}
);


context.drawImage(
camera,
0,
0,
width,
height
);


const frame =
context.getImageData(
0,
0,
width,
height
);


if (!previousFrame) {

previousFrame =
frame;

motionLevel = 0;

return;

}


let changedPixels = 0;

let totalDifference = 0;


const pixelStep = 4;


for (
let i = 0;
i < frame.data.length;
i += pixelStep
) {

const r =
frame.data[i];

const g =
frame.data[i + 1];

const b =
frame.data[i + 2];


const oldR =
previousFrame.data[i];

const oldG =
previousFrame.data[i + 1];

const oldB =
previousFrame.data[i + 2];


const difference =
Math.abs(r - oldR) +
Math.abs(g - oldG) +
Math.abs(b - oldB);


totalDifference +=
difference;


if (
difference > 80
) {

changedPixels++;

}

}


const totalPixels =
frame.data.length / 4;


const changedPercentage =
(
changedPixels /
totalPixels
) * 100;


const averageDifference =
totalDifference /
totalPixels;


motionLevel =
Math.min(
100,
(
changedPercentage * 8
) +
(
averageDifference / 10
)
);


previousFrame =
frame;


const threshold =
Number(
motionSensitivity.value
);


if (
motionLevel >= threshold
) {

triggerDetection(
"Movement"
);

}

}


/* ==========================================
SOUND DETECTION
========================================== */

function detectSound() {

if (
!soundEnabled.checked ||
!analyser
) {

soundLevel = 0;

return;

}


const data =
new Uint8Array(
analyser.fftSize
);


analyser.getByteTimeDomainData(
data
);


let sum = 0;


for (
let i = 0;
i < data.length;
i++
) {

const normalized =
(
data[i] - 128
) / 128;


sum +=
normalized *
normalized;

}


const rms =
Math.sqrt(
sum /
data.length
);


soundLevel =
Math.min(
100,
rms * 400
);


const threshold =
Number(
soundSensitivity.value
);


if (
soundLevel >= threshold &&
!soundDetectionCooldown
) {

soundDetectionCooldown =
true;


triggerDetection(
"Sound"
);


setTimeout(
function () {

soundDetectionCooldown =
false;

},
1000
);

}

}


/* ==========================================
TRIGGER DETECTION
========================================== */

function triggerDetection(
type
) {

const now =
Date.now();


const cooldownTime =
Number(
cooldown.value
);


if (
now - lastCaptureTime <
cooldownTime
) {

return;

}


lastCaptureTime =
now;


showDetectionAlert(
type
);


captureSnapshot(
type
);

}


/* ==========================================
ALERT
========================================== */

function showDetectionAlert(
type
) {

motionAlert.textContent =
type === "Movement"
? "🚨 MOVEMENT DETECTED"
: "🔊 LOUD SOUND DETECTED";


motionAlert.classList.add(
"visible"
);


statusIndicator.className =
"status-indicator alert";


statusIndicator.querySelector(
"strong"
).textContent =
"ALERT";


setTimeout(
function () {

motionAlert.classList.remove(
"visible"
);


if (monitoring) {

statusIndicator.className =
"status-indicator online";


statusIndicator.querySelector(
"strong"
).textContent =
"ONLINE";

}

},
1800
);

}


/* ==========================================
CAPTURE SNAPSHOT
========================================== */

function captureSnapshot(
triggerType
) {

if (
!camera.videoWidth ||
!camera.videoHeight
) {

return;

}


snapshotCanvas.width =
camera.videoWidth;


snapshotCanvas.height =
camera.videoHeight;


const context =
snapshotCanvas.getContext(
"2d"
);


context.drawImage(
camera,
0,
0,
snapshotCanvas.width,
snapshotCanvas.height
);


const image =
snapshotCanvas.toDataURL(
"image/jpeg",
0.85
);


const detection = {

id:
Date.now().toString() +
Math.random()
.toString(16)
.slice(2),

type:
triggerType,

time:
new Date().toISOString(),

image:
image

};


detections.unshift(
detection
);


/*
Keep the local history reasonably small.
This prevents localStorage from growing forever.
*/

if (
detections.length > 30
) {

detections =
detections.slice(
0,
30
);

}


latestImage =
image;


saveHistory();


renderLatestSnapshot();

renderHistory();

updateUI();

}


/* ==========================================
SAVE HISTORY
========================================== */

function saveHistory() {

try {

localStorage.setItem(
"cameraDetectorHistory",
JSON.stringify(
detections
)
);

} catch (error) {

console.warn(
"Could not save detection history.",
error
);

/*
Large images can exceed localStorage
limits. Keep fewer records.
*/

detections =
detections.slice(
0,
10
);

try {

localStorage.setItem(
"cameraDetectorHistory",
JSON.stringify(
detections
)
);

} catch (secondError) {

console.error(
secondError
);

}

}

}


/* ==========================================
LOAD HISTORY
========================================== */

function loadHistory() {

try {

const saved =
localStorage.getItem(
"cameraDetectorHistory"
);


if (saved) {

const parsed =
JSON.parse(
saved
);


if (
Array.isArray(parsed)
) {

detections =
parsed;

}

}


if (
detections.length > 0
) {

latestImage =
detections[0].image;

}

} catch (error) {

console.error(
"History loading error:",
error
);

detections = [];

latestImage = null;

}


renderLatestSnapshot();

renderHistory();

}


/* ==========================================
RENDER LATEST SNAPSHOT
========================================== */

function renderLatestSnapshot() {

if (!latestImage) {

latestSnapshot.innerHTML = `

<div class="empty-state">

<span>📸</span>

<p>
No snapshot yet.
</p>

</div>

`;

return;

}


const safeImage =
latestImage;


latestSnapshot.innerHTML = `

<img
src="${safeImage}"
alt="Latest detection snapshot"
>

<div class="snapshot-actions">

<a
class="download-button"
href="${safeImage}"
download="camera-detection.jpg"
>
⬇ Save Photo
</a>

</div>

`;

}


/* ==========================================
RENDER HISTORY
========================================== */

function renderHistory() {

if (
detections.length === 0
) {

historyList.innerHTML = `

<div class="empty-state">

<span>🛡️</span>

<p>
No detections yet.
</p>

</div>

`;

return;

}


historyList.innerHTML =
detections
.map(
function (item) {

return `

<div class="history-item">

<img
class="history-thumbnail"
src="${item.image}"
alt="Detection snapshot"
>

<div class="history-info">

<strong>
${escapeHTML(
item.type
)}
</strong>

<span>
${formatDateTime(
item.time
)}
</span>

</div>

<span class="history-type">
PHOTO
</span>

</div>

`;

}
)
.join("");

}


/* ==========================================
UI
========================================== */

function updateUI() {

detectionCount.textContent =
detections.length;


photoCount.textContent =
detections.length;


historyCount.textContent =
detections.length +
(
detections.length === 1
? " detection"
: " detections"
);

}


/* ==========================================
LIVE LEVELS
========================================== */

function updateLevels() {

const motion =
Math.round(
motionLevel
);


const sound =
Math.round(
soundLevel
);


motionLevelBar.style.width =
motion + "%";


soundLevelBar.style.width =
sound + "%";


motionLevelText.textContent =
motion + "%";


soundLevelText.textContent =
sound + "%";

}


/* ==========================================
SENSITIVITY LABELS
========================================== */

function updateSensitivityLabels() {

motionSensitivityValue.textContent =
motionSensitivity.value +
"%";


soundSensitivityValue.textContent =
soundSensitivity.value +
"%";

}


/* ==========================================
DATE
========================================== */

function formatDateTime(
value
) {

const date =
new Date(value);


if (
Number.isNaN(
date.getTime()
)
) {

return value;

}


return new Intl.DateTimeFormat(
"en-US",
{
month: "short",
day: "numeric",
year: "numeric",
hour: "numeric",
minute: "2-digit"
}
).format(date);

}


/* ==========================================
ESCAPE HTML
========================================== */

function escapeHTML(
value
) {

const div =
document.createElement(
"div"
);


div.textContent =
value == null
? ""
: String(value);


return div.innerHTML;

}


/* ==========================================
CLEAR HISTORY
========================================== */

clearHistoryButton.addEventListener(
"click",
function () {

if (
detections.length === 0
) {

return;

}


const confirmed =
confirm(
"Delete all detection history?"
);


if (!confirmed) {
return;
}


detections = [];

latestImage = null;


saveHistory();

renderLatestSnapshot();

renderHistory();

updateUI();

}
);


/* ==========================================
CLEAR LATEST
========================================== */

clearLatestButton.addEventListener(
"click",
function () {

latestImage = null;

renderLatestSnapshot();

}
);


/* ==========================================
BUTTONS
========================================== */

startButton.addEventListener(
"click",
startMonitoring
);


startMonitoringButton.addEventListener(
"click",
startMonitoring
);


stopMonitoringButton.addEventListener(
"click",
stopMonitoring
);


/* ==========================================
RANGE INPUTS
========================================== */

motionSensitivity.addEventListener(
"input",
updateSensitivityLabels
);


soundSensitivity.addEventListener(
"input",
updateSensitivityLabels
);


/* ==========================================
PAGE EXIT
========================================== */

window.addEventListener(
"beforeunload",
function () {

if (stream) {

stream
.getTracks()
.forEach(
function (track) {
track.stop();
}
);

}

}
);
