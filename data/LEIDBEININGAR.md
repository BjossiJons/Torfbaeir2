# Torfbæir um allt land – leiðbeiningar um gögnin

## Hvar er hvað

| Hvað | Hvar |
|---|---|
| Listi yfir alla bæi (ein færsla á bæ) | `data/baeir.js` |
| Myndir hvers bæjar | `Myndir/Baeir/<id>/` – t.d. `Myndir/Baeir/keldur/keldur-1.jpg` |
| Kortið sjálft | `LandidBujardir.html` (+ `css/landsbyggd.css`, `js/landsbyggd.js`) |
| Athugun á gögnunum | `tools/athuga-gogn.py` |

Gagnaskráin er `.js` skrá (ekki `.json`) til þess að kortið virki líka þegar þú opnar
`LandidBujardir.html` með tvísmelli á tölvunni þinni. Vafrar leyfa ekki að lesa `.json` skrár þannig.
Innihaldið er eins og áður: listi af færslum. Ekki breyta fyrstu línunum (sem byrja á `//` og `window.`)
eða síðustu línunni (`]);`).

## Að bæta við bæ

**1. Veldu auðkenni (`id`).** Nafn bæjarins með lágstöfum, án íslenskra stafa og án bila:
Glaumbær → `glaumbaer`, Hof á Skaga → `hof-a-skaga`.
Stafir: á→a, é→e, í→i, ó→o, ú→u, ý→y, þ→th, ð→d, æ→ae, ö→o.

**2. Settu myndirnar í sína möppu.** Búðu til `Myndir/Baeir/<id>/` og nefndu myndirnar
`<id>-1.jpg`, `<id>-2.jpg` o.s.frv. (lágstafir, endingin `.jpg`).
Lengri hlið myndar á að vera mest 1600 px og skráin helst undir 250–400 KB.
Sendu mér möppuna og ég minnka myndirnar í lotu.

**3. Finndu hnitin.** Í Google Maps: hægri-smelltu á bæjarstæðið og smelltu á fyrstu línuna í glugganum
(t.d. `65.6038, -19.5087`). Þá afritast hnitin. Fyrri talan er `lat`, sú seinni `lng`.
Tugabrot eru skrifuð með punkti (65.6038), ekki kommu.

**4. Bættu færslu við `data/baeir.js`.** Afritaðu sniðmátið hér að neðan, límdu það á undan síðustu línunni `]);`
og fylltu út. Komma á að vera á milli færslna (og á milli mynda), en **ekki** á eftir þeirri síðustu.

**5. Opnaðu `LandidBujardir.html` með tvísmelli** og athugaðu að bærinn birtist.

## Sniðmát

```js
  {
    "id": "",
    "nafn": "",
    "landshluti": "",
    "svaedi": "",
    "lat": 0,
    "lng": 0,
    "lysing": "",
    "myndir": [
      { "src": "", "texti": "" }
    ]
  },
```

Fleiri myndir: bættu við línu `{ "src": "...", "texti": "..." }` með kommu á milli.

## Reitirnir

| Reitur | Skylda | Lýsing |
|---|---|---|
| `id` | já | Auðkenni, sjá að ofan. Einstakt. Notað í slóð bæjarins (`LandidBujardir.html#keldur`) og myndamöppunni. |
| `nafn` | já | Nafn bæjarins eins og það á að birtast. |
| `landshluti` | já | Nákvæmlega eitt af gildunum hér að neðan. Notað í síunni á kortinu. |
| `svaedi` | nei | Sveit, sýsla eða dalur, t.d. `"Mývatnssveit"`. Birtist undir nafninu og er hægt að leita að. |
| `lat`, `lng` | já | Hnit (tölur, án gæsalappa). |
| `lysing` | nei | Stuttur texti um bæinn sjálfan. Má sleppa. |
| `sida` | nei | Slóð á ítarlegri síðu, t.d. `"Tomthus/T-Hali.html"`. Þá birtist hlekkurinn „Lesa meira“ í spjaldinu. |
| `myndir` | já | Listi af myndum. Má vera tómur `[]` meðan myndir vantar. |
| `src` | já | Skráarnafn myndar, t.d. `"keldur-1.jpg"`. Mappan ræðst af `id`. |
| `texti` | já | Texti við myndina. Má vera tómur `""`. |
| `heimild` | nei | Ljósmyndari eða uppruni myndar, t.d. `"Ljósmynd: Jón Jónsson"`. |

## Landshlutar (skrifaðir nákvæmlega svona)

Höfuðborgarsvæðið · Suðurnes · Vesturland · Vestfirðir · Norðurland vestra · Norðurland eystra · Austurland · Suðurland

`landshluti` er grófa skiptingin (átta gildi, notuð í síunni). Nákvæmari staðsetning, eins og sveit eða dalur, fer í `svaedi`.

## Algeng mistök

- **Komma vantar** milli færslna eða mynda, eða **aukakomma** á eftir síðustu færslu eða síðustu mynd. VS Code undirstrikar slíkt með rauðu.
- **Gæsalappir (`"`) inni í texta** brjóta skrána. Notaðu „svona“ gæsalappir í textanum.
- **Hástafir eða íslenskir stafir í skráarnöfnum.** Vefurinn greinir á milli `Keldur-1.jpg` og `keldur-1.jpg`.
- **Skráarending sem passar ekki:** `laufas-1.png` er ekki `laufas-1.jpg`.
- **Víxluð hnit.** `lat` á að vera um 63–67 og `lng` um -25 til -13.

## Athugun áður en þetta fer á vefinn

Úr verkefnismöppunni (þarf Python): `python tools/athuga-gogn.py`
Hún bendir á villur (kommur, myndir sem vantar, hástafi, hnit utan Íslands) og á myndir sem eru of stórar eða ónotaðar.
Annars máttu bara láta Claude athuga skrána.

Ráð í VS Code: `Shift+Alt+F` lagar inndrátt.

## Þegar bæirnir verða mjög margir

Skráin ræður við mörghundruð bæi (400 bæir hlaðast á innan við sekúndu). Ef hún verður óþægileg í meðförum
má skipta henni eftir landshlutum í t.d. `data/baeir-sudurland.js`, `data/baeir-austurland.js` o.s.frv.
Hver skrá hefur sömu umbúðir. Þá þarf aðeins að bæta `<script src="data/baeir-....js"></script>` í `LandidBujardir.html`.
