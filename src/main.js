import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import p5 from 'https://cdn.jsdelivr.net/npm/p5@1.9.4/+esm';

// Мои скрипты
import '/src/mascot.js';
import '/src/panel-system.js';
import '/src/grid-overlay.js';
import '/src/camera.js';

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

// Создание Scene
const scene = new THREE.Scene();

// #region Загрузка модельки
// console.log(GLTFLoader);
const gltfLoader = new GLTFLoader();
let model;
// let circleEyes;
// let starEyes;
// let heartEyes;
let whiteEyes;
let head;
// let longBody;
// let longWings;
// let mediumBody;
// let mediumWings;
// let shortBody;
// let shortWings;
// let antennae;
// let deerHorns;
// let rhinoHorns;

gltfLoader.load('public/Beetles.glb', (gltf) => {
  model = gltf.scene;
  scene.add(model);
  console.log(model);

  head = model.getObjectByName('Head');
  whiteEyes = model.getObjectByName('White_Eye');

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
  //
  initP5();
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
  1000
);
scene.add(camera);
camera.position.z = -2.5;
camera.position.x = -2.5;
camera.position.y = 3;

//AxesHelper
const axesHelper = new THREE.AxesHelper(5);
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
controls.rotateSpeed = 0.3;
controls.enableDamping = true;
controls.enablePan = false;
controls.target = new THREE.Vector3(0, 0, 0);
controls.enableZoom = false;

// Ресайз
window.addEventListener('resize', () => {
  // Обновить sizes
  // sizes.width = window.innerWidth;
  // sizes.height = window.innerHeight;

  // Обновить camera
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();

  // Обновить renderer
  renderer.setSize(sizes.width, sizes.height);
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

// // #region Кисти
// const bigBrushBtn = document.querySelector('.big-brush');
// const midBrushBtn = document.querySelector('.mid-brush');
// const lilBrushBtn = document.querySelector('.lil-brush');
// let brushSizeIndex = 0;
// function getBrushSize() {
//   if (brushSizeIndex == 0) {
//     return bigBrushBtn.offsetWidth;
//   }
//   if (brushSizeIndex == 1) {
//     return midBrushBtn.offsetWidth;
//   }
//   return lilBrushBtn.offsetWidth;
// }

// const brushColors = ['#ff87a9', '#a2ff3e', '#00e1ff'];
// let brushColorIndex = 0;
// let isRainbowBrush = false;

// bigBrushBtn.addEventListener('click', () => (brushSizeIndex = 0));
// midBrushBtn.addEventListener('click', () => (brushSizeIndex = 1));
// lilBrushBtn.addEventListener('click', () => (brushSizeIndex = 2));

// const pinkColorBtn = document.querySelector('.pink');
// const greenColorBtn = document.querySelector('.green');
// const blueColorBtn = document.querySelector('.blue');

// pinkColorBtn.addEventListener('click', () => {
//   brushColorIndex = 0;
//   isRainbowBrush = false;
// });
// greenColorBtn.addEventListener('click', () => {
//   brushColorIndex = 1;
//   isRainbowBrush = false;
// });
// blueColorBtn.addEventListener('click', () => {
//   brushColorIndex = 2;
//   isRainbowBrush = false;
// });

// const rainbowColorBtn = document.querySelector('.rainbow');
// rainbowColorBtn.addEventListener('click', () => (isRainbowBrush = true));
// // #endregion

// // #region P5
// let p5Canvas;
// const p5container = document.getElementById('p5-container');

// let pg; // графический буфер
// let p;
// let wingsTexture;

// function initP5() {
//   p = new p5((p) => {
//     // выполняется один раз
//     p.setup = function () {
//       // квадратный канвас, вписанный в контейнер
//       const size = Math.min(p5container.offsetWidth, p5container.offsetHeight);
//       p5Canvas = p.createCanvas(size, size);
//       p5Canvas.parent('p5-container');

//       // создаем графический буфер
//       pg = p.createGraphics(size, size);
//       pg.background(255);

//       // так как setup выполняется после создания скетча,
//       // необходимо, чтобы p5Canvas существовал перед p5Canvas.elt
//       //
//       // настройки текстуры
//       wingsTexture = new THREE.CanvasTexture(pg.elt);
//       wingsTexture.flipY = false;

//       wingsTexture.colorSpace = THREE.SRGBColorSpace;
//       wingsTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
//       wingsTexture.needsUpdate = true;

//       const wingsMaterial = new THREE.MeshBasicMaterial({ map: wingsTexture });
//       beetleOptions.wingShape.variants.forEach((item) => {
//         item.mesh.material = wingsMaterial;
//       });
//     };

//     // бесконечный цикл
//     p.draw = function () {
//       p.background(255);

//       p.image(pg, 0, 0, p.width, p.height);

//       if (
//         p.mouseIsPressed &&
//         p.mouseX >= 0 &&
//         p.mouseX <= p.width &&
//         p.mouseY >= 0 &&
//         p.mouseY <= p.height
//       ) {
//         const bx = p.mouseX * (pg.width / p.width);
//         const by = p.mouseY * (pg.height / p.height);
//         const pbx = p.pmouseX * (pg.width / p.width);
//         const pby = p.pmouseY * (pg.height / p.height);

//         pg.stroke(getColor());
//         pg.strokeWeight(getBrushSize());
//         pg.line(pbx, pby, bx, by);
//       }
//     };

//     // ресайз окна
//     p.windowResized = function () {
//       const size = Math.min(p5container.offsetWidth, p5container.offsetHeight);

//       // создаем новый буфер с новым размером
//       const newPG = p.createGraphics(size, size);
//       newPG.background(255);

//       // масштабируем старое содержимое на новый буфер
//       newPG.image(pg, 0, 0, size, size);

//       pg = newPG; // заменяем буфер
//       p.resizeCanvas(size, size);

//       wingsTexture = new THREE.CanvasTexture(pg.elt);
//       wingsTexture.flipY = false;

//       wingsTexture.colorSpace = THREE.SRGBColorSpace;
//       wingsTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
//       wingsTexture.needsUpdate = true;

//       const wingsMaterial = new THREE.MeshBasicMaterial({
//         map: wingsTexture,
//       });
//       beetleOptions.wingShape.variants.forEach((item) => {
//         item.mesh.material = wingsMaterial;
//       });
//     };
//   });
// }

// let t = 0;
// let speed = 0.05;
// function getColor() {
//   if (isRainbowBrush) {
//     // текущий цвет -- сразу переводим в формат, который понимает p5
//     let color1 = p.color(brushColors[brushColorIndex]);
//     // следующий цвет по кругу -- сразу переводим в формат, который понимает p5
//     let color2 = p.color(
//       brushColors[(brushColorIndex + 1) % brushColors.length]
//     );
//     let outputColor = p.lerpColor(color1, color2, t);
//     t += speed;
//     if (t > 1) {
//       t = 0;
//       brushColorIndex = (brushColorIndex + 1) % brushColors.length;
//     }
//     return outputColor;
//   } else {
//     return brushColors[brushColorIndex];
//   }
// }

// // #endregion

// Обновление кадров

function tick() {
  //Render
  renderer.render(scene, camera);
  controls.update();
  requestAnimationFrame(tick);

  // // обновляем текстуру в каждом кадре
  // if (wingsTexture) {
  //   wingsTexture.needsUpdate = true;
  // }

  // Обновляем позицию летяющих кнопок
  updateButtonPosition();
}
tick();
