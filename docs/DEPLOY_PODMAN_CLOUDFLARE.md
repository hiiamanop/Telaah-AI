# Go Live: Podman + Cloudflare Tunnel

Panduan singkat menjalankan Telaah 360 di PC ini sebagai container Podman yang mudah di-start/stop, lalu diekspos lewat domain `hiiamanop.my.id` memakai Cloudflare Tunnel.

## Arsitektur

```text
Internet
  └─ Cloudflare (hiiamanop.my.id)
       └─ Cloudflare Tunnel (cloudflared)
            └─ Podman pod: telaah-pod
                 ├─ telaah-app  (Next.js, localhost:3000)
                 └─ telaah-tunnel (cloudflared)
```

Container app dan tunnel berada dalam satu Podman pod, jadi cloudflared cukup memanggil `http://localhost:3000`. Tidak perlu membuka port 80/443 atau memasang Nginx/SSL.

## Prasyarat

- Podman terpasang (`podman --version`).
- `.env` berisi `OPENROUTER_API_KEY`.
- Domain sudah ditambahkan sebagai **Public Hostname** di tunnel Cloudflare dengan service:
  ```text
  http://localhost:3000
  ```

## 1. Isi token tunnel

Di dashboard Cloudflare: **Zero Trust / Networks → Tunnels → pilih tunnel → Install connector → copy token**.

Tambahkan ke `.env` (jangan kirim token ke chat):

```env
TUNNEL_TOKEN=eyJ...
```

`TUNNEL_TOKEN` hanya dibaca oleh container cloudflared. File `.env` sudah di-ignore git.

## 2. Build dan jalankan

```bash
cd /home/ahmad/workspace/Telaah-AI
./deploy/podman/up.sh
```

Perintah ini:
- build image `telaah-ai:local` jika belum ada;
- membuat pod `telaah-pod`;
- menjalankan `telaah-app` dengan `.env`;
- menjalankan `telaah-tunnel` jika `TUNNEL_TOKEN` terisi.

Kalau app sudah berjalan dan kamu baru mengisi token, cukup tambahkan connector tanpa rebuild:

```bash
./deploy/podman/tunnel.sh
```

Cek status:

```bash
./deploy/podman/status.sh
```

## 3. Start / stop sehari-hari

```bash
./deploy/podman/start.sh    # start pod yang sudah ada
./deploy/podman/stop.sh     # stop pod (container tetap ada)
./deploy/podman/status.sh   # status + cek HTTP lokal/domain
./deploy/podman/logs.sh     # log app
./deploy/podman/logs.sh tunnel
```

Untuk rebuild setelah kode berubah:

```bash
REBUILD=1 ./deploy/podman/up.sh
```

## 4. Tes

```bash
curl -I http://127.0.0.1:3000
curl -I https://hiiamanop.my.id
curl -s http://127.0.0.1:3000/api/market-overview | head
```

Kalau domain masih `525`:
- pastikan container `telaah-tunnel` berjalan (`./deploy/podman/status.sh`);
- pastikan public hostname tunnel memakai `http://localhost:3000`, bukan `https://`;
- cek DNS `hiiamanop.my.id` sudah proxied ke tunnel, bukan A record ke IP rumah.

## 5. Catatan

- PC harus menyala dan Podman berjalan selama aplikasi dipakai.
- Qdrant/Redis tidak wajib. Tanpa Qdrant, semantic cache dilewati; tanpa Redis, cache memori lokal dipakai.
- `data/` di-mount ke container, jadi `data/market_cache.json` dan registry broker tetap tersedia.
- Jangan commit `.env` atau token tunnel.
