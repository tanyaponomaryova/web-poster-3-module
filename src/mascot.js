document.addEventListener('DOMContentLoaded', () => {
  const widget = document.querySelector('.mascot-widget');
  const face = document.querySelector('.mascot-face');

  // Насколько сильно наклоняется лицо (в градусах) и насколько
  // далеко от маскота курсор должен быть, чтобы наклон стал максимальным.
  const MAX_TILT = 30; // deg
  const X_RANGE = 420; // px
  const Y_RANGE = 100; // px
  const X_SLIDE = 20; // px — насколько "лицо" сдвигается по сфере
  const Y_SLIDE = 30; // px — насколько "лицо" сдвигается по сфере
  const SMOOTHING = 0.08; // 0..1, чем меньше — тем медленнее и плавнее следование

  // target — куда лицо должно стремиться, current — где оно сейчас (лерп)
  let target = { x: 0, y: 0 };
  let current = { x: 0, y: 0 };

  function onPointerMove(e) {
    const rect = widget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;

    let dx = (e.clientX - cx) / X_RANGE;
    let dy = (e.clientY - cy) / Y_RANGE;

    // ограничиваем диапазон -1..1, чтобы наклон не был запредельным
    dx = Math.max(-1, Math.min(1, dx));
    dy = Math.max(-1, Math.min(1, dy));

    target.x = dx;
    target.y = dy;
  }

  window.addEventListener('mousemove', onPointerMove, { passive: true });

  function animate() {
    // линейная интерполяция current -> target даёт эффект "инерции"/задержки
    current.x += (target.x - current.x) * SMOOTHING;
    current.y += (target.y - current.y) * SMOOTHING;

    const rotY = current.x * MAX_TILT; // курсор правее -> поворот вокруг Y
    const rotX = -current.y * MAX_TILT; // курсор выше   -> поворот вокруг X
    const moveX = current.x * X_SLIDE;
    const moveY = current.y * Y_SLIDE * 0.7;

    face.style.transform = `rotateX(${rotX}deg) rotateY(${rotY}deg) translate(${moveX}px, ${moveY}px)`;

    requestAnimationFrame(animate);
  }

  animate();
});
