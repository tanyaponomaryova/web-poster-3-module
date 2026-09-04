const svg = document.getElementById('grid-overlay');
const v1 = document.getElementById('v1');
const v2 = document.getElementById('v2');
const h1 = document.getElementById('h1');
const h2 = document.getElementById('h2');

let CONCAVE_K = -0.14; // сила "вогнутости" на экране 1 (ближе к 0 = слабее, ближе к -1.2 = почти гипербола)
let CONVEX_K = 0.12; // сила "выпуклости" на экране 2
let CONVEX_K2 = 0.2; // сила искажения на экране 3 (сильнее)
let SCALE_1 = 1.1; // масштаб сетки на экране 1 (1 = без изменений)
let MAX_SCALE = 3.2; // во сколько раз "приближается" сетка к концу экрана 3

function setViewBox() {
  svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);
}

// Реальные границы секций (вычисляются с учётом их фактической высоты,
// а не по предположению, что каждая секция ровно 100vh)
let bounds = { s1: 0, s2: 0, s3: 0 };

function computeBounds() {
  const secs = document.querySelectorAll('.section');
  bounds.s1 = secs[0].offsetTop;
  bounds.s2 = secs[1].offsetTop;
  bounds.s3 = secs[2].offsetTop;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function render() {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const cx = W / 2;
  const cy = H / 2;

  const scrollY = window.scrollY;

  // прогресс внутри секции 1 → 2 (0..1)
  const seg1 = bounds.s2 - bounds.s1;
  let pA = seg1 > 0 ? (scrollY - bounds.s1) / seg1 : 0;
  pA = Math.min(1, Math.max(0, pA));

  // прогресс внутри секции 2 → 3 (0..1)
  const seg2 = bounds.s3 - bounds.s2;
  let pB = seg2 > 0 ? (scrollY - bounds.s2) / seg2 : 0;
  pB = Math.min(1, Math.max(0, pB));

  let k, scale;

  if (scrollY < bounds.s2) {
    // ещё не долистали до начала секции 2 → идёт переход вогнутость→выпуклость
    k = lerp(CONCAVE_K, CONVEX_K, pA);
    scale = lerp(SCALE_1, 1, pA);
  } else {
    // долистали дальше секции 2 → идёт переход к более сильной выпуклости + зум
    k = lerp(CONVEX_K, CONVEX_K2, pB);
    scale = lerp(1, MAX_SCALE, pB);
  }

  // базовые позиции колонок/строк сетки 3x3 (без искажения)
  const colOffsets = [-W / 6, W / 6];
  const rowOffsets = [-H / 6, H / 6];

  // применяем приближение (scale) от центра
  const cols = colOffsets.map((o) => cx + o * scale);
  const rows = rowOffsets.map((o) => cy + o * scale);

  function vPath(x) {
    const dir = x < cx ? -1 : 1; // направление от центра
    const ctrlX = x + k * dir * W;
    return `M ${x} 0 Q ${ctrlX} ${cy} ${x} ${H}`;
  }
  function hPath(y) {
    const dir = y < cy ? -1 : 1;
    const ctrlY = y + k * dir * H;
    return `M 0 ${y} Q ${cx} ${ctrlY} ${W} ${y}`;
  }

  v1.setAttribute('d', vPath(cols[0]));
  v2.setAttribute('d', vPath(cols[1]));
  h1.setAttribute('d', hPath(rows[0]));
  h2.setAttribute('d', hPath(rows[1]));
}

let ticking = false;
function onScroll() {
  if (!ticking) {
    requestAnimationFrame(() => {
      render();
      ticking = false;
    });
    ticking = true;
  }
}

window.addEventListener('scroll', onScroll, { passive: true });
window.addEventListener('resize', () => {
  setViewBox();
  computeBounds();
  render();
});
window.addEventListener('load', () => {
  computeBounds();
  render();
});

setViewBox();
computeBounds();
render();
