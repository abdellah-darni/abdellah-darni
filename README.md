# Abdellah Darni

I build the layer that decides whether a server recovers on its own at 2 a.m. or someone has to drive in and fix it. Most of my work is backend services and the bare-metal Linux infrastructure they run on, with regular detours into the systems-level C underneath.

I write up the debugging rabbit holes I fall into, mostly so future-me remembers how I got out, at [blog.darni.org](https://blog.darni.org).

📫 [LinkedIn](https://www.linkedin.com/in/darni-abdellah/)

---

### Featured Engineering

* **[DeepDame](https://github.com/sefault-dev/DeepDame)**: Real-time multiplayer checkers. I architected the game backend: a framework-free stateless engine, Redis-backed live state with atomic per-move updates, an LLM AI opponent with graceful fallback to a legal random move, and a STOMP/WebSocket layer validated to ~6,000 concurrent sessions via k6 on k3s. I then led the Flutter client with a feature-folder architecture using Riverpod, Freezed, GoRouter, Dio cookie-auth, and STOMP-over-SockJS. Shipped to production as a single-node Docker deployment.

* **[ToDoist](https://github.com/abdellah-darni/ToDoist)**: A terminal task manager written in C. Multi-panel ncurses interface using the menu, form, and panel libraries, with a non-blocking input loop, a live clock, and terminal-resize handling. SQLite storage through the C API: multi-statement writes wrapped in transactions with rollback on error, UUID primary keys (libuuid), a tasks/tags many-to-many schema with foreign keys, and soft deletes. Makefile with release, debug, AddressSanitizer, Valgrind, and gdb/lldb crash-report targets; builds on Linux and macOS, with a GitHub Actions build check.

* **[Homelab](https://github.com/abdellah-darni/home-lab)**: A Proxmox host serving my self-hosted stack as version-controlled Docker Compose behind a single Traefik v3 reverse proxy. Dual-provider routing pairs Docker label discovery with a watched file provider that brings non-Docker backends (Proxmox, a Jellyfin LXC) under the same TLS and middleware. Wildcard TLS via the Cloudflare DNS-01 challenge, a middleware chain enforcing LAN/Tailscale-only access with hardened security headers, and per-container capability drops and resource limits. Remote access over a Tailscale mesh, with a subnet-router LXC alongside per-VM clients. Writeup on the [blog](https://blog.darni.org/blog/architecting-modular-home-lab).


### Latest posts

<!-- BLOG-CARDS:START -->
<!-- BLOG-CARDS:END -->


### Stack

[![My stack](https://skillicons.dev/icons?i=java,spring,c,postgres,mongodb,redis,docker,kubernetes,linux,bash)](https://skillicons.dev)

`Traefik` · `Proxmox` · `Tailscale` · `CI/CD`
