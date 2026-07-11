# Handoff: ObizCare — zorgcommunicatie-trainer (MVP)

## Overview
ObizCare is een webapp waarin zorgverleners oefengesprekken voeren met een interactieve AI-avatar (video + stem via HeyGen) over cultuursensitieve communicatie. De tool geeft uitsluitend communicatieadvies — géén medisch advies; een verplichte, serieuze disclaimer vóór elke sessie is een vast UI-element. Doelgroep: verpleegkundigen, artsen, praktijkondersteuners; desktop + tablet; niet tech-savvy — eenvoud en rust boven features. Interfacetaal: Nederlands. Light mode volstaat voor de MVP.

## About the Design Files
De bestanden in deze bundel zijn **design-referenties gebouwd in HTML** — prototypes die de bedoelde look en het gedrag tonen, geen productiecode. De opdracht is deze designs **na te bouwen in de bestaande codebase**: React + Tailwind CSS op een standaard Laravel Breeze-basis. Gebruik de meegeleverde `tailwind.config.js`-uitbreiding en/of CSS custom properties. Bouw niets rechtstreeks over uit de HTML-bestanden; gebruik de bestaande Breeze-patronen (forms, auth-flows) en vervang alleen de styling/structuur.

## Fidelity
**High-fidelity.** Kleuren, typografie, spacing, radii, statussen en copy zijn definitief bedoeld. Recreëer pixel-nauwkeurig met Tailwind-utilities op basis van de tokens hieronder.

## Gekozen richting
Het prototype bevat **drie visuele varianten** (1a zeegroen, 1b terracotta, 1c blauw). De structuur en flows zijn identiek; alleen kleur/typografie/radius/sessielayout verschillen. **Standaard-aanname: variant 1a "Zeegroen"** (de tokens hieronder). De tokenwaarden van 1b/1c staan in `ObizCare Tokens.dc.html` (wissel via het variant-attribuut). Het gekozen logo is **"stemgolven" (optie 2d)**: cirkel in primary met drie witte verticale golfbalkjes — zie `assets/logo-obizcare.svg`.

## Screens / Views

### 1. Login / registratie / wachtwoord vergeten
- Gecentreerde kaart (340px breed, padding 32px) op canvas-achtergrond `#F4F6F5`.
- Kaart: wit, radius 12px, border 1px `#E2E8E6`, shadow-sm.
- Logo (34px) + woordmerk "ObizCare" 19px/700; subtitel 14px `#5C6B69`: "Oefen cultuursensitieve gesprekken, in je eigen tempo."
- Velden: label 13px/600; input radius 10px, border `#CFD9D6`, padding 10x12, bg `#FBFCFC`.
- Primaire knop: bg `#0E7569`, hover `#0A5B51`, wit, radius 10px, 15px/600, padding 12px, full-width. Label "Inloggen".
- Onder de knop links "Wachtwoord vergeten?", rechts "Account aanmaken" — 13px links in primary.
- Registratie en wachtwoord-vergeten volgen hetzelfde kaartpatroon (standaard Breeze-flows, herstyled).

### 2. Dashboard
- Topbar: wit, border-bottom `#E2E8E6`, padding 14x24. Links logo (26px) + "ObizCare" 15px/700. Rechts: **minutenbadge** + avatar-initiaal (30px cirkel `#DBE6E3`).
- Minutenbadge (komt op élk scherm terug): pill, 13px/600, dot 7px.
  - Normaal: bg `#E7F5EC`, tekst/dot `#16803C`, "42 min tegoed".
  - Bijna op (≤10 min): bg `#FCF3DC`, tekst `#946300`, dot `#B45309`, "8 min tegoed — bijna op".
- Content (padding 36x40): begroeting "Welkom terug, {naam}" 26px/700; subregel 15px `#5C6B69` met tegoed.
- CTA-kaart: bg `#EEF5F3`, border `#D8E6E2`, radius 14px, padding 26x28; titel 18px/700 "Start een oefengesprek", omschrijving 14px; rechts één primaire knop "Start een gesprek" (16px/600, radius 12px, padding 14x26).
- Onderaan infregel 13px `#5C6B69`: "ObizCare geeft communicatieadvies, geen medisch advies."

### 3. Gesprekssessie (belangrijkste scherm)
Layout: topbar + grid `1fr 340px` (video links, transcript rechts), min-hoogte ~430px. Op tablet: transcript onder de video.

**Topbar**: titel "Oefengesprek" + statusbadge + rechts timer-pill (`#EEF2F0`, tabular-nums, "⏱ 12:34 resterend") + stopknop (alleen bij actief): bg `#B3261E`, wit, "■ Stop gesprek".

**Statusbadges** (pill, 12px/600, dot 7px; dot pulseert bij actief/verbinden — animatie `opacity 1→.35`, 1.6s/1s infinite):
- Actief: bg `#E7F5EC` / `#16803C`
- Verbinden: bg `#E8F0F8` / `#2B6CB0`
- Fout: bg `#FBEAE9` / `#B3261E`

**Videovlak**: donker `#122523`; bij actief radial-gradient (`#24443F` → `#122523`), avatar-video vult het vlak (in prototype: placeholder-cirkel), linksonder pill "Avatar spreekt…" (`rgba(0,0,0,.4)`, tekst `#8EE6CF`, pulserende dot `#4FD1B5`).

**Statussen (state machine)** — het videovlak toont per status een kaart (wit, radius 14px, padding 28px, shadow-lg):
1. `disclaimer` (initieel, verplicht): kaart "Voordat je begint" met schild-icoon; bodytekst 14px/1.55 `#41504E`: "ObizCare helpt je oefenen met **communicatie** in cultuursensitieve situaties. De avatar geeft **géén medisch advies**, geen diagnoses en geen behandelinformatie. Twijfel je over medische zaken? Overleg dan altijd met een collega of behandelaar." + grijze notitiekaart: "Het gesprek is een oefening. Er worden geen echte patiëntgegevens gebruikt of opgeslagen." Knop: "Ik begrijp het — start het gesprek". Sessie kan NIET starten zonder deze klik.
2. `verbinden`: spinner (44px, border-top `#4FD1B5`) + "Verbinden met de avatar…" + "Dit duurt meestal een paar seconden". Ga automatisch naar `actief` zodra HeyGen verbonden is (prototype: 1,6s timeout).
3. `actief`: video + transcript live, input enabled, timer telt af, stopknop zichtbaar.
4. `einde` (na stop of natuurlijk einde): ✓-kaart "Sessie beëindigd", duur, knoppen "Nieuw gesprek" (→ disclaimer) en "Naar dashboard". Transcript blijft staan.
5. `fout`: !-kaart "De verbinding is verbroken" + "Je tegoed loopt niet door." + knop "Opnieuw verbinden" (→ disclaimer/verbinden).
6. `op` (tegoed op): ⏱-kaart "Je minutentegoed is op" + "Het gesprek is netjes afgerond en het transcript is bewaard. Vraag nieuw tegoed aan via je organisatie." + "Naar dashboard".

**Transcript** (rechterpaneel, bg `#FBFCFC`, border-left):
- Kop "Transcript" 13px/700.
- Systeemmelding: gecentreerd, 12px `#7A8A87`, bg `#EEF2F0`, radius 8px.
- Avatar: label "Avatar" 11px/700 in primary; bubbel bg `#EEF5F3`, radius `10 10 10 3`, 13.5px/1.5.
- Gebruiker ("Jij"): rechts uitgelijnd; bubbel bg `#0E7569`, wit, radius `10 10 3 10`, max-width 92%.
- Auto-scroll naar nieuwste bericht; lange gesprekken scrollen binnen het paneel.
- Invoer onderaan: tekstveld (radius 10px) + verzendknop 42px (primary, "➤"). Disabled buiten `actief`.

### 4. Profiel
- Zelfde topbar. Titel "Profiel" 20px/700.
- Grid 2 kolommen: Naam, E-mailadres; daaronder "Nieuw wachtwoord" (placeholder "Minimaal 10 tekens").
- Knoppen: "Wijzigingen opslaan" (primary) + "Annuleren" (outline `#CFD9D6`).
- Gevarenzone: kaart border `#F3D2D0`, bg `#FDF6F6`, radius 12px; titel "Account verwijderen" 14px/700 `#8F1F19`; uitleg 13px; outline-knop "Verwijderen…" in error-kleur → bevestigingsmodal (niet in prototype uitgewerkt; gebruik disclaimer-modalstijl).

## Interactions & Behavior
- Sessie-state machine zoals hierboven; overgangen: disclaimer→(accept)→verbinden→(connected)→actief→(stop|tijd op|fout)→einde|op|fout.
- Dot-pulse animatie: `@keyframes {0%,100%{opacity:1}50%{opacity:.35}}`.
- Spinner: 1s linear infinite rotate.
- Hover op primaire knoppen: primary → primary-dark.
- Timer: mm:ss aftellend, tabular-nums; kleurt warning (`#946300`) onder 5 min, error onder 1 min.
- Bij tegoed ≤10 min wisselt de minutenbadge overal naar de warning-variant.
- Formuliervalidatie: standaard Breeze (e-mail, wachtwoord min. 10 tekens).
- Responsive: vanaf ~900px transcript naast video; daaronder eronder. Hit targets ≥44px.

## State Management
- `session.status`: 'disclaimer' | 'verbinden' | 'actief' | 'einde' | 'fout' | 'op'
- `session.secondsRemaining`, `user.minutesBalance` (server-side leidend)
- `transcript[]`: { role: 'user' | 'avatar' | 'system', text, timestamp }
- Data: HeyGen sessie-API (connect/disconnect/fout-events), tegoed-endpoint, transcript-stream.

## Design Tokens (variant 1a Zeegroen — volledige set + 1b/1c in tokens-bestand)
Kleuren: primary `#0E7569`, primary-dark `#0A5B51`, secondary `#2B6CB0`, canvas `#F4F6F5`, surface `#FFFFFF`.
Grijsschaal 50→900: `#FBFCFC #EEF2F0 #DBE6E3 #CFD9D6 #9AA8A5 #7A8A87 #5C6B69 #41504E #2A3735 #1C2B2A`.
Semantisch: success `#16803C`/soft `#E7F5EC` · warning `#946300`/soft `#FCF3DC` · error `#B3261E`/soft `#FBEAE9` · info `#2B6CB0`/soft `#E8F0F8`.
Status: actief=success, verbinden=info, fout=error, tegoed-laag `#B45309`, tegoed-op=error.
Typografie: 'Source Sans 3' (heading + body). heading-xl 30/700, heading-lg 22/700, heading-md 17/700, body 15/400, label 13/600, transcript 13.5/400 lh1.5.
Spacing: 4px-basis (4 8 12 16 24 32 48 64). Radius: sm 8, md 12, lg 16, full 9999. Shadows: sm `0 1px 2px rgba(20,35,32,.06)`, md `0 1px 3px rgba(20,35,32,.08), 0 4px 12px rgba(20,35,32,.06)`, lg `0 8px 30px rgba(20,35,32,.16)`.
De kant-en-klare `tailwind.config.js`-extend en `:root`-CSS-variabelen staan in `ObizCare Tokens.dc.html` (onderaan, kopieerbaar; wissel variant voor 1b/1c-waarden).

## Assets
- `assets/logo-obizcare.svg` — logo 2d "stemgolven": cirkel `#0E7569`, drie witte balkjes (radius 1.75). Bij variant 1b cirkel `#B85C38`, bij 1c `#1D5FAE`.
- `assets/logo-waves-white.svg` — alleen de witte golfjes, voor gebruik op gekleurde vlakken (topbar-blokje, favicon-achtergrond).
- Avatar-video: HeyGen embed (in designs een placeholder).
- Font: Google Fonts "Source Sans 3" 400/600/700 (1b: Lora + Nunito Sans; 1c: Public Sans).

## Files
- `ObizCare Varianten.dc.html` — alle schermen in 3 varianten + klikbare sessie-statemachine + logo-opties (open in browser).
- `ObizCare Tokens.dc.html` — tokens-overzicht met kopieerbare Tailwind-config en CSS-variabelen per variant.
- `assets/` — logo-SVG's.
