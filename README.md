# SmartQ&A — Interactive Audience Question & Answer System

**SmartQ&A** adalah sistem tanya jawab interaktif berbasis web secara *real-time* yang dirancang untuk kegiatan seminar, workshop, kuliah umum, dan presentasi. Dilengkapi dengan fitur **Random Question Drawing (Mesin Undian Pertanyaan Acak)** beranimasi siap proyektor, **Live Voting**, **Manajemen Multi-Sesi**, dan **QR Code Generator**.

---

## Fitur Utama

1. **Participant Question Submission (`#/participant`)**
   - Akses langsung melalui **QR Code** tanpa registrasi/login.
   - Kirim pertanyaan menggunakan nama asli atau sebagai **Peserta Anonim**.
   - Validasi input lengkap (anti-kosong, batas karakter 350, anti-spam cooldown, deteksi duplikat).
   - Melihat pertanyaan yang sedang dipilih/dibahas pemateri secara *live*.
2. **Real-Time Question Dashboard (`#/admin/dashboard`)**
   - Pemantauan pertanyaan masuk secara *real-time* tanpa refresh halaman.
   - Statistik langsung: **Total Pertanyaan**, **Pending**, **Selected**, dan **Answered**.
   - Moderasi manual: **Pilih Pertanyaan**, **Tandai Dijawab**, **Lewati (Skip)**, dan **Hapus**.
3. **Random Question Drawing System (`#/admin/draw`)**
   - Mode layar penuh proyektor dengan kontras tinggi (`#0F172A`, `#2563EB`, `#06B6D4`).
   - Pemilihan acak kriptografis (`crypto.getRandomValues`) khusus pertanyaan berstatus **Pending**.
   - Penguncian transaksi (`runTransaction`) agar tidak terjadi pemilihan ganda jika dashboard dibuka di lebih dari satu perangkat.
   - Animasi *slot-machine shuffle* (~3.8 detik), *countdown visual* (3-2-1), efek *Winner Glow*, dan *Sound Effects* (Web Audio API).
4. **Live Audience Voting**
   - Satu peserta hanya dapat memberikan 1 vote untuk setiap pertanyaan.
   - Pengurutan pertanyaan berdasarkan **Terbaru** atau **Vote Terbanyak**.
5. **QR Code Generator**
   - Pembuatan QR Code otomatis mengikuti URL aplikasi dan kode sesi aktif.
   - Unduh poster QR Code dalam format **PNG** siap tampil di slide presentasi.
6. **Session Management (`#/admin/sessions`) & History (`#/admin/history`)**
   - Kelola banyak sesi kegiatan (Seminar, Workshop, Kuliah Umum).
   - Export rekap pertanyaan dan riwayat pengundian ke format **CSV**.

---

## Cara Menjalankan di Lokal (Windows PowerShell)

Cukup jalankan file pintasan berikut di terminal PowerShell Anda:

```powershell
.\start.bat
```

Atau menggunakan perintah `npm`:

```powershell
$env:PATH = "C:\Users\Lenovo\AppData\Local\nvm\v20.19.6;" + $env:PATH
npm run dev
```

Untuk melakukan *production build*:

```powershell
$env:PATH = "C:\Users\Lenovo\AppData\Local\nvm\v20.19.6;" + $env:PATH
npm run build
```

---

## Panduan Konfigurasi Firebase (Spark Plan Gratis)

1. Buka [Firebase Console](https://console.firebase.google.com/) dan klik **Create a project**.
2. Masuk ke menu **Build > Realtime Database**, klik **Create Database**, pilih lokasi server (misal: *Singapore `asia-southeast1`*), dan mulai dalam **Test mode** (kemudian terapkan aturan dari file `database.rules.json`).
3. Masuk ke menu **Build > Authentication**, klik **Get started**, lalu aktifkan metode Sign-in **Email/Password**.
4. Masuk ke **Project Settings (ikon roda gigi) > General**, gulir ke bawah ke bagian **Your apps**, pilih ikon **Web (`</>`)**, daftarkan aplikasi, dan salin kredensial `firebaseConfig`.
5. Anda dapat memasukkan kredensial tersebut melalui:
   - Tombol **"Real-Time Sync / Firebase Cloud"** di pojok kanan atas aplikasi SmartQ&A, **ATAU**
   - Menyalin file `.env.example` menjadi `.env` dan mengisi nilai `VITE_FIREBASE_*`.

