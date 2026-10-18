/* Darstellung und Bedienung des Imkerkurses. Daten: window.KURS, Logik: window.Logik. */
(function () {
  "use strict";

  const KURS = window.KURS;
  const L = window.Logik;
  const SPEICHER = "imkerkurs.v1";
  const inhalt = document.getElementById("inhalt");

  /* ---------- Speicher ---------- */
  let stand = null;

  function ladeStand() {
    try {
      return L.normalisiereStand(JSON.parse(localStorage.getItem(SPEICHER) || "null"));
    } catch (e) {
      return L.leererStand();
    }
  }

  function speichere() {
    let gespeichert = true;
    try {
      localStorage.setItem(SPEICHER, JSON.stringify(stand));
    } catch (e) {
      gespeichert = false;
    }
    document.getElementById("speicher-hinweis").textContent = gespeichert
      ? "" : "Dein Browser speichert den Fortschritt nicht. Er geht beim Schließen der Seite verloren.";
    aktualisiereZaehler();
  }

  /* ---------- Hilfen ---------- */
  function esc(text) {
    return String(text).replace(/[&<>"']/g, (z) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[z]);
  }

  function datumDe(iso) {
    const t = String(iso).split("-");
    return t.length === 3 ? `${t[2]}.${t[1]}.${t[0]}` : String(iso);
  }

  function heute() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  const lektionNachId = (id) => KURS.lektionen.find((l) => l.id === id);
  const modulNachNr = (nr) => KURS.module.find((m) => m.nr === nr);

  function setzeTitel(text) {
    document.title = text ? `${text} · Imkerkurs` : "Imkerkurs";
  }

  function alleFragen() {
    const liste = [];
    KURS.lektionen.forEach((l) => l.fragen.forEach((f) => liste.push({ frage: f, lektion: l })));
    return liste;
  }

  /* Ids der Wiederholungsliste, die es im Kurs noch gibt */
  function offeneIds() {
    return L.offeneIds(KURS.lektionen, stand.wiederholung);
  }

  /* Fokus auf ein Element setzen, das sonst keinen bekommt, damit Screenreader den neuen Inhalt vorlesen */
  function fokussiere(element) {
    element.tabIndex = -1;
    element.focus({ preventScroll: true });
  }

  /* ---------- Kursübersicht ---------- */
  function zeigeUebersicht() {
    setzeTitel("");
    const gesamt = KURS.lektionen.length;
    let html = `<h1>Dein Imkerkurs</h1>`;
    if (gesamt) {
      const naechste = L.naechsteOffeneLektion(KURS.lektionen, stand.abgeschlossen);
      const fertig = KURS.lektionen.filter((l) => stand.abgeschlossen[l.id]).length;
      const offen = offeneIds().length;
      html += `<p class="leise">${fertig} von ${gesamt} verfügbaren Lektionen abgeschlossen.</p><p class="aktionen">`;
      html += naechste
        ? `<a class="knopf" href="#/lektion/${naechste.id}">Weiter lernen: ${esc(naechste.titel)}</a>`
        : `<span class="leise">Alle verfügbaren Lektionen sind abgeschlossen.</span>`;
      if (offen) {
        html += `<a class="knopf zweit" href="#/wiederholen">${offen} ${offen === 1 ? "Frage" : "Fragen"} wiederholen</a>`;
      }
      html += `</p>`;
    } else {
      html += `<p class="leise">Die ersten Lektionen sind in Vorbereitung.</p>`;
    }
    html += `<div class="modulliste">`;
    KURS.module.forEach((m) => {
      const f = L.modulFortschritt(m.nr, KURS.lektionen, stand.abgeschlossen);
      const prozent = f.gesamt ? Math.round((f.fertig / f.gesamt) * 100) : 0;
      const zustand = f.gesamt ? `${f.fertig} von ${f.gesamt} Lektionen abgeschlossen` : "in Vorbereitung";
      html += `<a class="karte modulkarte${f.gesamt ? "" : " leer"}" href="#/modul/${m.nr}">
        <p class="leise">Modul ${m.nr} · ${esc(m.zeitraum)}</p>
        <h2>${esc(m.titel)}</h2>
        <div class="fortschritt" aria-hidden="true"><span style="width:${prozent}%"></span></div>
        <p class="leise">${zustand}</p></a>`;
    });
    inhalt.innerHTML = html + "</div>";
  }

  /* ---------- Modulseite ---------- */
  function zeigeModul(nr) {
    const m = modulNachNr(nr);
    if (!m) {
      zeigeUebersicht();
      return;
    }
    setzeTitel(m.titel);
    const eigene = KURS.lektionen.filter((l) => l.modul === nr);
    let html = `<p class="brotkrumen"><a href="#/">Kurs</a></p>
      <h1>Modul ${m.nr}: ${esc(m.titel)}</h1>
      <p>${esc(m.beschreibung)}</p>
      <p class="leise">Lernzeitraum: ${esc(m.zeitraum)}</p>
      <ol class="lektionsliste">`;
    eigene.forEach((l) => {
      const q = stand.quiz[l.id];
      let status = `<span class="leise">${l.dauer} Min.</span>`;
      if (stand.abgeschlossen[l.id]) {
        status = `<span class="status-fertig">✓ abgeschlossen</span>`;
      } else if (q) {
        status = `<span class="leise">bisher ${Math.round(q.anteil * 100)} %</span>`;
      }
      html += `<li><a href="#/lektion/${l.id}"><span>${l.nr}. ${esc(l.titel)}</span>${status}</a></li>`;
    });
    m.geplant.slice(eigene.length).forEach((titel) => {
      html += `<li><span class="geplant"><span>${esc(titel)}</span><span>in Vorbereitung</span></span></li>`;
    });
    inhalt.innerHTML = html + "</ol>";
  }

  /* ---------- Prüffragen (Lektion und Wiederholung) ---------- */
  function frageHtml(frage, zusatz) {
    const art = frage.typ === "mehrfach" ? "checkbox" : "radio";
    const hinweis = frage.typ === "mehrfach" ? "Mehrere Antworten können richtig sein." : "Eine Antwort ist richtig.";
    /* Die Optionen erscheinen bei jedem Aufbau in neuer Reihenfolge. Wert und data-index behalten den ursprünglichen Index. */
    const optionen = L.mischeReihenfolge(frage.optionen.length).map((i) => `
      <li class="option" data-index="${i}">
        <label><input type="${art}" name="${frage.id}" value="${i}"><span>${frage.optionen[i].text}</span></label>
        <p class="begruendung" hidden><strong class="urteil"></strong> ${frage.optionen[i].begruendung}</p>
      </li>`).join("");
    return `<div class="frage" data-frage="${frage.id}" role="group" aria-labelledby="${frage.id}-text">
      ${zusatz || ""}
      <p class="frage-text" id="${frage.id}-text">${frage.frage}</p>
      <p class="frage-hinweis">${hinweis}</p>
      <ul class="optionen">${optionen}</ul>
      <button type="button" class="knopf pruefen">Antwort prüfen</button>
      <p class="ergebnis" hidden></p>
    </div>`;
  }

  /** Bindet die Prüflogik an alle Fragen im Container. beiErgebnis(frage, richtig) nach jeder Prüfung. */
  function bindeFragen(container, fragen, beiErgebnis) {
    container.querySelectorAll(".frage").forEach((box) => {
      const frage = fragen.find((f) => f.id === box.dataset.frage);
      box.querySelector(".pruefen").addEventListener("click", () => {
        const gewaehlt = Array.from(box.querySelectorAll("input:checked")).map((e) => Number(e.value));
        const ergebnis = box.querySelector(".ergebnis");
        if (!gewaehlt.length) {
          ergebnis.hidden = false;
          ergebnis.className = "ergebnis";
          ergebnis.textContent = "Bitte zuerst eine Antwort wählen.";
          fokussiere(ergebnis);
          return;
        }
        const richtig = L.bewerteAntwort(frage, gewaehlt);
        box.querySelectorAll(".option").forEach((li) => {
          const i = Number(li.dataset.index);
          const istRichtig = frage.optionen[i].richtig;
          const istGewaehlt = gewaehlt.includes(i);
          li.querySelector("input").disabled = true;
          li.querySelector(".begruendung").hidden = false;
          if (istRichtig) {
            li.classList.add("richtig");
            li.querySelector(".urteil").textContent = istGewaehlt ? "Richtig gewählt." : "Richtig, aber nicht gewählt.";
          } else if (istGewaehlt) {
            li.classList.add("falsch");
            li.querySelector(".urteil").textContent = "Falsch gewählt.";
          }
        });
        box.querySelector(".pruefen").remove();
        ergebnis.hidden = false;
        ergebnis.className = `ergebnis ${richtig ? "gut" : "schlecht"}`;
        ergebnis.textContent = richtig ? "Richtig." : "Nicht ganz. Die Begründungen erklären, warum.";
        fokussiere(ergebnis);
        stand.wiederholung = L.aktualisiereWiederholung(stand.wiederholung, frage.id, richtig);
        speichere();
        beiErgebnis(frage, richtig);
      });
    });
  }

  /* ---------- Lektion ---------- */
  /* Breite Tabellen scrollen seitlich. Am Handy fehlt der Scrollbalken, daher zeigt die Klasse breit einen Hinweis */
  function markiereBreiteTabellen() {
    inhalt.querySelectorAll(".tabelle").forEach((box) => {
      box.classList.toggle("breit", box.scrollWidth > box.clientWidth + 1);
    });
  }

  function zeigeLektion(id) {
    const l = lektionNachId(id);
    if (!l) {
      zeigeUebersicht();
      return;
    }
    const m = modulNachNr(l.modul);
    setzeTitel(l.titel);
    const { vorher, nachher } = L.nachbarn(KURS.lektionen, l.id);
    const ziele = l.lernziele.map((z) => `<li>${esc(z)}</li>`).join("");
    const quellen = l.quellen.map((q) => `<li>${q}</li>`).join("");
    const blaettern = vorher || nachher
      ? `<nav class="blaettern" aria-label="Lektionen blättern">
        ${vorher ? `<a class="knopf zweit" href="#/lektion/${vorher.id}">← ${esc(vorher.titel)}</a>` : "<span></span>"}
        ${nachher ? `<a class="knopf zweit" href="#/lektion/${nachher.id}">${esc(nachher.titel)} →</a>` : ""}
      </nav>`
      : "";
    inhalt.innerHTML = `
      <p class="brotkrumen"><a href="#/">Kurs</a> › <a href="#/modul/${l.modul}">Modul ${l.modul}: ${esc(m ? m.titel : "")}</a></p>
      <h1>${esc(l.titel)}</h1>
      <p class="leise">Lektion ${l.nr} · etwa ${l.dauer} Minuten · Stand ${esc(datumDe(l.stand))}</p>
      <section class="lernziele"><h2>Lernziele</h2><ul>${ziele}</ul></section>
      <article class="lektionstext">${l.html}</article>
      <section class="pruefung">
        <h2>Prüffragen</h2>
        <p class="leise">Ab ${Math.round(L.BESTEHEN * 100)} % richtigen Antworten ist die Lektion bestanden.</p>
        <div id="fragen">${l.fragen.map((f) => frageHtml(f)).join("")}</div>
        <div id="fazit" class="quizfazit" role="status"></div>
      </section>
      <section class="quellen"><h2>Quellen</h2><ol>${quellen}</ol></section>
      ${blaettern}`;
    const antworten = {};
    bindeFragen(document.getElementById("fragen"), l.fragen, (frage, richtig) => {
      antworten[frage.id] = richtig;
      if (Object.keys(antworten).length === l.fragen.length) {
        zeigeFazit(l, antworten, nachher);
      }
    });
    markiereBreiteTabellen();
  }

  function zeigeFazit(l, antworten, nachher) {
    const e = L.quizErgebnis(l.fragen, antworten);
    const bisher = stand.quiz[l.id];
    if (!bisher || e.anteil >= bisher.anteil) {
      stand.quiz[l.id] = { anteil: e.anteil, datum: heute() };
    }
    speichere();
    const quote = `${e.richtig} von ${e.anzahl} richtig (${Math.round(e.anteil * 100)} %).`;
    const fazit = document.getElementById("fazit");
    fazit.innerHTML = e.bestanden
      ? `<p class="ergebnis gut">${quote} Bestanden.</p>
         <button type="button" class="knopf" id="abschliessen">Lektion abschließen${nachher ? " und weiter" : ""}</button>`
      : `<p class="ergebnis schlecht">${quote} Noch nicht bestanden.</p>
         <p>Lies die Abschnitte zu den falsch beantworteten Fragen noch einmal. Diese Fragen stehen jetzt auch in deiner Wiederholung.</p>
         <button type="button" class="knopf zweit" id="neu-versuchen">Fragen neu beantworten</button>`;
    const abschliessen = document.getElementById("abschliessen");
    if (abschliessen) {
      abschliessen.addEventListener("click", () => {
        stand.abgeschlossen[l.id] = stand.abgeschlossen[l.id] || heute();
        speichere();
        location.hash = nachher ? `#/lektion/${nachher.id}` : "#/";
      });
    }
    const neu = document.getElementById("neu-versuchen");
    if (neu) {
      neu.addEventListener("click", () => {
        zeigeLektion(l.id);
        document.querySelector(".pruefung").scrollIntoView();
        fokussiere(document.querySelector(".pruefung h2"));
      });
    }
  }

  /* ---------- Wiederholen ---------- */
  function zeigeWiederholen() {
    setzeTitel("Wiederholen");
    const ids = offeneIds();
    const eintraege = alleFragen().filter((e) => ids.includes(e.frage.id));
    if (!eintraege.length) {
      inhalt.innerHTML = `<h1>Wiederholen</h1>
        <p>Gerade gibt es nichts zu wiederholen. Falsch beantwortete Prüffragen landen automatisch hier und verschwinden, wenn du sie zweimal in Folge richtig beantwortest.</p>
        <p><a class="knopf" href="#/">Zur Kursübersicht</a></p>`;
      return;
    }
    inhalt.innerHTML = `<h1>Wiederholen</h1>
      <p class="leise">${eintraege.length} ${eintraege.length === 1 ? "Frage" : "Fragen"}. Eine Frage verschwindet aus der Liste, wenn du sie zweimal in Folge richtig beantwortest.</p>
      <div id="fragen">${eintraege.map((e) => frageHtml(e.frage,
        `<p class="leise">Aus: <a href="#/lektion/${e.lektion.id}">${esc(e.lektion.titel)}</a></p>`)).join("")}</div>
      <p><button type="button" class="knopf zweit" id="neue-runde">Neue Runde</button></p>`;
    bindeFragen(document.getElementById("fragen"), eintraege.map((e) => e.frage), () => {});
    document.getElementById("neue-runde").addEventListener("click", () => {
      zeigeWiederholen();
      window.scrollTo(0, 0);
      fokussiere(document.querySelector("#inhalt h1"));
    });
  }

  /* ---------- Glossar ---------- */
  function zeigeGlossar() {
    setzeTitel("Glossar");
    const eintrag = (g) => `<div class="glossar-eintrag">
        <dt>${esc(g.begriff)}</dt><dd>${g.erklaerung}</dd></div>`;
    inhalt.innerHTML = `<section class="glossar"><h1>Glossar</h1>
      <label for="glossar-suche" class="leise">Begriff suchen</label>
      <input id="glossar-suche" class="glossar-suche" type="search" autocomplete="off" placeholder="z. B. Weisel">
      <dl>${KURS.glossar.map(eintrag).join("")}</dl>
      <p id="glossar-leer" class="leise" hidden>Kein Begriff gefunden.</p></section>`;
    /* Suchtext aus dem sichtbaren Text, nicht aus dem HTML (sonst treffen Suchwörter wie "strong" oder "href") */
    const eintraege = inhalt.querySelectorAll(".glossar-eintrag");
    eintraege.forEach((el) => { el.dataset.text = el.textContent.replace(/\s+/g, " ").toLowerCase(); });
    const suche = document.getElementById("glossar-suche");
    suche.addEventListener("input", () => {
      const q = suche.value.trim().replace(/\s+/g, " ").toLowerCase();
      let sichtbar = 0;
      eintraege.forEach((el) => {
        const treffer = !q || el.dataset.text.includes(q);
        el.hidden = !treffer;
        sichtbar += treffer ? 1 : 0;
      });
      document.getElementById("glossar-leer").hidden = sichtbar > 0;
    });
  }

  /* ---------- Navigation ---------- */
  function aktualisiereZaehler() {
    const n = offeneIds().length;
    const zaehler = document.getElementById("zaehler-wiederholen");
    zaehler.hidden = n === 0;
    zaehler.textContent = String(n);
  }

  function markiereNavigation(bereich) {
    document.querySelectorAll(".hauptnav a").forEach((a) => {
      if (a.dataset.nav === bereich) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  /* Leseposition im Verlaufseintrag merken: Zurück und Vor springen dorthin, ein neuer Link beginnt oben */
  let merkZeit = 0;
  function merkePosition() {
    clearTimeout(merkZeit);
    merkZeit = setTimeout(() => {
      try {
        history.replaceState({ y: window.scrollY }, "");
      } catch (e) {
        /* Manche Browser begrenzen replaceState, dann fehlt nur die gemerkte Position */
      }
    }, 200);
  }

  /* Bilder laden verzögert und haben vorher keine Höhe: vor dem Sprung alle laden, sonst stimmt die Position nicht */
  function springeZu(y) {
    const hash = location.hash;
    const offen = [...inhalt.querySelectorAll("img")].filter((bild) => !bild.complete);
    if (y === 0 || offen.length === 0) {
      window.scrollTo(0, y);
      return;
    }
    Promise.all(offen.map((bild) => new Promise((fertig) => {
      bild.addEventListener("load", fertig, { once: true });
      bild.addEventListener("error", fertig, { once: true });
      bild.loading = "eager";
    }))).then(() => {
      if (location.hash === hash) window.scrollTo(0, y);
    });
  }

  function route() {
    clearTimeout(merkZeit);
    const [bereich, wert] = (location.hash || "#/").replace(/^#\/?/, "").split("/");
    if (bereich === "lektion") {
      zeigeLektion(wert);
      markiereNavigation("kurs");
    } else if (bereich === "modul") {
      zeigeModul(Number(wert));
      markiereNavigation("kurs");
    } else if (bereich === "wiederholen") {
      zeigeWiederholen();
      markiereNavigation("wiederholen");
    } else if (bereich === "glossar") {
      zeigeGlossar();
      markiereNavigation("glossar");
    } else {
      zeigeUebersicht();
      markiereNavigation("kurs");
    }
    springeZu(history.state && typeof history.state.y === "number" ? history.state.y : 0);
    inhalt.focus({ preventScroll: true });
  }

  function start() {
    if (!KURS || !L) {
      inhalt.innerHTML = `<h1>Kursdaten fehlen</h1>
        <p>Bitte im Ordner Lern-App <code>python werkzeuge/bauen.py</code> ausführen.</p>`;
      return;
    }
    stand = ladeStand();
    document.getElementById("zuruecksetzen").addEventListener("click", () => {
      if (window.confirm("Gesamten Lernfortschritt und die Wiederholungsliste löschen?")) {
        stand = L.leererStand();
        speichere();
        route();
      }
    });
    /* Änderungen aus einem anderen Tab übernehmen, sonst überschreibt ein veralteter Tab den Fortschritt */
    window.addEventListener("storage", (e) => {
      if (e.key === SPEICHER || e.key === null) {
        stand = ladeStand();
        aktualisiereZaehler();
      }
    });
    history.scrollRestoration = "manual";
    window.addEventListener("scroll", merkePosition, { passive: true });
    window.addEventListener("resize", markiereBreiteTabellen);
    window.addEventListener("hashchange", route);
    speichere();
    route();
  }

  start();
})();
