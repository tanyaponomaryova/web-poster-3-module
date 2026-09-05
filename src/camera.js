import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import 'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js';
import 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js';

/* =========================================================
   ОБЩАЯ ИДЕЯ

   Жук загружается ОДИН РАЗ в main.js. Мы его не клонируем
   и не грузим повторно — просто рендерим ОДНУ И ТУ ЖЕ сцену
   (window.beetleScene) второй камерой:

     - webcam ВЫКЛЮЧЕНА -> "студийный" режим: жук неподвижен
       в editor-сцене, вторая (студийная) камера с OrbitControls
       просто на него смотрит. Модель никуда не переносится,
       поэтому редактор выше по странице ничего не теряет.

     - webcam ВКЛЮЧЕНА -> AR-режим: жук должен двигаться по
       ладони, а координаты в editor-сцене должны оставаться
       нетронутыми. Поэтому на время AR-режима модель временно
       переносится (Object3D.attach, без клонирования) в
       отдельную AR-сцену и возвращается на место (0,0,0) при
       выключении камеры.

   В любой момент времени активен только один из двух циклов
   рендера (студийный или AR) — второй ставится на паузу.
   ========================================================= */

/* =========================================================
   DOM
   ========================================================= */

const video = document.getElementById('video');
const cameraBtn = document.getElementById('cameraBtn');
const photoBtn = document.getElementById('photoBtn');
const cameraSection = document.getElementById('camera-section');
const cameraScreen = document.getElementById('cameraScreen');
const flash = document.getElementById('flash');

const studioCanvas = document.getElementById('studio-canvas');
const studioBackdropCanvas = document.getElementById('studio-backdrop');
const arCanvas = document.getElementById('three-canvas');

const backgroundPanel = document.getElementById('backgroundColorPanel');
const handScalePanel = document.getElementById('handScalePanel');

/* =========================================================
   STATE
   ========================================================= */

let stream = null;
let cameraStarted = false;
let handCamera = null;

let editorScene = null; // window.beetleScene, общая сцена редактора
let beetleModel = null; // window.beetleModel

let backgroundHue = 260; // синхронизируется с hue-slider (data-color-target="worldBackground")
let handScale = 1; // синхронизируется с range-slider (data-value-target="handBeetleScale")

let studioRAF = null;
let arRAF = null;

let sectionVisible = false;

/* =========================================================
   ГРАДИЕНТНЫЙ ФОН (Canvas2D, не Three.js — так его проще
   и переиспользовать в фото, и не трогать scene.background
   общей сцены, который влиял бы и на редактор выше)
   ========================================================= */

const backdropCtx = studioBackdropCanvas.getContext('2d');

function hslCss(h, s, l) {
  return `hsl(${((h % 360) + 360) % 360}, ${s}%, ${l}%)`;
}

function drawBackdrop() {
  const w = studioBackdropCanvas.width;
  const h = studioBackdropCanvas.height;
  if (!w || !h) return;

  const cx = w * 0.5;
  const cy = h * 0.38;
  const r = Math.max(w, h) * 0.8;

  const gradient = backdropCtx.createRadialGradient(cx, cy, 0, cx, cy, r);
  // градиент из БЛИЖАЙШИХ к главному оттенков, а не случайных цветов
  gradient.addColorStop(0, hslCss(backgroundHue + 15, 85, 72));
  gradient.addColorStop(0.55, hslCss(backgroundHue, 80, 55));
  gradient.addColorStop(1, hslCss(backgroundHue - 25, 70, 28));

  backdropCtx.fillStyle = gradient;
  backdropCtx.fillRect(0, 0, w, h);
}

function resizeBackdrop() {
  const rect = cameraScreen.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  studioBackdropCanvas.width = Math.round(rect.width * dpr);
  studioBackdropCanvas.height = Math.round(rect.height * dpr);
  drawBackdrop();
}

// слушаем colorchange от hue-slider'а фона — переиспользуем
// generic-логику panel-system.js без единой правки в ней
document.addEventListener('colorchange', (e) => {
  if (e.detail.target !== 'worldBackground') return;
  backgroundHue = e.detail.color.hue;
  drawBackdrop();
});

// слушаем valuechange от range-slider'а масштаба руки
document.addEventListener('valuechange', (e) => {
  if (e.detail.target !== 'handBeetleScale') return;
  handScale = e.detail.value;
});

/* =========================================================
   СТУДИЙНЫЙ РЕЖИМ (webcam выключена)
   Рендерим ОБЩУЮ сцену редактора (editorScene) второй,
   свободной камерой. Модель НЕ трогаем и никуда не переносим.
   ========================================================= */

let studioRenderer = null;
let studioCamera = null;
let studioControls = null;

function initStudio() {
  studioRenderer = new THREE.WebGLRenderer({
    canvas: studioCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true, // нужно для фото
  });
  studioRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  studioCamera = new THREE.PerspectiveCamera(50, 1, 0.05, 100);
  studioCamera.position.set(0, 1.3, 4);

  studioControls = new OrbitControls(studioCamera, studioCanvas);
  studioControls.enableDamping = true;
  studioControls.enablePan = true;
  studioControls.enableZoom = true;
  studioControls.minDistance = 2; // ограничение приближения
  studioControls.maxDistance = 8; // ограничение отдаления
  studioControls.target.set(0, 0.3, 0);
  studioControls.update();

  resizeStudio();
}

function resizeStudio() {
  const rect = cameraScreen.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  studioRenderer.setSize(rect.width, rect.height, false);
  studioCamera.aspect = rect.width / rect.height;
  studioCamera.updateProjectionMatrix();
}

function studioTick() {
  studioRAF = requestAnimationFrame(studioTick);
  if (!editorScene) return;
  studioControls.update();
  studioRenderer.render(editorScene, studioCamera);
}

function startStudioLoop() {
  if (studioRAF !== null || cameraStarted || !editorScene) return;
  studioTick();
}

function stopStudioLoop() {
  if (studioRAF !== null) {
    cancelAnimationFrame(studioRAF);
    studioRAF = null;
  }
}

/* =========================================================
   AR-РЕЖИМ (webcam включена)
   Отдельная сцена + Orthographic-камера, как и раньше, но
   вместо куба-заглушки X сюда временно "переезжает" сама
   модель жука (Object3D.attach — без клонирования).
   ========================================================= */

const arScene = new THREE.Scene();
const handAnchor = new THREE.Group();
handAnchor.visible = false;
arScene.add(handAnchor);

let arRenderer = null;
let arCamera; // OrthographicCamera

function initAR() {
  arRenderer = new THREE.WebGLRenderer({
    canvas: arCanvas,
    alpha: true,
    antialias: true,
    preserveDrawingBuffer: true,
  });
  arRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  arRenderer.setClearColor(0x000000, 0);

  const rect = cameraScreen.getBoundingClientRect();
  const aspect = rect.width / rect.height || 1;
  arCamera = new THREE.OrthographicCamera(-aspect, aspect, 1, -1, 0.01, 100);
  arCamera.position.z = 10;

  resizeAR();
}

function resizeAR() {
  const rect = cameraScreen.getBoundingClientRect();
  if (!rect.width || !rect.height) return;

  arRenderer.setSize(rect.width, rect.height, false);

  const aspect = rect.width / rect.height;
  arCamera.left = -aspect;
  arCamera.right = aspect;
  arCamera.top = 1;
  arCamera.bottom = -1;
  arCamera.updateProjectionMatrix();
}

function arTick() {
  arRAF = requestAnimationFrame(arTick);
  arRenderer.render(arScene, arCamera);
}

function startARLoop() {
  if (arRAF !== null) return;
  arTick();
}

function stopARLoop() {
  if (arRAF !== null) {
    cancelAnimationFrame(arRAF);
    arRAF = null;
  }
}

// "Забираем" модель из editor-сцены в AR-сцену на время фотобудки
function enterHandMode() {
  if (!beetleModel) return;
  handAnchor.attach(beetleModel); // сохраняет текущий мировой transform
  handAnchor.visible = false; // покажем, когда рука будет найдена
}

// Возвращаем модель обратно в editor-сцену как было (0,0,0, без вращения/масштаба)
function exitHandMode() {
  if (!beetleModel || !editorScene) return;
  editorScene.attach(beetleModel);
  beetleModel.position.set(0, 0, 0);
  beetleModel.rotation.set(0, 0, 0);
  beetleModel.scale.set(1, 1, 1);
}

/* =========================================================
   ГОТОВНОСТЬ МОДЕЛИ (main.js грузит .glb один раз)
   ========================================================= */

function onBeetleReady({ detail }) {
  editorScene = detail.scene;
  beetleModel = detail.model;

  initStudio();
  initAR();
  drawBackdrop();
  resizeBackdrop();

  if (sectionVisible && !cameraStarted) startStudioLoop();
}

if (window.beetleModel && window.beetleScene) {
  // модель могла успеть загрузиться раньше, чем выполнился этот модуль
  onBeetleReady({
    detail: { scene: window.beetleScene, model: window.beetleModel },
  });
} else {
  window.addEventListener('beetle:ready', onBeetleReady);
}

/* =========================================================
   RESIZE
   ========================================================= */

function resizeAll() {
  resizeBackdrop();
  if (studioRenderer) resizeStudio();
  if (arRenderer) resizeAR();
}

window.addEventListener('resize', resizeAll);

/* =========================================================
   ВИДИМОСТЬ СЕКЦИИ: экономим CPU/GPU, когда её не видно
   - webcam при уходе из вьюпорта останавливается ПОЛНОСТЬЮ
     (stream.getTracks().stop(), а не просто скрытие canvas) —
     именно декодирование видео и ML-инференс руки затратны,
     не сам three.js рендер.
   - студийный цикл рендера просто ставится на паузу.
   ========================================================= */

if ('IntersectionObserver' in window) {
  new IntersectionObserver(
    ([entry]) => {
      sectionVisible = entry.isIntersecting;

      if (sectionVisible) {
        resizeAll();
        if (!cameraStarted) startStudioLoop();
      } else {
        stopStudioLoop();
        if (cameraStarted) stopCamera(); // сознательно не автозапускаем камеру обратно
      }
    },
    { threshold: 0.05 }
  ).observe(cameraSection);
} else {
  sectionVisible = true;
  startStudioLoop();
}

/* =========================================================
   ПЕРЕКЛЮЧЕНИЕ РЕЖИМОВ: КНОПКА КАМЕРЫ
   ========================================================= */

function setModeUI(isWebcamOn) {
  cameraSection.classList.toggle('webcam-on', isWebcamOn);
  backgroundPanel.style.display = isWebcamOn ? 'none' : '';
  handScalePanel.style.display = isWebcamOn ? '' : 'none';
  cameraBtn.textContent = isWebcamOn ? 'Выключить камеру' : 'Включить камеру';
}

cameraBtn.addEventListener('click', () => {
  if (cameraStarted) {
    stopCamera();
  } else {
    startCamera();
  }
});

async function startCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
      audio: false,
    });

    video.srcObject = stream;
    await video.play();

    cameraStarted = true;
    setModeUI(true);

    stopStudioLoop();
    enterHandMode();
    startARLoop();

    startHandTracking();
  } catch (error) {
    console.error('Ошибка доступа к камере:', error);
    alert(
      'Не удалось получить доступ к веб-камере. Проверьте разрешения браузера.'
    );
  }
}

function stopCamera() {
  if (!cameraStarted) return;

  if (handCamera) {
    handCamera.stop();
    handCamera = null;
  }
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }
  video.srcObject = null;

  cameraStarted = false;
  setModeUI(false);

  stopARLoop();
  handAnchor.visible = false;
  exitHandMode();

  if (sectionVisible) startStudioLoop();
}

/* =========================================================
   MEDIAPIPE HANDS
   ========================================================= */

function startHandTracking() {
  const hands = new Hands({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
  });

  hands.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: 0.7,
    minTrackingConfidence: 0.7,
  });

  hands.onResults(onHandResults);

  handCamera = new Camera(video, {
    onFrame: async () => {
      if (!cameraStarted) return;
      await hands.send({ image: video });
    },
    width: 640,
    height: 480,
  });

  handCamera.start();
}

function onHandResults(results) {
  if (!results.multiHandLandmarks || !results.multiHandLandmarks.length) {
    handAnchor.visible = false;
    return;
  }

  handAnchor.visible = true;

  const hand = results.multiHandLandmarks[0];
  updateHandOrientation(hand);
  placePositionOnPalm(hand[9]); // landmark 9 — центральная область ладони
}

/* ---------------------------------------------------------------
   ОРИЕНТАЦИЯ ЛАДОНИ

   MediaPipe даёт 21 точку руки в нормализованных координатах
   (x,y — доля ширины/высоты кадра, z — примерная глубина
   относительно запястья). Чтобы получить поворот ладони как
   плоскости, берём 3 вектора из её "скелета":

     right   — поперёк ладони (от мизинца к указательному)
     forward — от запястья к основанию среднего пальца
     normal  — векторное произведение (right x forward) —
               направление "от ладони наружу", то есть то,
               куда должен смотреть "верх" жука, если он
               стоит на ладони как на площадке.

   Из этих трёх ортонормированных векторов строим базис и
   превращаем его в кватернион — это и есть поворот ладони.
   --------------------------------------------------------------- */

// Направление между двумя landmark'ами, переведённое в систему
// координат three.js — те же инверсии X/Y, что и при переводе
// позиции (см. placePositionOnPalm): видео зеркально по X,
// а экранный Y направлен вниз, поэтому оба знака инвертируются.
function landmarkDir(a, b) {
  return new THREE.Vector3(-(b.x - a.x), -(b.y - a.y), (b.z - a.z) * 0.5);
}

const targetQuaternion = new THREE.Quaternion();
const basisMatrix = new THREE.Matrix4();

// Поправка на "родную" ориентацию модели жука: если после
// подключения жук стоит на ладони боком/вверх ногами/задом
// наперёд — крутите эти углы (в радианах), а не логику выше.
// Например, THREE.MathUtils.degToRad(90) по нужной оси.
const restOffset = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0, 0, 0)
);

// Сглаживание: сырые landmark'и дрожат от кадра к кадру,
// slerp с небольшим шагом убирает дрожь без заметной задержки.
// Меньше значение — плавнее, но более "инертно".
const ROTATION_SMOOTHING = 0.25;

function updateHandOrientation(hand) {
  const wrist = hand[0];
  const indexMCP = hand[5];
  const middleMCP = hand[9];
  const pinkyMCP = hand[17];

  const right = landmarkDir(pinkyMCP, indexMCP).normalize();
  const rawForward = landmarkDir(wrist, middleMCP).normalize();

  // "верх" ладони — перпендикуляр к её плоскости
  const normal = new THREE.Vector3()
    .crossVectors(right, rawForward)
    .normalize();
  // пересобираем forward, чтобы базис был строго ортогональным
  const forward = new THREE.Vector3().crossVectors(normal, right).normalize();

  basisMatrix.makeBasis(right, normal, forward);
  targetQuaternion.setFromRotationMatrix(basisMatrix).multiply(restOffset);

  handAnchor.quaternion.slerp(targetQuaternion, ROTATION_SMOOTHING);
}

function placePositionOnPalm(palm) {
  const screenRect = cameraScreen.getBoundingClientRect();
  const screenWidth = screenRect.width;
  const screenHeight = screenRect.height;

  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  if (!videoWidth || !videoHeight) return;

  // object-fit: cover — считаем реальную позицию точки внутри видимой области
  const scale = Math.max(screenWidth / videoWidth, screenHeight / videoHeight);
  const renderedVideoWidth = videoWidth * scale;
  const renderedVideoHeight = videoHeight * scale;
  const cropX = (renderedVideoWidth - screenWidth) / 2;
  const cropY = (renderedVideoHeight - screenHeight) / 2;

  // видео зеркально (transform: scaleX(-1)) — инвертируем X
  const sourceX = (1 - palm.x) * videoWidth;
  const sourceY = palm.y * videoHeight;
  const screenX = sourceX * scale - cropX;
  const screenY = sourceY * scale - cropY;

  const normalizedX = screenX / screenWidth;
  const normalizedY = screenY / screenHeight;

  const aspect = screenWidth / screenHeight;
  const threeX = (normalizedX - 0.5) * 2 * aspect;
  const threeY = -(normalizedY - 0.5) * 2;

  const offsetY = 0.05;
  const threeZ = palm.z * 0.5;

  handAnchor.position.set(threeX, threeY + offsetY, threeZ);
  handAnchor.scale.setScalar(handScale);
}

/* =========================================================
   ФОТО
   ========================================================= */

photoBtn.addEventListener('click', takePhoto);

function takePhoto() {
  const rect = cameraScreen.getBoundingClientRect();
  const width = Math.round(rect.width);
  const height = Math.round(rect.height);

  const photoCanvas = document.createElement('canvas');
  photoCanvas.width = width;
  photoCanvas.height = height;
  const ctx = photoCanvas.getContext('2d');

  if (cameraStarted) {
    if (!video.videoWidth) return;
    drawMirroredVideo(ctx, width, height);
    ctx.drawImage(arRenderer.domElement, 0, 0, width, height);
  } else {
    ctx.drawImage(studioBackdropCanvas, 0, 0, width, height);
    ctx.drawImage(studioRenderer.domElement, 0, 0, width, height);
  }

  savePhotoCanvas(photoCanvas);

  flash.classList.remove('active');
  void flash.offsetWidth;
  flash.classList.add('active');
}

function drawMirroredVideo(ctx, width, height) {
  const videoWidth = video.videoWidth;
  const videoHeight = video.videoHeight;
  const scale = Math.max(width / videoWidth, height / videoHeight);
  const drawWidth = videoWidth * scale;
  const drawHeight = videoHeight * scale;
  const offsetX = (width - drawWidth) / 2;
  const offsetY = (height - drawHeight) / 2;

  ctx.save();
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(
    video,
    width - offsetX - drawWidth,
    offsetY,
    drawWidth,
    drawHeight
  );
  ctx.restore();
}

function savePhotoCanvas(photoCanvas) {
  photoCanvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().replace(/[:.]/g, '-');
    link.download = `beetle-photo-${date}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
}
