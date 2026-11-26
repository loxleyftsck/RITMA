# RITMA Mobile Visual Polish

## Goal

Buat pengalaman mobile LUNARA terasa lebih hidup dan mudah dipindai, dengan ikon yang menunjukkan fungsi atau emosi, Dashboard yang menempatkan informasi utama dan check-in lebih awal, serta hierarki visual yang konsisten dari Welcome sampai Profil. Pertahankan identitas LUNARA, alur yang sudah berjalan, dan tampilan berdasarkan data pengguna yang tercatat.

Status **diterapkan dan diverifikasi di preview lokal**. MV-01 sampai MV-07 selesai untuk lingkup web responsif. [Lembar review ikon](MOBILE_ICON_REVIEW.png) · [Hasil QA](QA_REPORT.md#mobile-visual-polish)

## Inventaris pekerjaan aset

### Buat baru · 6 aset

| File yang dibuat | Spesifikasi | Penggunaan |
| --- | --- | --- |
| `icons/mood-radiant.svg` | SVG, viewBox 24 × 24 | Senyum terbuka dan ekspresi cerah. Dashboard dan Mood Tracker. |
| `icons/mood-calm.svg` | SVG, viewBox 24 × 24 | Mata rileks dan senyum tipis. Dashboard dan Mood Tracker. |
| `icons/mood-tender.svg` | SVG, viewBox 24 × 24 | Ekspresi lembut yang bentuknya berbeda dari Calm. Dashboard dan Mood Tracker. |
| `icons/mood-tired.svg` | SVG, viewBox 24 × 24 | Kelopak turun atau mata terpejam. Dashboard dan Mood Tracker. |
| `icons/mood-low.svg` | SVG, viewBox 24 × 24 | Ekspresi lesu dengan mulut menurun lembut. Dashboard dan Mood Tracker. |
| `icons/ai-care-emblem.svg` | SVG, viewBox 32 × 32 | Emblem asisten yang mengambil elemen dari bulan sabit atau kelopak LUNARA. Dipakai di percakapan dan keadaan awal AI Care. |

Gunakan bentuk dan ekspresi yang terbaca pada ukuran kecil. Pertahankan label mood yang sudah ada. Warna peach, rose, dan lilac bisa membantu membedakan opsi. Warna, bingkai, dan ketebalan garis untuk keadaan terpilih dikelola oleh komponen.

### Rapikan aset yang sudah ada · 5 ikon navigasi

| Ikon | Pekerjaan |
| --- | --- |
| Home | Seimbangkan proporsi rumah dan bobot garis. |
| Cycle | Perjelas siluet ritme siklus agar bedanya dengan indikator muat mudah dikenali. |
| Insights | Samakan ukuran optis ikon grafik dengan ikon lain. |
| AI Care | Selaraskan ikon tab dengan emblem percakapan pada ukuran yang lebih kecil. |
| Profile | Samakan radius dan bobot outline profil dengan keluarga ikon lain. |

Gunakan sistem ikon yang sudah ada di `src/components.js`. Uji keadaan aktif dan nonaktif dengan label tetap terlihat. Tinjau ikon kalender, pengaturan, privasi, ekspor, dan panah pada saat integrasi agar ketebalan garis dan posisi konsisten.

### Pakai ulang dan evaluasi crop

- `editorial/welcome-portrait.webp` untuk Welcome dan `editorial/hero-fabric.webp` untuk hero pendukung.
- `editorial/floral-study.webp` dan `backgrounds/blush-mauve-veil.webp` untuk aksen ringan di sekitar ring Dashboard dan transisi antarbagian.
- Empat ilustrasi di `onboarding/`, empat ilustrasi fase di `cycle/`, gambar artikel di `wellness/`, dan ilustrasi keadaan kosong di `empty-states/`.
- Logo, emblem merek, dan app icon LUNARA yang sudah tercatat di manifest. Profil tetap bisa memakai inisial akun.

Evaluasi raster selesai untuk preview ini. Wajah dan teks Welcome terbaca dengan potret yang ada. Dashboard menggunakan kembali floral study dengan crop kecil dan mask. Dua kandidat raster baru tidak diperlukan untuk hasil yang diuji.

## Backlog

| Prioritas | Task | Hasil yang diperiksa |
| --- | --- | --- |
| P0 | **MV-01 · Desain paket ikon.** Buat enam aset baru, rapikan lima ikon navigasi, dan susun lembar review dalam ukuran pakai aslinya. | Ikon mood bisa dibedakan lewat bentuk, label terbaca, dan keadaan aktif jelas. |
| P0 | **MV-02 · Polish Dashboard mobile.** Tata sapaan, ring, estimasi, dan check-in agar ring tetap dominan dan mood rutin terlihat lebih awal. | Satu fokus utama, ritme vertikal lebih ringkas, label estimasi terlihat, serta keadaan tanpa riwayat dan consent dijeda tetap jelas. |
| P1 | **MV-03 · Polish Cycle dan Mood.** Perjelas tiga penanda kalender, rapikan Log Period, dan gunakan ikon mood yang sama di kedua layar. | Hari ini, tanggal tercatat, dan estimasi dapat dibedakan tanpa mengandalkan warna saja. Pencatatan dan dialog tetap bisa dipakai. |
| P1 | **MV-04 · Polish Insights dan Health Report.** Beri satu grafik atau ringkasan utama, lalu rincian dan akses ekspor. | Grafik mengambil titik yang benar-benar tercatat. Ring laporan menampilkan metrik yang tersedia, dan PDF serta CSV tetap bisa diunduh. |
| P1 | **MV-05 · Polish AI Care.** Terapkan emblem, rapikan balon pengguna dan asisten, dan dekatkan saran pertanyaan dengan kolom input. | Sumber dan izin penggunaan ringkasan riwayat mudah ditemukan. Balasan, kondisi awal, dan kesalahan tetap bisa dibedakan. |
| P2 | **MV-06 · Polish Welcome, Onboarding, Library, dan Profil.** Review crop, pertahankan satu pesan per langkah, tonjolkan artikel unggulan, serta rapikan baris menu profil. | Tombol mudah dijangkau, teks legibel di atas foto, pencarian dan tautan artikel bekerja, serta menu akun bisa dipindai cepat. |
| P2 | **MV-07 · Uji visual dan interaksi.** Review perbandingan sebelum dan sesudah, cek state kosong dan error, lalu dokumentasikan aset yang disetujui. | QA mencatat layar yang benar-benar diuji, hasil `npm test`, serta daftar aset dan keputusan review. |

MV-01 dan MV-02 ditinjau sebagai satu putaran. Ekspresi Tender diperhalus setelah render ukuran kecil, lalu ikon dan hierarki diterapkan pada layar lain. Gerak tambahan merupakan opsi untuk putaran berikutnya. Transisi kontrol yang ada menghormati reduced motion.

## Kriteria selesai

- Ikon mood dan navigasi terbaca pada lebar 320 dan 390 px. Kontrol utama punya target sentuh yang memadai dan konten tetap dapat dijangkau di atas tab bar.
- Sapaan, ring, dan estimasi menjadi hierarki awal Dashboard. Check-in lebih mudah terlihat pada viewport yang sama. Keadaan kosong dan consent dijeda tetap jelas.
- Forecast ditandai sebagai estimasi. Tanggal fase, masa subur, persentase kesehatan, dan tren personal hanya ditampilkan bila tersedia metode dan data yang mendukungnya. Gunakan hitungan atau catatan aktual sebagai ringkasan saat ini.
- Alur login, logging, laporan, dan privasi lolos regresi. Uji layout desktop sebagai pembanding. Verifikasi perangkat fisik dicatat terpisah bila tersedia.
- Berkas yang benar-benar dibuat dan diterapkan tercantum di manifest dan lembar review, dengan jalur lokal, penggunaan, dan status aktual.
