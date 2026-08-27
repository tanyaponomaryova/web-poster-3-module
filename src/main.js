import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import p5 from 'https://cdn.jsdelivr.net/npm/p5@1.9.4/+esm';

// Создание Scene
const scene = new THREE.Scene();

// Загрузка модельки
console.log(GLTFLoader);
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

  beetleOptions.eyes.variants.forEach((item) => {
    item.mesh = model.getObjectByName(item.name);
  });

  beetleOptions.head.variants.forEach((item) => {
    item.mesh = model.getObjectByName(item.name);
  });

  beetleOptions.bodyShape.variants.forEach((item) => {
    item.mesh = model.getObjectByName(item.name);
  });

  beetleOptions.wingShape.variants.forEach((item) => {
    item.mesh = model.getObjectByName(item.name);
  });

  // Устанавливаем первичные значения
  toggleVariant(beetleOptions.head, 'Antennae');
  toggleVariant(beetleOptions.eyes, 'Circle');
  toggleVariant(beetleOptions.bodyShape, 'Body_Medium');
  // toggleVariant(beetleOptions.bodyColor, "Body_Medium");

  //
  initP5();
});

const beetleOptions = {
  eyes: {
    selected: null,
    variants: [
      {
        name: 'Star',
        mesh: null,
        button: document.querySelector('.star-eyes'),
      },
      {
        name: 'Circle',
        mesh: null,
        button: document.querySelector('.circle-eyes'),
      },
      {
        name: 'Heart',
        mesh: null,
        button: document.querySelector('.heart-eyes'),
      },
    ],
  },

  head: {
    selected: null,
    variants: [
      {
        name: 'Antennae',
        mesh: null,
        button: document.querySelector('.antennae'),
      },
      {
        name: 'Deer_Horns',
        mesh: null,
        button: document.querySelector('.deer-horns'),
      },
      {
        name: 'Rhino_Horns',
        mesh: null,
        button: document.querySelector('.rhino-horns'),
      },
    ],
  },

  bodyShape: {
    selected: null,
    variants: [
      {
        name: 'Body_Long',
        mesh: null,
        button: document.querySelector('.long-body'),
      },
      {
        name: 'Body_Medium',
        mesh: null,
        button: document.querySelector('.medium-body'),
      },
      {
        name: 'Body_Short',
        mesh: null,
        button: document.querySelector('.short-body'),
      },
    ],
  },

  wingShape: {
    selected: null,
    variants: [
      {
        name: 'Wings_Long',
        mesh: null,
      },
      {
        name: 'Wings_Medium',
        mesh: null,
      },
      {
        name: 'Wings_Short',
        mesh: null,
      },
    ],
  },

  bodyColor: {
    selected: null,
    variants: [
      {
        name: '#ff5b94',
        button: document.getElementById('pink-body'),
      },
      {
        name: '#c14fff',
        button: document.getElementById('purple-body'),
      },
      {
        name: '#5650ff',
        button: document.getElementById('blue-body'),
      },
      {
        name: '#9BFF4F',
        button: document.getElementById('green-body'),
      },
      {
        name: '#ffb13c',
        button: document.getElementById('orange-body'),
      },
    ],
  },
};

// Функция выбора
function toggleVariant(group, clickedName) {
  // Снимаем актив у всех кнопок этой группы
  group.variants.forEach((item) => {
    if (item.button) item.button.classList.remove('active');
  });

  if (group === beetleOptions.bodyColor) {
    // так как у головы и тел одинаковый материал -- цвет изменится у всего
    head.material.emissive.set(clickedName);
    const btn = group.variants.find(
      (item) => item.name === clickedName
    )?.button;
    if (btn) {
      btn.classList.add('active');
      console.log('кнопка цвет телжа');
      console.log(clickedName);
      console.log(btn.classList);
    }
    group.selected = clickedName;
    return;
  }

  let indexOfClickedItem;
  for (let i = 0; i < group.variants.length; i++) {
    if (clickedName === group.variants[i].name) {
      indexOfClickedItem = i;
    }
  }
  for (let i = 0; i < group.variants.length; i++) {
    if (i === indexOfClickedItem) {
      group.variants[i].mesh.visible = true;
      if (group.variants[i].button)
        group.variants[i].button.classList.add('active');
    } else {
      group.variants[i].mesh.visible = false;
    }
  }

  group.selected = clickedName;
  if (group === beetleOptions.bodyShape) {
    // если изменилось тело -- меняем крылья
    for (let i = 0; i < beetleOptions.wingShape.variants.length; i++) {
      if (i === indexOfClickedItem) {
        beetleOptions.wingShape.variants[i].mesh.visible = true;
      } else {
        beetleOptions.wingShape.variants[i].mesh.visible = false;
      }
    }
    beetleOptions.wingShape.selected =
      beetleOptions.wingShape.variants[indexOfClickedItem].name;
  }
}

beetleOptions.head.variants.forEach((item) => {
  item.button.addEventListener('click', () => {
    toggleVariant(beetleOptions.head, item.name);
  });
});
beetleOptions.eyes.variants.forEach((item) => {
  item.button.addEventListener('click', () => {
    toggleVariant(beetleOptions.eyes, item.name);
  });
});
beetleOptions.bodyShape.variants.forEach((item) => {
  item.button.addEventListener('click', () => {
    toggleVariant(beetleOptions.bodyShape, item.name);
  });
});
beetleOptions.bodyColor.variants.forEach((item) => {
  item.button.addEventListener('click', () => {
    toggleVariant(beetleOptions.bodyColor, item.name);
  });
});

const container3d = document.getElementById('container-3d');
const sizes = {
  get width() {
    return container3d.offsetWidth;
  },
  get height() {
    return container3d.offsetHeight;
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
  alpha: true,
  antialias: true,
  canvas: canvas,
});
renderer.setSize(sizes.width, sizes.height);
renderer.render(scene, camera);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// Создание OrbitControls
const controls = new OrbitControls(camera, canvas);
// controls.autoRotate = true;
// controls.rotateSpeed = 0.3;
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

// #region Положение клика в 3д
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
window.addEventListener('click', (event) => {
  mouse.x = (event.clientX / sizes.width) * 2 - 1;
  mouse.y = -(event.clientY / sizes.height) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);

  if (intersects.length > 0) {
    const hit = intersects[0];

    console.log('Клик по объекту:', hit.object.name);
    console.log('Точка клика в 3D:', hit.point);
  }
});
// #endregion

// #region Кисти
const bigBrushBtn = document.querySelector('.big-brush');
const midBrushBtn = document.querySelector('.mid-brush');
const lilBrushBtn = document.querySelector('.lil-brush');
let brushSizeIndex = 0;
function getBrushSize() {
  if (brushSizeIndex == 0) {
    return bigBrushBtn.offsetWidth;
  }
  if (brushSizeIndex == 1) {
    return midBrushBtn.offsetWidth;
  }
  return lilBrushBtn.offsetWidth;
}

const brushColors = ['#ff87a9', '#a2ff3e', '#00e1ff'];
let brushColorIndex = 0;
let isRainbowBrush = false;

bigBrushBtn.addEventListener('click', () => (brushSizeIndex = 0));
midBrushBtn.addEventListener('click', () => (brushSizeIndex = 1));
lilBrushBtn.addEventListener('click', () => (brushSizeIndex = 2));

const pinkColorBtn = document.querySelector('.pink');
const greenColorBtn = document.querySelector('.green');
const blueColorBtn = document.querySelector('.blue');

pinkColorBtn.addEventListener('click', () => {
  brushColorIndex = 0;
  isRainbowBrush = false;
});
greenColorBtn.addEventListener('click', () => {
  brushColorIndex = 1;
  isRainbowBrush = false;
});
blueColorBtn.addEventListener('click', () => {
  brushColorIndex = 2;
  isRainbowBrush = false;
});

const rainbowColorBtn = document.querySelector('.rainbow');
rainbowColorBtn.addEventListener('click', () => (isRainbowBrush = true));
// #endregion

let p5Canvas;
const p5container = document.getElementById('p5-container');

let pg; // графический буфер
let p;
let wingsTexture;

function initP5() {
  p = new p5((p) => {
    // выполняется один раз
    p.setup = function () {
      // квадратный канвас, вписанный в контейнер
      const size = Math.min(p5container.offsetWidth, p5container.offsetHeight);
      p5Canvas = p.createCanvas(size, size);
      p5Canvas.parent('p5-container');

      // создаем графический буфер
      pg = p.createGraphics(size, size);
      pg.background(255);

      // так как setup выполняется после создания скетча,
      // необходимо, чтобы p5Canvas существовал перед p5Canvas.elt
      //
      // настройки текстуры
      wingsTexture = new THREE.CanvasTexture(pg.elt);
      wingsTexture.flipY = false;

      wingsTexture.colorSpace = THREE.SRGBColorSpace;
      wingsTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      wingsTexture.needsUpdate = true;

      const wingsMaterial = new THREE.MeshBasicMaterial({ map: wingsTexture });
      beetleOptions.wingShape.variants.forEach((item) => {
        item.mesh.material = wingsMaterial;
      });
    };

    // бесконечный цикл
    p.draw = function () {
      p.background(255);

      p.image(pg, 0, 0, p.width, p.height);

      if (
        p.mouseIsPressed &&
        p.mouseX >= 0 &&
        p.mouseX <= p.width &&
        p.mouseY >= 0 &&
        p.mouseY <= p.height
      ) {
        const bx = p.mouseX * (pg.width / p.width);
        const by = p.mouseY * (pg.height / p.height);
        const pbx = p.pmouseX * (pg.width / p.width);
        const pby = p.pmouseY * (pg.height / p.height);

        pg.stroke(getColor());
        pg.strokeWeight(getBrushSize());
        pg.line(pbx, pby, bx, by);
      }
    };

    // ресайз окна
    p.windowResized = function () {
      const size = Math.min(p5container.offsetWidth, p5container.offsetHeight);

      // создаем новый буфер с новым размером
      const newPG = p.createGraphics(size, size);
      newPG.background(255);

      // масштабируем старое содержимое на новый буфер
      newPG.image(pg, 0, 0, size, size);

      pg = newPG; // заменяем буфер
      p.resizeCanvas(size, size);

      wingsTexture = new THREE.CanvasTexture(pg.elt);
      wingsTexture.flipY = false;

      wingsTexture.colorSpace = THREE.SRGBColorSpace;
      wingsTexture.anisotropy = renderer.capabilities.getMaxAnisotropy();
      wingsTexture.needsUpdate = true;

      const wingsMaterial = new THREE.MeshBasicMaterial({
        map: wingsTexture,
      });
      beetleOptions.wingShape.variants.forEach((item) => {
        item.mesh.material = wingsMaterial;
      });
    };
  });
}

let t = 0;
let speed = 0.05;
function getColor() {
  if (isRainbowBrush) {
    // текущий цвет -- сразу переводим в формат, который понимает p5
    let color1 = p.color(brushColors[brushColorIndex]);
    // следующий цвет по кругу -- сразу переводим в формат, который понимает p5
    let color2 = p.color(
      brushColors[(brushColorIndex + 1) % brushColors.length]
    );
    let outputColor = p.lerpColor(color1, color2, t);
    t += speed;
    if (t > 1) {
      t = 0;
      brushColorIndex = (brushColorIndex + 1) % brushColors.length;
    }
    return outputColor;
  } else {
    return brushColors[brushColorIndex];
  }
}

// #endregion

// Обновление кадров
function tick() {
  //Render
  renderer.render(scene, camera);
  controls.update();
  requestAnimationFrame(tick);

  // обновляем текстуру в каждом кадре
  if (wingsTexture) {
    wingsTexture.needsUpdate = true;
  }

  // Обновляем позицию летяющих кнопок
  updateButtonPosition();
}
tick();
