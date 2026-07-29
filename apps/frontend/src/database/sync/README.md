# Synchronizacja danych z Google Drive

## Model bezpieczeństwa

**Serwer Saldoo nie przechowuje żadnych danych użytkownika ani żadnego klucza.**
Wszystko, co jest potrzebne do odczytania danych, leży na Google Drive użytkownika
albo w jego głowie.

Szyfrowanie jest kopertowe (envelope encryption), tak jak w LUKS, `age` czy
Bitwardenie:

- **DEK** (Data Encryption Key) — losowy klucz 256-bit, szyfruje eksport bazy Dexie
  (AES-GCM, świeży IV przy każdym zapisie). Nigdy nie opuszcza przeglądarki w
  jawnej postaci.
- **Keysloty** — DEK zaszyfrowany osobno pod każdą metodą odblokowania. Trafiają na
  Drive jako `saldoo-keys.json`, obok danych. Każdy slot jest bezużyteczny bez
  sekretu, którego na Drive **nie ma**.

Sloty tworzone przy zakładaniu vaulta:

| Slot | KDF | Rola |
|---|---|---|
| `recovery-code` | PBKDF2-SHA256, 100k | 128 bitów entropii, pokazany raz, korzeń zaufania |
| `passphrase` | PBKDF2-SHA256, 600k | hasło użytkownika, do codziennego użytku |

Format keyfile'a jest wersjonowany i rozszerzalny — dodanie slotu `passkey-prf`
(WebAuthn PRF) to **przepakowanie DEK, bez ponownego szyfrowania danych**.

Konsekwencja, o której trzeba pamiętać przy pisaniu copy: Google i każdy, kto wejdzie
na konto Google użytkownika, ma szyfrogram, ale **nie ma** hasła ani kodu awaryjnego.
Utrata hasła **i** kodu awaryjnego oznacza bezpowrotną utratę danych.

## Pliki na Drive

Oba w folderze `saldoo` (scope `drive.file`, więc aplikacja widzi wyłącznie własne pliki):

- `saldoo-data.json` — `EncryptedPayload` (`formatVersion`, `iv`, `ciphertext`)
- `saldoo-keys.json` — `Keyfile` (`formatVersion`, `keyslots[]`)

## Cykl życia vaulta

`VaultManager` (`@/crypto/vault-manager.ts`) rozstrzyga stan przy starcie aplikacji.
**Keyfile na Drive jest jedynym źródłem prawdy** o tym, czy vault istnieje — sam
zacache'owany DEK nigdy nie wystarcza.

| Keyfile | DEK w cache | Stan |
|---|---|---|
| brak | — | `needs-setup` (cache jest czyszczony) |
| jest | brak | `locked` |
| jest | jest | `unlocked` |

DEK jest cache'owany per urządzenie w **osobnej** bazie Dexie `saldoo-vault`.
Świadomie nie w tabeli `meta` bazy aplikacji: `exportDB` serializuje każdą tabelę,
którą dostanie, więc klucz obok danych aplikacji wylądowałby w backupie na Drive.

`VaultGate` (`@/features/vault/vault-gate.tsx`) stoi przed `DataSyncWrapper` i nie
przepuszcza nic dalej, dopóki DEK nie jest dostępny.

## Aktualizacja `lastUpdated`

Timestamp w tabeli `meta` jest aktualizowany przy każdej operacji modyfikującej dane:

```typescript
// expenses.ts, profits.ts, transactions.ts, duty.ts, tags.ts
await db.expenses.add({ ... });
await setLastUpdated();
await vaultDriveSync.exportToDrive();
```

Przy imporcie timestamp wraca automatycznie — `importInto` z `dexie-export-import`
importuje **wszystkie** tabele, w tym `meta`.

## Logika synchronizacji

Decyzja jest czystą funkcją: `decideSync()` w `sync-decision.service.ts`
(przetestowana w `__tests__/sync-decision.service.test.ts`).

| Stan lokalny | Stan zdalny | Decyzja |
|---|---|---|
| pusty | ma dane | `import` |
| ma dane | brak timestampu | `export` |
| pusty | brak timestampu | `none` |
| — | nowszy niż lokalny | `import` |
| nowszy niż zdalny | — | `export` |
| równe | równe | `none` |

Pustka jest sprawdzana **przed** timestampami celowo: świeże urządzenie nie ma
sensownego `localLastModified`, więc porównanie kazałoby mu wyeksportować nic na
dobrą kopię zdalną.

`syncNewestDB()` czyta i odszyfrowuje plik z Drive **dokładnie raz**, a potem działa
na wyniku.

## Zabezpieczenia przed utratą danych

Sześć reguł, których nie wolno rozluźnić — każda ma test:

1. **Uszkodzony keyfile rzuca `CorruptKeyfileError`, nigdy nie udaje „brak vaulta".**
   Gdyby udawał, aplikacja zaproponowałaby założenie nowego vaulta i odcięła dane
   starym kluczem.
2. **Pusty keyfile to też `CorruptKeyfileError`.** Jedynym dowodem na „vaulta nigdy
   nie było" jest plik, którego w folderze **nie ma** — `readFile()` zwraca wtedy
   `null`. Plik, który istnieje i nic nie mówi, to niedokończony zapis.
3. **Czytanie niczego nie tworzy.** Wcześniej `getOrCreateFileIdInSaldooFolder()`
   zakładał plik już przy odczycie; gdy zapis, który miał po nim nastąpić, nie
   doszedł, na Drive zostawał 0-bajtowy keyfile — czyli dokładnie reguła 2.
4. **Przy duplikatach nazw wygrywa najnowszy niepusty plik** (`selectDriveFile`).
   Drive dopuszcza wiele plików o tej samej nazwie i nie obiecuje kolejności, więc
   `files[0]` to rzut monetą, w którym jedna strona kasuje backup.
5. **Backup, którego nie da się odczytać, nigdy nie jest nadpisywany.** Zły DEK przy
   aktualnym formacie → `RemoteDecryptionError`. Plik **bez** `formatVersion`
   (sprzed vaulta) albo bajty, których nie da się sparsować → `UnreadableBackupError`
   i ekran z instrukcją zmiany nazwy. Kopie sprzed vaulta były zamykane kluczem
   trzymanym przez serwer, którego już nie ma — migracji nie ma jak zrobić, więc plik
   zostaje nietknięty.
6. **`exportToDrive()` odmawia nadpisania backupu pustą bazą.**

## Token do Drive

Jeden token Google na wszystko — ten sam OAuth client i ta sama zgoda co przy
logowaniu. `DriveTokenService` (`@/auth/google/drive-token.service.ts`) odnawia go
po cichu przez Google Identity Services (`prompt: ''`), trzymając go w pamięci i w
`sessionStorage` (nie w cookie: nigdy nie leci z requestem, ginie z zakładką).

`GoogleDriveButton` jest **wyłącznie fallbackiem** na wypadek, gdy Google odmówi
cichego odnowienia.

## Debugowanie

`syncNewestDB()` zwraca podjętą decyzję (`'import' | 'export' | 'none'`), więc w
testach i w konsoli widać wynik bez czytania logów.
