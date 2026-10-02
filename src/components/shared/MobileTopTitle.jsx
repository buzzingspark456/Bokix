import React, { useEffect, useRef, useState } from 'react';

// Telefonens toppfält beter sig som en apps navigationsfält (iOS "large
// title"): sidans egen stora rubrik (första <h1> i innehållet) står kvar
// högst upp i sidan, och när man skrollat förbi den tonar samma namn in
// i det fasta toppfältet. Fältet får samtidigt en tunn underkant, så det
// syns var innehållet glider in under det.
//
// Rubriken läses ur sidan i stället för ur en egen lista med namn, så nya
// sidor följer med av sig själva. Läses om vid varje skroll: sidorna laddas
// lat (Suspense) och rubriken finns inte alltid när fältet monteras.
export default function MobileTopTitle() {
  const ref = useRef(null);
  const [state, setState] = useState({ title: '', show: false });

  useEffect(() => {
    const el = ref.current;
    const bar = el?.closest('.global-top-bar');
    const scroller = el?.closest('.main-wrapper');
    if (!bar || !scroller) return undefined;
    let frame = 0;
    const update = () => {
      frame = 0;
      const h1 = scroller.querySelector('.main-content-inner h1');
      const barBottom = bar.getBoundingClientRect().bottom;
      const show = h1 ? h1.getBoundingClientRect().bottom < barBottom + 4 : scroller.scrollTop > 40;
      const title = (h1?.textContent || '').trim();
      bar.toggleAttribute('data-scrolled', scroller.scrollTop > 2);
      setState(prev => (prev.title === title && prev.show === show ? prev : { title, show }));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    scroller.addEventListener('scroll', onScroll, { passive: true });
    const timer = setTimeout(update, 300);
    update();
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame) cancelAnimationFrame(frame);
      clearTimeout(timer);
      bar.removeAttribute('data-scrolled');
    };
  }, []);

  return (
    <span ref={ref} className="topbar-compact-title" data-show={state.show ? 'true' : 'false'} aria-hidden={!state.show}>
      {state.title}
    </span>
  );
}
