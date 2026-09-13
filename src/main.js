import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import p5 from 'https://cdn.jsdelivr.net/npm/p5@1.9.4/+esm';

// Мои скрипты
import '/src/hero.js';
// import '/src/mascot.js';
import '/src/panel-system.js';
import '/src/grid-overlay.js';
import '/src/camera.js';

// Создание Scene
const scene = new THREE.Scene();

// Делаем сцену доступной другим модулям (camera.js),
// чтобы не грузить модель жука повторно и не плодить лишние объекты —
// camera.js рендерит ЭТУ ЖЕ сцену второй (студийной) камерой,
// а для AR-режима временно "забирает" model через Object3D.attach().
window.beetleScene = scene;

const gltfLoader = new GLTFLoader();

// #region HERO СЕКЦИЯ

let pencilModel = null;
let beetleWingsModel = null;
let star1Model = null;
let star2Model = null;
let handModel = null;

gltfLoader.load('public/hero-scene.glb', (gltf) => {
  let model = gltf.scene;

  // переносим все объекты в загружаемой сцене
  // на отдельный слой, чтобы их видела только heroCamera
  model.traverse((object) => {
    object.layers.set(1);
  });

  pencilModel = model.getObjectByName('pencil');
  beetleWingsModel = model.getObjectByName('beetle-wings');
  star1Model = model.getObjectByName('star-1');
  star2Model = model.getObjectByName('star-2');
  handModel = model.getObjectByName('hand');

  scene.add(model);
});

const heroContainer = document.getElementById('hero-section');
const heroSizes = {
  get width() {
    return heroContainer.offsetWidth;
  },
  get height() {
    return heroContainer.offsetHeight;
  },
};

// Camera HERO секции
const heroCamera = new THREE.PerspectiveCamera(
  25,
  heroSizes.width / heroSizes.height,
  0.05,
  100
);
scene.add(heroCamera);

heroCamera.layers.set(1);

// #region Анимация камеры HERO
let mouseX = 0;
let mouseY = 0;
let targetX = 0;
let targetY = 0;
// нормализуем координаты мыши от -1 до 1, независимо от размера окна
window.addEventListener('mousemove', (event) => {
  const rect = heroContainer.getBoundingClientRect();
  mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouseY = ((event.clientY - rect.top) / rect.height) * 2 - 1;
});
// сохраняем исходную позицию камеры
const initialHeroCameraPosition = heroCamera.position.clone();
// сила эффекта параллакса — подберите под свою сцену
const parallaxStrength = 0.05;
// #endregion Анимация камеры HERO

// Renderer
const heroCanvas = document.querySelector('.hero-webgl');
const heroRenderer = new THREE.WebGLRenderer({
  // Прозрачность фона
  alpha: true,
  antialias: true,
  canvas: heroCanvas,
});
heroRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
heroRenderer.setSize(heroSizes.width, heroSizes.height);
heroRenderer.render(scene, heroCamera);

// Создание OrbitControls
// const heroControls = new OrbitControls(heroCamera, heroCanvas);
// heroControls.autoRotate = true;
// heroControls.rotateSpeed = 0.3;
// heroControls.enableDamping = true;
// heroControls.enablePan = false;
// heroControls.target = new THREE.Vector3(0, 0, 0);
// heroControls.enableZoom = false;

// #endregion HERO СЕКЦИЯ

// #region BEETLE OPTIONS
// Переменные, в которых хранятся параметры жука
// (форма глаз, форма головы, форма тела,
// форма крыльев, цвет тела, цвет глаз,
// цвет кисти для рисования на крыльях)
//
// Proxy -- обёртка для объекта.
// Proxy перехватывает присваивание
// и вызывает onBeetleOptionsChange(...).
const beetleOptions = new Proxy(
  // Proxy target object
  {
    // здесь хранятся НАЗВАНИЯ (в виде СТРОКИ) текущей выбранной части жука
    eyeShapeName: null,
    headShapeName: null,
    bodyShapeName: null,

    // здесь хранятся ссылки на все mesh (чтобы не потерять)
    eyeShapeVariants: [
      {
        name: 'Circle',
        object: null,
      },
      {
        name: 'Star',
        object: null,
      },
      {
        name: 'Heart',
        object: null,
      },
    ],
    headShapeVariants: [
      {
        name: 'Antennae',
        object: null,
      },
      {
        name: 'Deer_Horns',
        object: null,
      },
      {
        name: 'Rhino_Horns',
        object: null,
      },
    ],
    bodyShapeVariants: [
      {
        name: 'Body_Long',
        object: null,
      },
      {
        name: 'Body_Medium',
        object: null,
      },
      {
        name: 'Body_Short',
        object: null,
      },
    ],
    wingShapeVariants: [
      {
        name: 'Wings_Long',
        object: null,
      },
      {
        name: 'Wings_Medium',
        object: null,
      },
      {
        name: 'Wings_Short',
        object: null,
      },
    ],

    // здесь хранятся текущие цвета
    eyeColor: null,
    bodyColor: null,
    brushColor: null,
  },
  {
    // Proxy перехватывает операцию set
    // ловушка срабатывает на КАЖДОЕ присваивание beetleOptions[property] = value
    set(target, property, value) {
      const oldValue = target[property];

      // не забываем реально записать значение,
      // так как Proxy не делает это автоматически
      target[property] = value;

      if (oldValue !== value) {
        // если значение изменилось -- срабатывает функция (в ней будет меняться 3D объект жука и его текстуры)
        onBeetleOptionsChange(property, value, oldValue);
      }

      return true; // обязателен для set-ловушки
    },
  }
);

// делаем переменную доступную другим модулям (глобальной)
window.beetleOptions = beetleOptions;

// ---------- вспомогательная функция: показать один вариант, скрыть остальные ----------
function selectVariantByName(variantsArray, selectedName) {
  variantsArray.forEach((variant) => {
    if (variant.object) {
      variant.object.visible = variant.name === selectedName;
    }
  });
}

// что происходит при обновлении переменной в beetleOptions?
function onBeetleOptionsChange(property, value, oldValue) {
  if (property === 'eyeShapeName') {
    selectVariantByName(beetleOptions.eyeShapeVariants, value);
  } else if (property === 'headShapeName') {
    selectVariantByName(beetleOptions.headShapeVariants, value);
  } else if (property === 'bodyShapeName') {
    selectVariantByName(beetleOptions.bodyShapeVariants, value);
    // связь тело -> крылья: находим индекс выбранного тела
    // и включаем крылья с ТЕМ ЖЕ индексом
    const bodyIndex = beetleOptions.bodyShapeVariants.findIndex(
      (variant) => variant.name === value
    );
    const wingVariant = beetleOptions.wingShapeVariants[bodyIndex];
    if (wingVariant) {
      selectVariantByName(beetleOptions.wingShapeVariants, wingVariant.name);
      // рисунок на крыльях общий для всех вариантов, а трафарет —
      // свой под каждую форму крыльев (см. #region Рисование на крыльях)
      updateWingMaskOverlay(wingVariant.name);
    }
  } else if (property === 'eyeColor') {
    // все 3 варианта глаз используют ОДИН и тот же Material —
    // достаточно один раз перекрасить, эффект применится ко всем
    beetleOptions.eyeShapeVariants[0].object.material.emissive.set(value);
  } else if (property === 'bodyColor') {
    // тело и голова тоже на одном материале
    head.material.emissive.set(value);
  } else if (property === 'brushColor') {
  }
}
// #endregion BEETLE OPTIONS

// #region Загрузка модельки ЖУКА
gltfLoader.load('public/Beetles.glb', (gltf) => {
  let model = gltf.scene;
  scene.add(model);
  console.log(model);

  let head = model.getObjectByName('Head');
  let whiteEyes = model.getObjectByName('White_Eye');

  // сохраняем mesh'ы частей тела в объект beetleOptions (это все варианты)

  beetleOptions.eyeShapeVariants.forEach((item) => {
    item.object = model.getObjectByName(item.name);
  });
  beetleOptions.headShapeVariants.forEach((item) => {
    item.object = model.getObjectByName(item.name);
  });
  beetleOptions.bodyShapeVariants.forEach((item) => {
    item.object = model.getObjectByName(item.name);
  });
  beetleOptions.wingShapeVariants.forEach((item) => {
    item.object = model.getObjectByName(item.name);
  });
  // задаём начальные варианты — теперь как ИМЕНА, идёт через Proxy,
  // поэтому onBeetleOptionsChange сам скроет/покажет нужные mesh'и
  beetleOptions.eyeShapeName = beetleOptions.eyeShapeVariants[0].name;
  beetleOptions.headShapeName = beetleOptions.headShapeVariants[0].name;
  beetleOptions.bodyShapeName = beetleOptions.bodyShapeVariants[0].name; // это же включит и крылья[0]

  // Сообщаем camera.js, что модель готова и можно её использовать
  // (одна и та же модель, без клонирования и повторной загрузки .glb)
  window.beetleModel = model;
  window.dispatchEvent(
    new CustomEvent('beetle:ready', { detail: { scene, model } })
  );
});

// #endregion Загрузка модельки

const container = document.getElementById('canvas-buttons-wrapper');

// Размеры контейнера в котором находится 3D canvas
// (возвращаtn текущие значения после ресайза)
const sizes = {
  get width() {
    return container.offsetWidth;
  },
  get height() {
    return container.offsetHeight;
  },
};

// Camera
const camera = new THREE.PerspectiveCamera(
  50,
  sizes.width / sizes.height,
  0.05,
  100
);
scene.add(camera);
camera.position.z = -2.5;
camera.position.x = -2.5;
camera.position.y = 3;

//AxesHelper
const axesHelper = new THREE.AxesHelper(5);
axesHelper.layers.enableAll();
scene.add(axesHelper);

// Renderer
const canvas = document.querySelector('.webgl');
const renderer = new THREE.WebGLRenderer({
  // Прозрачность фона
  alpha: true,
  antialias: true,
  canvas: canvas,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(sizes.width, sizes.height);
renderer.render(scene, camera);

// Создание OrbitControls
const controls = new OrbitControls(camera, canvas);
controls.autoRotate = true;
controls.autoRotateSpeed = 0.8;
controls.enableDamping = true;
controls.enablePan = false;
controls.target = new THREE.Vector3(0, 0, 0);
controls.enableZoom = false;

// Ресайз
window.addEventListener('resize', () => {
  // Обновить camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  heroCamera.aspect = heroSizes.width / heroSizes.height;
  heroCamera.updateProjectionMatrix();

  // Обновить renderer
  renderer.setSize(sizes.width, sizes.height);
  heroRenderer.setSize(heroSizes.width, heroSizes.height);
});

// #region Летающие кнопки
const anchoredButtons = [
  {
    button: document.querySelector('.anchored-button-eyes'),
    name: 'Eyes',
    position: new THREE.Vector3(-0.33, 0.71, -0.96),
  },
  {
    button: document.querySelector('.anchored-button-wings'),
    name: 'Wings',
    position: new THREE.Vector3(-0.52, 0.91, 0.25),
  },
  {
    button: document.querySelector('.anchored-button-body-color'),
    name: 'Body Color',
    position: new THREE.Vector3(-0.58, 0.33, -0.34),
  },
  {
    button: document.querySelector('.anchored-button-head'),
    name: 'Head',
    position: new THREE.Vector3(0, 0.53, -1.5),
  },
  {
    button: document.querySelector('.anchored-button-body-shape'),
    name: 'Body Shape',
    position: new THREE.Vector3(-0.01, 0.99, 1),
  },
];

function updateButtonPosition() {
  for (let i = 0; i < anchoredButtons.length; i++) {
    const vector = anchoredButtons[i].position.clone();
    // проецирует вектор на камеру -- вектор изменился
    vector.project(camera);

    const x = (vector.x * 0.5 + 0.5) * sizes.width;
    const y = (-vector.y * 0.5 + 0.5) * sizes.height;

    anchoredButtons[i].button.style.left = x + 'px';
    anchoredButtons[i].button.style.top = y + 'px';
  }
}

// #endregion

// #region Рисование на крыльях (p5.js -> THREE.CanvasTexture)
// Идея (как в исходном закомментированном коде): пользователь рисует
// прямо на p5-холсте, а графический буфер wingPG всегда того же размера,
// что и сам видимый canvas (= размер .wing-canvas-wrap в панели).
// При ресайзе контейнера буфер пересоздаётся под новый размер, а старый
// рисунок масштабируется в него -- так же, как и в оригинальной логике.
// Раз буфер = видимый canvas 1:1, толщина кисти (strokeWeight) на нём
// совпадает с тем, что пользователь физически видит на экране -- то есть
// с тем же числом, что и радиус кружков-иконок размера кисти в HTML.
// Цвет кисти живёт в beetleOptions.brushColor (пишется туда уже готовой
// логикой panel-system.js через data-color-target="brushColor"),
// размер кисти -- в beetleOptions.brushSize (через data-option-target="brushSize"
// на .icon-select, значения берутся из data-value кнопок).
const DEFAULT_BRUSH_COLOR = '#ff2d9e';
const DEFAULT_BRUSH_SIZE = 10;

// Трафарет поверх холста: для каждого варианта крыльев — своя картинка,
// показывающая, какая часть рисунка реально попадёт на видимую поверхность
// 3D-модели. Пути ведут в /public (Vite отдаёт их с корня сайта).
const wingMaskSrcByWingShape = {
  Wings_Short: '/mask-wing-short.svg',
  Wings_Medium: '/mask-wing-medium.svg',
  Wings_Long: '/mask-wing-long.svg',
};

const wingP5Container = document.getElementById('wingP5Container');
const wingMaskOverlay = document.getElementById('wingMaskOverlay');
const wingClearBtn = document.querySelector('.wing-clear-btn');

let wingP5; // экземпляр p5 (instance mode)
let wingCanvasEl; // сам <canvas>, который создал p5
let wingPG; // графический буфер -- ВСЕГДА того же размера, что и canvas
let wingsTexture;
let wingsMaterial;

function updateWingMaskOverlay(wingShapeName) {
  if (!wingMaskOverlay) return;
  const src = wingMaskSrcByWingShape[wingShapeName];
  if (src) wingMaskOverlay.src = src;
}

// Материал с текстурой холста ставится на ВСЕ варианты крыльев сразу —
// рисунок общий и не зависит от текущей выбранной длины тела/крыльев.
function applyWingsMaterialToVariants() {
  if (!wingsMaterial) return;
  beetleOptions.wingShapeVariants.forEach((variant) => {
    if (variant.object) variant.object.material = wingsMaterial;
  });
}

function clearWingCanvas() {
  if (!wingPG) return;
  wingPG.background(255);
  if (wingsTexture) wingsTexture.needsUpdate = true;
}

function getWingCanvasSize() {
  return Math.max(
    1,
    Math.min(wingP5Container.offsetWidth, wingP5Container.offsetHeight)
  );
}

// (пере)создаёт THREE.CanvasTexture и материал поверх ТЕКУЩЕГО wingPG
function rebuildWingsTexture() {
  if (wingsTexture) wingsTexture.dispose();

  wingsTexture = new THREE.CanvasTexture(wingPG.elt);
  wingsTexture.flipY = false;
  wingsTexture.colorSpace = THREE.SRGBColorSpace;
  wingsTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  wingsTexture.needsUpdate = true;

  // плоский материал, не зависящий от освещения сцены —
  // рисунок должен выглядеть одинаково при любом свете
  wingsMaterial = new THREE.MeshBasicMaterial({ map: wingsTexture });
  applyWingsMaterialToVariants();
}

function initWingPainter() {
  if (!wingP5Container || wingP5) return; // уже создан либо негде создавать

  wingP5 = new p5((p) => {
    p.setup = function () {
      const size = getWingCanvasSize();
      wingCanvasEl = p.createCanvas(size, size);
      wingCanvasEl.parent('wingP5Container');

      wingPG = p.createGraphics(size, size);
      wingPG.background(255);

      rebuildWingsTexture();
    };

    p.draw = function () {
      p.image(wingPG, 0, 0, p.width, p.height);

      if (
        p.mouseIsPressed &&
        p.mouseX >= 0 &&
        p.mouseX <= p.width &&
        p.mouseY >= 0 &&
        p.mouseY <= p.height
      ) {
        wingPG.stroke(beetleOptions.brushColor || DEFAULT_BRUSH_COLOR);
        wingPG.strokeWeight(
          parseFloat(beetleOptions.brushSize) || DEFAULT_BRUSH_SIZE
        );
        wingPG.line(p.pmouseX, p.pmouseY, p.mouseX, p.mouseY);

        wingsTexture.needsUpdate = true;
      }
    };
  });

  // При изменении размера контейнера панели -- пересоздаём буфер под
  // новый размер и масштабируем в него старый рисунок (как в исходной
  // закомментированной логике с p.windowResized).
  function handleContainerResize() {
    if (!wingP5 || !wingPG) return;
    const size = getWingCanvasSize();
    if (size === wingPG.width) return;

    const newPG = wingP5.createGraphics(size, size);
    newPG.background(255);
    newPG.image(wingPG, 0, 0, size, size);
    wingPG.remove();
    wingPG = newPG;

    wingP5.resizeCanvas(size, size);
    rebuildWingsTexture();
  }

  if ('ResizeObserver' in window) {
    new ResizeObserver(handleContainerResize).observe(wingP5Container);
  }
}

if (wingClearBtn) {
  wingClearBtn.addEventListener('click', clearWingCanvas);
}

// Холст можно создавать сразу — он не зависит от загрузки .glb модели.
initWingPainter();
// А вот применить материал к мешам крыльев можно только когда модель
// загружена и beetleOptions.wingShapeVariants[i].object заполнены —
// ждём то же событие, что уже используется для передачи сцены в camera.js.
window.addEventListener('beetle:ready', () => {
  applyWingsMaterialToVariants();

  // трафарет для той формы крыльев, что уже выбрана к этому моменту
  // (индекс тот же, что связывает bodyShapeVariants <-> wingShapeVariants)
  const bodyIndex = beetleOptions.bodyShapeVariants.findIndex(
    (variant) => variant.name === beetleOptions.bodyShapeName
  );
  const currentWingVariant = beetleOptions.wingShapeVariants[bodyIndex];
  if (currentWingVariant) updateWingMaskOverlay(currentWingVariant.name);
});
// #endregion Рисование на крыльях

// #region Обновление кадров

let editorRAF = null;
function tick() {
  //Render Сцена с жуком
  renderer.render(scene, camera);
  controls.update();
  editorRAF = requestAnimationFrame(tick);

  // Обновляем позицию летяющих кнопок
  updateButtonPosition();
}
tick();

let heroEditorRAF = null;
let time = Date.now();
function heroTick() {
  //Render Hero секция
  heroRenderer.render(scene, heroCamera);
  // heroControls.update();
  heroEditorRAF = requestAnimationFrame(heroTick);

  // вращение карандаша
  // Time
  const currentTime = Date.now();
  const deltaTime = currentTime - time;
  time = currentTime;

  // КАРАНДАШ
  pencilModel.rotation.y += 0.001 * deltaTime;
  // КРЫЛЬЯ
  // object.rotation.z = Math.sin(currentTime * speed) * amplitude;
  // amplitude = максимальный угол в радианах
  beetleWingsModel.rotation.x = Math.sin(currentTime * 0.003) * 0.07;
  // ЗВЁЗДОЧКИ
  star1Model.rotation.z = Math.sin(currentTime * 0.005) * 0.3;
  star2Model.rotation.z = Math.sin(currentTime * 0.005 + 1) * 0.3;
  // РУКА (по двум осям)
  // handModel.rotation.y = Math.sin(currentTime * 0.001) * 0.01;aut
  handModel.rotation.z = Math.sin(currentTime * 0.001 + 1) * 0.05;

  // анимация камеры параллакс
  // целевое смещение камеры
  targetX = mouseX * parallaxStrength;
  targetY = -mouseY * parallaxStrength; // минус, чтобы движение было интуитивным
  // плавная интерполяция (lerp) — избавляет от резких скачков
  heroCamera.position.x +=
    (initialHeroCameraPosition.x + targetX - heroCamera.position.x) * 0.1;
  heroCamera.position.y +=
    (initialHeroCameraPosition.y + targetY - heroCamera.position.y) * 0.1;
  // камера всегда смотрит в центр сцены
  heroCamera.lookAt(0, 0, -1);
}
heroTick();

// Останавливаем рендер редактора, когда секция скрыта (например,
// пользователь ушёл в #camera-section) — экономит CPU/GPU,
// возобновляем при возврате.
const editorSection = document.getElementById('creation-section');
if (editorSection && 'IntersectionObserver' in window) {
  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        if (editorRAF === null) tick();
      } else if (editorRAF !== null) {
        cancelAnimationFrame(editorRAF);
        editorRAF = null;
      }
    },
    { threshold: 0.05 }
  ).observe(editorSection);
}

// Останавливаем рендер редактора, когда секция скрыта (например,
// пользователь ушёл в #camera-section) — экономит CPU/GPU,
// возобновляем при возврате.
const heroSection = document.getElementById('hero-section');
if (heroSection && 'IntersectionObserver' in window) {
  new IntersectionObserver(
    ([entry]) => {
      if (entry.isIntersecting) {
        if (heroEditorRAF === null) heroTick(); // ← исправлено
      } else if (heroEditorRAF !== null) {
        cancelAnimationFrame(heroEditorRAF);
        heroEditorRAF = null;
      }
    },
    { threshold: 0.05 }
  ).observe(heroSection);
}
// #endregion Обновление кадров
