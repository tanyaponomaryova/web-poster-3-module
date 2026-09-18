import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import p5 from 'https://cdn.jsdelivr.net/npm/p5@1.9.4/+esm';

// Мои скрипты
import '/src/mascot.js';
import '/src/header.js';
import '/src/panel-system.js';
import '/src/anchored-panel-morph.js';
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
let pencilEmptyModel = null;
let beetleWingsModel = null;
let star1Model = null;
let star2Model = null;
let handModel = null;
let flowerModel = null;
let brushModel = null;
let bugLabModel = null;

gltfLoader.load('public/hero-scene.glb', (gltf) => {
  let model = gltf.scene;

  // переносим все объекты в загружаемой сцене
  // на отдельный слой, чтобы их видела только heroCamera
  model.traverse((object) => {
    object.layers.set(1);
  });

  pencilModel = model.getObjectByName('pencil');
  pencilEmptyModel = model.getObjectByName('pencil-empty');
  beetleWingsModel = model.getObjectByName('beetle-wings');
  star1Model = model.getObjectByName('star-1');
  star2Model = model.getObjectByName('star-2');
  handModel = model.getObjectByName('hand');
  flowerModel = model.getObjectByName('flower');
  brushModel = model.getObjectByName('brush-handle');
  bugLabModel = model.getObjectByName('bug-lab');

  pencilEmptyModel.userData.baseRotX = pencilEmptyModel.rotation.x;
  pencilEmptyModel.userData.baseRotY = pencilEmptyModel.rotation.y;
  handModel.userData.baseRotX = handModel.rotation.x;
  handModel.userData.baseRotY = handModel.rotation.y;
  star1Model.userData.baseRotX = star1Model.rotation.x;
  star1Model.userData.baseRotY = star1Model.rotation.y;
  star2Model.userData.baseRotX = star2Model.rotation.x;
  star2Model.userData.baseRotY = star2Model.rotation.y;
  flowerModel.userData.baseRotX = flowerModel.rotation.x;
  flowerModel.userData.baseRotY = flowerModel.rotation.y;
  brushModel.userData.baseRotX = brushModel.rotation.x;
  brushModel.userData.baseRotY = brushModel.rotation.y;
  bugLabModel.userData.baseRotX = bugLabModel.rotation.x;
  bugLabModel.userData.baseRotY = bugLabModel.rotation.y;

  console.log(model);
  scene.add(model);
});

const heroContainer = document.querySelector('.hero-canvas-wrapper');
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
  31,
  heroSizes.width / heroSizes.height,
  0.05,
  100
);
scene.add(heroCamera);

heroCamera.layers.set(1);

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

// ссылка на mesh головы/тела -- заполняется асинхронно, когда догрузится
// модель жука (см. gltfLoader.load('public/Beetles.glb', ...) ниже).
// Пока модель не загружена, остаётся null -- поэтому в onBeetleOptionsChange
// ниже есть проверка на null перед обращением к .material.
let head = null;

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
    // достаточно один раз перекрасить, эффект применится ко всем.
    // Модель могла ещё не догрузиться (панели с цветом инициализируются
    // сразу при открытии страницы) -- в этом случае просто выходим,
    // значение уже сохранено в beetleOptions и будет применено ниже,
    // в колбэке gltfLoader.load, как только модель будет готова.
    const eyeMeshObject = beetleOptions.eyeShapeVariants[0].object;
    if (!eyeMeshObject) return;
    eyeMeshObject.material.emissive.set(value);
  } else if (property === 'bodyColor') {
    // тело и голова тоже на одном материале
    if (!head) return;
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

  head = model.getObjectByName('Head');
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

  // Панели с цветом (hue-slider) инициализируются сразу при загрузке
  // страницы и уже могли записать в beetleOptions.bodyColor/eyeColor

  // значение по умолчанию до того, как модель здесь догрузилась --
  // onBeetleOptionsChange тогда просто вышел по проверке на null.
  // Теперь, когда head и eyeShapeVariants[0].object уже определены,
  // применяем эти цвета к модели.
  if (beetleOptions.bodyColor) {
    onBeetleOptionsChange('bodyColor', beetleOptions.bodyColor);
  }
  if (beetleOptions.eyeColor) {
    onBeetleOptionsChange('eyeColor', beetleOptions.eyeColor);
  }

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
// const axesHelper = new THREE.AxesHelper(5);
// axesHelper.layers.enableAll();
// scene.add(axesHelper);

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

  console.log('РЕСАЙЗ');
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

// #endregion Летающие кнопки

// #region Рисование на крыльях (p5.js -> THREE.CanvasTexture)
// Архитектура: десктопная и мобильная панели показывают ОДИН и тот же
// физический <canvas> -- при переключении (по media query) JS просто
// переносит DOM-узел canvas в контейнер активной на данный момент панели
// (appendChild). Одновременно панели никогда не видны вдвоём, поэтому
// узел всегда однозначно принадлежит той панели, что сейчас на экране,
// а рисунок автоматически "продолжается" при переключении, т.к. это
// буквально один и тот же canvas с одним и тем же p5.Graphics-буфером.
//
// Графический буфер wingPG имеет ФИКСИРОВАННЫЙ размер 512x512 px и
// больше никогда не пересоздаётся при ресайзе -- в него и пишется весь
// рисунок, он же источник для THREE.CanvasTexture. Видимый canvas тоже
// имеет внутреннее разрешение 512x512, но его CSS-размер (то, как он
// показан на экране) подстраивается под размер контейнера конкретной
// панели через style.width/height -- т.е. буфер и отображение разделены.
//
// Т.к. буфер зафиксирован, а отображается он в контейнерах разного
// физического размера (десктоп/мобайл), толщину кисти нужно масштабировать:
// координаты указателя и strokeWeight переводятся из CSS-пикселей контейнера
// в пиксели буфера через коэффициент (512 / текущая CSS-ширина canvas),
// чтобы линия выглядела одинаковой толщины на экране независимо от того,
// в какой из панелей сейчас идёт рисование.
//
// Цвет кисти живёт в beetleOptions.brushColor (пишется туда уже готовой
// логикой panel-system.js через data-color-target="brushColor"),
// размер кисти -- в beetleOptions.brushSize (через data-option-target="brushSize"
// на .icon-select, значения берутся из data-value кнопок).
const DEFAULT_BRUSH_COLOR = '#ff2d9e';
const DEFAULT_BRUSH_SIZE = 10;

// Фиксированный размер буфера рисования (не путать с CSS-размером canvas)
const WING_BUFFER_SIZE = 512;

// Трафарет поверх холста: для каждого варианта крыльев — своя картинка,
// показывающая, какая часть рисунка реально попадёт на видимую поверхность
// 3D-модели. Пути ведут в /public (Vite отдаёт их с корня сайта).
const wingMaskSrcByWingShape = {
  Wings_Short: '/mask-wing-short.svg',
  Wings_Medium: '/mask-wing-medium.svg',
  Wings_Long: '/mask-wing-long.svg',
};

// Контейнеры-"причалы" для canvas в десктопной и мобильной панелях
const wingP5ContainerDesktop = document.getElementById('wingP5Container');
const wingP5ContainerMobile = document.getElementById('wingP5ContainerMobile');
// Оверлеи-трафареты -- у каждой панели свой <img>, обновляем оба разом
const wingMaskOverlayDesktop = document.getElementById('wingMaskOverlay');
const wingMaskOverlayMobile = document.getElementById('wingMaskOverlayMobile');
// Кнопка "очистить" есть в обеих панелях
const wingClearBtns = document.querySelectorAll('.wing-clear-btn');

let wingP5; // экземпляр p5 (instance mode)
let wingCanvasEl; // единственный <canvas>, который "путешествует" между панелями
let wingPG; // графический буфер -- ВСЕГДА 512x512, создаётся один раз
let wingsTexture;
let wingsMaterial;
// цвет крыльев сначала и после удаления нарисованного
let wingsBackgroundColor = '#ededed';

// В каком контейнере физически лежит canvas прямо сейчас
let wingActiveContainer = null;

function updateWingMaskOverlay(wingShapeName) {
  const src = wingMaskSrcByWingShape[wingShapeName];
  if (!src) return;
  if (wingMaskOverlayDesktop) wingMaskOverlayDesktop.src = src;
  if (wingMaskOverlayMobile) wingMaskOverlayMobile.src = src;
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
  wingPG.background(wingsBackgroundColor);
  if (wingsTexture) wingsTexture.needsUpdate = true;
}

// Из двух контейнеров-"причалов" возвращает тот, что сейчас реально виден
// на экране (ненулевой размер). Десктоп/мобайл переключаются media query,
// поэтому видимым одновременно должен быть максимум один из них; если
// видимых нет (обе панели сейчас закрыты) -- возвращает null, и canvas
// остаётся там, где был.
function getVisibleWingContainer() {
  if (
    wingP5ContainerDesktop &&
    wingP5ContainerDesktop.offsetWidth > 0 &&
    wingP5ContainerDesktop.offsetHeight > 0
  ) {
    return wingP5ContainerDesktop;
  }
  if (
    wingP5ContainerMobile &&
    wingP5ContainerMobile.offsetWidth > 0 &&
    wingP5ContainerMobile.offsetHeight > 0
  ) {
    return wingP5ContainerMobile;
  }
  return null;
}

// Переносит canvas в активный контейнер (если сменился) и подгоняет его
// CSS-размер под этот контейнер. Внутреннее разрешение canvas (буфер)
// при этом не трогается -- меняется только то, как он показан на экране.
// Вызывается каждый кадр из p.draw(): проверка дешёвая, а DOM трогаем
// только when что-то реально поменялось.
function syncWingCanvasMount() {
  if (!wingCanvasEl) return;
  const container = getVisibleWingContainer();
  if (!container) return;

  if (wingActiveContainer !== container) {
    container.appendChild(wingCanvasEl.elt);
    wingActiveContainer = container;
  }

  const size = Math.max(
    1,
    Math.min(container.offsetWidth, container.offsetHeight)
  );
  if (wingCanvasEl.elt.style.width !== size + 'px') {
    wingCanvasEl.elt.style.width = size + 'px';
    wingCanvasEl.elt.style.height = size + 'px';
  }
}

// Переводит координаты события указателя (в CSS-пикселях экрана) в
// координаты буфера 512x512, и заодно возвращает масштаб для strokeWeight,
// чтобы кисть выглядела одинаковой толщины независимо от того, насколько
// маленькой или большой сейчас отображается панель.
function getWingBufferPointFromEvent(evt) {
  const rect = wingCanvasEl.elt.getBoundingClientRect();
  const scale = WING_BUFFER_SIZE / rect.width; // canvas всегда квадратный
  return {
    x: (evt.clientX - rect.left) * scale,
    y: (evt.clientY - rect.top) * scale,
    scale,
  };
}

// (пере)создаёт THREE.CanvasTexture и материал поверх wingPG.
// Теперь вызывается только один раз при инициализации -- буфер больше
// не пересоздаётся при ресайзе, значит и текстуру пересобирать не нужно.
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
  if ((!wingP5ContainerDesktop && !wingP5ContainerMobile) || wingP5) return;

  wingP5 = new p5((p) => {
    p.setup = function () {
      // Внутреннее разрешение canvas фиксировано -- 512x512, как и буфер.
      wingCanvasEl = p.createCanvas(WING_BUFFER_SIZE, WING_BUFFER_SIZE);
      // Монтируем изначально в десктопный контейнер (если его нет --
      // в мобильный); дальше syncWingCanvasMount() сам разберётся,
      // где показывать canvas, в зависимости от того, что видно.
      const initialParent = wingP5ContainerDesktop || wingP5ContainerMobile;
      wingCanvasEl.parent(initialParent);
      wingActiveContainer = initialParent;

      wingPG = p.createGraphics(WING_BUFFER_SIZE, WING_BUFFER_SIZE);
      wingPG.background(wingsBackgroundColor);

      rebuildWingsTexture();

      // Рисуем через нативные pointer-события (а не p.mouseX/mouseY),
      // чтобы полностью контролировать перевод координат из CSS-пикселей
      // отображаемого canvas в пиксели фиксированного буфера -- это и
      // даёт масштабирование толщины кисти под текущий размер панели.
      wingCanvasEl.elt.style.touchAction = 'none';

      let wingDrawing = false;
      let wingLastX = 0;
      let wingLastY = 0;

      wingCanvasEl.elt.addEventListener('pointerdown', (evt) => {
        wingDrawing = true;
        const pos = getWingBufferPointFromEvent(evt);
        wingLastX = pos.x;
        wingLastY = pos.y;
        wingCanvasEl.elt.setPointerCapture(evt.pointerId);
        evt.preventDefault();
      });

      wingCanvasEl.elt.addEventListener('pointermove', (evt) => {
        if (!wingDrawing) return;
        const pos = getWingBufferPointFromEvent(evt);

        wingPG.stroke(beetleOptions.brushColor || DEFAULT_BRUSH_COLOR);
        wingPG.strokeWeight(
          (parseFloat(beetleOptions.brushSize) || DEFAULT_BRUSH_SIZE) *
            pos.scale
        );
        wingPG.line(wingLastX, wingLastY, pos.x, pos.y);
        wingsTexture.needsUpdate = true;

        wingLastX = pos.x;
        wingLastY = pos.y;
        evt.preventDefault();
      });

      ['pointerup', 'pointercancel', 'pointerleave'].forEach((eventName) => {
        wingCanvasEl.elt.addEventListener(eventName, () => {
          wingDrawing = false;
        });
      });
    };

    p.draw = function () {
      // Каждый кадр: убедиться, что canvas лежит в видимой сейчас панели
      // и подогнан под её размер, затем отрисовать буфер как есть --
      // buffer и canvas одного разрешения, масштабирование не нужно.
      syncWingCanvasMount();
      p.image(wingPG, 0, 0);
    };
  });
}

if (wingClearBtns.length) {
  wingClearBtns.forEach((btn) =>
    btn.addEventListener('click', clearWingCanvas)
  );
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
const parallaxStrength = 0.01;
const rotationStrength = 0.2;
// #endregion Анимация камеры HERO

let heroEditorRAF = null;
let time = Date.now();

function rotateModelToCursor(model, strength) {
  // Поворот объектов за курсором
  const targetRotY = model.userData.baseRotY + mouseX * strength;
  const targetRotX = model.userData.baseRotX + mouseY * strength;
  // lerp для плавности
  model.rotation.y += (targetRotY - model.rotation.y) * 0.1;
  model.rotation.x += (targetRotX - model.rotation.x) * 0.1;
}

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

  // ОТДЕЛЬНАЯ АНИМАЦИЯ ОБЪЕКТОВ
  // КАРАНДАШ
  pencilModel.rotation.y += 0.001 * deltaTime;
  // КРЫЛЬЯ
  // object.rotation.z = Math.sin(currentTime * speed) * amplitude;
  // amplitude = максимальный угол в радианах
  beetleWingsModel.rotation.x = Math.sin(currentTime * 0.003) * 0.07;
  // ЗВЁЗДОЧКИ
  star1Model.rotation.y = Math.sin(currentTime * 0.005) * 0.3;
  star2Model.rotation.y = Math.sin(currentTime * 0.005 + 1) * 0.3;
  // РУКА (по двум осям)
  handModel.rotation.z = Math.sin(currentTime * 0.001 + 1) * 0.05;

  rotateModelToCursor(pencilEmptyModel, rotationStrength);
  rotateModelToCursor(handModel, rotationStrength);
  rotateModelToCursor(flowerModel, rotationStrength);
  rotateModelToCursor(brushModel, rotationStrength);
  rotateModelToCursor(star1Model, rotationStrength);
  rotateModelToCursor(star2Model, rotationStrength);
  rotateModelToCursor(bugLabModel, rotationStrength * 3);

  // АНИМАЦИЯ ДВИЖЕНИЯ КАМЕРЫ С КУРСОРОМ
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
