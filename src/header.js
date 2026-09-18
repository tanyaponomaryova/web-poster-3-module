document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('site-header');
  const logo = document.getElementById('header-logo');
  const firstSection = document.querySelector('#hero-section');
  if (!firstSection) {
    console.warn('Первая секция не найдена.');
    return;
  }
  /* * На сколько процентов первой секции * пользователь должен прокрутить страницу. * * 0.9 = 90% * 0.8 = 80% * 0.5 = 50% */
  const SHOW_AFTER = 0.5;
  function updateHeader() {
    const rect = firstSection.getBoundingClientRect();
    /* * Высота первой секции */ const sectionHeight =
      firstSection.offsetHeight;
    /* * Сколько пикселей первой секции * уже прошло через верхнюю границу viewport. */ const passed =
      Math.max(0, -rect.top);
    /* * Процент пройденной секции */ const progress = passed / sectionHeight;
    if (progress >= SHOW_AFTER) {
      header.classList.add('is-visible');
    } else {
      header.classList.remove('is-visible');
    }
  }
  /* * Проверяем положение секции во время прокрутки. */ window.addEventListener(
    'scroll',
    updateHeader,
    { passive: true }
  );
  /* * Проверяем также сразу после загрузки. */ updateHeader();
  /* * Клик по bug-lab.svg — * плавная прокрутка в самое начало. */ logo.addEventListener(
    'click',
    () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  );
});
