# O Gabinete do Escrivão — protótipo

Protótipo jogável do capítulo piloto de um jogo educativo sobre Bitcoin.
O jogador investiga como o selo do Escrivão foi adivinhado e cria um segredo
que resista: aprende, errando, por que uma chave segura nasce do acaso.

Roda direto no navegador do celular, em retrato, sem instalar nada.
Toque no chão para andar e nos objetos para investigar. O progresso fica
salvo apenas no próprio aparelho.

**Aviso:** as 12 palavras geradas no jogo são de demonstração. Nunca as use
numa carteira de verdade.

## Arquivos

- `index.html` e `game.js`: o jogo.
- `vendor/three.min.js`: biblioteca three.js r128 (licença MIT, ver `vendor/THREE-LICENSE.txt`).
- `data/palavras.js`: lista oficial de palavras em português da BIP-39
  (repositório bitcoin/bips, `bip-0039/portuguese.txt`).
