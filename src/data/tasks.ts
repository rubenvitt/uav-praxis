export type Aufgabe = {
  id: string;
  teil: 1 | 2 | 3;
  nummer: string;
  titel: string;
  schritte: string[];
  lernziel: string;
  durchfuehrungshinweise: string[];
  sicherheitshinweise: string[];
  zielanzahlDefault: number;
};

export const AUFGABEN: Aufgabe[] = [
  // ── Teil 1 – Erlernen der grundlegenden Steuerung einer Drohne ──────────────

  {
    id: '1-1',
    teil: 1,
    nummer: '1.1',
    titel: 'Schwebeflug',
    schritte: [
      'Starten Sie und lassen Sie die Drohne für mindestens 5 Minuten auf der Stelle in konstanter Höhe schweben (hovern).',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; eine Drohne ohne GPS im Flug stabilisieren.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zur Drohne ca. 5 Meter',
      'Höhe ca. 2 Meter',
      'Durchführung in Windstille und bei Wind',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 4,
  },

  {
    id: '1-2',
    teil: 1,
    nummer: '1.2',
    titel: 'Landung',
    schritte: [
      'Landen Sie die Drohne auf dem vorbereiteten Landeplatz während diese mit der „Nase" von ihnen weg zeigt.',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; eine Drohne ohne GPS landen.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zur Drohne ca. 5 Meter',
      'Durchführung in Windstille und bei Wind',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 8,
  },

  {
    id: '1-3',
    teil: 1,
    nummer: '1.3',
    titel: 'Fliegen auf gerader Linie',
    schritte: [
      'Starten Sie und lassen Sie die Drohne auf der Stelle in konstanter Höhe schweben (hovern).',
      'Fliegen Sie vorwärts eine gerade Strecke von etwa 10 Metern.',
      'Verharren Sie kurz am Zielpunkt ohne abzudriften.',
      'Kehren Sie zur Ursprungsposition zurück, ohne die Ausrichtung der Drohne zu verändern.',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; eine Drohne ohne GPS im Flug stabilisieren und einfache Flugmanöver sicher durchführen.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zum Ausgangspunkt ca. 5 Meter',
      'Höhe ca. 2 Meter',
      'Durchführung in Windstille und bei Wind',
      'mehrfache Wiederholung',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 5,
  },

  {
    id: '1-4',
    teil: 1,
    nummer: '1.4',
    titel: 'Rechteck',
    schritte: [
      'Starten Sie und lassen Sie die Drohne auf der Stelle in konstanter Höhe schweben (hovern).',
      'Fliegen Sie etwa 5 Meter seitwärts (R)',
      'Fliegen Sie etwa 10 Meter vorwärts',
      'Fliegen Sie etwa 10 Meter seitwärts (L)',
      'Fliegen Sie etwa 10 Meter rückwärts',
      'Kehren Sie zur Ursprungsposition zurück.',
      'Die Ausrichtung soll sich dabei nicht verändern („Nase" vom Steuerer weg).',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; eine Drohne ohne GPS im Flug stabilisieren und einfache Flugmanöver sicher durchführen.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zum Ausgangspunkt ca. 5 Meter',
      'Höhe ca. 2 Meter',
      'Durchführung in Windstille und bei Wind',
      'mehrfache Wiederholung',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 5,
  },

  {
    id: '1-5',
    teil: 1,
    nummer: '1.5',
    titel: 'U-Turn',
    schritte: [
      'Fliegen Sie vorwärts eine gerade Strecke von etwa 10 Metern.',
      'Wenden Sie ohne zu stoppen.',
      'Kehren Sie zur Ursprungsposition zurück.',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; eine Drohne ohne GPS unabhängig von ihrer Ausrichtung kontrollieren.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zum Ausgangspunkt ca. 5 Meter',
      'Höhe ca. 2 Meter',
      'Durchführung in Windstille und bei Wind',
      'mehrfache Wiederholung mit Wenden in beide Richtungen.',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 5,
  },

  {
    id: '1-6',
    teil: 1,
    nummer: '1.6',
    titel: 'Ziel umkreisen',
    schritte: [
      'Fliegen Sie auf das Ziel zu („Nase" immer in Flugrichtung) und umkreisen Sie es so eng wie möglich.',
      'Kehren Sie zur Ursprungsposition zurück.',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; eine Drohne ohne GPS unabhängig von ihrer Ausrichtung kontrollieren und die Auge-Hand-Koordination trainieren.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zum Ausgangspunkt ca. 5 Meter',
      'Entfernung Ziel ca. 55 Meter',
      'Höhe ca. 2 Meter',
      'Durchführung in Windstille und bei Wind',
      'mehrfache Wiederholung',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 8,
  },

  {
    id: '1-7',
    teil: 1,
    nummer: '1.7',
    titel: 'Position anfliegen',
    schritte: [
      'Fliegen Sie auf direktem Weg zu Ziel 1 und verweilen Sie dort kurz.',
      'Fliegen Sie auf direktem Weg zu Ziel 2 und verweilen Sie dort kurz.',
      'Kehren Sie zur Ursprungsposition zurück.',
      'Die „Nase" soll dabei immer in Flugrichtung zeigen.',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; eine Drohne ohne GPS unabhängig von ihrer Ausrichtung kontrollieren und die Auge-Hand-Koordination trainieren.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zum Ausgangspunkt ca. 5 Meter',
      'Entfernung Ziel 1 ca. 15 Meter',
      'Entfernung Ziel 2 ca. 20 Meter',
      'Entfernung zwischen den Zielen ca. 20 Meter',
      'Höhe ca. 5 Meter',
      'Durchführung in Windstille und bei Wind',
      'mehrfache Wiederholung',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 7,
  },

  {
    id: '1-8',
    teil: 1,
    nummer: '1.8',
    titel: 'Liegende Acht',
    schritte: [
      'Fliegen Sie eine Acht („Nase" immer in Flugrichtung) mit einem Durchmesser der Kreise von ca. 5 Metern.',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; mit einer Drohne ohne GPS komplexe Flugmanöver durchführen und die Auge-Hand-Koordination trainieren.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Entfernung zum Ausgangspunkt ca. 5 Meter',
      'Höhe ca. 5 Meter',
      'Durchführung in Windstille und bei Wind',
      'mehrfache Wiederholung',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 8,
  },

  {
    id: '1-9',
    teil: 1,
    nummer: '1.9',
    titel: 'Komplette Selbstumrundung',
    schritte: [
      'Fliegen Sie einen Kreis („Nase" immer in Flugrichtung) mit einem Durchmesser von mindestens 5 Metern um sich herum.',
    ],
    lernziel:
      'Gefühl für die Steuerung der Drohne und ihr Verhalten unter Windeinfluss erlangen; mit einer Drohne ohne GPS einen sicheren Flugbetrieb gewährleisten und die Auge-Hand-Koordination trainieren.',
    durchfuehrungshinweise: [
      'Flug ohne Assistenzsysteme',
      'Zu Beginn „Einstiegsdrohne" empfohlen',
      'Höhe mindestens 3 Meter',
      'Durchführung in Windstille und bei Wind',
      'mehrfache Wiederholung',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 7,
  },

  // ── Teil 2 – Sichere Steuerung der Drohne in Einsatznahen Situationen ───────

  {
    id: '2-1',
    teil: 2,
    nummer: '2.1',
    titel: 'Steuerungssoftware und Flugmodi',
    schritte: [
      'Beschäftigen Sie sich mit der Steuerungssoftware und erproben Sie die verschiedenen Flugmodi der Drohne (z.B. Position, Tripod, Sport).',
    ],
    lernziel:
      'Umfassende Kenntnis der drohnenspezifischen Steuerungssoftware und der verschiedenen Fähigkeiten des Flugsystems erlangen.',
    durchfuehrungshinweise: [],
    sicherheitshinweise: [],
    zielanzahlDefault: 6,
  },

  {
    id: '2-2',
    teil: 2,
    nummer: '2.2',
    titel: 'Liegende Acht in größerer Entfernung',
    schritte: [
      'Fliegen Sie eine Acht („Nase" immer in Flugrichtung) mit einem Durchmesser der Kreise von ca. 15 Metern.',
    ],
    lernziel:
      'Mit einer Drohne mit GPS komplexe Flugmanöver durchführen; Entfernungsschätzung und Erfassung der Drohnenausrichtung trainieren.',
    durchfuehrungshinweise: ['Entfernung zur Drohne ca. 50 Meter'],
    sicherheitshinweise: [],
    zielanzahlDefault: 12,
  },

  {
    id: '2-3',
    teil: 2,
    nummer: '2.3',
    titel: 'Kompl. Selbstumrundung in größerer Entfernung',
    schritte: [
      'Fliegen Sie einen Kreis („Nase" immer in Flugrichtung) mit einem Durchmesser von mindestens 150 Metern um sich herum.',
    ],
    lernziel:
      'Mit einer Drohne mit GPS einen sicheren Flugbetrieb gewährleisten; Entfernungsschätzung und Erfassung der Drohnenausrichtung trainieren.',
    durchfuehrungshinweise: ['Höhe ca. 50 Meter'],
    sicherheitshinweise: [],
    zielanzahlDefault: 12,
  },

  {
    id: '2-4',
    teil: 2,
    nummer: '2.4',
    titel: 'Position in definierter Höhe anfliegen',
    schritte: [
      'Fliegen Sie in einer vorher definierten Höhe ein Ziel an.',
      'Verwenden sie dabei nicht die Kamera und Telemetriedaten.',
    ],
    lernziel:
      'Fähigkeiten zur Höhen- und Entfernungsschätzung sowie zur Erfassung der Drohnenausrichtung trainieren.',
    durchfuehrungshinweise: [
      'Entfernung zum Ziel ca. 100-200 Meter',
      'Höhe ca. 15-60 Meter',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 11,
  },

  {
    id: '2-5',
    teil: 2,
    nummer: '2.5',
    titel: 'Sensoren',
    schritte: [
      'Testen sie die Sensoren der Drohne (z.B. Tageslichtkamera, Wärmebildkamera, etc.) und machen sie sich mit der Bedienung und den Möglichkeiten vertraut.',
    ],
    lernziel:
      'Für den späteren Betrieb notwendige Erfahrungen im Umgang mit den Sensoren der Drohne sammeln.',
    durchfuehrungshinweise: ['z.B. kalibrieren der Wärmebildkamera'],
    sicherheitshinweise: [],
    zielanzahlDefault: 9,
  },

  {
    id: '2-6',
    teil: 2,
    nummer: '2.6',
    titel: 'Landung mit Bodeneffektwechsel',
    schritte: [
      'Fliegen Sie seitlich an einen breiten, erhöhten Gegenstand heran und Landen Sie darauf.',
    ],
    lernziel:
      'Das Fluggerät auch unter schwierigen Bedingungen sicher landen; weitere Kenntnisse zum Einfluss des Bodeneffekts auf das Flugverhalten der Drohne erlangen.',
    durchfuehrungshinweise: ['Geeignetes Hindernis, z.B. Stehtisch, Kiste'],
    sicherheitshinweise: [],
    zielanzahlDefault: 13,
  },

  {
    id: '2-7',
    teil: 2,
    nummer: '2.7',
    titel: 'Landung außerhalb der Sichtweite',
    schritte: [
      'Führen Sie eine BVLOS Landung mithilfe der Kamera durch. Stehen Sie dazu in der Nähe des Landeplatzes ohne direkten Sichtkontakt. Ihr LRB muss in Rufweite sein. Er hat die Drohne jederzeit im Blick und bricht die Übung notfalls ab.',
    ],
    lernziel:
      'Die besonderen Herausforderungen kennenlernen, die beim Flugbetrieb ohne direkte Sicht auf die Drohne auftreten.',
    durchfuehrungshinweise: [
      'z.B. Fahrzeug zwischen Drohnensteuerer und Landeplatz, LRB davor',
      'LRB muss Drohne jederzeit sehen können.',
      'Im Falle des Abbruchs begibt sich der Drohnensteuerer schnellstmöglich in Sichtweite der Drohne.',
    ],
    sicherheitshinweise: ['LRB entscheidet über Abbruch!'],
    zielanzahlDefault: 6,
  },

  {
    id: '2-8',
    teil: 2,
    nummer: '2.8',
    titel: 'Simulierter Ausfall des GPS',
    schritte: [
      'Während eines Fluges schaltet der LRB die Drohne zu einem von ihm festgelegten Zeitpunkt in den ATTI Modus. Der Pilot verfährt entsprechend dem Notverfahren für den Ausfall des GPS.',
    ],
    lernziel:
      'Sensibilisierung für jederzeit unvorbereitet auftretende Störungen; Anwendung der im Betriebshandbuch festgelegten Notverfahren für GPS-Ausfall trainieren.',
    durchfuehrungshinweise: [
      'Zur Sicherheit auf ausreichende Höhe und Hindernisfreiheit bei Beginn der Übung achten.',
    ],
    // Urteil: „Bei Kontrollverlust…" ist im Original nicht fett, wird aber laut Plan als Sicherheitshinweis geführt.
    sicherheitshinweise: [
      'Übung nur in Sichtweite durchführen!',
      'Bei Kontrollverlust schnellstmöglich zurück in den GPS Modus wechseln.',
    ],
    zielanzahlDefault: 4,
  },

  {
    id: '2-9',
    teil: 2,
    nummer: '2.9',
    titel: 'BVLOS-Flug',
    schritte: [
      'Führen Sie einen Flug außerhalb der Sichtweite durch. Nutzen sie zur Navigation die verfügbaren Sensoren der Drohne.',
    ],
    lernziel:
      'Fähigkeiten zum Flugbetrieb ohne direkte Sicht auf die Drohne vertiefen.',
    durchfuehrungshinweise: ['Höhe ca. 50 Meter'],
    sicherheitshinweise: [],
    zielanzahlDefault: 4,
  },

  {
    id: '2-10',
    teil: 2,
    nummer: '2.10',
    titel: 'Parcours',
    schritte: [
      'Fliegen Sie mit der Drohne einen Parcours ab. Ziel ist ein flüssiger, zügiger aber sicherer Durchflug. Führen Sie ggf. einen BVLOS-Flug durch den Parcours durch.',
    ],
    lernziel:
      'Alle erworbenen Fähigkeiten im Umgang mit der Drohne sicher anwenden und weiter ausbauen.',
    durchfuehrungshinweise: [
      'Durchführung z.B. als Ausbildungsdienst; mehrfache Wiederholung, ggf. Zeitnahme',
      'Mindestanforderungen: Flug zwischen 2 Gegenständen hindurch, Abstand ca. 3x Spannweite der Drohne',
      'Flug unter Gegenstand hindurch (z.B. Klappleiter, Tisch)',
      'Anflug von Mehreren Zielen (min. 3)',
      'Landung an definierter Position',
      'Bei BVLOS-Flug: LRB muss Drohne jederzeit sehen können.',
      'Im Falle des Abbruchs begibt sich der Drohnensteuerer schnellstmöglich in Sichtweite der Drohne.',
    ],
    // „Durchführung z.B. als Ausbildungsdienst" ist fett im Original, ist aber ein Durchführungshinweis, kein Sicherheitshinweis.
    sicherheitshinweise: ['LRB entscheidet über Abbruch!'],
    zielanzahlDefault: 1,
  },

  // ── Teil 3 – Training von Einsatzszenarien ───────────────────────────────────

  {
    id: '3-1',
    teil: 3,
    nummer: '3.1',
    titel: 'Personensuche',
    schritte: [
      'Führen Sie eine simulierte Personensuche in einem vorher definierten Suchgebiet durch. Dem Drohnensteuerer darf die genaue Position der gesuchten Person(en) nicht bekannt sein.',
    ],
    lernziel:
      'Erfahrungen bei der Interpretation der Sensordaten (z. B. Wärmebild) im Kontext einer Personensuche erlangen; Flugvorbereitung und Dokumentation üben.',
    durchfuehrungshinweise: [
      'Vollständige Einsatz- und Flugplanung',
      'Suchgebiet ca. ½ km²',
      'Durchführung bei Tag und ggf. Nacht sowie im BVLOS-Flug',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 1,
  },

  {
    id: '3-2',
    teil: 3,
    nummer: '3.2',
    titel: 'Einsatzdokumentation',
    schritte: [
      'Erstellen Sie Aufnahmen einer simulierten Einsatzstelle aus verschiedenen Perspektiven und bereiten Sie die Daten zur Weitergabe vor.',
    ],
    lernziel:
      'Neben der fliegerischen Durchführung einer Einsatzdokumentation die technischen Fähigkeiten zur Aufbereitung und Weitergabe von Sensordaten erlangen.',
    durchfuehrungshinweise: [
      'z.B. eigener Landeplatz',
      'Weitergabe über Bluetooth, USB-Stick, etc.',
      'ggf. Videoaufnahmen und weitere Sensordaten, Flugweg, etc.',
      'ggf. Live-Übertragung in ELW, etc.',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 1,
  },

  {
    id: '3-3',
    teil: 3,
    nummer: '3.3',
    titel: 'Ausleuchten',
    schritte: [
      'Leuchten Sie mit der Drohne einen (sich bewegenden) Einsatzbereich aus.',
    ],
    lernziel:
      'Die besonderen Herausforderungen des Flugbetriebs bei Dunkelheit kennenlernen und die Koordination mit anderen Einsatzkräften üben.',
    durchfuehrungshinweise: [
      'z.B. Person / KFZ im Gelände folgen',
      'Kommunikation mit Einsatzkräften am Boden über Funk oder Übermittlungszeichen',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 1,
  },

  {
    id: '3-4',
    teil: 3,
    nummer: '3.4',
    titel: 'Lastentransport',
    schritte: [
      'Transportieren sie eine kleinere Last zu einer vorher festgelegten Position und setzen Sie diese dort ab.',
    ],
    lernziel:
      'Die Schwierigkeiten des Transports von Lasten mit der Drohne (ggf. auch außerhalb der Sichtweite) kennenlernen und die Kommunikation mit den Einsatzkräften am Boden üben.',
    durchfuehrungshinweise: [
      'max. Startgewicht der Drohne beachten',
      'ggf. auch im BVLOS-Flug',
    ],
    // „kein Abwurf zulässig!" ist im Original nicht fett, wird aber laut Plan als Sicherheitshinweis geführt.
    sicherheitshinweise: ['kein Abwurf zulässig! (Sondergenehmigung erforderlich)'],
    zielanzahlDefault: 1,
  },

  {
    id: '3-5',
    teil: 3,
    nummer: '3.5',
    titel: 'Begrenzung des Einsatzbereichs',
    schritte: [
      'Führen Sie eine beliebige Einsatzübung in einem zuvor festgelegten Einsatzbereich durch.',
      'Nutzen Sie die technischen Möglichkeiten ihres Systems zur Überwachung der Drohnenposition und vergleichen Sie die Informationen mit ihrer persönlichen Einschätzung.',
    ],
    lernziel:
      'Vorbereitung auf den Einsatz in einem begrenzten Einsatzbereich, z.B. beim Einsatz mehrerer Drohnen.',
    durchfuehrungshinweise: [
      'LRB legt Einsatzbereich fest',
      'Ggf. Anwendung von Geofences',
    ],
    sicherheitshinweise: [],
    zielanzahlDefault: 1,
  },
];
