# SPEC.md: Cat Companion (desktop pet kucing piksel)

Dokumen serah-terima. AI mana pun yang melanjutkan proyek ini WAJIB membaca seluruh file ini dulu, terutama bagian **2. Cara kerja dengan pemilik**.

Terakhir diperbarui: 25 Oktober 2026 (pose mengetik, mode panas, lelah; perbaikan aset ketik jadi prioritas).

---

## 1. Tujuan proyek

Pemilik ingin membuat desktop pet sendiri: kucing piksel yang hidup di desktop Windows, terinspirasi dari app berbayar bernama **Comnyang** (comnyang.com), tapi dengan fitur lebih banyak dan sesuai kebutuhan pribadi.

Prinsip penting:
- Tiru **ide dan fitur**, JANGAN pakai aset gambar atau sprite Comnyang. Karakter digambar sendiri oleh pemilik (mirip kucing peliharaannya).
- Tujuan akhir: aplikasi yang bisa dipakai sehari-hari, dengan kustomisasi kucing (warna dan pola bulu).

### Fitur target (terinspirasi Comnyang)

Reaksi input:
- Mata mengikuti kursor
- Kucing memburu kursor saat mouse digerakkan cepat
- Mendengkur dan muncul hati saat kepalanya dielus dengan mouse
- "Memijat" keyboard saat pengguna mengetik
- Mode panas: memerah dan berasap saat mengetik terlalu cepat
- Membuka gulungan tisu saat scroll
- Drag dengan efek meregang seperti mochi (squash and stretch)
- Mode mengintip dari tepi layar saat ada video atau aplikasi fullscreen

Produktivitas:
- Timer Pomodoro (fokus dan istirahat), timer piksel di samping kucing
- Pengingat peregangan (kucing membesar sesekali)
- Pengingat minum air
- Pengingat pesan (waktu dan teks kustom)
- Catatan yang disematkan di atas kepala kucing
- Kucing memanggil nama pengguna saat pengingat

Kustomisasi:
- Ganti warna badan dan pola bulu (palette swap + layer pola)
- Panel pengaturan dengan pratinjau langsung

Fitur lanjutan (setelah semua jalan):
- Statistik harian aktivitas, mood kucing, aksesori
- Reaksi ke AI agent (kucing ikut berpikir, melompat saat selesai)

---

## 2. Cara kerja dengan pemilik (WAJIB DIPATUHI)

Profil pemilik: pemula (awam), memakai **Windows**, editor **VS Code**, terminal **PowerShell**. Berbahasa Indonesia.

Aturan komunikasi:
1. **Jawab dalam bahasa Indonesia**, santai, jelas, tanpa jargon berlebihan. Istilah teknis dijelaskan singkat.
2. **Hemat token.** Pemilik sangat peduli token. Jawaban singkat dan langsung ke inti. Jangan bertele-tele atau mengulang penjelasan.
3. **Jangan buat prototipe atau kode besar yang tidak diminta.** Hanya tulis kode untuk phase yang sedang dikerjakan.
4. **Jangan minta screenshot.** Kalau pemilik menempel output terminal, percayai itu. Kalau pemilik bilang "udah", artinya langkah berhasil. Kalau ada error, pemilik akan menempel teks error. Minta teks, bukan gambar.
5. **Jangan menanyakan hal yang sudah dijawab.** Cek spec ini dulu.
6. **Membuat folder dan file: selalu lewat satu skrip PowerShell** dengan format ini (jangan perintah `mkdir` satu per satu):

```powershell
$files = @(
  "path\ke\file1.ts",
  "path\ke\file2.ts"
)
foreach ($p in $files) {
  $full = Join-Path $PWD $p
  [System.IO.Directory]::CreateDirectory((Split-Path $full)) | Out-Null
  if (-not (Test-Path -LiteralPath $full)) { New-Item -ItemType File -Path $full | Out-Null }
}
```

7. **Kode ditulis langsung di chat** (blok kode), supaya pemilik tinggal menyalin ke VS Code. Jangan minta pemilik mengetik ulang.
8. **Mengganti kode memakai format SEBELUM/SESUDAH**: tampilkan blok kode lama (SEBELUM) dan blok kode baru (SESUDAH) yang menggantikannya secara utuh. JANGAN memberi instruksi seperti "taruh ini di bagian itu, ubah ini sampai ini". Untuk file yang berubah hampir total, cukup bilang "Ctrl+A lalu timpa seluruh isi dengan:" dan beri isi barunya.
9. Untuk file baru berisi kode: sebut nama file dan lokasinya, lalu beri isinya.
10. Setiap akhir phase, beri perintah commit Git (`git add .` lalu `git commit -m "..."`).
11. Akhiri tiap langkah dengan kriteria "berhasil kalau...", dan beri tahu cara menutup atau membatalkan kalau relevan.
12. Satu pertanyaan klarifikasi maksimal per giliran. Lebih baik berasumsi dan menyebutkan asumsinya.
13. **Kalau AI butuh melihat isi file**, jangan minta pemilik membuka dan menyalin manual, dan jangan minta screenshot. Buatkan perintah PowerShell (versi 5.1) yang menyalin isi file ke clipboard, supaya pemilik tinggal menjalankannya lalu menempel (Ctrl+V) ke chat. Jalankan dari folder `D:\Projects\cat-companion`.

Satu file:

```powershell
Get-Content -Raw -Encoding UTF8 "main.js" | Set-Clipboard
```

Beberapa file sekaligus (tiap file diberi judul `=== nama ===`, ganti isi daftarnya):

```powershell
$files = @("main.js", "src\renderer\pet\index.html")
($files | ForEach-Object { "=== $_ ===`r`n" + (Get-Content -Raw -Encoding UTF8 $_) }) -join "`r`n`r`n" | Set-Clipboard
```

Untuk output error dari sebuah perintah (ganti `npm start` sesuai kebutuhan):

```powershell
npm start 2>&1 | Out-String | Set-Clipboard
```

Hanya minta file yang benar-benar perlu dilihat, supaya token hemat.

14. **JANGAN MENEBAK ASET.** Sebelum menulis kode yang bergantung pada isi atau posisi piksel sebuah PNG, minta dump piksel (ukuran, kotak isi, peta huruf per warna) lewat perintah PowerShell `System.Drawing` yang menyalin ke clipboard. Dilarang memotong atau memisah gambar utuh dengan tebakan koordinat. Hargai pemisahan layer yang sudah dibuat pemilik. Pemilik pernah sangat kesal karena AI memotong gambar pose ketik dengan tebakan sehingga pola bocor dan kumis salah warna.
15. Pemilik sering hampir kehabisan token. Kalau pemilik mengeluh token menipis, langsung kerjakan hal terpenting, tanpa basa-basi.

---

## 3. Tech stack dan keputusan

| Hal | Keputusan |
|---|---|
| Platform | Windows (target utama). macOS opsional nanti |
| Framework | **Electron** (versi terpasang `^45.0.0`) |
| Bahasa | Saat ini JavaScript biasa. Rencana pindah ke **TypeScript** di phase 3 atau saat dibutuhkan |
| Animasi | **Prosedural lewat kode** (puppet / cutout animation), BUKAN sprite sheet frame-by-frame penuh |
| Render | HTML + CSS/Canvas, `image-rendering: pixelated`, skala bilangan bulat (2x, 3x) |
| Input global | `uiohook-napi` (modul native, mungkin perlu rebuild di Windows) |
| Penyimpanan | `electron-store` untuk pengaturan |
| Packaging | `electron-builder` |
| Tool gambar | **LibreSprite** (sudah dipakai pemilik) |

Alasan Electron: jendela transparan, always-on-top, dan click-through didukung langsung. Cocok untuk pemula. Tauri (lebih ringan, butuh Rust) dipertimbangkan nanti jika perlu optimasi.

Alasan animasi prosedural: pemilik merasa membuat frame animasi manual melelahkan. Gerakan sederhana (napas, ekor, telinga, kedip, mochi, tint panas) dibuat lewat kode. Gambar hanya untuk pose statis, ekspresi, dan ikon efek.

### Aturan privasi (jangan dilanggar)

- Pembaca input global hanya boleh mencatat **ada atau tidaknya** aktivitas (tombol ditekan, mouse bergerak, scroll). **Jangan pernah menyimpan atau mencatat tombol apa yang ditekan.** Kalau tidak, aplikasi secara teknis menjadi keylogger dan bisa diblokir antivirus.
- Tidak ada pelacakan atau pengiriman data ke luar.

### Catatan teknis

- Saat ini `main.js` memakai `nodeIntegration: true` dan `contextIsolation: false` agar sederhana. Kalau aplikasi mulai matang atau memuat konten eksternal, migrasikan ke `preload` + `contextIsolation: true`.
- Click-through: jendela default `setIgnoreMouseEvents(true, { forward: true })`. Saat kursor masuk elemen kucing, kirim IPC `set-ignore-mouse` dengan `false`. Saat keluar, kirim `true`.
- Tombol keluar darurat: **Ctrl+Shift+Q** (global shortcut). Alternatif: Ctrl+C di terminal.

---

## 4. Spesifikasi aset karakter

Kucing dirancang sebagai **bagian-bagian terpisah** agar bisa digerakkan dan dikustomisasi.

Ukuran dan gaya:
- Kanvas per aset: **32x32 atau 48x48 piksel**, latar transparan, format **PNG**.
- Palet kecil (sekitar 6-8 warna). Garis tepi konsisten.
- Referensi: foto kucing peliharaan pemilik (disimpan di `art/reference/`).

Daftar aset minimal:
1. **Badan duduk** (1 gambar) dan **badan tidur melingkar** (1 gambar)
2. **Bagian terpisah:** kepala, telinga, ekor (agar bisa diputar dari titik pivot)
3. **Mata:** normal, tertutup, senang, berpikir (3-4 versi, layer terpisah agar bisa digeser mengikuti kursor)
4. **Ikon efek:** hati, zzz, uap, (nanti: tetes air, gulungan tisu)
5. **Pola bulu** sebagai layer terpisah (belang, tuxedo, calico, dst), 1-2 dulu
6. Pose tambahan sesuai kebutuhan: kaki menekan keyboard, berdiri, terkejut. Siklus jalan paling sulit dibuat prosedural, jadi boleh disederhanakan (kucing meluncur, atau 2 frame bergantian)

Teknik kustomisasi warna (palette swap):
- Gambar badan dengan **warna penanda** murni (misalnya badan = magenta `#FF00FF`, pola = cyan `#00FFFF`).
- Saat program berjalan, warna penanda diganti dengan warna pilihan pengguna lewat Canvas (`getImageData` / `putImageData`).

Ekspor dari LibreSprite: layer atau bagian diekspor sebagai PNG terpisah (File > Export), disimpan di `assets/cat/...` sesuai struktur folder. File sumber `.aseprite`/`.lpx` disimpan di `art/source/`.

`assets/cat/rig.json` (masih kosong) akan menyimpan: posisi tiap bagian terhadap badan, dan titik pivot (ekor, telinga). Dengan begitu mengganti desain tidak perlu mengubah kode.

Efek yang dibuat lewat kode (tanpa digambar):
- Napas: scale badan 100% ke 103% perlahan
- Ekor goyang dan telinga berkedut: rotasi bagian dari pivot
- Kedip: ganti atau sembunyikan layer mata berkala
- Mata mengikuti kursor: geser layer pupil beberapa piksel
- Mochi: squash and stretch sesuai kecepatan drag
- Mode panas: tint merah + getar kecil
- Hati dan zzz: elemen yang naik pelan dan memudar (CSS animation)
- Agar tetap terasa pixel art: batasi rotasi ke sudut kecil atau gerak dalam langkah diskret

---

## 5. Phase pekerjaan dan status

| Phase | Isi | Status |
|---|---|---|
| 0 | Persiapan: Node, Git, VS Code, Electron, jendela "Hello" | **Selesai** (commit "Phase 0: setup awal") |
| 1 | Desain karakter di LibreSprite (aset sesuai bagian 4) | **Selesai (aset dasar)**; pose mengetik (click1/click2) sudah dibuat tetapi masih SATU GAMBAR UTUH, pemilik sedang memisahnya per komponen (lihat bagian 7 dan 8) |
| 2 | Jendela transparan, click-through, kotak placeholder oranye | **Selesai** (dicek pemilik, berjalan) |
| 3 | Rig dan animasi prosedural (napas, ekor, telinga, kedip, hati, zzz) | **Selesai**, berjalan baik; tidur melingkar lewat kode (kepala turun) |
| 4 | Otak kucing (state machine) + input global (`uiohook-napi`) | **Sebagian selesai**: input global, reaksi mengetik, tidur otomatis berjalan. State machine formal (`brain/`) belum, logikanya masih berupa flag di `pet.js` |
| 5 | Interaksi mouse (mata ikut kursor, mochi, elus, bermain dengan kursor, scroll) | **Sebagian selesai**: mata + kepala/badan kenyal ikut kursor, drag mochi, elus dan dengkur, scroll menggerakkan tangan, bermain dengan kursor (kursor digerakkan cepat di dekat kucing -> kucing menunduk, badan geol-geol, ekor kibas cepat; konstanta `PLAY_SPEED` dan `PLAY_RADIUS` di `pet.js`; bisa dimatikan di menu klik kanan, disimpan sebagai `hunt` di `settings.json`). Catatan: versi awal "mengejar kursor dengan memindahkan jendela" DIBATALKAN pemilik karena mengganggu dan menutupi layar; jangan dibuat lagi. Pose mengetik + frustrasi + memerah + lelah SUDAH ada kodenya (25 Okt 2026) tetapi aset pose ketik bermasalah, WAJIB diperbaiki dulu (bagian 7 dan 8). Belum: gulungan tisu |
| 6 | Pomodoro, pengingat peregangan/minum/pesan, catatan sematan, `electron-store` | **Sebagian selesai**: Pomodoro, pengingat peregangan dan minum, menu klik kanan, simpan pengaturan (JSON sendiri, bukan `electron-store`). Belum: pesan pengingat kustom, catatan sematan |
| 7 | Kustomisasi kucing (palette swap, pola, panel pengaturan + pratinjau) | **Selesai (dasar)**: panel kustomisasi, 5 preset, 4 warna, 4 pola prosedural, tersimpan. Belum: editor catatan dan pesan di panel |
| 8 | Polish: tray, auto-start Windows, multi-monitor, mode mengintip, cek CPU/RAM | Belum |
| 9 | Packaging dengan `electron-builder`, uji di komputer lain, README | Belum |

Kriteria selesai per phase:
- **Phase 3:** kucing diam tapi terasa hidup (napas, ekor, kedip terlihat).
- **Phase 4:** mengetik di aplikasi lain membuat kucing bereaksi; diam beberapa menit membuatnya tidur.
- **Phase 5:** semua interaksi mouse dasar responsif.
- **Phase 6:** pengaturan bertahan setelah aplikasi ditutup dan dibuka lagi.
- **Phase 7:** pemilik bisa membuat kucing yang mirip kucingnya sendiri.

Catatan: Phase 3 bisa dikerjakan dengan **placeholder** (kotak berwarna per bagian) kalau aset pemilik belum jadi, lalu diganti PNG asli begitu tersedia.

---

## 6. Struktur folder (tree)

Lokasi projek: `D:\Projects\cat-companion`

CATATAN: tree di bawah adalah RENCANA AWAL dan sebagian sudah usang (misalnya file `.ts` kosong di `src/renderer/pet` tidak dipakai). Struktur sebenarnya ada di bagian 7. Gunakan tree ini hanya sebagai gambaran umum.

```
cat-companion/
├── package.json                  # main: "main.js", script: "start": "electron ."
├── package-lock.json
├── main.js                       # PROSES UTAMA SAAT INI (akan dimigrasi ke src/main/main.ts)
├── tsconfig.json                 # kosong
├── electron-builder.yml          # kosong
├── .gitignore                    # node_modules/, dist/, release/, art/exports/
├── README.md                     # kosong
│
├── docs/
│   ├── roadmap.md                # kosong
│   └── art-guide.md              # kosong
│
├── art/                          # bahan mentah, TIDAK ikut dibundel
│   ├── reference/                # foto kucing pemilik
│   ├── source/                   # file .aseprite / .lpx
│   └── exports/                  # ekspor sementara (di-ignore Git)
│
├── assets/                       # aset yang ikut dibundel
│   ├── cat/
│   │   ├── body/                 # sit.png, sleep.png
│   │   ├── parts/                # head, ears, tail
│   │   ├── eyes/                 # normal, closed, happy, thinking
│   │   ├── patterns/             # tabby, tuxedo, dst
│   │   └── rig.json              # posisi bagian + titik pivot (kosong)
│   ├── effects/                  # heart, zzz, steam
│   ├── ui/                       # ikon tray, dst
│   └── sounds/                   # opsional
│
├── src/
│   ├── main/                     # proses utama Electron (semua file kosong)
│   │   ├── main.ts
│   │   ├── ipc.ts
│   │   ├── windows/
│   │   │   ├── petWindow.ts
│   │   │   └── panelWindow.ts
│   │   ├── input/
│   │   │   └── globalInput.ts    # uiohook, hanya hitung aktivitas
│   │   └── services/
│   │       ├── pomodoro.ts
│   │       ├── reminders.ts
│   │       ├── settingsStore.ts
│   │       ├── tray.ts
│   │       └── autoLaunch.ts
│   │
│   ├── preload/
│   │   └── preload.ts
│   │
│   ├── renderer/
│   │   ├── pet/                  # tampilan kucing
│   │   │   ├── index.html        # SUDAH ADA ISINYA (kotak oranye placeholder)
│   │   │   ├── main.ts
│   │   │   ├── core/
│   │   │   │   ├── gameLoop.ts
│   │   │   │   ├── rig.ts        # susunan layer + pivot
│   │   │   │   └── renderer.ts
│   │   │   ├── brain/
│   │   │   │   ├── stateMachine.ts
│   │   │   │   └── states/       # idle.ts, sleep.ts, typing.ts (tambah per perilaku)
│   │   │   ├── animation/
│   │   │   │   ├── procedural.ts     # napas, ekor, telinga, kedip
│   │   │   │   ├── squashStretch.ts  # efek mochi
│   │   │   │   ├── effects.ts        # hati, zzz, uap
│   │   │   │   └── easing.ts
│   │   │   └── customization/
│   │   │       ├── paletteSwap.ts
│   │   │       └── patterns.ts
│   │   │
│   │   └── panel/                # UI pengaturan
│   │       ├── index.html
│   │       ├── main.ts
│   │       ├── CatCustomizer.ts
│   │       ├── PomodoroSettings.ts
│   │       └── ReminderSettings.ts
│   │
│   └── shared/
│       ├── types.ts
│       └── constants.ts
│
├── dist/                         # hasil build (di-ignore)
└── release/                      # installer (di-ignore)
```

Aturan struktur:
- Satu file per state di `brain/states/`; menambah perilaku baru = tambah satu file.
- `art/` (mentah) dipisah dari `assets/` (dibundel).
- `node_modules/` ada di root (ter-ignore).

---

## 7. Keadaan kode saat ini

Lingkungan: Node `v22.17.1`, Git `2.54.0`, Electron `^45.0.0`, `uiohook-napi`, branch `master`. Cara jalan: `npm start`. Keluar: Ctrl+Shift+Q.

Sumber kebenaran adalah file di repo (snapshot kode tidak disalin ke sini agar tidak usang). Untuk melihat file, pakai perintah clipboard di bagian 2 aturan 13.

File yang aktif dipakai:
- `main.js` (root): jendela transparan 200x200 di pojok kanan bawah, click-through, global shortcut keluar, pembaca input global (`uIOhook`) yang mengirim event IPC `activity` dengan nilai `key`, `mouse`, `scroll`, atau `click`. Tidak ada isi ketikan yang dibaca.
- `src/renderer/pet/index.html`: panggung (`#stage`), CSS layer, animasi CSS gelembung.
- `src/renderer/pet/` dipecah jadi modul CommonJS (tanpa build). Semua variabel bersama ada di objek `S` (`state.js`), modul lain memakai `const S = require('./state')`:
  - `state.js`: konstanta pengaturan (`SLEEP_AFTER_MS`, `PLAY_SPEED`, `PLAY_RADIUS`, `LOVE_START_UP`, `SLEEP_HEAD_DROP`, `FOLLOW_HEAD`, `FOLLOW_BODY`, `FEET_X`, `FEET_Y`, `WIN`) dan semua variabel status. `FEET_X`/`FEET_Y` = titik telapak kaki di gambar: badan miring dan menunduk dari titik ini supaya kaki tampak menapak di lantai dan tidak melayang (aturan dari pemilik: kaki harus diam saat bermain, mengikuti kursor, melonjak; hanya saat di-drag boleh terangkat). Jangan menggeser badan secara horizontal; pakai rotasi dari kaki.
  - `actions.js`: `setSleep`, `spawnLove`, `updateHud`, `rand`.
  - `rig.js`: `buildRig` (muat gambar, susun layer, pivot, gelembung), `initLook` (terapkan warna/pola tersimpan dan dengarkan perubahan dari panel).
  - `input.js`: `initInput` (semua listener mouse/drag/klik kanan dan semua pesan IPC dari `main.js`, termasuk deteksi "bermain").
  - `animate.js`: `startLoop` (loop animasi: napas, tidur, bermain, elus/dengkur, kepala/badan kenyal, ekor, kuping, kedip, pupil, tangan, mochi).
  - `pet.js`: titik awal saja (`buildRig`, `initInput`, `initLook`, `startLoop`).
  - Menambah perilaku baru: tambahkan variabel di `state.js`, event di `input.js`, dan gerakannya di `animate.js`., titik pivot (ekor, kuping, gelembung), dan lokasi efek.

Aset yang sudah ada (PNG, kanvas penuh sama ukuran, latar transparan, semua bertumpuk di posisi 0,0):
- `assets/cat/body/badan.png`
- `assets/cat/parts/` : `ekor`, `kepala`, `kumis`, `kuping`, `tangan`
- `assets/cat/eyes/` : `mata`, `mata_tidur`, `pupil`
- `assets/effects/` : `love`, `gelembung`
- File sumber `.aseprite` ada di `art/source/`. Kucing berwarna hitam dengan garis tepi putih (belum memakai warna penanda untuk palette swap, ini baru dikerjakan di Phase 7).

Perilaku yang sudah jalan:
- Napas (kepala naik-turun 1 piksel), ekor goyang bertahap 5 derajat, kuping berkedut acak, kedip, pupil melirik kiri/kanan.
- Klik kucing: hati naik dari atas kepala (`LOVE_START_UP`).
- Mengetik di aplikasi mana pun: lihat bagian "Pose mengetik" di bawah (menggantikan gerakan tangan; layer `tangan` sekarang hanya bergerak saat scroll).
- Tidak ada aktivitas selama `SLEEP_AFTER_MS` (5 menit): tidur melingkar (kepala turun ke badan lewat `SLEEP_HEAD_DROP`, mata tidur, gelembung). Aktivitas keyboard, klik, atau scroll membangunkan. Gerak mouse saja tidak.
- Posisi hati dan gelembung bergantung pada posisi gambar di kanvas pemilik (keduanya diekspor di tengah kanvas, sehingga hati dipindah lewat kode). - Pola digambar lewat kode. Posisinya dihitung otomatis dari kotak pembatas piksel tiap layer (kepala dan badan punya titik tengah sendiri karena kucing sedikit serong); geser manual lewat `CX_HEAD` dan `CX_BODY` di `look.js`.

### Pose mengetik, mode panas, lelah (ditambahkan 25 Okt 2026; logika animasi bagus, ASET BERMASALAH)

Aset:
- `assets/cat/typing/click1.png` dan `click2.png`: dua pose ketik, kanvas 48x48, kucing + papan ketik dalam SATU GAMBAR UTUH (bukan layer terpisah). Kucing digambar lebih besar dari kucing idle (lebar sekitar 40 vs 40, kepala 27 vs 24 piksel; lantai disejajarkan lewat `TYPE_SHIFT_Y`).
- `assets/cat/eyes/mata_tertutup2.png`: mata tertutup (garis di y20-24), digambar pas di kepala pose click1, BUKAN kepala idle (mata idle di y12-15).
- `assets/effects/gelembung2.png` dan `gelembung4.png`: gelembung frustrasi 4x4 piksel (kanvas 48x48).

Kode:
- `state.js`: konstanta `TYPE_HOLD_MS`, `TYPE_SHIFT_Y`, `TFEET_X/Y`, `TAIL_PIVOT`, `TIRED_DX/DY`, `HEAT_KPS`, `HEAT_RISE_MS`, `HEAT_FALL_MS`, `FRUSTRATE_AT`, `HOT_MS`, `TIRED_MS`; data `typing`, `angryImgs`, `keyTimes`, `typeFrame`.
- `rig.js`: `buildTyping` (3 set pose: click1, click2, lelah; tiap set = papan ketik + badan + ekor, masing-masing punya versi merah) dan `applyLook` yang juga mewarnai pose ketik.
- `look.js`: `recolorTyping` (mewarnai pose ketik).
- `input.js`: event `key` mengisi `keyTimes` (hanya WAKTU, bukan tombol) dan membalik `typeFrame`.
- `animate.js`: blok "Mengetik cepat" dan "Pose mengetik".

Alur perilaku: ngetik pelan = pose click1/click2 bergantian per ketikan, badan turun tiap ketikan (`kick`), ekor berkibas (makin cepat ngetik makin cepat kibasan); ngetik ngebut terus-menerus (>= `HEAT_KPS` ketikan/detik) = gelembung frustrasi lalu memerah bertahap lalu bergetar (`HOT_MS`); lalu lelah (`TIRED_MS`): mata tertutup + gelembung, merah memudar; lalu normal.

MASALAH UTAMA (belum selesai): `recolorTyping` memotong gambar utuh click1/click2 memakai TEBAKAN koordinat (`isTail`, `isHead`, `tailLayer`, `findEyes`, `whiskerMask`). Akibatnya: pola badan bocor/tembus aneh, kumis berwarna badan, bintik hitam salah tempat di kuping dan ekor, dan kaki tampak di depan kepala. Kucing idle (yang sudah dipisah per komponen) tidak punya masalah ini. Pemilik marah karena upayanya memisah komponen tidak dihargai. JANGAN lanjutkan pendekatan memotong gambar utuh. Perbaikan warna merah (`warm()`: garis tepi jadi merah, badan gelap tetap gelap) dan perbaikan kumis sudah diberikan tetapi harus diuji ulang setelah layer terpisah tersedia.

Keputusan yang menyimpang dari rencana awal:
- Struktur rencana awal (`src/renderer/pet/core|brain|animation` dengan file TypeScript) TIDAK dipakai. Kode kucing dipecah jadi modul JavaScript datar di `src/renderer/pet/` (lihat daftar di atas). State machine formal (`brain/`) belum dibuat; status masih berupa flag di `state.js`.
- Tidur memakai kepala yang diturunkan lewat kode, bukan gambar pose melingkar. Pemilik boleh menggantinya dengan gambar sendiri nanti.

---

## 8. Langkah berikutnya untuk AI penerus

0. **PRIORITAS 1: perbaiki pose mengetik memakai layer terpisah** (baca dulu bagian 7 "Pose mengetik").
   - Kenyataan: aset click1/click2 saat ini SATU GAMBAR UTUH. Pemilik sedang memisah komponennya seperti kucing idle dan akan memberikan PNG terpisah. Urutan layer di LibreSprite dari atas ke bawah: PUPIL, MATA, KUMIS, KEPALA, KUPING, KAKI_KIRI, KAKI_KANAN, KEY_UNCLICKED, KEY_CLICKED, BADAN, EKOR. Nama file yang direncanakan (diawali `ketik_` di Downloads, lalu dipindah ke `assets/cat/typing/` tanpa awalan): `pupil`, `mata`, `kumis`, `kepala`, `kuping`, `kaki_kiri`, `kaki_kanan`, `key_unclicked`, `key_clicked`, `badan`, `ekor`. Kanvas 48x48, latar transparan.
   - JANGAN menebak atau memotong gambar utuh. Kalau file terpisah belum ada di `assets/cat/typing/`, minta pemilik memberi kabar dulu.
   - Setelah file ada: (a) minta dump piksel tiap file lewat clipboard (aturan 13 dan 14); (b) rakit pose ketik dari layer-layer itu seperti rig idle, dengan urutan tumpuk di atas (kaki di bawah kepala, bukan di depan), grup kepala dan badan, pivot ekor dan kuping; simpan di `rig.json` atau `rig-typing.json`; (c) pakai ulang `look.js` (`recolorAll`, `PATTERNS`) per layer TANPA heuristik koordinat; kumis, mata, pupil dan papan ketik tidak diwarnai ulang; (d) hapus `recolorTyping`, `isTail`, `isHead`, `tailLayer`, `findEyes`, `whiskerMask`, dan `buildTyping` versi lama.
   - Pertahankan animasi yang sudah dipuji pemilik: badan turun tiap ketikan (`kick`), ekor berkibas makin cepat saat ngetik makin cepat, merah bertahap, getar, lelah, gelembung. Tambahkan: kaki kiri dan kanan bergantian menekan, papan ketik ganti ke KEY_CLICKED sebentar.
   - Merah saat panas: hanya garis tepi yang memerah, badan hitam tetap hitam (jangan jadi warna kulit).
   - Mata lelah: `mata_tertutup2.png` digambar untuk posisi kepala pose ketik; posisikan ulang atau minta pemilik menggambar ulang.
   - Pemilik tidak puas dengan desain asetnya dan akan mengganti PNG. Kode harus tetap jalan bila PNG ditimpa dengan nama dan kanvas yang sama.

1. Kerjakan **Phase 5** (interaksi mouse): mata ikut kursor, drag dengan efek mochi (squash and stretch), elus kepala (hover lama lalu hati dan dengkur), berburu kursor saat mouse digerakkan cepat, reaksi scroll (gulungan tisu), mode panas saat mengetik sangat cepat. Event `mouse` dan `scroll` sudah dikirim dari `main.js`, tetapi posisi kursor global belum, jadi tambahkan data koordinat (hanya posisi, aman).
2. (Opsional) Migrasi ke TypeScript bila pemilik mau. Pemecahan modul sudah selesai.
3. (Sudah dikerjakan sebagian, lihat butir 0) Pose mengetik di keyboard.
4. Setelah tiap phase, perbarui tabel status bagian 5 dan bagian 7 ini, lalu beri perintah commit.

Kemungkinan masalah:
- `uiohook-napi` memakai modul native. Jika ada masalah setelah update Electron, jalankan `electron-rebuild` (jelaskan langkahnya dengan sederhana).
- Antivirus bisa curiga pada hook input global. Patuhi aturan privasi di bagian 3.
- Mode mengintip (Phase 8) butuh deteksi aplikasi fullscreen; tunda sampai akhir.