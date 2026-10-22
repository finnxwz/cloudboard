# Import From Pinterest

Ein Obsidian-Community-Plugin in TypeScript: Eine **eigene Pinterest-artige Board-Ansicht**, mit vier Bildspalten, abgerundeten Bildkarten und leeren Rahmen mit einem Plus in der Mitte. **Kein Canvas und keine Pinterest-Anmeldung erforderlich.** Lokale Fotos, direkte Online-Bilder und öffentliche Vorschaubilder einzelner Pinterest-Pins lassen sich mischen.

## Language / Sprache (ab 1.5.0)

Die Oberfläche ist standardmäßig **Englisch**. Unter **Settings → Import From Pinterest → Language** kannst du zwischen **English**, **Deutsch**, **Español** und **Français** wählen. Bei deutscher Oberfläche heißt das Feld **Sprache**, bei spanischer **Idioma** und bei französischer **Langue**.

Die Auswahl wird in den Plugin-Einstellungen gespeichert und nach einem Neustart wiederhergestellt. Einstellungen, geöffnete Boards, Command-Palette-Einträge und die Beschriftung des Bilder-Symbols wechseln ohne Plugin-Neustart. Kontextmenüs und Dialoge verwenden die gewählte Sprache beim nächsten Öffnen; bereits eingegebene Inhalte werden nicht durch einen Sprachwechsel verworfen.

**Nicht übersetzt werden eigene Notizen, vorhandene Dateinamen und Bildunterschriften** (auch nicht von Pinterest übernommene Texte). Die Sprache betrifft nur die Plugin-Bedienelemente, Hilfetexte, Tooltips und Meldungen. Native Obsidian-/Systemdialoge richten sich weiterhin nach Obsidian bzw. dem Betriebssystem. Technische Netzwerk-/Parserdetails des älteren Canvas-Importers können auf Englisch bleiben.

### Weitere Übersetzungen ergänzen

- Englische Basistexte und deutsche Übersetzungen: `src/i18n.ts`.
- Spanisch: `src/locales/es.ts`; Französisch: `src/locales/fr.ts`.
- Für eine zusätzliche Sprache eine Datei mit `import type { Dictionary } from '../i18n'` und einem vollständigen `Dictionary` anlegen, danach in `src/i18n.ts` importieren und bei `Language`, `LANGUAGE_NAMES` und `dictionaries` registrieren.
- Platzhalter wie `{number}` oder `{error}` müssen in jeder Übersetzung erhalten bleiben. Die Tests prüfen Vollständigkeit und Platzhalter. Fehlende Laufzeitübersetzungen und unbekannte Spracheinstellungen fallen auf Englisch zurück.
- Anschließend `npm test` und `npm run build` ausführen und die Plugin-Dateien aktualisieren. Es werden keine Übersetzungsdienste und keine zusätzlichen Netzwerkzugriffe verwendet.

## Neu ab 1.2.0: Echtes Bilderboard statt Canvas

**Ab 1.4.0:** Unter **Einstellungen → Import From Pinterest → Bildunterschriften-Leiste anzeigen** lässt sich die gesamte Leiste unter den Fotos ein- und ausschalten (Standard: an). Die Änderung wirkt sofort auf alle geöffneten Boards und wird in den Plugin-Einstellungen gespeichert.

- **Leiste an:** Bildunterschrift, Stift und Papierkorb stehen unter dem Foto. Die Icons sind zunächst halbtransparent und werden beim Darüberfahren oder Tastaturfokus voll sichtbar.
- **Leiste aus:** Die gesamte Kachel besteht nur aus dem Foto. Stift und Papierkorb erscheinen oben rechts **auf dem Bild**, sobald der Mauszeiger über der Kachel steht. Ohne Hover sind sie vollständig ausgeblendet. Tastaturfokus blendet sie ebenfalls ein. Auf dem Handy einmal auf das Foto tippen, um die Aktionen einzublenden; ein zweites Tippen öffnet die große Vorschau. Außerhalb der Kachel tippen blendet die Aktionen wieder aus.
- Bildunterschriften lassen sich über den Stift bearbeiten oder leeren. Beim Ausblenden der Leiste bleiben vorhandene Texte gespeichert. Der Quellen-Link wird nicht angezeigt (vorhandene Quelladressen bleiben intern erhalten).

Der frühere Verschiebe-Button im Foto wurde entfernt. Kacheln lassen sich weiterhin per Drag-and-drop innerhalb einer Spalte und zwischen den vier Spalten anordnen: am Desktop direkt am Foto ziehen; die Einfügeposition wird farbig markiert. Auf Touch-Geräten das Foto etwa eine halbe Sekunde halten und dann ziehen. Normales Wischen ohne vorheriges Halten scrollt weiterhin das Board. Alternativ die Kachel selbst mit Tab fokussieren und mit den Pfeiltasten verschieben: hoch/runter innerhalb der Spalte, links/rechts ans Ende der Nachbarspalte. Änderungen an Beschriftung und Reihenfolge werden direkt in der Board-Datei gespeichert. Touch-Gesten sind automatisiert getestet; reale Geräte-Tests stehen weiterhin aus.

1. Eine neue Notiz anlegen (z. B. „Tattoo-Ideen“).
2. Rechtsklick auf die Notiz → **Notiz in Bilderboard umwandeln**. Alternativ denselben Befehl über die Command Palette oder das Bilder-Symbol in der linken Leiste verwenden.
3. Sofort öffnet sich `<Notizname> Board.pboard`: **vier Spalten nebeneinander**, jede mit einem leeren Plus-Rahmen.
4. Auf das **Plus** in der gewünschten Spalte klicken:
   - **Vom Gerät auswählen:** Ein oder mehrere Fotos auswählen. Sie werden entsprechend Obsidian-Anhangseinstellungen in den Vault kopiert und sofort dem Board hinzugefügt.
   - **Aus dem Vault auswählen:** Vorhandene Bilddatei suchen; sie wird direkt eingebettet, nicht dupliziert.
   - **Internet-Link:** Eine direkte HTTPS-Bildadresse pro Zeile eingeben und **Online-Bild hinzufügen** anklicken. Diese Bilder werden **nicht lokal gespeichert**, unabhängig von der Einstellung für den alten Pinterest-Board-Import.
   - **Einzelne Pinterest-Pins:** Ein vollständiger Link wie `https://de.pinterest.com/pin/123456789/` funktioniert, wenn Pinterest das öffentliche Open-Graph-Vorschaubild der Pin-Seite bereitstellt. Die übernommene Bildunterschrift kann anschließend mit dem Stift angepasst werden.
5. Unter den Bildkarten jeder Spalte bleibt ein Plus-Rahmen für weitere Bilder sichtbar. Die ursprüngliche Markdown-Notiz bleibt unverändert und ist oben über einen Button erreichbar.

Die Bilder erscheinen in ihrer natürlichen Höhe als Masonry-Karten in der ausgewählten Spalte. Keine freie Arbeitsfläche, keine Verbindungslinien und keine Canvas-Abhängigkeit; Karten werden einfach innerhalb des Spaltenrasters neu angeordnet. Ein Bild anklicken öffnet eine große Vorschau. Der Papierkorb entfernt nur die Karte vom Board, **niemals die Bilddatei aus dem Vault**. Die Boards werden bei Änderungen direkt gespeichert und beim erneuten Öffnen wiederhergestellt. Ein automatischer Abgleich mit Pinterest findet für diese eigenen Boards nicht statt.

### Bereits vorhandenes Canvas übernehmen

Rechtsklick auf das bisherige `.canvas` → **Als echtes Bilderboard übernehmen**, oder bei geöffnetem Canvas den Befehl **Bisheriges Canvas als echtes Bilderboard übernehmen** verwenden. Erkennbare lokale Bildkarten, lokale Wiki-Einbettungen und Remote-Bildkarten der früheren Plugin-Version werden in eine neue `.pboard`-Datei übernommen. Das ursprüngliche Canvas bleibt unverändert. Freie Canvas-Positionen und Verbindungen werden nicht übernommen.

### Speicherung

`.pboard` ist eine normale JSON-Datei im Vault mit Bildadressen bzw. Vault-Pfaden und einer Spaltennummer von 0 bis 3. Keine Canvas-Nodes und keine Canvas-Koordinaten. Alle Board-Inhalte liegen in der Datei selbst, nicht nur in den Plugin-Einstellungen. Bei deaktiviertem Plugin bleiben die Dateien erhalten; zum Anzeigen der Board-Oberfläche ist das Plugin erforderlich. Board-Namen lassen sich wie andere Vault-Dateien im Datei-Explorer ändern. Verknüpfungen zu lokalen Bildern und zur ursprünglichen Notiz werden bei über Obsidian erfolgten Datei-/Ordnerumbenennungen aktualisiert.

### Auf dem Handy

Die `.pboard`-Datei und die enthaltenen Online-Adressen lassen sich wie andere Vault-Dateien aufs Handy synchronisieren. **Das Plugin muss auch dort installiert und aktiviert sein.** Beim Sync-Dienst müssen eigene Dateitypen zugelassen sein (bei Obsidian Sync gegebenenfalls „Alle anderen Dateitypen synchronisieren“ aktivieren). Online-Bilder benötigen Internet und eine ohne Cookies erreichbare Bildadresse, aber keine Bilddateien im Vault. Für lokale Bilder müssen die zugehörigen Anhänge ebenfalls mitsynchronisiert werden.

Die Oberfläche benötigt kein Electron und ist für Obsidian Mobile vorgesehen. Auf schmalen Displays bleiben es vier Spalten; das Board lässt sich dafür **horizontal scrollen**, statt auf zwei Spalten umzuschalten. Reale Tests auf iOS/Android stehen noch aus.

**Pin-Link ist nicht Bild-Link:** Pinterest kann auch bei einzelnen öffentlich sichtbaren Pins den automatischen Abruf sperren. Dann im Browser auf das eigentliche Bild rechtsklicken bzw. lange drücken und **Bildadresse kopieren** wählen. Eine Adresse wie `https://i.pinimg.com/originals/…jpg` direkt einfügen. Das Plugin umgeht keine Login-Sperren. `pin.it`-Kurzlinks müssen im Browser geöffnet und durch den vollständigen Pin-Link ersetzt werden.

Andere Webseiten werden nicht nach Bildern durchsucht: Für Nicht-Pinterest-Links muss die URL direkt das Bild liefern, keine HTML-Seite. Manche Anbieter sperren externe Einbettungen, verwenden ablaufende Links oder entfernen Bilder später. Das Board zeigt dafür „Bild nicht erreichbar“. Online-Bilder sind nicht offline verfügbar und kontaktieren beim Anzeigen den jeweiligen Bildanbieter.

Lokale Formate: JPG/JPEG, PNG, GIF, WebP, AVIF, BMP; maximal 25 MB pro Bild. HEIC-Fotos vom iPhone bitte zunächst als JPG exportieren. SVG wird im Dateiimport nicht unterstützt. Falls ein Import nach dem Kopieren eines Anhangs fehlschlägt, kann dieser Anhang im Vault zurückbleiben. Ein geschlossener Importdialog bricht einen bereits gestarteten Import nicht ab.

## Installation

Voraussetzung: Obsidian **1.5.7+**.

### Aus dem GitHub-Release

1. Das [Release 1.5.0](https://github.com/finnxwz/obsidian-import-from-pinterest/releases/tag/1.5.0) öffnen.
2. `main.js`, `manifest.json` und `styles.css` herunterladen.
3. Die drei Dateien in den Ordner `<Vault>/.obsidian/plugins/import-from-pinterest/` kopieren.
4. Obsidian neu laden und das Plugin unter **Einstellungen → Community-Plugins** aktivieren.

Alternativ kann das Repository mit [BRAT](https://github.com/TfTHacker/obsidian42-brat) als Beta-Plugin hinzugefügt werden: `finnxwz/obsidian-import-from-pinterest`.

Das Plugin ist noch nicht im offiziellen Community-Verzeichnis veröffentlicht. Die Anleitung zur Einreichung dort steht in der [Obsidian-Dokumentation](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin).

### Selbst bauen

Zum Bauen werden Node.js **22.12+** und npm benötigt.

```sh
npm install
npm test
npm run build
```

Danach wie oben beschrieben installieren.

## Ältere Funktion: Ganzes Pinterest-Board importieren

1. Im Datei-Explorer Rechtsklick auf eine Markdown-Notiz oder ein Canvas.
2. **Legacy: Pinterest-Board als Canvas importieren** auswählen. Diese Zusatzfunktion ist unabhängig von den neuen eigenen Bilderboards.
3. Eine öffentliche Board-URL eingeben, z. B. `https://de.pinterest.com/nutzername/boardname/`.
4. Neben der Ausgangsdatei entsteht `<Name> Pinterest.canvas`. Die Ausgangsdatei wird **nicht** verändert. Bereits vorhandene Namen erhalten eine laufende Nummer.

Jede Karte enthält das Bild, den Titel, einen Pinterest-Link und, falls vorhanden, den ursprünglichen Ziel-Link. Lange Karten lassen sich wie gewohnt im Canvas vergrößern. Online-Bilder werden in Markdown-Karten eingebettet, da Canvas keine eigene Remote-Bild-Node unterstützt.

### Einstellungen

| Einstellung | Funktion |
| --- | --- |
| Sync interval | Deaktiviert, 15, 30 (Standard) oder 60 Minuten |
| Save images locally | Bilder unter `Pinterest assets/<Board-Schlüssel>/` herunterladen statt online einbetten |
| Sync Now | Alle verknüpften Canvases sofort abgleichen |

Zusätzlich steht **Sync Pinterest Canvases** in der Command Palette zur Verfügung. Hintergrund-Sync meldet Fehler nur in der Entwicklerkonsole; manuelle Aktionen zeigen eine Zusammenfassung bzw. einen Fehler an. Das Intervall läuft nur, während Obsidian und das Plugin aktiv sind. Der erste automatische Abgleich erfolgt nach einem vollständigen Intervall.

## Verhalten und Datensicherheit des älteren Canvas-Imports

- Bestehende Pin-Karten behalten Node-ID, Position, Größe und Farbe.
- Neue Karten werden in einem neuen Masonry-Block unterhalb vorhandener Karten angefügt.
- Entfernte Pins werden mitsamt ihren verbundenen Kanten entfernt. Selbst angelegte Nodes bleiben erhalten.
- Ein manuell gelöschter Pin erscheint beim nächsten Sync erneut, solange er auf Pinterest vorhanden ist.
- Eigene Textänderungen bleiben bei unverändertem Pinterest-Inhalt erhalten. Ändert sich der generierte Inhalt (z. B. Titel, Quelle oder Bildmodus), ersetzt der Sync den Kartentext. Dauerhafte persönliche Notizen daher besser in eigenen Nodes ablegen.
- Downloads werden wiederverwendet, aber **niemals automatisch gelöscht**. Fehlgeschlagene Importe können bereits heruntergeladene Bilder hinterlassen.
- Vault-Schreibzugriffe beim Sync verwenden `Vault.process`, um zwischenzeitliche gespeicherte Änderungen nicht mit einem alten Snapshot zu überschreiben.
- Gleichzeitige Syncs/Importe innerhalb dieser Plugin-Instanz sind gesperrt. Auf mehreren Geräten nicht gleichzeitig dasselbe Canvas synchronisieren; Konflikte des verwendeten Vault-Sync-Diensts lassen sich nicht verhindern.

### Sync-Anker

Das Canvas enthält ein zusätzliches JSON-Feld:

```json
{
  "nodes": [],
  "edges": [],
  "pinterest": {
    "version": 1,
    "pinterestUrl": "https://www.pinterest.com/username/boardname/",
    "lastSynced": "2026-10-21T12:00:00.000Z",
    "pins": {}
  }
}
```

`pins` ordnet Pinterest-IDs den Canvas-Node-IDs und zuletzt erzeugten Texten zu. Unbekannte Canvas-Felder werden erhalten. Da Obsidian benutzerdefinierte Felder beim Speichern entfernen kann, liegt eine Sicherung dieser Zuordnung in `.obsidian/plugins/import-from-pinterest/data.json`. Datei- und Ordnerumbenennungen im Vault aktualisieren diese Zuordnung. Beim Übertragen auf ein anderes Gerät auch diese Plugin-Daten mitsynchronisieren, insbesondere wenn Obsidian das benutzerdefinierte Canvas-Feld bereits entfernt hat.

## Pinterest-Einschränkungen

**Kein offizieller Pinterest-API-Client:** Das Plugin nutzt öffentliche, undokumentierte Pinterest-Web-Endpunkte und gegebenenfalls JSON-Hydration aus der Board-Seite, ohne Anmeldung, Cookies oder API-Schlüssel. Pinterest kann diese Schnittstellen ändern oder automatisierte Zugriffe blockieren. Ein erfolgreicher Abruf aller öffentlichen Boards kann daher nicht garantiert werden. Keine Umgehung von Login-, CAPTCHA- oder Zugriffssperren.

**Bekannter Fall (21.10.2026):** Beim direkten Test eines öffentlichen Board-Links lieferte der Board-Endpunkt HTTP 403 und die HTML-Seite eine aktivierte Board-Login-Sperre ohne Board-Daten. Version 1.0.1 erkennt diesen Fall und erklärt die Ursache, statt nur „No public board metadata found“ zu melden. Das ist eine Diagnosekorrektur, keine Import-Lösung: Diese Version unterstützt keine Pinterest-Anmeldung. Eine Anmeldung im normalen Browser wird nicht automatisch von Obsidian `requestUrl` übernommen. Eine öffentliche URL allein garantiert daher keinen anonymen Import.

- Nur öffentliche Boards; keine privaten Boards, Kurzlinks (`pin.it`), einzelnen Pins oder Board-Unterabschnitte.
- Alle Netzwerkzugriffe des Plugins erfolgen über Obsidian `requestUrl`. Remote-Bilder in den fertigen Markdown-Karten lädt anschließend Obsidian selbst.
- Vollständige Pagination ist Voraussetzung für Updates. Bei fehlenden/wiederholten Bookmarks, einer abweichenden gemeldeten Pin-Anzahl, HTTP-Fehlern oder unbekannten Bildformaten wird das Canvas nicht aktualisiert. Während eines Abrufs geänderte Boards können deshalb einen erneuten Versuch erfordern.
- Keine Video-Dateien: Verfügbares Vorschaubild wird verwendet; Pins ohne unterstütztes Bild brechen den Abgleich sicher ab.
- Maximal 500 Seiten pro Abruf, 45 Sekunden Timeout pro Anfrage und 25 MB pro lokalem Bild. Da `requestUrl` kein Abort-Signal unterstützt, kann ein Netzwerkrequest nach dem Timeout intern noch auslaufen.
- Große Boards und lokale Downloads können lange dauern. Es gibt keinen Echtzeit-Push: „Live-Sync“ ist regelmäßiges Polling.
- Leere Boards werden nur bei vollständiger Antwort akzeptiert. Ein bestätigtes leeres Board entfernt alle vom Plugin verwalteten Pin-Nodes.
- Die Nutzung von Bildern unterliegt den Rechten der jeweiligen Urheber und den Pinterest-Nutzungsbedingungen.

## Entwicklung und Tests

`npm run dev` startet den esbuild-Watch-Modus. `npm test` prüft Board-Speicherung, die tatsächliche Vier-Spalten-Ansicht mit Plus-Rahmen (DOM-Tests mit happy-dom), Auswahl der Zielspalte, Fehleranzeigen, Migration früherer Canvases, URL-Validierung und Uploads. Zusätzlich bleiben Tests für den älteren Canvas-Import, Pagination und Fehlerfälle mit simulierten Pinterest-Antworten enthalten. `npm run build` führt TypeScript-Prüfung und Produktions-Build aus.

Ein echter Obsidian-/Pinterest-Integrationstest ist separat in einem Test-Vault erforderlich. Testablauf: Notiz in Bilderboard umwandeln, alle vier Plus-Rahmen anklicken, lokale/Online-Bilder hinzufügen, große Vorschau öffnen, Karten entfernen, Board schließen/neu öffnen, Bildordner umbenennen und auf ein Mobilgerät synchronisieren. Bestehendes Canvas über den neuen Übernahmebefehl migrieren und überprüfen, dass die Ursprungsdatei unverändert bleibt. Für den älteren Board-Import zusätzlich Synchronisation und Offline-Verhalten prüfen.

## Datenschutz

Bildadressen und Quellen der eigenen Bilderboards werden direkt in der `.pboard`-Datei gespeichert. Direkte Online-Bilder werden beim Anzeigen über normale Bild-Elemente geladen, ohne sie in den Vault zu speichern; bei Pin-Links fragt das Plugin einmal die Pin-Seite über `requestUrl` ab. Keine Pinterest-Anmeldung, keine Passwörter, keine manuell gespeicherten Sitzungscookies.

Beim älteren Board-Import werden Board-URLs, Pin-IDs und generierte Kartentexte im Vault bzw. den Plugin-Daten gespeichert. Pinterest erhält beim Import/Sync Netzwerkzugriffe; Online-Einbettungen kontaktieren den jeweiligen Bildanbieter auch beim Anzeigen. Keine Telemetrie und keine Drittanbieter-Proxy-Dienste.

## Lizenz

MIT, siehe [LICENSE](LICENSE).
