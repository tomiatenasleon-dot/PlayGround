# PlayGround

<!-- omgithub:readme:start -->
## 🚀 Build, play, and remix with OMGithub

**Created using [OMGithub.com](https://go.ondev.store/).**

[![OMGithub](https://img.shields.io/badge/OMGithub-Open%20project-orange?style=for-the-badge)](https://go.ondev.store/tomiatenasleon-dot/PlayGround)
[![GitHub](https://img.shields.io/badge/GitHub-Source-181717?logo=github&style=for-the-badge)](https://github.com/tomiatenasleon-dot/PlayGround)

- 🎮 [Open the project](https://go.ondev.store/tomiatenasleon-dot/PlayGround).
- ✨ [Remix this project](https://go.ondev.store/tomiatenasleon-dot/PlayGround?remix=1).
- 💻 [Explore the source](https://github.com/tomiatenasleon-dot/PlayGround).
- 🛠️ [Check build runs](https://github.com/tomiatenasleon-dot/PlayGround/actions).
- 🐛 [Report an issue](https://github.com/tomiatenasleon-dot/PlayGround/issues).
- 👤 [Explore the creator's projects](https://go.ondev.store/tomiatenasleon-dot).
- 🌍 [Create with OMGithub](https://go.ondev.store/).
<!-- omgithub:readme:end -->

## BUSCADOS · 3D

Juego de acción 3D en navegador con Three.js. Ejecuta `npm install` y `npm start`; abre `http://localhost:3002`. Controles: WASD para moverte, Shift para correr, Espacio para saltar y E para interactuar. En el capítulo 3, F permite entrar o salir del coche.

### Multijugador online (hasta 4 personas)

El servidor integrado de `server.js` sirve el juego y las salas WebSocket. Para jugar en la misma red, ejecuta `npm start` en un equipo y abre `http://IP_DEL_SERVIDOR:3002` desde los dispositivos de tus amigos. Para jugar desde Internet, despliega este proyecto en un host Node.js con conexiones WebSocket habilitadas; configura `PORT` si el proveedor asigna otro puerto y permite ese puerto en el firewall. Todos deben abrir la misma URL pública, pulsar **JUGAR ONLINE** y el anfitrión debe crear una sala; comparte el código para que los demás se unan. Las salas son efímeras y se eliminan al desconectarse el último jugador.

> El prototipo incluye capítulos jugables, persecución y sincronización de posición en tiempo real. La historia posterior al tercer objetivo queda preparada para ampliarse; no incluye todavía cuentas persistentes, chat, guardado ni matchmaking.
