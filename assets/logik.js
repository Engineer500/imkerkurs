/* Reine Lernlogik ohne Seitenbezug. Im Browser als window.Logik, in Node per require(). */
(function (wurzel, fabrik) {
  const api = fabrik();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    wurzel.Logik = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const BESTEHEN = 0.8;
  const RICHTIG_IN_FOLGE = 2;

  const istObjekt = (x) => x !== null && typeof x === "object" && !Array.isArray(x);

  /** Leerer Lernstand: abgeschlossene Lektionen, Quizergebnisse und Wiederholungsliste. */
  function leererStand() {
    return { abgeschlossen: {}, quiz: {}, wiederholung: {} };
  }

  /** Macht aus beliebigem gespeichertem Inhalt einen gültigen Stand. Falsche Typen werden verworfen. */
  function normalisiereStand(roh) {
    const stand = leererStand();
    if (istObjekt(roh)) {
      Object.keys(stand).forEach((schluessel) => {
        if (istObjekt(roh[schluessel])) {
          stand[schluessel] = roh[schluessel];
        }
      });
    }
    return stand;
  }

  /** true, wenn genau die richtigen Antworten (Indizes) gewählt wurden. */
  function bewerteAntwort(frage, ausgewaehlt) {
    const richtige = frage.optionen.map((o, i) => (o.richtig ? i : -1)).filter((i) => i >= 0);
    const gewaehlt = Array.from(new Set(ausgewaehlt)).sort((a, b) => a - b);
    return gewaehlt.length === richtige.length && gewaehlt.every((wert, i) => wert === richtige[i]);
  }

  /**
   * Zufällige Reihenfolge der Zahlen 0 bis anzahl minus 1 (Fisher Yates). Dient dazu, Antwortoptionen gemischt
   * anzuzeigen, während Werte und Auswertung bei den ursprünglichen Indizes bleiben.
   * zufall liefert Zahlen von 0 bis unter 1, für Tests lässt sich eine feste Folge einsetzen.
   */
  function mischeReihenfolge(anzahl, zufall = Math.random) {
    const reihe = Array.from({ length: anzahl }, (_, i) => i);
    for (let i = reihe.length - 1; i > 0; i--) {
      const j = Math.min(i, Math.floor(zufall() * (i + 1)));
      [reihe[i], reihe[j]] = [reihe[j], reihe[i]];
    }
    return reihe;
  }

  /** Ergebnis eines Quiz. antworten: { frageId: true|false } */
  function quizErgebnis(fragen, antworten) {
    const anzahl = fragen.length;
    const richtig = fragen.filter((f) => antworten[f.id] === true).length;
    const anteil = anzahl ? richtig / anzahl : 0;
    return { richtig, anzahl, anteil, bestanden: anzahl > 0 && anteil >= BESTEHEN };
  }

  /** Wiederholungsliste { frageId: richtigeAntwortenInFolge }. Gibt eine neue Liste zurück. */
  function aktualisiereWiederholung(wiederholung, frageId, richtig) {
    const neu = Object.assign({}, wiederholung);
    if (!richtig) {
      neu[frageId] = 0;
      return neu;
    }
    if (Object.prototype.hasOwnProperty.call(neu, frageId)) {
      neu[frageId] += 1;
      if (neu[frageId] >= RICHTIG_IN_FOLGE) {
        delete neu[frageId];
      }
    }
    return neu;
  }

  /** Ids der Wiederholungsliste, die es im Kurs noch gibt. Verwaiste Ids gelöschter Fragen zählen nicht. */
  function offeneIds(lektionen, wiederholung) {
    const bekannt = new Set();
    lektionen.forEach((l) => l.fragen.forEach((f) => bekannt.add(f.id)));
    return Object.keys(wiederholung).filter((id) => bekannt.has(id));
  }

  function naechsteOffeneLektion(lektionen, abgeschlossen) {
    return lektionen.find((l) => !abgeschlossen[l.id]) || null;
  }

  function modulFortschritt(modulNr, lektionen, abgeschlossen) {
    const eigene = lektionen.filter((l) => l.modul === modulNr);
    return { fertig: eigene.filter((l) => abgeschlossen[l.id]).length, gesamt: eigene.length };
  }

  function nachbarn(lektionen, id) {
    const i = lektionen.findIndex((l) => l.id === id);
    if (i === -1) {
      return { vorher: null, nachher: null };
    }
    return { vorher: lektionen[i - 1] || null, nachher: lektionen[i + 1] || null };
  }

  return { BESTEHEN, leererStand, normalisiereStand, bewerteAntwort, mischeReihenfolge, quizErgebnis,
    aktualisiereWiederholung, offeneIds, naechsteOffeneLektion, modulFortschritt, nachbarn };
});
