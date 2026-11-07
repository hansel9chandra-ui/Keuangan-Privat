# Keuanganku (dengan password)

Aplikasi pencatat keuangan untuk mahasiswa. HTML + CSS + JavaScript murni, tanpa server. Data disimpan di browser dan **dienkripsi** dengan password Anda.

## Fitur
- 3 kategori bawaan: Uang Makan, Uang Jajan, Uang Kuliah
- Tambah, edit, hapus kategori dan transaksi
- Anggaran per kategori, ringkasan bulanan, grafik, pencarian dan filter
- Ekspor/impor cadangan JSON, ekspor CSV
- **Layar password di awal**, tombol **Kunci**, kunci otomatis setelah 5 menit tidak aktif, dan **Ganti password**

## Cara kerja keamanan
- Saat pertama dibuka, Anda membuat password (minimal 6 karakter, makin panjang makin aman). Di HP, keyboard angka otomatis muncul di kolom password, jadi PIN angka 6 sampai 8 digit paling mudah dipakai.
- Data dienkripsi di perangkat dengan AES-256-GCM. Kuncinya diturunkan dari password (PBKDF2, 250.000 iterasi). Password tidak pernah disimpan.
- Jika sebelumnya Anda sudah punya data di versi tanpa password (di alamat dan browser yang sama), data itu otomatis diamankan saat Anda membuat password, lalu salinan yang tidak terenkripsi dihapus.

## Batasan yang perlu diketahui
- **Lupa password = data tidak bisa dipulihkan.** Satu-satunya jalan adalah memakai "Lupa password?" (menghapus data) lalu **Impor cadangan**. Karena itu buat cadangan secara berkala.
- File cadangan JSON dan CSV **tidak** dienkripsi. Simpan di tempat aman.
- Password melindungi data yang tersimpan. Perangkat yang terinfeksi malware atau keylogger tetap berisiko.
- Data dan password berlaku per browser dan per perangkat (HP dan laptop tidak saling terhubung).
- Kode aplikasi di GitHub bersifat publik, tetapi datanya tidak ada di GitHub.
- Enkripsi memerlukan `https` atau `localhost` (GitHub Pages sudah https).

## Memperbarui versi di GitHub
Ganti file `index.html`, `style.css`, `app.js`, dan `README.md` di repository dengan versi ini (tab Code → Add file → Upload files, lalu Commit). Tunggu 1-3 menit, lalu muat ulang halaman (Ctrl+F5).

## Struktur
```
index.html   Kerangka halaman
style.css    Tampilan
app.js       Logika aplikasi, enkripsi, dan kunci
```
