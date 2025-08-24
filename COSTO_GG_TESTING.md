# 🧪 Testing "Costo gg" - Documentazione

Documentazione completa per i test di validazione del calcolo automatico del "Costo gg" nel sistema V&P.

## 🎯 Obiettivo dei Test

Validare che il calcolo del "Costo gg" funzioni correttamente secondo le regole di business:
1. **Solo giornate "Campo"** contribuiscono al costo
2. **Priorità tariffe**: Specifiche progetto > Standard
3. **Validità temporale** delle tariffe
4. **Formattazione italiana** nella visualizzazione

## 📁 File di Test Disponibili

### **test_costo_gg_stefano_marzo2025.php**

**Scopo**: Test dettagliato del calcolo per un collaboratore specifico in un periodo determinato.

**Caratteristiche**:
- ✅ **Collaboratore**: Stefano Colombo
- ✅ **Periodo**: Marzo 2025
- ✅ **Filtro tipo**: Solo giornate di tipo "Campo"
- ✅ **Verifica API**: Confronto tra calcolo manuale e API
- ✅ **Formattazione italiana**: Numeri con virgola decimali e punto migliaia

**Output del Test**:
```
🔍 IMPORTANTE: Il calcolo del 'Costo gg' viene effettuato SOLO per giornate di tipo 'Campo'

📊 TARIFFE COLLABORATORE
ID_COLLABORATORE | Commessa | Tariffa gg | Validità
2               | NULL     | € 500,00   | Standard

📋 DETTAGLIO CALCOLI MARZO 2025
Data       | Giorni | Tipo  | Progetto | Tariffa Spec. | Tariffa Std. | Tariffa Usata | Costo gg
03/03/2025 | 1,0    | Campo | COM001   | -            | € 500,00     | € 500,00      | € 500,00
05/03/2025 | 0,5    | Campo | COM002   | -            | € 500,00     | € 500,00      | € 250,00

💰 RIEPILOGO FINALE
- Totale Giornate: 1,5
- Costo gg Totale: € 750,00
- Costo Medio per Giornata: € 500,00

✅ VERIFICA API
Risultato Query API: € 750,00
Risultato Calcolo Manuale: € 750,00
✅ I calcoli coincidono perfettamente!
```

**Come Eseguire**:
```bash
# Da browser
http://your-domain.com/test_costo_gg_stefano_marzo2025.php

# Da terminale
php test_costo_gg_stefano_marzo2025.php
```

## 🔧 Logica di Test Implementata

### **1. Verifica Collaboratore**
```php
// Cerca il collaboratore nel database
$sql_stefano = "SELECT ID_COLLABORATORE, Collaboratore, Email FROM ANA_COLLABORATORI 
                WHERE Collaboratore LIKE '%Stefano%' AND Collaboratore LIKE '%Colombo%'";
```

### **2. Analisi Tariffe**
```php
// Mostra tutte le tariffe disponibili per il collaboratore
$sql_tariffe = "SELECT tc.*, c.Commessa 
                FROM ANA_TARIFFE_COLLABORATORI tc
                LEFT JOIN ANA_COMMESSE c ON tc.ID_COMMESSA = c.ID_COMMESSA
                WHERE tc.ID_COLLABORATORE = ?
                ORDER BY tc.ID_COMMESSA ASC, tc.Dal DESC";
```

### **3. Calcolo Manuale**
```php
// Per ogni consuntivazione, applica la logica di selezione tariffa
foreach ($consuntivazioni as $cons) {
    if ($cons['Tipo'] === 'Campo') {  // SOLO tipo Campo
        // Cerca tariffa specifica progetto
        $tariffa_specifica = getTariffaSpecifica($collaboratore_id, $commessa_id, $data);
        
        // Fallback a tariffa standard
        $tariffa_standard = getTariffaStandard($collaboratore_id, $data);
        
        // Usa priorità: specifica > standard
        $tariffa_usata = $tariffa_specifica ?: $tariffa_standard;
        
        $costo_giornata = $cons['gg'] * $tariffa_usata;
        $totale_costo += $costo_giornata;
    }
}
```

### **4. Verifica API**
```php
// Confronta con il risultato dell'API ConsuntivazioneAPI.php
$sql_api_verifica = "SELECT SUM(...) as costo_gg_api 
                     FROM FACT_GIORNATE g 
                     WHERE g.Tipo = 'Campo' AND ...";

$differenza = abs($costo_api - $totale_costo);
if ($differenza < 0.01) {
    echo "✅ I calcoli coincidono perfettamente!";
} else {
    echo "❌ Differenza rilevata: € " . $differenza;
}
```

## 📊 Formattazione Italiana

### **Funzione Helper**
```php
/**
 * Formatta un numero in formato italiano (virgola per decimali, punto per migliaia)
 */
function formatItalianNumber($value) {
    return number_format($value, 2, ',', '.');
}
```

### **Utilizzo**
```php
// Visualizzazione: € 1.250,75
echo "€ " . formatItalianNumber(1250.75);

// Esportazione CSV: 1250,75 (solo virgola decimali)
echo number_format(1250.75, 2, ',', '');
```

## 🎯 Scenari di Test Raccomandati

### **Test Case 1: Giornate Solo Campo**
- Inserire consuntivazioni di tipo "Campo" e altri tipi
- Verificare che solo "Campo" contribuisca al costo
- **Risultato atteso**: Costo > 0 solo per "Campo"

### **Test Case 2: Tariffe Multiple**
- Collaboratore con tariffa standard (ID_COMMESSA = NULL)
- Progetto con tariffa specifica (ID_COMMESSA = valore)
- **Risultato atteso**: Usa tariffa specifica quando disponibile

### **Test Case 3: Validità Temporale**
- Tariffe con date di validità diverse
- Consuntivazioni in date diverse
- **Risultato atteso**: Usa tariffa valida alla data della giornata

### **Test Case 4: Formattazione**
- Verificare formato visualizzazione (1.250,75)
- Verificare formato CSV (1250,75)
- **Risultato atteso**: Formati corretti per italiano

## 🔍 Debugging e Troubleshooting

### **Problemi Comuni**

#### **Costo sempre 0**
1. Verificare che le giornate siano di tipo "Campo"
2. Controllare esistenza tariffe per il collaboratore
3. Verificare validità temporale delle tariffe

#### **Tariff non trovata**
1. Controllare campo ID_COLLABORATORE nelle tariffe
2. Verificare date di validità (Dal)
3. Assicurarsi che esista almeno una tariffa standard (ID_COMMESSA = NULL)

#### **Calcoli non coincidenti**
1. Verificare filtri identici tra test manuale e API
2. Controllare precision decimali nei calcoli
3. Verificare logica di selezione tariffe

### **Log e Debug**
```php
// Aggiungi debug nel test
echo "DEBUG: Collaboratore ID = " . $stefano['ID_COLLABORATORE'] . "\n";
echo "DEBUG: Consuntivazioni trovate = " . count($consuntivazioni) . "\n";
echo "DEBUG: Tariffe disponibili = " . count($tariffe) . "\n";

// Per ogni consuntivazione
echo "DEBUG: Tipo = {$cons['Tipo']}, Costo = {$costo_giornata}\n";
```

## 📋 Checklist Test Completo

- [ ] **Test eseguito con successo** senza errori PHP
- [ ] **Collaboratore trovato** nel database
- [ ] **Consuntivazioni trovate** per il periodo
- [ ] **Solo giornate "Campo"** hanno costo > 0
- [ ] **Tariffe caricate** correttamente
- [ ] **Calcolo manuale** vs **API match** (differenza < 0.01€)
- [ ] **Formattazione italiana** corretta
- [ ] **Totali coerenti** tra dettaglio e riepilogo

## 🚀 Estensioni Future dei Test

### **Test Automatizzati**
- Script PHPUnit per test automatici
- Test di regressione per ogni release
- Integrazione CI/CD per validation continua

### **Test Performance**
- Benchmark calcoli con grandi volumi di dati
- Ottimizzazione query per migliori performance
- Stress test con migliaia di consuntivazioni

### **Test Edge Cases**
- Giornate parziali (0.1, 0.5, ecc.)
- Tariffe con date sovrapposte
- Collaboratori senza tariffe
- Progetti senza tariffe specifiche

---

**Versione**: 1.0.0  
**Data Creazione**: Agosto 2025  
**Ultima Modifica**: Agosto 2025  
**Autore**: Sistema di test V&P