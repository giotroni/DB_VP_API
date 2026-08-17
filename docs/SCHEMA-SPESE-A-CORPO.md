# Spese pattuite a corpo — schema proposto

*17/08/2026 — proposta, non ancora implementata*

Completa `docs/REGOLE-SPESE.md`, che descrive i regimi in vigore. Qui c'è solo ciò che
cambierebbe.

## 1. Il problema

L'ordine Lavazza `1020201558` (COM0007 LAVAZZA SETTIMO) ha **due righe**:

```
10  GIORNATE                        7 G  × 1.650,00 = 11.550,00
20  SPESE DI VITTO E ALLOGGIO       1 UR × 1.000,00 =  1.000,00
```

`1 UR` è quantità uno: un importo **a corpo**, non legato alle giornate. La fattura 13/25
ricalca la stessa struttura. Il gestionale non sa rappresentarlo: i mille euro non stanno da
nessuna parte, e la commessa risulta con 11.550,00 di maturato contro 12.550,00 fatturati.

Oggi una categoria di spesa può essere **compresa**, **a diaria giornaliera** o **a costi
reali**. Manca *a corpo*.

## 2. Perché non un task di tipo «Spese»

È l'alternativa più immediata, e ha un precedente: `Monitoraggio` è già un task che non è
un'attività. La scarto per tre motivi.

- **Inventa un'attività che nessuno consuntiva.** Il maturato nasce dalle giornate; un task
  senza giornate che vale 1.000 € è un importo contrattuale travestito da consuntivo.
- **Darebbe a `Valore_gg` un terzo significato.** Oggi ne ha già due — prezzo/giornata sui
  task normali, percentuale sui Monitoraggio. È lo stesso meccanismo che ha reso ambigui per
  settimane i 370 € di Porcari e i 500 € di EMU.
- **Produrrebbe ricavo su commesse mai partite.** È il difetto già aperto su
  `calcolaValoreSpese`, e **42 task su 118 non hanno nessuna giornata**.

Il forfait non è un'attività: è un **regime di spesa**, il quarto accanto a quelli esistenti.

## 3. Lo schema

Il regime oggi è **implicito**: «diaria a zero significa costi reali». Quell'implicito è
esattamente ciò che ha reso indistinguibile un forfait una tantum da una tariffa a trasferta.
La proposta lo rende dichiarato.

```sql
ALTER TABLE ANA_TASK
    ADD COLUMN Regime_Spese_Viaggi
        ENUM('Compreso','Diaria','Corpo','Reali') NOT NULL DEFAULT 'Reali'
        AFTER Spese_Comprese_Vitto_Alloggio,
    ADD COLUMN Valore_Spese_Viaggi DECIMAL(10,2) DEFAULT NULL
        AFTER Regime_Spese_Viaggi,
    ADD COLUMN Regime_Spese_Vitto_Alloggio
        ENUM('Compreso','Diaria','Corpo','Reali') NOT NULL DEFAULT 'Reali'
        AFTER Valore_Spese_Viaggi,
    ADD COLUMN Valore_Spese_Vitto_Alloggio DECIMAL(10,2) DEFAULT NULL
        AFTER Regime_Spese_Vitto_Alloggio;
```

Una coppia per categoria: il **regime** dice come si legge l'**importo**. `Valore_Spese_X`
resta `NULL` quando il regime è `Compreso` o `Reali`, così non sopravvive un numero orfano
pronto a riemergere — è già la regola che `TaskAPI` applica alle diarie.

I campi attuali (`Spese_Comprese_X`, `Valore_Spese_std_X`) **restano in tabella e nessun
codice li legge più**, come si è fatto ad agosto con `Spese_Comprese` e `Valore_Spese_std`.
Si rimuovono tutti e quattro con una migration separata, a verifica avvenuta in produzione.

### La migrazione dei dati

```sql
UPDATE ANA_TASK SET
  Regime_Spese_Viaggi = CASE
      WHEN Spese_Comprese_Viaggi = 'Si'                  THEN 'Compreso'
      WHEN COALESCE(Valore_Spese_std_Viaggi, 0) > 0      THEN 'Diaria'
      ELSE 'Reali' END,
  Valore_Spese_Viaggi = CASE
      WHEN Spese_Comprese_Viaggi <> 'Si'
       AND COALESCE(Valore_Spese_std_Viaggi, 0) > 0      THEN Valore_Spese_std_Viaggi
      ELSE NULL END,
  Regime_Spese_Vitto_Alloggio = CASE
      WHEN Spese_Comprese_Vitto_Alloggio = 'Si'          THEN 'Compreso'
      WHEN COALESCE(Valore_Spese_std_Vitto_Alloggio,0)>0 THEN 'Diaria'
      ELSE 'Reali' END,
  Valore_Spese_Vitto_Alloggio = CASE
      WHEN Spese_Comprese_Vitto_Alloggio <> 'Si'
       AND COALESCE(Valore_Spese_std_Vitto_Alloggio,0)>0 THEN Valore_Spese_std_Vitto_Alloggio
      ELSE NULL END;
```

Nessun task nasce `Corpo`: il regime non è deducibile dai dati, va dichiarato. Oggi il solo
caso accertato è Lavazza Settimo.

```sql
UPDATE ANA_TASK
   SET Regime_Spese_Vitto_Alloggio = 'Corpo',
       Valore_Spese_Vitto_Alloggio = 1000.00
 WHERE ID_TASK = 'TAS00022';   -- LAVAZZA SETTIMO FORMAZIONE, ordine 1020201558 riga 20
```

**Conteggi attesi dopo la migration** — se non tornano, la conversione è sbagliata:

| Regime | Viaggi | Vitto/alloggio |
|---|---:|---:|
| `Compreso` | 38 | 82 |
| `Diaria` | 44 | 0 |
| `Corpo` | 0 | **1** |
| `Reali` | 36 | 35 |

## 4. Le regole di calcolo

Tutto dentro `CalcoloSpese`, che resta l'unico posto dove le regole vivono.

| Regime | Ricavo della categoria |
|---|---|
| `Compreso` | **0** — è già dentro il valore giornata |
| `Diaria` | importo **×** numero di giornate addebitabili; per i viaggi contano solo quelle con `Viaggio = 'Si'` |
| `Corpo` | l'importo, **una volta sola sul task**, se esiste almeno una giornata addebitabile; altrimenti **0** |
| `Reali` | somma degli esborsi effettivi delle giornate addebitabili |

Le prime due, la quarta e la nozione di «giornata addebitabile» sono invariate: la migration
non cambia un centesimo su nessun task esistente. Cambia solo TAS00022, e solo perché glielo
diciamo esplicitamente.

### Quando il forfait diventa maturato

**Alla prima giornata addebitabile del task, in una volta sola.** Non prima.

Legare il riconoscimento a una giornata consuntivata evita il difetto che già esiste — ricavo
esposto su commesse mai partite — ed è lo stesso innesco che usa la diaria. L'alternativa
naturale, il pro-rata su `gg_previste`, la scarto: `gg_previste` è compilato su 75 task su
118, quindi darebbe risultati che dipendono da quanto è curata l'anagrafica invece che dal
contratto.

## 5. Il vincolo che decide l'implementazione

`GiornateAPI` calcola il ricavo spese **per singola giornata** (`Valore_spese_viaggi`,
`Valore_spese_vitto`) e il front-end lo somma; `TaskAPI` e `CommesseAPI` lo calcolano
**aggregato per task**. Le due strade devono dare lo stesso numero: oggi lo fanno
(15.497,04 € per entrambe), ed è il risultato del lavoro di agosto sulle formule duplicate.

Un importo per-task non è divisibile per giornata, quindi va **imputato a una giornata
precisa**: la **prima addebitabile del task** — `Data` minima, a parità di data `ID_GIORNATA`
minimo, così è deterministico. Per la categoria viaggi, la prima con `Viaggio = 'Si'`.

Conseguenza concreta: `ricavoViaggiGiornata()` e `ricavoVittoGiornata()` non possono più
decidere guardando solo la giornata, hanno bisogno di sapere **se questa è la prima**. Va
quindi passato un flag calcolato da chi legge l'insieme delle giornate del task. È il costo
implementativo principale della proposta, e va fatto bene: è esattamente il punto dove
nascono le formule divergenti.

A schermo il forfait comparirà tutto su una giornata sola. È voluto e va detto
nell'interfaccia, altrimenti sembra un errore di battitura.

## 6. Cosa cambia nei numeri

| | Prima | Dopo |
|---|---:|---:|
| COM0007 maturato | 11.550,00 | **12.550,00** |
| COM0007 differenza col fatturato | 1.000,00 | **0,00** |
| Ricavo spese, totale | 15.497,04 | 16.497,04 |
| Valore totale | 653.000,79 | 654.000,79 |
| Margine | 60.534,96 | 61.534,96 |

Il costo non cambia: su quel task non è registrato nessun esborso. Il margine sale di mille
euro perché è ricavo che finora non era contabilizzato da nessuna parte, non perché sia stato
speso meno.

Nessun'altra commessa si muove.

## 7. Cosa questo non risolve

**Il valore contrattuale resta da mettere sull'ordine.** L'ordine Lavazza ha due righe e il
gestionale dovrà rispecchiarle: è la fase 4 di `PROGETTO-COMMESSE-ORDINI.md`. Il forfait sul
task risponde a «quanto abbiamo maturato», la riga d'ordine a «quanto è stato ordinato». Sono
due domande diverse e vanno tenute separate.

**Non serve a far quadrare una percentuale.** Resta valida la decisione del 16/08: le spese si
leggono su una riga propria dell'avanzamento, senza denominatore e senza percentuale.

**Porcari ed EMU non sono casi di questo tipo.** Sembravano forfait censiti male e non lo
sono: i 370 € di Porcari sono una tariffa **a trasferta** (l'offerta dice «1 × 370 €/viaggio»)
e i 500 € di EMU si comportano allo stesso modo. Con i flag `Viaggio` corretti tornano già
senza toccare nulla.

## 8. Rilascio

Va **dentro la fase 1** del progetto commesse-ordini, quando la migration di struttura si
scrive comunque: è una modifica di schema che non cambia comportamento, tranne il singolo task
dichiarato a corpo.

Da verificare prima del rilascio:

1. i conteggi per regime del § 3;
2. che il ricavo spese totale sia **16.497,04** e che la somma **per giornata** coincida con
   quella **per task** — è l'invariante del § 5;
3. che le altre 44 commesse non si muovano di un centesimo;
4. che un task a corpo **senza giornate** esponga ricavo **zero**.
