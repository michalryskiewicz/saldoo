# Synchronizacja Danych z Google Drive

## Jak działa synchronizacja timestampów

### Aktualizacja `lastUpdated`

Timestamp `lastUpdated` w tabeli `meta` jest aktualizowany **automatycznie** przy każdej operacji modyfikującej dane:

#### 1. Dodawanie danych
```typescript
// expenses.ts, profits.ts, transactions.ts, duty.ts
await db.expenses.add({ ... });
await setLastUpdated(); // ✅ Timestamp aktualizowany
await googleDriveSync.exportToDrive();
```

#### 2. Aktualizacja danych
```typescript
await db.expenses.update(id, { ... });
await setLastUpdated(); // ✅ Timestamp aktualizowany
await googleDriveSync.exportToDrive();
```

#### 3. Usuwanie danych
```typescript
await db.expenses.delete(id);
await setLastUpdated(); // ✅ Timestamp aktualizowany
await googleDriveSync.exportToDrive();
```

### Import danych

Gdy importujesz dane z Google Drive, timestamp `lastUpdated` jest **automatycznie przywracany** jako część importowanych danych:

```typescript
const dbBlob = new Blob([clearContent], { type: 'application/json' });
await importInto(db, dbBlob, { overwriteValues: true });
// ✅ Tabela 'meta' (wraz z lastUpdated) jest częścią importu
```

**Ważne:** `importInto` z biblioteki `dexie-export-import` importuje **wszystkie tabele**, włącznie z tabelą `meta`, więc nie trzeba ręcznie aktualizować timestamp po imporcie.

## Logika synchronizacji

Metoda `syncNewestDB()` działa według następujących priorytetów:

### 1. Lokalna baza pusta, zdalna ma dane
```typescript
if (isCurrentDBEmpty && remoteLastModified > 0) {
  await this.importFromDrive(); // IMPORT
}
```

### 2. Lokalna baza ma dane, zdalna pusta
```typescript
if (!isCurrentDBEmpty && remoteLastModified === -1) {
  await this.exportToDrive(); // EXPORT
}
```

### 3. Obie bazy puste
```typescript
if (isCurrentDBEmpty && remoteLastModified === -1) {
  // BRAK AKCJI
}
```

### 4. Porównanie timestampów
```typescript
if (remoteLastModified > localLastModified) {
  await this.importFromDrive(); // IMPORT - zdalna nowsza
} else if (localLastModified > remoteLastModified) {
  await this.exportToDrive(); // EXPORT - lokalna nowsza
} else {
  // BRAK AKCJI - zsynchronizowane
}
```

## Scenariusze użycia

### Scenariusz 1: Nowy użytkownik
1. **Urządzenie A (pierwszy raz):**
   - `localLastModified = -1`
   - `remoteLastModified = -1`
   - **Akcja:** Brak (obie bazy puste)

2. **Użytkownik dodaje expense:**
   - `setLastUpdated()` → `localLastModified = 1732800000000`
   - `exportToDrive()` → zapisuje w Drive

3. **Urządzenie B (pierwszy raz):**
   - `localLastModified = -1`
   - `remoteLastModified = 1732800000000`
   - **Akcja:** Import z Drive
   - Po imporcie: `localLastModified = 1732800000000` ✅

### Scenariusz 2: Synchronizacja między urządzeniami
1. **Urządzenie B modyfikuje dane:**
   - `setLastUpdated()` → `localLastModified = 1732810000000`
   - `exportToDrive()` → zapisuje w Drive

2. **Urządzenie A (powrót):**
   - `localLastModified = 1732800000000`
   - `remoteLastModified = 1732810000000`
   - **Akcja:** Import z Drive (zdalna nowsza)
   - Po imporcie: `localLastModified = 1732810000000` ✅

## Debugowanie

Aby zobaczyć logi synchronizacji, otwórz konsolę przeglądarki. Zobaczysz:

```
Sync check: {
  localLastModified: 1732800000000,
  remoteLastModified: 1732810000000,
  isCurrentDBEmpty: false
}
Import From Drive (remote is newer)
Database imported from Google Drive
```

## Bezpieczeństwo

- Wszystkie dane są **szyfrowane** przed wysłaniem do Google Drive
- Używamy AES-GCM z kluczem derywowanym z PBKDF2
- Każde szyfrowanie używa losowego salt i IV
- Hasło szyfrujące jest przechowywane w profilu użytkownika

## Potencjalne problemy

### Problem: Oba urządzenia eksportują zamiast importować
**Przyczyna:** `getRemoteLastModified()` nie deszyfruje pliku przed parsowaniem
**Rozwiązanie:** ✅ Naprawione - teraz plik jest deszyfrowany przed parsowaniem

### Problem: Nieskończona pętla importu/eksportu
**Przyczyna:** Timestamp nie jest aktualizowany po operacjach
**Rozwiązanie:** ✅ Każda operacja (add/update/delete) wywołuje `setLastUpdated()`

### Problem: Timestamp nie jest zachowany po imporcie
**Przyczyna:** `importInto` nie importuje tabeli meta
**Rozwiązanie:** ✅ `importInto` importuje **wszystkie** tabele, w tym meta

