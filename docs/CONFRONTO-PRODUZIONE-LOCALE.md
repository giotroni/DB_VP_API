# Confronto fra produzione e locale — metodo e risultati

*16/08/2026*

Serve a rispondere a una domanda che torna a ogni rilascio: **quanto cambiano i numeri di
Management quando le modifiche locali andranno in produzione, e perché.** Il confronto non
si fa più a occhio fra due schermate: il backup di produzione viene caricato in un database
separato e i totali si ricalcolano sugli stessi dati con le due regole.

## Come si riproduce

Il backup notturno in `DB/Backup/` **è** la produzione. Caricarlo accanto al database locale,
nello stesso container:

```bash
docker exec vp_db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -e "CREATE DATABASE prod_260815"'
docker cp DB/Backup/260815_vaglioty_DB_VP.sql vp_db:/tmp/prod.sql
docker exec vp_db sh -c 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" prod_260815 < /tmp/prod.sql'
```

Da lì si calcolano i totali di testata in tre scenari, replicando in SQL le formule del
front-end:

| Scenario | Dati | Regole | A cosa serve |
|---|---|---|---|
| 1 | backup | produzione | riprodurre la schermata di `vaglioandpartners.com` |
| 2 | locale | produzione | isolare l'effetto delle correzioni fatte a mano in locale |
| 3 | locale | locale | riprodurre la schermata di `127.0.0.1:8081` |

**Controllo di aderenza**: valore totale e costo accounting degli scenari 1 e 3 devono
coincidere al centesimo con le due schermate. Se non coincidono, la replica delle formule è
sbagliata e i numeri non valgono.

Gli script (query e generatore Excel) stanno nello scratchpad di sessione; il risultato è
`docs/scostamenti-produzione-locale.xlsx`, **non versionato** perché contiene i dati veri.

## I numeri al 16/08/2026

| | Produzione | Locale | Δ |
|---|---:|---:|---:|
| Valore totale | 650.778,29 | 653.000,79 | +2.222,50 |
| Costo totale attività | 431.325,79 | 429.243,39 | −2.082,40 |
| Costo accounting | 163.222,44 | 163.222,44 | 0 |
| Margine | 56.230,06 | 60.534,96 | **+4.304,90** |

Da cosa nasce:

- **+2.222,50** sul ricavo spese: diaria per giornata invece che una volta per task, più i
  regimi rivisti a mano in locale (44 task con vitto/alloggio portato a *compreso*).
- **−2.822,40** sul costo spese: esborso reale invece del prezzo di vendita.
- **+740,00** sul costo, che **non** dipende dalle regole: due giornate su `TAS00104` avevano
  `Desk = Si` nel backup e `No` in locale, il che le rende addebitabili (2 × 370 €).

Il maturato giornate non cambia: le regole nuove non toccano né il valore giornate né il
monitoraggio, e infatti giornate di campo (383,8) e costo accounting coincidono.

## La trappola: la stessa regola scritta più volte

Ogni scostamento inspiegabile trovato finora nasce dallo stesso motivo — la medesima regola
implementata in più punti, con esiti divergenti. Prima di dare per buono un confronto,
verificare **quale copia** alimenta la schermata che si sta guardando.

**Spese.** In produzione convivono tre formule: `GiornateAPI` applica la diaria a ogni
giornata (ed è quella che le schede sommano), `TaskAPI::calcolaValoreSpese` la conta una
volta per task, `CommesseAPI::computeMaturatoForCommessa` una volta per mese. Accorparle in
`CalcoloSpese` è stato lo scopo del lavoro di agosto.

**Monitoraggio.** Stessa storia, trovata il 16/08 in due copie e corretta:

- `CommesseAPI::computeMaturatoForCommessa` sommava le percentuali di *tutti* i task di
  monitoraggio applicandole a ogni mese, ignorando le finestre temporali. Su CASALE CREMASCO
  dava 9.145 invece di 4.572,50. L'endpoint `?action=maturato` non è chiamato da nessuna
  pagina, quindi il difetto non era visibile.
- La testata di Management calcolava il **costo** del monitoraggio come valore campo ×
  percentuale per ogni task, mentre il **ricavo** dello stesso monitoraggio lo prendeva
  corretto dal server: 5.352,50 € di costo in più, tutti sottratti al margine, in entrambi
  gli ambienti (CASALE CREMASCO 4.572,50, AMBROSI 620, LINDT CapiTurno 2026 160).

La regola sui task di monitoraggio, confermata dall'utente il 16/08: **in ogni momento ne
esiste al massimo uno attivo**; più task sulla stessa commessa sono ammessi se le finestre
sono disgiunte, tipicamente quando il coordinamento passa di mano. `TaskAPI` la fa già
rispettare in scrittura, sia in creazione sia in modifica.

## Difetto aperto: la diaria senza giornate

`TaskAPI::calcolaValoreSpese` restituisce la diaria appena è valorizzata sul task, senza
verificare che esistano giornate:

```php
if ($speseStandard > 0) {
    return $speseStandard;   // non guarda le giornate
}
```

La funzione gemella per il valore giornate fa il contrario (`if (empty($giornate)) return 0`).
Il risultato è che tre commesse mai partite espongono ricavo spese: PORCARI Seconda Fase
2.960 €, CERTOSA Seconda Fase 150 €, MELZO Prima Fase 210 €. Con le regole nuove il problema
non si pone (la diaria si moltiplica per le giornate, quindi zero), ma finché la produzione
non è allineata il dato resta esposto.
