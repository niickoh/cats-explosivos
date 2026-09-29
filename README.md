# Gatitos Explosivos Web

Primera version multijugador para jugar en navegadores conectados a la misma red local.

## Reglas modeladas

La base sigue el flujo oficial: cada turno puedes jugar cartas o robar para terminar el turno; si robas un Gatito Explosivo quedas fuera salvo que tengas Desactivacion; al desactivar, reinsertas el gatito en cualquier posicion del mazo. Tambien incluye cartas base como Ataque, Saltar, Favor, Mezclar y Ver el Futuro.

Reglas ajustadas en esta version:

- El mazo base usa `cantidad de jugadores - 1` Gatitos Explosivos.
- Cada jugador empieza con una Desactivacion y entra solo 1 Desactivacion extra al mazo.
- Al iniciar, cada jugador recibe 8 cartas en total: 1 Desactivacion y 7 cartas del mazo.
- El mazo base usa 5 Va a ser que NO, 5 Ver el Futuro, 4 Mezclar, 4 Favor, 4 Saltar, 4 Atacar y 20 cartas de gatos sin reglas.
- Los Ataques son acumulables: si respondes a un Ataque con otro Ataque, pasas tus turnos pendientes y sumas 2 al siguiente jugador.
- Si un jugador con turnos acumulados roba un Gatito Explosivo y lo desactiva, sus turnos pendientes se cancelan al esconder el gatito y el juego continua con el siguiente jugador.
- Los pares funcionan con cualquier dos cartas del mismo icono. Al jugarlos, eliges una carta boca abajo de la mano del jugador objetivo.
- El boton Mezclar mano reordena tu mano localmente.
- Puedes alternar la vista de la mano entre abanico, fila y tabla.
- La mesa usa un estilo poker: mazo y descarte al centro, jugadores alrededor y sus manos representadas como abanicos de reversos.
- El boton rojo Va a ser que NO esta junto a la mesa: se ilumina si tienes la carta y pulsa cuando puede jugarse.
- No puedes jugar Va a ser que NO sobre tu propia jugada.
- El boton Va a ser que NO es circular, con relieve y usa `nope.png` como icono.
- La pantalla de inicio usa `portada final.jpg` y ubica el formulario de nombre/sala a la derecha en escritorio.
- El fondo visual de la mesa usa `portada.png`.
- Los modales de seleccion de cartas muestran manos grandes con scroll horizontal para que todas las cartas sean accesibles.
- La animacion de Mezclar muestra varias cartas cruzandose sobre el mazo.
- El juego usa todo el ancho de la pantalla y la mesa ahora es una superficie dinamica, no una mesa ovalada de poker.
- En pantallas pequenas, los jugadores se muestran en una franja desplazable para que los nombres y manos no se corten.
- La interfaz se adapta para jugar desde navegador movil.
- El boton Retirarse descarta toda la mano del jugador y lo deja fuera de la partida.
- Al cambiar el turno, cada navegador muestra una alerta: al jugador activo le indica que es su turno y al resto les indica a quien le toca.
- El combo de 3 cartas identicas permite nombrar una carta y pedirla a otro jugador.
- El combo de 5 cartas diferentes permite recuperar una carta de la pila de descarte.
- Para el combo de 5 diferentes, el jugador elige manualmente las 5 cartas que quiere usar desde un abanico.
- Cuando se resuelve Mezclar, el mazo muestra una animacion de mezcla.
- Va a ser que NO se puede jugar fuera de turno durante la ventana de respuesta de una accion cancelable. Cada NO alterna el resultado: impar cancela, par permite que la accion siga.
- Antes de entrar a la sala puedes marcar una o mas expansiones para sumarlas al mazo. La sala conserva esa seleccion para iniciar la partida.
- Las cartas usan los disenos de `diseño de cartas y reglas/img/cartas`.
- El Gatito Implosivo no se puede cancelar ni desactivar. La primera vez que aparece se muestra con animacion y el jugador debe esconderlo boca arriba en cualquier posicion del mazo.
- El Gatito Implosivo queda boca arriba internamente en el mazo, pero no se muestra asomado en la mesa.
- Con Imploding Kittens, el Gatito Implosivo se cuenta como una forma de morir: Imploding + Exploding = jugadores - 1.
- Con Streaking Kittens, se vuelve a introducir el Gatito Implosivo y se agregan suficientes Gatitos Explosivos para que Imploding + Exploding = jugadores.
- Si un jugador con Gatito Fugitivo roba un Gatito Explosivo, lo guarda en la mano sin publicar la jugada en el historial.
- Si un Gatito Explosivo se entrega o roba desde una mano, el receptor explota. Si alguien pierde su Gatito Fugitivo mientras conserva un Gatito Explosivo, tambien explota.
- Streaking Kittens incorpora Streaking Kitten x1, Bomba Gatomica x1, Marca x3, Maldicion del Culo de Gato x2, Super Salto x1, Ver el Futuro x5 x1, Alterar el Futuro x5 x1, Intercambiar Superior e Inferior x3 y Recogida de Basura x1.
- Marca permite seleccionar desde un abanico una carta del objetivo y deja esa carta visible en la mano de mesa y en el abanico de robo hasta que salga de la mano.
- Maldicion del Culo de Gato deja la mano ciega: el jugador ve reversos y, al jugar, el servidor elige una carta real al azar.
- Streaking Kitten y Gatito Explosivo no pueden usarse en el combo de 5 distintas ni recuperarse del descarte.

Para una primera version ya hay cartas de expansiones basadas en los archivos `.md` locales: Gatito Implosivo, Gatito Fugitivo, Alterar el Futuro, Robar del Fondo, Marcha Atras, Super Salto, Ataque Dirigido y Gato Salvaje. Las expansiones mas complejas se agregan de forma conservadora con cartas ya soportadas por la logica actual.

Fuentes consultadas:

- Reglas oficiales base: https://www.explodingkittens.com/pages/rules-kittens
- Guia oficial de cartas y expansiones: https://www.explodingkittens.com/pages/comprehensive-field-guide
- Expansion Imploding Kittens: https://www.explodingkittens.com/pages/rules-imploding-kittens
- Listado oficial de expansiones: https://www.explodingkittens.com/collections/exploding-kittens-expansions

## Ejecutar en VS Code

1. Abre esta carpeta en Visual Studio Code.
2. Abre la terminal integrada.
3. Instala dependencias:

```bash
npm install
```

4. Inicia el servidor:

```bash
npm start
```

5. En tu navegador abre:

```text
http://localhost:3000
```

## Publicar en una red local

Cuando ejecutes `npm start`, la terminal mostrara una linea parecida a:

```text
Red local: http://192.168.1.35:3000
```

Comparte esa direccion con tus amigos. Todos deben estar conectados a la misma red Wi-Fi/LAN y entrar con el mismo codigo de sala.

Si Windows pregunta por permisos de firewall para Node.js, permite el acceso en redes privadas. Si no pueden entrar, revisa que la red sea privada y que el puerto `3000` no este bloqueado.

## Notas de esta primera version

- Soporta de 2 a 6 jugadores con las cantidades actuales del mazo.
- Con Imploding el maximo sube a 6; con Streaking suma 1 jugador mas.
- El chat es en vivo dentro de la sala.
- Las manos son privadas; el servidor mantiene el estado real de la partida.
- La Desactivacion abre un control para esconder el Gatito Explosivo en cualquier posicion del mazo.
- Las cartas, la portada, el reverso y el icono de Va a ser que NO usan imagenes locales de `diseño de cartas y reglas`.
- El mazo usa la imagen real del reverso de las cartas.
- Ver el Futuro muestra las 3 cartas superiores como abanico con sus imagenes.
- Las cartas gato sin instrucciones se generan usando los nombres e imagenes disponibles en la carpeta de cartas gato.
- Al robar una carta, el jugador ve una animacion privada; si roba un Gatito Explosivo, se muestra una animacion de explosion.
- Cuando recibes una carta por Favor o robo a otro jugador, se muestra una animacion privada revelando la carta recibida.
- Algunas cartas avanzadas de expansiones con efectos especiales completos quedan para iteraciones siguientes.
