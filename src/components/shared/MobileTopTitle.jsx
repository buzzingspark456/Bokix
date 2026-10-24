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
    let lastTop = scroller.scrollTop;
    const update = () => {
      frame = 0;
      const h1 = scroller.querySelector('.main-content-inner h1');
      const barRect = bar.getBoundingClientRect();
      // En listsidas rubrik står i själva fältets rad (index.css): den lilla
      // rubriken tonar in först när den stora nästan glidit ut under fältet.
      const inBar = Boolean(h1?.closest('.list-page-header'));
      const show = h1
        ? h1.getBoundingClientRect().bottom < (inBar ? barRect.top + 12 : barRect.bottom + 4)
        : scroller.scrollTop > 40;
      const title = (h1?.textContent || '').trim();
      bar.toggleAttribute('data-scrolled', scroller.scrollTop > 2);
      // Den flytande "Ny …"-knappen krymper till en rund knapp när man
      // skrollar nedåt och visar texten igen uppåt eller högst upp (index.css,
      // data-fab-compact). Några pixlars marginal så att studs och små
      // ryck inte får den att blinka.
      const top = scroller.scrollTop;
      if (top < 60 || top < lastTop - 6) scroller.removeAttribute('data-fab-compact');
      else if (top > lastTop + 6) scroller.setAttribute('data-fab-compact', '');
      if (Math.abs(top - lastTop) > 6 || top < 60) lastTop = top;
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
      scroller.removeAttribute('data-fab-compact');
    };
  }, []);

  return (
    <span ref={ref} className="topbar-compact-title" data-show={state.show ? 'true' : 'false'} aria-hidden={!state.show}>
      {state.title}
    </span>
  );
}
